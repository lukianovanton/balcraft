package com.gearhaven.chicken;

import net.minecraft.client.renderer.entity.ChickenRenderer;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;

@EventBusSubscriber(modid = GearhavenChicken.MODID, bus = EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class ClientHooks {
    @SubscribeEvent
    public static void onRegisterRenderers(EntityRenderersEvent.RegisterRenderers event) {
        // Reuse the vanilla chicken model/renderer for our admin-chicken.
        event.registerEntityRenderer(GearhavenChicken.ADMIN_CHICKEN.get(), ChickenRenderer::new);
    }
}
