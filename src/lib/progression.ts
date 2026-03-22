import { SequenceState, SessionSettings } from "./types";

export function getNextScale(openLosses: number, targetProfitBuffer: number, baseScale: number) {
  return Math.max(baseScale, Math.ceil((openLosses + targetProfitBuffer) / 8));
}

export function getStakeBreakdown(scale: number) {
  return {
    scale,
    stakeHigh: 14 * scale,
    stakeMid: 5 * scale,
    stakeZero: 1 * scale,
    totalStake: 20 * scale,
    worstCoveredWinProfit: 8 * scale,
    bestCoveredWinProfit: 16 * scale,
    uncoveredLossAmount: 20 * scale,
  };
}

export function getJamesBondProfit(number: number, scale: number) {
  if (number === 0) return 16 * scale;
  if (number >= 13 && number <= 18) return 10 * scale;
  if (number >= 19 && number <= 36) return 8 * scale;
  return -20 * scale;
}

export function createSequenceState(settings: SessionSettings): SequenceState {
  const nextScale = getNextScale(0, settings.targetProfitBuffer, settings.baseScale);
  const breakdown = getStakeBreakdown(nextScale);
  return {
    active: false,
    openLosses: 0,
    nextScale,
    nextTotalStake: breakdown.totalStake,
    stakeZero: breakdown.stakeZero,
    stakeMid: breakdown.stakeMid,
    stakeHigh: breakdown.stakeHigh,
    longestLosingSequence: 0,
    currentLosingSequence: 0,
    betsTaken: 0,
    wins: 0,
    losses: 0,
    runningPL: 0,
    currentDrawdown: 0,
    maxDrawdown: 0,
  };
}

export function refreshSequence(openLosses: number, settings: SessionSettings, base?: Partial<SequenceState>): SequenceState {
  const nextScale = getNextScale(openLosses, settings.targetProfitBuffer, settings.baseScale);
  const breakdown = getStakeBreakdown(nextScale);
  return {
    ...createSequenceState(settings),
    ...base,
    openLosses,
    nextScale,
    nextTotalStake: breakdown.totalStake,
    stakeZero: breakdown.stakeZero,
    stakeMid: breakdown.stakeMid,
    stakeHigh: breakdown.stakeHigh,
  };
}
