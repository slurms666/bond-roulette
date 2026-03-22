import { getNumberMeta } from "./roulette";
import { Spin, Status, TrackerSnapshot, TriggerRule } from "./types";

function streakFor<T>(spins: Spin[], selector: (spin: Spin) => T, target: T, zeroBreak?: (spin: Spin) => boolean) {
  let count = 0;
  for (const spin of spins) {
    if (zeroBreak?.(spin)) break;
    if (selector(spin) === target) count += 1;
    else break;
  }
  return count;
}

function spinsSince(spins: Spin[], matcher: (spin: Spin) => boolean) {
  let count = 0;
  for (const spin of spins) {
    if (matcher(spin)) return count;
    count += 1;
  }
  return count;
}

export function buildTrackerSnapshot(spins: Spin[]): TrackerSnapshot {
  const currentDozen = spins[0]?.dozen ?? 0;
  const currentColumn = spins[0]?.column ?? 0;

  return {
    currentRedStreak: streakFor(spins, (s) => s.colour, "red", (s) => s.colour === "green"),
    currentBlackStreak: streakFor(spins, (s) => s.colour, "black", (s) => s.colour === "green"),
    currentOddStreak: streakFor(spins, (s) => s.parity, "odd", (s) => s.parity === "zero"),
    currentEvenStreak: streakFor(spins, (s) => s.parity, "even", (s) => s.parity === "zero"),
    currentHighStreak: streakFor(spins, (s) => s.rangeBand, "high", (s) => s.rangeBand === "zero"),
    currentLowStreak: streakFor(spins, (s) => s.rangeBand, "low", (s) => s.rangeBand === "zero"),
    currentDozenStreak: {
      dozen: currentDozen,
      length: currentDozen === 0 ? 0 : streakFor(spins, (s) => s.dozen, currentDozen, (s) => s.dozen === 0),
    },
    currentColumnStreak: {
      column: currentColumn,
      length: currentColumn === 0 ? 0 : streakFor(spins, (s) => s.column, currentColumn, (s) => s.column === 0),
    },
    spinsSinceRed: spinsSince(spins, (s) => s.colour === "red"),
    spinsSinceBlack: spinsSince(spins, (s) => s.colour === "black"),
    spinsSinceOdd: spinsSince(spins, (s) => s.parity === "odd"),
    spinsSinceEven: spinsSince(spins, (s) => s.parity === "even"),
    spinsSinceHigh: spinsSince(spins, (s) => s.rangeBand === "high"),
    spinsSinceLow: spinsSince(spins, (s) => s.rangeBand === "low"),
    spinsSinceDozen1: spinsSince(spins, (s) => s.dozen === 1),
    spinsSinceDozen2: spinsSince(spins, (s) => s.dozen === 2),
    spinsSinceDozen3: spinsSince(spins, (s) => s.dozen === 3),
    spinsSinceColumn1: spinsSince(spins, (s) => s.column === 1),
    spinsSinceColumn2: spinsSince(spins, (s) => s.column === 2),
    spinsSinceColumn3: spinsSince(spins, (s) => s.column === 3),
    spinsSinceZero: spinsSince(spins, (s) => s.number === 0),
    spinsSinceUncovered: spinsSince(spins, (s) => s.jamesBondZone === "uncovered"),
    spinsSinceBondHigh: spinsSince(spins, (s) => s.jamesBondZone === "high"),
    spinsSinceBondMid: spinsSince(spins, (s) => s.jamesBondZone === "mid"),
  };
}

