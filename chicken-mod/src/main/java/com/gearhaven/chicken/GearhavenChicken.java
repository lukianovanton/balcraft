package com.gearhaven.chicken;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.mojang.brigadier.Command;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.AABB;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.ServerChatEvent;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

import java.util.List;
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

    private int tick = 0;

    public GearhavenChicken(IEventBus modBus) {
        ENTITIES.register(modBus);
        modBus.addListener(this::onAttributes);

        NeoForge.EVENT_BUS.addListener(this::onChat);
        NeoForge.EVENT_BUS.addListener(this::onRegisterCommands);
        NeoForge.EVENT_BUS.addListener(this::onServerTick);
        NeoForge.EVENT_BUS.addListener(this::onLogin);
        NeoForge.EVENT_BUS.addListener(this::onLogout);
    }

    private void onAttributes(EntityAttributeCreationEvent event) {
        event.put(ADMIN_CHICKEN.get(), AdminChicken.createAttributes().build());
    }

    // ---------------------------------------------------------------------
    // Presence: the chicken lives on the SERVER, not tied to any player. We
    // discover an existing one (survives restarts) and spawn one if missing.
    // ---------------------------------------------------------------------
    private void onServerTick(ServerTickEvent.Post event) {
        if (++tick % 40 != 0) return; // ~ every 2s
        MinecraftServer server = event.getServer();
        ServerLevel overworld = server.overworld();

        // The chicken force-loads its own chunk, so it's always among the loaded
        // entities here — making discovery + dedup reliable.
        List<AdminChicken> all = overworld.getEntitiesOfClass(
                AdminChicken.class, new AABB(BlockPos.ZERO).inflate(3.0E7));

        if (!all.isEmpty()) {
            // Keep exactly one; remove any duplicates (e.g. from older builds).
            AdminChicken keep = (CURRENT != null && CURRENT.isAlive() && all.contains(CURRENT))
                    ? CURRENT : all.get(0);
            for (AdminChicken c : all) {
                if (c != keep) c.discard();
            }
            CURRENT = keep;
        } else if (CURRENT == null || !CURRENT.isAlive() || CURRENT.isRemoved()) {
            spawnAtSpawn(overworld, server);
        }
    }

    private void spawnAtSpawn(ServerLevel level, MinecraftServer server) {
        BlockPos sp = level.getSharedSpawnPos();
        AdminChicken c = ADMIN_CHICKEN.get().create(level);
        if (c == null) return;
        c.moveTo(sp.getX() + 0.5, sp.getY() + 1, sp.getZ() + 0.5, 0, 0);
        c.setCustomName(Component.literal("§eПетух"));
        c.setCustomNameVisible(true);
        c.setPersistenceRequired();
        level.addFreshEntity(c);
        CURRENT = c;
        TabPresence.showToAll(server);
    }

    private void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer sp) {
            TabPresence.showTo(sp);
        }
    }

    private void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        // When the last player leaves, pull the chicken back to spawn so it
        // stays in loaded chunks (spawn chunks) and never gets stranded.
        if (!(event.getEntity() instanceof ServerPlayer sp)) return;
        MinecraftServer server = sp.server;
        if (server == null || CURRENT == null) return;
        if (server.getPlayerList().getPlayerCount() <= 1) {
            ServerLevel ow = server.overworld();
            BlockPos s = ow.getSharedSpawnPos();
            if (CURRENT.level() != ow) return;
            CURRENT.teleportTo(s.getX() + 0.5, s.getY() + 1, s.getZ() + 0.5);
            CURRENT.directive.idle();
        }
    }

    // --- /chicken: bring the (always-present) chicken to you ---
    private void onRegisterCommands(RegisterCommandsEvent event) {
        event.getDispatcher().register(
                Commands.literal("chicken").requires(s -> s.hasPermission(0)).executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayer();
                    if (p == null) return 0;
                    bringToPlayer(p);
                    return Command.SINGLE_SUCCESS;
                }));
    }

    private void bringToPlayer(ServerPlayer p) {
        ServerLevel level = p.serverLevel();
        if (CURRENT == null || !CURRENT.isAlive()) {
            spawnAtSpawn(level, p.server);
        }
        if (CURRENT == null) return;
        CURRENT.teleportTo(p.getX(), p.getY(), p.getZ());
        CURRENT.directive.idle();
        say(p.server, "Тепнулся к тебе, ну чё, командуй.");
    }

    // ---------------------------------------------------------------------
    // Chat -> brain -> action
    // ---------------------------------------------------------------------
    private void onChat(ServerChatEvent event) {
        ServerPlayer speaker = event.getPlayer();
        MinecraftServer server = speaker.server;
        AdminChicken chicken = CURRENT;
        if (chicken == null || !chicken.isAlive()) return;

        String message = event.getMessage().getString();

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

        // Nearby mobs the chicken could act on (attack/guard), so the brain can
        // pick e.g. "skeleton" as a target.
        JsonArray mobs = new JsonArray();
        AABB box = chicken.getBoundingBox().inflate(40.0);
        List<Entity> near = chicken.level().getEntities(chicken, box,
                e -> e instanceof LivingEntity && !(e instanceof Player) && e.isAlive());
        near.sort((a, b) -> Double.compare(chicken.distanceToSqr(a), chicken.distanceToSqr(b)));
        int count = 0;
        for (Entity e : near) {
            if (count++ >= 12) break;
            JsonObject o = new JsonObject();
            o.addProperty("type", BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).getPath());
            o.addProperty("name", e.getType().getDescription().getString());
            o.addProperty("dist", (int) Math.sqrt(chicken.distanceToSqr(e)));
            mobs.add(o);
        }
        payload.add("mobs", mobs);

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

        UUID targetUuid = resolveTarget(server, chicken, resp.target);
        String action = resp.action == null ? "idle" : resp.action.toLowerCase();

        switch (action) {
            case "attack" -> chicken.directive.setAttack(targetUuid, resp.hits);
            case "guard" -> chicken.directive.set(Directive.Type.GUARD, targetUuid);
            case "goto" -> chicken.directive.set(Directive.Type.GOTO, targetUuid);
            case "follow" -> chicken.directive.set(Directive.Type.FOLLOW, targetUuid);
            case "come" -> chicken.directive.set(Directive.Type.COME, targetUuid);
            case "dig" -> chicken.directive.set(Directive.Type.DIG, null);
            case "wander" -> chicken.directive.set(Directive.Type.WANDER, null);
            default -> chicken.directive.idle();
        }
    }

    /** Resolve a target string to an entity UUID: an online player, or the nearest mob of that type. */
    private UUID resolveTarget(MinecraftServer server, AdminChicken chicken, String name) {
        if (name == null || name.isBlank()) return null;
        Player pl = server.getPlayerList().getPlayerByName(name);
        if (pl != null) return pl.getUUID();

        String key = name.toLowerCase();
        AABB box = chicken.getBoundingBox().inflate(48.0);
        List<Entity> near = chicken.level().getEntities(chicken, box,
                e -> e instanceof LivingEntity && !(e instanceof Player) && e.isAlive());
        LivingEntity best = null;
        double bestD = Double.MAX_VALUE;
        for (Entity e : near) {
            String path = BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).getPath().toLowerCase();
            String disp = e.getType().getDescription().getString().toLowerCase();
            if (path.equals(key) || path.contains(key) || disp.contains(key)) {
                double dd = chicken.distanceToSqr(e);
                if (dd < bestD) { bestD = dd; best = (LivingEntity) e; }
            }
        }
        return best != null ? best.getUUID() : null;
    }

    private static void say(MinecraftServer server, String text) {
        server.getPlayerList().broadcastSystemMessage(
                Component.literal("§e[Петух] §r" + text), false);
    }
}
