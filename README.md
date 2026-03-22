# Bond Roulette

Browser-based prototype for **European roulette only**.

## Honest framing

This app is **not** a claim of beating roulette.
It does **not** predict spins, guarantee profit, or remove the house edge.
It is a **live session assistant** for:

- logging spins
- surfacing manual entry triggers
- calculating James Bond staking progression
- warning when recommended stakes exceed bankroll or table limits

## Scope

- European roulette only: **0–36, single zero**
- No American roulette / no 00 mode in v1
- Client-side only
- No backend
- Local storage persistence only

## What it includes

- **Live Dashboard**
  - recent spin visibility
  - trigger score snapshot
  - bankroll-aware warnings
- **Spin Log**
  - newest-first local session history
- **Trigger Rules / Settings**
  - adjustable lookback and threshold values
  - bankroll, chip, table max, and recovery settings
- **James Bond Calculator / Progression Panel**
  - standard Bond layout
  - recovery based on weakest covered win
- **Strategy / Help**
  - plain-English explanation and guardrails

## James Bond layout

At scale `S`:

- `14 × S` on **19–36**
- `5 × S` on **13–18**
- `1 × S` on **0**
- Total stake = `20 × S`

Spin P/L:

- 19–36 -> `+8 × S`
- 13–18 -> `+10 × S`
- 0 -> `+16 × S`
- 1–12 -> `-20 × S`

## Recovery formula

This prototype uses the recovery logic you specified:

```txt
nextScale = max(baseScale, ceil((openLosses + targetProfitBuffer) / 8))
```

Why `/ 8`?
Because the weakest covered win on the James Bond layout is only `+8 × scale`, so simple doubling is not enough.

## Run locally

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Tech

- Next.js
- TypeScript
- Tailwind CSS
- localStorage persistence

## Notes

This is intentionally a fast prototype, not a polished gambling product.
If you extend it later, obvious next steps are:

- topic/session tagging
- export/import logs
- better trigger presets
- optional history review charts
- deploy to Vercel