export function evaluateTriggerRules(rules: TriggerRule[], snapshot: TrackerSnapshot) {
  const reasons: string[] = [];
  let score = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    let active = false;
    let reason = "";

    switch (rule.category) {
      case "colourStreak": {
        const color = rule.target ?? "black";
        const value = color === "red" ? snapshot.currentRedStreak : snapshot.currentBlackStreak;
        active = value >= rule.threshold;
        reason = `${value} ${color}s in a row`;
        break;
      }
      case "parityStreak": {
        const parity = rule.target ?? "even";
        const value = parity === "odd" ? snapshot.currentOddStreak : snapshot.currentEvenStreak;
        active = value >= rule.threshold;
        reason = `${value} ${parity}s in a row`;
        break;
      }
      case "highLowStreak": {
        const band = rule.target ?? "high";
        const value = band === "high" ? snapshot.currentHighStreak : snapshot.currentLowStreak;
        active = value >= rule.threshold;
        reason = `${value} ${band}s in a row`;
        break;
      }
      case "dozenStreak": {
        const dozen = Number(rule.target ?? "1");
        const value = snapshot.currentDozenStreak.dozen === dozen ? snapshot.currentDozenStreak.length : 0;
        active = value >= rule.threshold;
        reason = `dozen ${dozen} streak ${value}`;
        break;
      }
      case "columnStreak": {
        const column = Number(rule.target ?? "1");
        const value = snapshot.currentColumnStreak.column === column ? snapshot.currentColumnStreak.length : 0;
        active = value >= rule.threshold;
        reason = `column ${column} streak ${value}`;
        break;
      }
      case "colourAbsence": {
        const color = rule.target ?? "red";
        const value = color === "red" ? snapshot.spinsSinceRed : snapshot.spinsSinceBlack;
        active = value >= rule.threshold;
        reason = `${color} absent for ${value} spins`;
        break;
      }
      case "highLowAbsence": {
        const band = rule.target ?? "low";
        const value = band === "high" ? snapshot.spinsSinceHigh : snapshot.spinsSinceLow;
        active = value >= rule.threshold;
        reason = `${band} absent for ${value} spins`;
        break;
      }
      case "dozenAbsence": {
        const dozen = Number(rule.target ?? "1");
        const value = dozen === 1 ? snapshot.spinsSinceDozen1 : dozen === 2 ? snapshot.spinsSinceDozen2 : snapshot.spinsSinceDozen3;
        active = value >= rule.threshold;
        reason = `dozen ${dozen} absent for ${value} spins`;
        break;
      }
      case "columnAbsence": {
        const column = Number(rule.target ?? "1");
        const value = column === 1 ? snapshot.spinsSinceColumn1 : column === 2 ? snapshot.spinsSinceColumn2 : snapshot.spinsSinceColumn3;
        active = value >= rule.threshold;
        reason = `column ${column} absent for ${value} spins`;
        break;
      }
      case "zeroAbsence": {
        const value = snapshot.spinsSinceZero;
        active = value >= rule.threshold;
        reason = `zero absent for ${value} spins`;
        break;
      }
    }

    if (active) {
      score += rule.weight;
      reasons.push(reason);
    }
  }

  return { score, reasons };
}

export function scoreToStatus(score: number, watchScore: number, entryScore: number): Status {
  if (score >= entryScore) return "ENTER";
  if (score >= watchScore) return "WATCH";
  return "WAIT";
}

export function buildSpinFromNumber(number: number, spins: Spin[], rules: TriggerRule[], watchScore: number, entryScore: number) {
  const meta = getNumberMeta(number);
  const provisional: Spin = {
    id: crypto.randomUUID(),
    index: spins.length + 1,
    number,
    colour: meta.colour,
    parity: meta.parity,
    rangeBand: meta.rangeBand,
    dozen: meta.dozen,
    column: meta.column,
    jamesBondZone: meta.jamesBondZone,
    triggerScore: 0,
    triggerReasons: [],
    status: "WAIT",
    betTaken: false,
    createdAt: new Date().toISOString(),
  };

  const snapshot = buildTrackerSnapshot([provisional, ...spins]);
  const scored = evaluateTriggerRules(rules, snapshot);
  provisional.triggerScore = scored.score;
  provisional.triggerReasons = scored.reasons;
  provisional.status = scoreToStatus(scored.score, watchScore, entryScore);
  return { spin: provisional, snapshot };
}
