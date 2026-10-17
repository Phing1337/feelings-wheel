import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// `npm run icons` turns public/icon.svg into the favicon + PWA icons in public/.
// The bubbles sit well inside the maskable safe zone, so home-screen icons go full-bleed on ink.
const ink = { background: '#0B0B12' };

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0, resizeOptions: ink },
    apple: { ...preset.apple, padding: 0, resizeOptions: ink }
  },
  images: ['public/icon.svg']
});
