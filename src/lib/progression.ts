import { SequenceState, SessionSettings } from "./types";

export function getNextScale(openLosses: number, targetProfitBuffer: number, baseScale: number) {
  return Math.max(baseScale, Math.ceil((openLosses + targetProfitBuffer) / 8));
}

export function totalStakeToScale(totalStake: number, baseScale = 1) {
  return Math.max(baseScale, Math.ceil(totalStake / 20));
}

export function resolveScaleForSettings(openLosses: number, settings: SessionSettings) {
  const minimumRecoveryScale = getNextScale(openLosses, settings.targetProfitBuffer, settings.baseScale);
  if (settings.stakeSizingMode === "customTotalStake") {
    const customScale = totalStakeToScale(settings.customTotalStake, settings.baseScale);
    return {
      minimumRecoveryScale,
      activeScale: Math.max(minimumRecoveryScale, customScale),
      customScale,
      customStakeTooLow: customScale < minimumRecoveryScale,
    };
  }

  return {
    minimumRecoveryScale,
    activeScale: minimumRecoveryScale,
    customScale: minimumRecoveryScale,
    customStakeTooLow: false,
  };
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
  const resolved = resolveScaleForSettings(0, settings);
  const breakdown = getStakeBreakdown(resolved.activeScale);
  return {
    active: false,
    openLosses: 0,
    nextScale: breakdown.scale,
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
  const resolved = resolveScaleForSettings(openLosses, settings);
  const breakdown = getStakeBreakdown(resolved.activeScale);
  return {
    ...createSequenceState(settings),
    ...base,
    openLosses,
    nextScale: breakdown.scale,
    nextTotalStake: breakdown.totalStake,
    stakeZero: breakdown.stakeZero,
    stakeMid: breakdown.stakeMid,
    stakeHigh: breakdown.stakeHigh,
  };
}

export function getRecoveryLadder(settings: SessionSettings, startingOpenLosses: number, steps: number) {
  const rows: Array<{
    lossStep: number;
    openLossesBefore: number;
    minimumScaleNeeded: number;
    activeScale: number;
    totalStake: number;
    worstCoveredWinProfit: number;
    bestCoveredWinProfit: number;
    uncoveredLossIfLostAgain: number;
    openLossesIfLostAgain: number;
  }> = [];

  let openLosses = startingOpenLosses;
  for (let i = 0; i < steps; i += 1) {
    const resolved = resolveScaleForSettings(openLosses, settings);
    const breakdown = getStakeBreakdown(resolved.activeScale);
    rows.push({
      lossStep: i,
      openLossesBefore: openLosses,
      minimumScaleNeeded: resolved.minimumRecoveryScale,
      activeScale: resolved.activeScale,
      totalStake: breakdown.totalStake,
      worstCoveredWinProfit: breakdown.worstCoveredWinProfit,
      bestCoveredWinProfit: breakdown.bestCoveredWinProfit,
      uncoveredLossIfLostAgain: breakdown.uncoveredLossAmount,
      openLossesIfLostAgain: openLosses + breakdown.uncoveredLossAmount,
    });
    openLosses += breakdown.uncoveredLossAmount;
  }

  return rows;
}
