package com.gearhaven.chicken;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mojang.brigadier.Command;
import net.minecraft.commands.Commands;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.ServerChatEvent;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

import java.util.UUID;

@Mod(GearhavenChicken.MODID)
public class GearhavenChicken {
    public static final String MODID = "gearhavenchicken";

    public static final DeferredRegister<EntityType<?>> ENTITIES =
            DeferredRegister.create(Registries.ENTITY_TYPE, MODID);

    public static final DeferredHolder<EntityType<?>, EntityType<AdminChicken>> ADMIN_CHICKEN =
            ENTITIES.register("admin_chicken", () -> EntityType.Builder
                    .of(AdminChicken::new, MobCategory.CREATURE)
                    .sized(0.4f, 0.7f)
                    .clientTrackingRange(12)
                    .build("admin_chicken"));

    /** The single active admin-chicken (server side). */
    public static AdminChicken CURRENT;

    public GearhavenChicken(IEventBus modBus) {
        ENTITIES.register(modBus);
        modBus.addListener(this::onAttributes);

        NeoForge.EVENT_BUS.addListener(this::onChat);
        NeoForge.EVENT_BUS.addListener(this::onRegisterCommands);
    }

    private void onAttributes(EntityAttributeCreationEvent event) {
        event.put(ADMIN_CHICKEN.get(), AdminChicken.createAttributes().build());
    }

    private void onRegisterCommands(RegisterCommandsEvent event) {
        event.getDispatcher().register(
                Commands.literal("chicken").requires(s -> s.hasPermission(0)).executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayer();
                    if (p == null) return 0;
                    summonOrTeleport(p);
                    return Command.SINGLE_SUCCESS;
                }));
    }

    private void summonOrTeleport(ServerPlayer p) {
        ServerLevel level = p.serverLevel();
        if (CURRENT == null || !CURRENT.isAlive() || CURRENT.level() != level) {
            AdminChicken c = ADMIN_CHICKEN.get().create(level);
            if (c == null) return;
            c.moveTo(p.getX(), p.getY(), p.getZ(), p.getYRot(), 0);
            c.setCustomName(Component.literal("§eКурица-Админ"));
            c.setCustomNameVisible(true);
            level.addFreshEntity(c);
            CURRENT = c;
            say(p.server, "Ко-ко, я на месте. Чё надо?");
        } else {
            CURRENT.teleportTo(p.getX(), p.getY(), p.getZ());
            say(p.server, "Тепнулась к тебе, не ори.");
        }
    }

    private void onChat(ServerChatEvent event) {
        ServerPlayer speaker = event.getPlayer();
        MinecraftServer server = speaker.server;
        AdminChicken chicken = CURRENT;
        if (chicken == null || !chicken.isAlive()) return;

        String message = event.getMessage().getString();

        // Build context for the brain.
        JsonObject payload = new JsonObject();
        payload.addProperty("player", speaker.getGameProfile().getName());
        payload.addProperty("message", message);

        JsonObject chick = new JsonObject();
        chick.addProperty("x", chicken.getX());
        chick.addProperty("y", chicken.getY());
        chick.addProperty("z", chicken.getZ());
        chick.addProperty("directive", chicken.directive.type.name());
        payload.add("chicken", chick);

        JsonArray players = new JsonArray();
        for (ServerPlayer sp : server.getPlayerList().getPlayers()) {
            JsonObject o = new JsonObject();
            o.addProperty("name", sp.getGameProfile().getName());
            o.addProperty("dist", (int) Math.sqrt(chicken.distanceToSqr(sp)));
            players.add(o);
        }
        payload.add("players", players);

        ChickenBrain.think(payload).thenAccept(resp -> {
            if (resp == null) return;
            server.execute(() -> applyResponse(server, resp));
        });
    }

    private void applyResponse(MinecraftServer server, ChickenBrain.Response resp) {
        AdminChicken chicken = CURRENT;
        if (chicken == null || !chicken.isAlive()) return;

        if (resp.say != null && !resp.say.isBlank()) {
            say(server, resp.say);
        }

        UUID targetUuid = null;
        if (resp.target != null && !resp.target.isBlank()) {
            Player tp = server.getPlayerList().getPlayerByName(resp.target);
            if (tp != null) targetUuid = tp.getUUID();
        }

        switch (resp.action == null ? "idle" : resp.action.toLowerCase()) {
            case "attack" -> chicken.directive.set(Directive.Type.ATTACK, targetUuid);
            case "goto" -> chicken.directive.set(Directive.Type.GOTO, targetUuid);
            case "follow" -> chicken.directive.set(Directive.Type.FOLLOW, targetUuid);
            case "come" -> chicken.directive.set(Directive.Type.COME, targetUuid);
            default -> chicken.directive.idle();
        }
    }

    private static void say(MinecraftServer server, String text) {
        server.getPlayerList().broadcastSystemMessage(
                Component.literal("§e[Курица-Админ] §r" + text), false);
    }
}
