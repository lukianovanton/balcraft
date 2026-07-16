package com.gearhaven.chicken;

import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.ai.goal.Goal;

import java.util.EnumSet;

/**
 * Drives the admin-chicken based on its {@link Directive}: walks to / follows a
 * player, and for ATTACK actually pecks them (damage + knockback). If the target
 * is far, it first "blinks" close, then walks the rest and hits — so it visibly
 * arrives and strikes rather than acting at range.
 */
public class ControlGoal extends Goal {
    private static final double ATTACK_REACH = 2.0D;   // blocks
    private static final double BLINK_IF_FARTHER = 22.0D;
    private static final int ATTACK_COOLDOWN = 12;     // ticks between pecks
    private static final float PECK_DAMAGE = 4.0F;

    private final AdminChicken chicken;
    private int attackCd = 0;

    public ControlGoal(AdminChicken chicken) {
        this.chicken = chicken;
        this.setFlags(EnumSet.of(Goal.Flag.MOVE, Goal.Flag.LOOK));
    }

    @Override
    public boolean canUse() {
        return true;
    }

    @Override
    public boolean canContinueToUse() {
        return true;
    }

    @Override
    public boolean isInterruptable() {
        return false;
    }

    private Player target() {
        Directive d = chicken.directive;
        if (d.target == null) return null;
        return chicken.level().getPlayerByUUID(d.target);
    }

    @Override
    public void tick() {
        if (attackCd > 0) attackCd--;
        Directive d = chicken.directive;

        if (d.type == Directive.Type.IDLE) {
            chicken.getNavigation().stop();
            return;
        }

        Player p = target();
        if (p == null || !p.isAlive()) {
            chicken.getNavigation().stop();
            return;
        }

        chicken.getLookControl().setLookAt(p, 30.0F, 30.0F);
        double distSqr = chicken.distanceToSqr(p);

        // Blink close if the target is far away.
        if (distSqr > BLINK_IF_FARTHER * BLINK_IF_FARTHER) {
            double ang = chicken.getRandom().nextDouble() * Math.PI * 2.0;
            double r = 5.0;
            double tx = p.getX() + Math.cos(ang) * r;
            double tz = p.getZ() + Math.sin(ang) * r;
            chicken.teleportTo(tx, p.getY(), tz);
            return;
        }

        double speed = d.type == Directive.Type.ATTACK ? 1.4D : 1.2D;
        chicken.getNavigation().moveTo(p, speed);

        if (d.type == Directive.Type.ATTACK && distSqr <= ATTACK_REACH * ATTACK_REACH && attackCd == 0) {
            attackCd = ATTACK_COOLDOWN;
            chicken.swing(InteractionHand.MAIN_HAND);
            p.hurt(chicken.damageSources().mobAttack(chicken), PECK_DAMAGE);
            double dx = p.getX() - chicken.getX();
            double dz = p.getZ() - chicken.getZ();
            p.knockback(0.4F, -dx, -dz);
        }

        // COME/FOLLOW: once arrived at a COME target, go idle so it stops on top of them.
        if (d.type == Directive.Type.COME && distSqr <= 4.0D) {
            chicken.getNavigation().stop();
        }
    }
}
