export type RouletteColour = "red" | "black" | "green";
export type Parity = "odd" | "even" | "zero";
export type RangeBand = "low" | "high" | "zero";
export type Dozen = 1 | 2 | 3 | 0;
export type Column = 1 | 2 | 3 | 0;
export type JamesBondZone = "zero" | "mid" | "high" | "uncovered";
export type Status = "WAIT" | "WATCH" | "ENTER";

export type Spin = {
  id: string;
  index: number;
  number: number;
  colour: RouletteColour;
  parity: Parity;
  rangeBand: RangeBand;
  dozen: Dozen;
  column: Column;
  jamesBondZone: JamesBondZone;
  triggerScore: number;
  triggerReasons: string[];
  status: Status;
  betTaken: boolean;
  triggerLabel?: string;
  scaleUsed?: number;
  totalStake?: number;
  stakeZero?: number;
  stakeMid?: number;
  stakeHigh?: number;
  spinPL?: number;
  runningPL?: number;
  openLossesAfter?: number;
  createdAt: string;
  notes?: string;
};

export type TriggerCategory =
  | "colourStreak"
  | "parityStreak"
  | "highLowStreak"
  | "dozenStreak"
  | "columnStreak"
  | "colourAbsence"
  | "highLowAbsence"
  | "dozenAbsence"
  | "columnAbsence"
  | "zeroAbsence";

export type TriggerRule = {
  id: string;
  label: string;
  enabled: boolean;
  threshold: number;
  weight: number;
  category: TriggerCategory;
  target?: string;
};

export type StakeSizingMode = "scale" | "customTotalStake";

export type SessionSettings = {
  bankroll: number;
  chipValue: number;
  tableMaxStake: number;
  baseScale: number;
  targetProfitBuffer: number;
  minimumWatchScore: number;
  minimumEntryScore: number;
  autoResetAfterCoveredWin: boolean;
  stakeSizingMode: StakeSizingMode;
  customTotalStake: number;
};

export type SequenceState = {
  active: boolean;
  openLosses: number;
  nextScale: number;
  nextTotalStake: number;
  stakeZero: number;
  stakeMid: number;
  stakeHigh: number;
  longestLosingSequence: number;
  currentLosingSequence: number;
  betsTaken: number;
  wins: number;
  losses: number;
  runningPL: number;
  currentDrawdown: number;
  maxDrawdown: number;
};

export type TrackerSnapshot = {
  currentRedStreak: number;
  currentBlackStreak: number;
  currentOddStreak: number;
  currentEvenStreak: number;
  currentHighStreak: number;
  currentLowStreak: number;
  currentDozenStreak: { dozen: Dozen; length: number };
  currentColumnStreak: { column: Column; length: number };
  spinsSinceRed: number;
  spinsSinceBlack: number;
  spinsSinceOdd: number;
  spinsSinceEven: number;
  spinsSinceHigh: number;
  spinsSinceLow: number;
  spinsSinceDozen1: number;
  spinsSinceDozen2: number;
  spinsSinceDozen3: number;
  spinsSinceColumn1: number;
  spinsSinceColumn2: number;
  spinsSinceColumn3: number;
  spinsSinceZero: number;
  spinsSinceUncovered: number;
  spinsSinceBondHigh: number;
  spinsSinceBondMid: number;
};

export type AppState = {
  settings: SessionSettings;
  rules: TriggerRule[];
  spins: Spin[];
  sequence: SequenceState;
  sessionNotes: string;
};
