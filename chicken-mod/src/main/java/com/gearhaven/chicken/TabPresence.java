package com.gearhaven.chicken;

import com.mojang.authlib.GameProfile;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.GameType;

import java.lang.reflect.Field;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

/**
 * Makes the admin-chicken show up in the TAB player list as a fake entry, so it
 * always reads as "present on the server". This is purely cosmetic and uses a
 * bit of reflection on the vanilla packet; it's fully best-effort — any failure
 * is swallowed and just means no tab entry (the chicken itself still works).
 */
public final class TabPresence {
    private TabPresence() {}

    private static final UUID ID = UUID.fromString("d3c0c0c0-1111-4000-8000-00000000c0c0");
    private static final GameProfile PROFILE = new GameProfile(ID, "Petuh");
    private static final Component DISPLAY = Component.literal("§eПетух");

    /** Send the fake tab entry to one player (e.g. on join). */
    public static void showTo(ServerPlayer viewer) {
        try {
            viewer.connection.send(buildPacket());
        } catch (Throwable ignored) {
            // best-effort only
        }
    }

    /** (Re)send the fake tab entry to everyone online. */
    public static void showToAll(MinecraftServer server) {
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            showTo(p);
        }
    }

    private static ClientboundPlayerInfoUpdatePacket buildPacket() throws Exception {
        EnumSet<ClientboundPlayerInfoUpdatePacket.Action> actions = EnumSet.of(
                ClientboundPlayerInfoUpdatePacket.Action.ADD_PLAYER,
                ClientboundPlayerInfoUpdatePacket.Action.UPDATE_LISTED,
                ClientboundPlayerInfoUpdatePacket.Action.UPDATE_LATENCY,
                ClientboundPlayerInfoUpdatePacket.Action.UPDATE_GAME_MODE,
                ClientboundPlayerInfoUpdatePacket.Action.UPDATE_DISPLAY_NAME);

        ClientboundPlayerInfoUpdatePacket.Entry entry = new ClientboundPlayerInfoUpdatePacket.Entry(
                ID, PROFILE, true, 0, GameType.SURVIVAL, DISPLAY, null);

        // No public constructor takes custom entries, so build an empty packet
        // and set the entries list reflectively.
        ClientboundPlayerInfoUpdatePacket pkt =
                new ClientboundPlayerInfoUpdatePacket(actions, List.of());
        Field f = ClientboundPlayerInfoUpdatePacket.class.getDeclaredField("entries");
        f.setAccessible(true);
        f.set(pkt, List.of(entry));
        return pkt;
    }
}
