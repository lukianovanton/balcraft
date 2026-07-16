package com.gearhaven.chicken;

import java.util.UUID;

/** The chicken's current order, set by the brain and executed by {@link ControlGoal}. */
public final class Directive {
    public enum Type {
        IDLE,     // mill about / gentle wander
        WANDER,   // actively roam around
        COME,     // walk to the caller and stop on them
        FOLLOW,   // keep walking after a target
        GOTO,     // walk to a target and stand near
        ATTACK,   // walk up and peck a target (player OR mob) until it's gone
        GUARD,    // stay near a target and peck any hostile mob that comes close
        DIG       // dig a hole straight down where it stands
    }

    public volatile Type type = Type.IDLE;
    /** Target entity (player or mob) for COME/FOLLOW/GOTO/ATTACK/GUARD. */
    public volatile UUID target = null;
    /** ATTACK only: pecks left before stopping. Very large = effectively "until dead". */
    public volatile int attacksLeft = 0;

    public void set(Type t, UUID tgt) {
        this.type = t;
        this.target = tgt;
    }

    /** ATTACK with a peck budget. count <= 0 means "until the target dies". */
    public void setAttack(UUID tgt, int count) {
        this.type = Type.ATTACK;
        this.target = tgt;
        this.attacksLeft = count <= 0 ? Integer.MAX_VALUE : count;
    }

    public void idle() {
        this.type = Type.IDLE;
        this.target = null;
    }
}
