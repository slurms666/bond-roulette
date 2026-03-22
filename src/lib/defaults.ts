import { createSequenceState } from "./progression";
import { AppState, SessionSettings, TriggerRule } from "./types";

export const defaultSettings: SessionSettings = {
  bankroll: 500,
  chipValue: 1,
  tableMaxStake: 400,
  baseScale: 1,
  targetProfitBuffer: 8,
  minimumWatchScore: 4,
  minimumEntryScore: 7,
  autoResetAfterCoveredWin: true,
};

export const defaultRules: TriggerRule[] = [
  { id: "black-streak", label: "Black streak", enabled: true, threshold: 5, weight: 2, category: "colourStreak", target: "black" },
  { id: "red-streak", label: "Red streak", enabled: false, threshold: 5, weight: 2, category: "colourStreak", target: "red" },
  { id: "even-streak", label: "Even streak", enabled: true, threshold: 4, weight: 1, category: "parityStreak", target: "even" },
  { id: "high-streak", label: "High streak", enabled: true, threshold: 4, weight: 1, category: "highLowStreak", target: "high" },
  { id: "dozen-1-absence", label: "Dozen 1 absence", enabled: true, threshold: 8, weight: 2, category: "dozenAbsence", target: "1" },
  { id: "column-1-absence", label: "Column 1 absence", enabled: true, threshold: 7, weight: 1, category: "columnAbsence", target: "1" },
  { id: "low-absence", label: "Low absence", enabled: true, threshold: 6, weight: 2, category: "highLowAbsence", target: "low" },
  { id: "zero-absence", label: "Zero absence", enabled: true, threshold: 24, weight: 1, category: "zeroAbsence" },
];

export function createDefaultState(): AppState {
  return {
    settings: defaultSettings,
    rules: defaultRules,
    spins: [],
    sequence: createSequenceState(defaultSettings),
    sessionNotes: "",
  };
}

export const demoNumbers = [32, 29, 35, 20, 24, 27, 31, 17, 23, 30, 8, 0, 19, 21, 28, 6, 33, 18, 34, 12];
