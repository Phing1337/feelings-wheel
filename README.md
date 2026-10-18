# Feelings Wheel

A bold, bubbly feelings wheel for finding the words for how you feel — and for how you see the people
you care about — then sharing them. Phone-first and installable as an offline PWA.

**Live:** https://phing1337.github.io/feelings-wheel/

On your phone, open the link and choose **Add to Home Screen** (Safari: Share → Add to Home Screen;
Chrome: ⋮ → Install app).

## How it works

- Tap a bubble to bloom the feelings connected to it; hold to pin it to **My wheel** (top left).
- It's a thesaurus too: tap the feeling in the middle (or **≈ words**) and its synonyms revolve around
  it — everyday words on the inner ring, rare and strange ones (sanguine, choleric, twitterpated…) on
  the outer. Tap a word to swap it into the middle, drag to spin, tap outside to close.
- The card at the bottom explains the feeling in focus, with your path back above it.
- Open My wheel (tap or pull down) to learn more about each feeling and share how you're doing.
- The background glows drift slowly and take on the colors and mood of what you've pinned.

### I feel · I see you

The switch at the bottom of the home screen flips between two wheels:

- **I feel** — how you're feeling.
- **I see you** — how you see someone: looks, heart, spirit, humor, mind and character. Bright words
  (beautiful, witty, kind) sit beside double-edged ones (stubborn, intense) and their shadow sides
  (vain, flaky), which show up deeper in colour with a gentle way to bring them up.

Each wheel keeps its own pins. In **their wheel**, type the person's name when you share — it stays on
your phone — and **Tell them** drafts a warm, playful or honest message from what you've pinned.

## Develop

```sh
npm install
npm run dev          # http://127.0.0.1:5175
npm run words:check  # validate every deck (`-- people` checks just one)
npm run build        # production build in dist/
npm run icons        # regenerate favicon + PWA icons from public/icon.svg
```

## Content

Every feeling lives in YAML under `content/clusters/` — one file per cluster (love, longing, wonder…),
with definitions, examples, aliases, links to related feelings, and a thesaurus of `synonyms` and rare
`deep` words with glosses, pronunciations and origins. The **I see you** words live the same way under
`content/people/`. A Vite plugin compiles both decks into the app; `npm run words:check` catches
duplicates and broken links. See [`content/README.md`](content/README.md) for the format.

## Design tokens

Colors, type, motion and the background aura are all CSS variables in `src/tokens.css`, mirrored in the
Paper design file.

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
