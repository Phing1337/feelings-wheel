# Writing feelings

Everything the app knows lives here, in plain YAML:

- `families.yaml` — the six colour families (joyful, peaceful, sad, scared, mad, powerful)
- `clusters/*.yaml` — one file per cluster of related feelings (love, longing, wonder…)

`npm run dev` reloads the app every time you save. `npm run words:check` validates everything and prints
totals and warnings (`npm run words:check -- --strict` fails on warnings too).

## A cluster

```yaml
id: hope
name: Hope
family: joyful          # the colour family it belongs to
anchor: hopeful         # the doorway feeling other clusters link to
blurb: Leaning toward what could be.
near:                   # neighbouring clusters, and the feelings that lead there
  joy: [excited]
  strength: [determined]
feelings:
  - word: hopeful
    # …
```

## A feeling

| field | what it is |
| --- | --- |
| `word` | the feeling, lowercase — it should fit “I feel ___” |
| `core: true` | one per family: the big home bubble |
| `mix` | its colour blend, e.g. `joyful 60, powerful 25, peaceful 15` (weights are normalised) |
| `level` | intensity, 0–5 (default 3) |
| `def` | one or two plain sentences |
| `aliases` | other phrasings that mean exactly this (`[in awe, awestruck]`) |
| `hy` | where to break a long word on a bubble, e.g. `warm-hearted` |
| `also` | other clusters it belongs to |
| `stronger` `softer` `opposite` `under` `see` | links to other feelings, by word or alias |
| `body` | where you feel it |
| `voice` | what it sounds like in your head |
| `text` `say` `opener` `self` | example phrases: a text, saying it out loud, a conversation opener, a note to yourself |
| `synonyms` `deep` | the thesaurus — see below |
| `note` | a comment for editors; the app ignores it |

## The thesaurus: `synonyms` and `deep`

Tap a feeling’s centre bubble and its synonyms revolve around it — everyday words on the inner ring, rare
and strange ones on the outer ring. Tap any of them to swap it into the middle; hold one to pin it.

```yaml
    synonyms:                       # everyday words
      - glad: a soft, quiet yes about how things are
      - over the moon: so happy it’s a little ridiculous
      - cheery                      # a bare word works too
    deep:                           # rare, literary, old, regional or borrowed
      - sanguine: cheerfully confident, even when things look grim
        sounds: SANG-gwin           # optional: how to say it, stressed syllable in CAPS
        from: Latin sanguis, “blood” — once thought to make you cheerful
      - kvelling: glowing with pride over someone you love
        lang: Yiddish               # optional: for borrowed words
```

- **Every word lives in one place.** A word can be a synonym of only one feeling, and can’t also be a
  feeling or another feeling’s alias — link those with `see:` instead. `words:check` warns and keeps the
  first one it finds (clusters are read alphabetically).
- **It fits “I feel ___” or “I’m ___”.** Adjectives and short idioms (`over the moon`, `het up`), not nouns.
- **Glosses** — the part after the colon — start lowercase, have no full stop and stay under ~70
  characters. Make them vivid and plain: what it feels like, or how it differs from its neighbours.
  Every `deep` word needs one.
- **Real words only.** Dictionary words, attested idioms and genuine loanwords — no invented coinages,
  clinical labels, slurs or shaming words.
- **Depth over padding.** Family hubs and cluster anchors get 10–16 of each, ordinary feelings 5–10, and
  narrow ones 2–6 (and no `deep` words if none truly fit). A weak fit is worse than none.
- Avoid `: ` (colon + space) inside a gloss, or wrap the whole gloss in quotes.
