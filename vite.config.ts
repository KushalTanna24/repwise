import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Same path as the legacy worker so installed clients replace it cleanly.
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Repwise',
        short_name: 'Repwise',
        description: 'Your full-body training log with rules-based progression.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', env: { TZ: 'Asia/Kolkata' } },
});
