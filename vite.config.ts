import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const normalizeBasePath = (value: string): string => (value.endsWith('/') ? value : `${value}/`);
const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const base = normalizeBasePath(process.env.VITE_BASE_PATH ?? '/');
const outDir = process.env.VITE_OUT_DIR ?? 'dist';
const rootPath = base === '/' ? base : base.slice(0, -1);
const navigateFallbackAllowlist =
  base === '/'
    ? [/^\/(?:index\.html)?$/]
    : [new RegExp(`^${escapeForRegex(rootPath)}(?:\\/|\\/index\\.html)?$`)];

export default defineConfig({
  base,
  build: {
    outDir
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'Listless',
        short_name: 'Listless',
        description: 'A minimalist offline-first list app',
        start_url: base,
        display: 'standalone',
        background_color: '#f6f5f1',
        theme_color: '#1a1a1a',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackAllowlist
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
