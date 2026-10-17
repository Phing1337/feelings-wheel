# Feelings Wheel

A bold, bubbly feelings wheel for finding the words for how you feel — then sharing them.
Phone-first and installable as an offline PWA.

**Live:** https://phing1337.github.io/feelings-wheel/

On your phone, open the link and choose **Add to Home Screen** (Safari: Share → Add to Home Screen;
Chrome: ⋮ → Install app).

## How it works

- Tap a bubble to bloom the feelings connected to it; hold to pin it to **My wheel**.
- Open My wheel to learn more about each feeling and share how you're doing.
- The background glows drift slowly and take on the colors and mood of what you've pinned.

## Develop

```sh
npm install
npm run dev          # http://127.0.0.1:5175
npm run words:check  # validate the feelings content
npm run build        # production build in dist/
npm run icons        # regenerate favicon + PWA icons from public/icon.svg
```

## Content

Every feeling lives in YAML under `content/clusters/` — one file per cluster (love, longing, wonder…),
with definitions, examples, aliases and links to related feelings. A Vite plugin compiles them into the
app; `npm run words:check` catches duplicates and broken links.

## Design tokens

Colors, type, motion and the background aura are all CSS variables in `src/tokens.css`, mirrored in the
Paper design file.

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
