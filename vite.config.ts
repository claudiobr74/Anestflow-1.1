import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { applySupabaseEnvFromFiles } from './src/lib/supabaseEnvFiles';
import { PWA_CACHE_NAME, PWA_REGISTER_TYPE } from './src/lib/pwaPolicy';

export default defineConfig(({ mode }) => {
  applySupabaseEnvFromFiles(process.cwd(), mode);
  return {
    envDir: process.cwd(),
    envPrefix: 'VITE_',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: PWA_REGISTER_TYPE,
        includeAssets: ['logo.png'],
        workbox: {
          cacheId: PWA_CACHE_NAME,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5000000
        },
        manifest: {
          name: 'AnestFlow',
          short_name: 'AnestFlow',
          description: 'Prontuário Anestésico Digital PWA',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
