import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
      ],

      manifest: {
        id: '/',

        name:
          'Disaster Management Coordination System',

        short_name:
          'DisasterCoord',

        description:
          'Smart disaster early-warning and emergency coordination platform for Sri Lanka.',

        start_url:
          '/',

        scope:
          '/',

        display:
          'standalone',

        background_color:
          '#ffffff',

        theme_color:
          '#0f172a',

        orientation:
          'any',

        icons: [
          {
            src:
              '/icons/pwa-192x192.png',

            sizes:
              '192x192',

            type:
              'image/png',

            purpose:
              'any',
          },

          {
            src:
              '/icons/pwa-512x512.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'any',
          },

          {
            src:
              '/icons/pwa-512x512.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'maskable',
          },
        ],
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg}',
        ],

        navigateFallback:
          '/index.html',

        cleanupOutdatedCaches:
          true,
      },
    }),
  ],
});