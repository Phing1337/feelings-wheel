import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import feelingsData from './scripts/vite-plugin-feelings.js';

// BASE_PATH is set by the Pages workflow: "/<repo>/" for project sites, "/" for <user>.github.io.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  plugins: [
    feelingsData(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Feelings Wheel',
        short_name: 'Feelings',
        description: 'Find the words for how you feel — then share them.',
        theme_color: '#0B0B12',
        background_color: '#0B0B12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      },
      devOptions: { enabled: false }
    })
  ]
});
