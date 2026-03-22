# Bond Roulette

A browser-based **European roulette only** session assistant prototype.

## Honest framing

This app does **not** claim to beat roulette.
It does **not** use predictive AI.
It does **not** guarantee profit.
It does **not** remove the house edge.

It is a **live trigger tracker and James Bond staking calculator** for people who manually decide when to enter.

Use it for:
- live spin logging
- trigger visibility
- streak and absence tracking
- James Bond progression sizing
- bankroll and table-limit warnings
- session review/export

## Scope

- European roulette only: **0–36**, single zero
- No American roulette / no `00`
- Client-side only
- No backend
- No auth
- Local storage persistence in v1

## Routes

- `/` — dashboard
- `/log` — full spin log
- `/settings` — trigger rules + bankroll settings
- `/calculator` — James Bond calculator
- `/help` — explanation and disclaimer

## What it includes

### Live dashboard
- recent spins strip
- live signal cards
- composite trigger score
- WAIT / WATCH / ENTER status
- trigger reason list
- progression card
- safety card
- session P/L card

### Spin handling
- buttons `0–36`
- immediate last-spin visibility
- undo last spin
- edit prior spin
- clear session with confirmation
- optional keyboard shortcuts

### Auto-derived metadata per spin
- number
- colour
- parity
- range band
- dozen
- column
- James Bond zone

### Trigger engine
Configurable heuristic trigger rules with:
- enabled flag
- threshold
- weight

Supported trigger categories:
- colour streak
- parity streak
- high/low streak
- dozen streak
- column streak
- colour absence
- high/low absence
- dozen absence
- column absence
- zero absence

Composite score output:
- `WAIT`
- `WATCH`
- `ENTER`

Important: this is a **rule-based heuristic engine**, not probability or prediction.

### Betting / sequence logging
Each spin stores:
- trigger snapshot
- trigger score
- status at that moment
- whether a bet was taken
- scale/stake used if taken
- spin P/L if taken
- running P/L
- open losses after spin

### Import / export
- export session to JSON
- export spin log to CSV
- import JSON backup

### Demo session
- one-click seeded demo session for testing the UI quickly

---

## James Bond layout

At scale `S`:

- `14 × S` on **19–36**
- `5 × S` on **13–18**
- `1 × S` on **0**
- total stake = `20 × S`

### P/L per spin
- `19–36` -> `+8 × S`
- `13–18` -> `+10 × S`
- `0` -> `+16 × S`
- `1–12` -> `-20 × S`

---

## Recovery formula

This prototype uses the recovery formula you specified:

```txt
nextScale = max(baseScale, ceil((openLosses + targetProfitBuffer) / 8))
```

Why `/ 8`?
Because the weakest covered James Bond win is only `+8 × scale`, so simple doubling is not enough.

If auto-reset is enabled:
- covered win -> open losses reset to `0`
- uncovered loss -> full stake added to open losses

---

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Build for production

```bash
npm run build
npm run start
```

## Run tests

```bash
npm test
```

---

## Deploy to Vercel

### Option 1 — GitHub import
1. Push the repo to GitHub
2. Go to Vercel
3. Import the repo
4. Deploy with defaults

### Option 2 — Vercel CLI
```bash
npm i -g vercel
vercel
```

No backend configuration is needed for v1.

---

## Acceptance checks covered

Core test coverage includes:
- number classification
- James Bond profit logic
- recovery progression sizing
- trigger score aggregation
- WAIT / WATCH / ENTER threshold handling

---

## Limitations / disclaimer

- Roulette remains random.
- The house edge remains.
- Trigger scores are visibility heuristics only.
- This is not betting advice.
- This tool does not place bets automatically.
- This prototype is for logging, trigger visibility, and stake management only.

## Tech

- Next.js
- TypeScript
- Tailwind CSS
- Vitest
- localStorage

## Next obvious upgrades

- better multi-digit keyboard entry
- richer edit modal
- mini charts for trigger activation / P&L
- print-friendly report layout
- deeper sequence replay and review tooling
