/**
 * Política explícita do Service Worker (Fase 7B).
 * Produção: VitePWA `autoUpdate` + skipWaiting + clientsClaim + cleanupOutdatedCaches.
 * Dev: main.tsx desregistra SW de um dist antigo — não fazer isso em produção.
 */
export const PWA_CACHE_NAME = "anestflow-pwa-v7" as const;
export const PWA_REGISTER_TYPE = "autoUpdate" as const;
