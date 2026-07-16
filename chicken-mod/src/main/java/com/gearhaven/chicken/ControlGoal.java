package com.gearhaven.chicken;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.EnumSet;
import java.util.List;

/**
 * Drives the admin-chicken based on its {@link Directive}. It can walk to /
 * follow / go to entities, peck ANY living target (players and mobs), guard a
 * player from hostiles, dig a hole, and roam. If a target is far, it first
 * "blinks" close then walks the rest and strikes — so it visibly arrives and
 * really acts rather than doing things at range.
 */
public class ControlGoal extends Goal {
    private static final double ATTACK_REACH = 2.2D;    // blocks
    private static final double BLINK_IF_FARTHER = 24.0D;
    private static final int ATTACK_COOLDOWN = 12;      // ticks between pecks
    private static final float PECK_DAMAGE = 4.0F;
    private static final int MAX_DIG_DEPTH = 5;
    private static final int DIG_COOLDOWN = 8;

    private final AdminChicken chicken;
    private int attackCd = 0;

    // dig state
    private Directive.Type lastType = Directive.Type.IDLE;
    private BlockPos digAnchor = null;
    private int digDepth = 0;
    private boolean digDone = false;

    // wander state
    private int wanderCd = 0;

    public ControlGoal(AdminChicken chicken) {
        this.chicken = chicken;
        this.setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK));
    }

    @Override public boolean canUse() { return true; }
    @Override public boolean canContinueToUse() { return true; }
    @Override public boolean isInterruptable() { return false; }

    private LivingEntity target() {
        Directive d = chicken.directive;
        if (d.target == null) return null;
        if (!(chicken.level() instanceof ServerLevel sl)) return null;
        Entity e = sl.getEntity(d.target);
        return (e instanceof LivingEntity le && le.isAlive()) ? le : null;
    }

    @Override
    public void tick() {
        if (attackCd > 0) attackCd--;

        Directive d = chicken.directive;
        if (d.type != lastType) {
            onEnter(d.type);
            lastType = d.type;
        }

        // Nobody online: keep the chicken parked at world spawn so it stays in
        // loaded chunks (and doesn't strand itself far away, unloaded).
        if (chicken.level().players().isEmpty()) {
            parkAtSpawn();
            return;
        }

        switch (d.type) {
            case DIG -> doDig();
            case WANDER -> doWander(12.0);
            case GUARD -> doGuard();
            case IDLE -> doWander(6.0);            // mill about gently — feels alive
            default -> doGoToEntity(d.type);       // COME / FOLLOW / GOTO / ATTACK
        }
    }

    private void onEnter(Directive.Type t) {
        chicken.getNavigation().stop();
        wanderCd = 0;
        if (t == Directive.Type.DIG) {
            digAnchor = chicken.blockPosition();
            digDepth = 0;
            digDone = false;
        }
    }

    // --- go to / follow / attack an entity ---
    private void doGoToEntity(Directive.Type type) {
        LivingEntity p = target();
        if (p == null) {
            chicken.getNavigation().stop();
            // target gone (e.g. mob killed) — drop back to milling about
            if (type == Directive.Type.ATTACK) chicken.directive.idle();
            return;
        }

        chicken.getLookControl().setLookAt(p, 30.0F, 30.0F);
        double distSqr = chicken.distanceToSqr(p);

        if (distSqr > BLINK_IF_FARTHER * BLINK_IF_FARTHER) {
            blinkNear(p);
            return;
        }

        double speed = type == Directive.Type.ATTACK ? 1.5D : 1.25D;
        chicken.getNavigation().moveTo(p, speed);

        if (type == Directive.Type.ATTACK && distSqr <= ATTACK_REACH * ATTACK_REACH) {
            peck(p);
        }
        if (type == Directive.Type.COME && distSqr <= 4.0D) {
            chicken.getNavigation().stop();
        }
    }

    // --- guard a player: peck the nearest hostile mob near them ---
    private void doGuard() {
        LivingEntity guarded = target();
        if (guarded == null) {
            doWander(6.0);
            return;
        }
        LivingEntity foe = nearestHostile(guarded, 14.0);
        if (foe == null) {
            // no threats — hang around the guarded player
            chicken.getLookControl().setLookAt(guarded, 30.0F, 30.0F);
            if (chicken.distanceToSqr(guarded) > 9.0D) {
                if (chicken.distanceToSqr(guarded) > BLINK_IF_FARTHER * BLINK_IF_FARTHER) blinkNear(guarded);
                else chicken.getNavigation().moveTo(guarded, 1.2D);
            } else {
                chicken.getNavigation().stop();
            }
            return;
        }
        chicken.getLookControl().setLookAt(foe, 30.0F, 30.0F);
        chicken.getNavigation().moveTo(foe, 1.5D);
        if (chicken.distanceToSqr(foe) <= ATTACK_REACH * ATTACK_REACH) peck(foe);
    }

    private LivingEntity nearestHostile(LivingEntity around, double radius) {
        Level lvl = chicken.level();
        AABB box = around.getBoundingBox().inflate(radius);
        List<Entity> list = lvl.getEntities(chicken, box,
                e -> e instanceof Enemy && e instanceof LivingEntity && e.isAlive());
        LivingEntity best = null;
        double bestD = Double.MAX_VALUE;
        for (Entity e : list) {
            double dd = chicken.distanceToSqr(e);
            if (dd < bestD) { bestD = dd; best = (LivingEntity) e; }
        }
        return best;
    }

    // --- dig a hole straight down ---
    private void doDig() {
        chicken.getNavigation().stop();
        if (digDone || digAnchor == null) {
            chicken.directive.idle();
            return;
        }
        if (attackCd > 0) return; // reuse cd as a small pacing gate
        if (digDepth >= MAX_DIG_DEPTH) { digDone = true; return; }

        Level lvl = chicken.level();
        BlockPos pos = digAnchor.below(1 + digDepth);
        BlockState st = lvl.getBlockState(pos);
        if (st.isAir()) { digDepth++; return; }
        // don't grind on bedrock / unbreakable
        if (st.getDestroySpeed(lvl, pos) < 0) { digDone = true; return; }

        chicken.swing(InteractionHand.MAIN_HAND);
        lvl.destroyBlock(pos, true, chicken);
        digDepth++;
        attackCd = DIG_COOLDOWN;
    }

    // --- roam ---
    private void doWander(double radius) {
        chicken.getLookControl().setLookAt(
                chicken.getX() + chicken.getRandom().nextDouble() - 0.5,
                chicken.getEyeY(),
                chicken.getZ() + chicken.getRandom().nextDouble() - 0.5);
        if (wanderCd > 0) { wanderCd--; return; }
        if (!chicken.getNavigation().isDone()) return;

        double ang = chicken.getRandom().nextDouble() * Math.PI * 2.0;
        double r = 2.0 + chicken.getRandom().nextDouble() * radius;
        double tx = chicken.getX() + Math.cos(ang) * r;
        double tz = chicken.getZ() + Math.sin(ang) * r;
        chicken.getNavigation().moveTo(tx, chicken.getY(), tz, 1.0D);
        wanderCd = 40 + chicken.getRandom().nextInt(80);
    }

    private void parkAtSpawn() {
        if (!(chicken.level() instanceof ServerLevel sl)) return;
        BlockPos sp = sl.getSharedSpawnPos();
        double dx = sp.getX() + 0.5 - chicken.getX();
        double dz = sp.getZ() + 0.5 - chicken.getZ();
        if (dx * dx + dz * dz > 64.0) {
            chicken.getNavigation().moveTo(sp.getX() + 0.5, sp.getY(), sp.getZ() + 0.5, 1.0D);
        } else {
            chicken.getNavigation().stop();
        }
    }

    private void blinkNear(LivingEntity p) {
        double ang = chicken.getRandom().nextDouble() * Math.PI * 2.0;
        double r = 5.0;
        double tx = p.getX() + Math.cos(ang) * r;
        double tz = p.getZ() + Math.sin(ang) * r;
        chicken.teleportTo(tx, p.getY(), tz);
    }

    private void peck(LivingEntity p) {
        if (attackCd > 0) return;
        attackCd = ATTACK_COOLDOWN;
        chicken.swing(InteractionHand.MAIN_HAND);
        p.hurt(chicken.damageSources().mobAttack(chicken), PECK_DAMAGE);
        Vec3 push = new Vec3(p.getX() - chicken.getX(), 0, p.getZ() - chicken.getZ());
        p.knockback(0.4F, -push.x, -push.z);
    }
}
