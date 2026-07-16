package com.gearhaven.chicken;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.animal.Chicken;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;

/**
 * Immortal admin-chicken. Behaves only per its {@link Directive} (set by the
 * brain) — no vanilla wandering/panic. Visually a normal chicken (reuses the
 * vanilla chicken model + renderer).
 */
public class AdminChicken extends Chicken {
    public final Directive directive = new Directive();

    /** The chunk we currently force-load so the chicken never unloads (which would
     *  invalidate GearhavenChicken.CURRENT and spawn a duplicate). Follows the chicken. */
    private ChunkPos forcedChunk = null;

    public AdminChicken(EntityType<? extends Chicken> type, Level level) {
        super(type, level);
        this.setPersistenceRequired();
        this.setNoAi(false);
    }

    @Override
    public void tick() {
        super.tick();
        // Keep the chicken's own chunk force-loaded, and move that ticket with it.
        if (this.level() instanceof ServerLevel sl && this.isAlive()) {
            ChunkPos cp = new ChunkPos(this.blockPosition());
            if (!cp.equals(forcedChunk)) {
                if (forcedChunk != null) sl.setChunkForced(forcedChunk.x, forcedChunk.z, false);
                sl.setChunkForced(cp.x, cp.z, true);
                forcedChunk = cp;
            }
        }
    }

    @Override
    public void remove(RemovalReason reason) {
        // Release our forced chunk when we go away (dedup / dimension change).
        if (forcedChunk != null && this.level() instanceof ServerLevel sl) {
            sl.setChunkForced(forcedChunk.x, forcedChunk.z, false);
            forcedChunk = null;
        }
        super.remove(reason);
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Chicken.createAttributes()
                .add(Attributes.MOVEMENT_SPEED, 0.32D)
                .add(Attributes.FOLLOW_RANGE, 64.0D)
                .add(Attributes.MAX_HEALTH, 1024.0D);
    }

    @Override
    protected void registerGoals() {
        // Only our controllable behaviour — no default chicken goals.
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new ControlGoal(this));
    }

    // --- immortal, but hittable ---
    // You CAN hit it (it flinches and gets knocked back), it just never dies.
    @Override
    public boolean hurt(DamageSource source, float amount) {
        if (this.level().isClientSide) return false;
        // Instant-kill / void / /kill bypass invulnerability — ignore those entirely
        // so it can never be removed.
        if (source.is(DamageTypeTags.BYPASSES_INVULNERABILITY)) {
            return false;
        }
        // Cap damage so a single hit can never bring it to 0 (no death), while
        // still triggering the vanilla hit reaction + knockback.
        float safe = Math.min(amount, Math.max(0.0F, this.getHealth() - 1.0F));
        boolean hit = super.hurt(source, safe);
        // Keep it topped up so its HP is effectively infinite.
        this.setHealth(this.getMaxHealth());
        this.deathTime = 0;
        return hit;
    }

    @Override
    public boolean removeWhenFarAway(double distance) {
        return false;
    }

    @Override
    public boolean isPushable() {
        return false;
    }

    @Override
    public void checkDespawn() {
        // never despawn
    }

    // eggs off — an admin doesn't lay eggs
    @Override
    public void aiStep() {
        super.aiStep();
    }
}
