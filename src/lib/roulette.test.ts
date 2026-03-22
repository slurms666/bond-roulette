import { describe, expect, it } from "vitest";
import { getJamesBondZone, getNumberMeta } from "./roulette";
import { getJamesBondProfit, getNextScale } from "./progression";
import { evaluateTriggerRules, scoreToStatus } from "./triggers";
import { defaultRules } from "./defaults";
import { TrackerSnapshot } from "./types";

describe("roulette classification", () => {
  it("classifies 0 correctly", () => {
    const meta = getNumberMeta(0);
    expect(meta.colour).toBe("green");
    expect(meta.parity).toBe("zero");
    expect(meta.rangeBand).toBe("zero");
    expect(meta.dozen).toBe(0);
    expect(meta.column).toBe(0);
    expect(meta.jamesBondZone).toBe("zero");
  });

  it("classifies James Bond zones correctly", () => {
    expect(getJamesBondZone(13)).toBe("mid");
    expect(getJamesBondZone(18)).toBe("mid");
    expect(getJamesBondZone(19)).toBe("high");
    expect(getJamesBondZone(36)).toBe("high");
    expect(getJamesBondZone(12)).toBe("uncovered");
    expect(getJamesBondZone(1)).toBe("uncovered");
  });
});

describe("profit logic", () => {
  it("returns correct P/L at scale 1", () => {
    expect(getJamesBondProfit(0, 1)).toBe(16);
    expect(getJamesBondProfit(13, 1)).toBe(10);
    expect(getJamesBondProfit(18, 1)).toBe(10);
    expect(getJamesBondProfit(19, 1)).toBe(8);
    expect(getJamesBondProfit(36, 1)).toBe(8);
    expect(getJamesBondProfit(1, 1)).toBe(-20);
    expect(getJamesBondProfit(12, 1)).toBe(-20);
  });
});

describe("recovery progression", () => {
  it("sizes next scale correctly", () => {
    expect(getNextScale(0, 8, 1)).toBe(1);
    expect(getNextScale(20, 8, 1)).toBe(4);
    expect(getNextScale(100, 8, 1)).toBe(14);
  });
});

describe("trigger scoring", () => {
  const snapshot: TrackerSnapshot = {
    currentRedStreak: 0,
    currentBlackStreak: 5,
    currentOddStreak: 0,
    currentEvenStreak: 4,
    currentHighStreak: 4,
    currentLowStreak: 0,
    currentDozenStreak: { dozen: 2, length: 3 },
    currentColumnStreak: { column: 2, length: 2 },
    spinsSinceRed: 5,
    spinsSinceBlack: 0,
    spinsSinceOdd: 4,
    spinsSinceEven: 0,
    spinsSinceHigh: 0,
    spinsSinceLow: 6,
    spinsSinceDozen1: 8,
    spinsSinceDozen2: 0,
    spinsSinceDozen3: 3,
    spinsSinceColumn1: 7,
    spinsSinceColumn2: 0,
    spinsSinceColumn3: 4,
    spinsSinceZero: 24,
    spinsSinceUncovered: 6,
    spinsSinceBondHigh: 0,
    spinsSinceBondMid: 4,
  };

  it("sums active rule weights correctly", () => {
    const result = evaluateTriggerRules(defaultRules, snapshot);
    expect(result.score).toBe(10);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("maps score to wait/watch/enter correctly", () => {
    expect(scoreToStatus(2, 4, 7)).toBe("WAIT");
    expect(scoreToStatus(4, 4, 7)).toBe("WATCH");
    expect(scoreToStatus(9, 4, 7)).toBe("ENTER");
  });
});
