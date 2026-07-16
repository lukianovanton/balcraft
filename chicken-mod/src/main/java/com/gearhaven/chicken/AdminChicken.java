package com.gearhaven.chicken;

import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.animal.Chicken;
import net.minecraft.world.level.Level;

/**
 * Immortal admin-chicken. Behaves only per its {@link Directive} (set by the
 * brain) — no vanilla wandering/panic. Visually a normal chicken (reuses the
 * vanilla chicken model + renderer).
 */
public class AdminChicken extends Chicken {
    public final Directive directive = new Directive();

    public AdminChicken(EntityType<? extends Chicken> type, Level level) {
        super(type, level);
        this.setPersistenceRequired();
        this.setNoAi(false);
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

    // --- immortality ---
    @Override
    public boolean isInvulnerableTo(DamageSource source) {
        return true;
    }

    @Override
    public boolean hurt(DamageSource source, float amount) {
        return false;
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
