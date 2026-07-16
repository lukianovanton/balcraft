package com.gearhaven.chicken;

import java.util.UUID;

/** The chicken's current order, set by the brain and executed by {@link ControlGoal}. */
public final class Directive {
    public enum Type { IDLE, COME, FOLLOW, GOTO, ATTACK }

    public volatile Type type = Type.IDLE;
    /** Target player for COME/FOLLOW/GOTO/ATTACK. */
    public volatile UUID target = null;

    public void set(Type t, UUID tgt) {
        this.type = t;
        this.target = tgt;
    }

    public void idle() {
        this.type = Type.IDLE;
        this.target = null;
    }
}
