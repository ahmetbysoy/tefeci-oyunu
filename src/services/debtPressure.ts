import { Loan } from '../types';
import {
  MINIMUM_LEVERAGE_MAX,
  normalizeMinimumLeverage,
} from './gameSettings';

export type DebtPressureStage =
  | 'NONE'
  | 'FUNDED'
  | 'PRESSURED'
  | 'DESPERATE'
  | 'OVERDUE';

export interface DebtPressureProfile {
  stage: DebtPressureStage;
  remainingSeconds: number;
  remainingRatio: number;
  confidenceAdjustment: number;
  leverageMultiplier: number;
  riskMultiplier: number;
  maxMarginMultiplier: number;
}

const NEUTRAL_PRESSURE: DebtPressureProfile = {
  stage: 'NONE',
  remainingSeconds: Number.POSITIVE_INFINITY,
  remainingRatio: 1,
  confidenceAdjustment: 0,
  leverageMultiplier: 1,
  riskMultiplier: 1,
  maxMarginMultiplier: 1,
};

export function calculateDebtPressure(
  loan: Pick<Loan, 'status' | 'dueAt' | 'termMinutes'> | null | undefined,
  now: number,
): DebtPressureProfile {
  if (!loan || (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE')) {
    return { ...NEUTRAL_PRESSURE };
  }

  const totalSeconds = Math.max(1, loan.termMinutes * 60);
  const remainingSeconds = Math.max(0, Math.ceil((loan.dueAt - now) / 1000));
  const remainingRatio = Math.min(1, remainingSeconds / totalSeconds);

  if (loan.status === 'OVERDUE' || remainingSeconds === 0) {
    return {
      stage: 'OVERDUE',
      remainingSeconds: 0,
      remainingRatio: 0,
      confidenceAdjustment: -16,
      leverageMultiplier: 2.5,
      riskMultiplier: 1.9,
      maxMarginMultiplier: 1.45,
    };
  }

  if (remainingRatio <= 0.2) {
    return {
      stage: 'DESPERATE',
      remainingSeconds,
      remainingRatio,
      confidenceAdjustment: -12,
      leverageMultiplier: 2.2,
      riskMultiplier: 1.7,
      maxMarginMultiplier: 1.35,
    };
  }

  if (remainingRatio <= 0.5) {
    return {
      stage: 'PRESSURED',
      remainingSeconds,
      remainingRatio,
      confidenceAdjustment: -6,
      leverageMultiplier: 1.5,
      riskMultiplier: 1.3,
      maxMarginMultiplier: 1.15,
    };
  }

  return {
    stage: 'FUNDED',
    remainingSeconds,
    remainingRatio,
    confidenceAdjustment: 0,
    leverageMultiplier: 1,
    riskMultiplier: 1,
    maxMarginMultiplier: 1,
  };
}

export function calculateEffectiveLeverage({
  preferredLeverage,
  traderMaxLeverage,
  minimumLeverage,
  riskModeFactor,
  debtMultiplier,
}: {
  preferredLeverage: number;
  traderMaxLeverage: number;
  minimumLeverage: number;
  riskModeFactor: number;
  debtMultiplier: number;
}) {
  const floor = normalizeMinimumLeverage(minimumLeverage);
  const personalMaximum = Math.min(
    MINIMUM_LEVERAGE_MAX,
    Math.max(1, Math.round(traderMaxLeverage)),
  );
  // The player explicitly chose an overriding floor. When that floor is above
  // a character's personal maximum, the floor wins but the engine-wide 50x
  // hard ceiling remains in force.
  const effectiveMaximum = Math.max(personalMaximum, floor);
  const desired = Math.round(
    Math.max(1, preferredLeverage) *
    Math.max(0, riskModeFactor) *
    Math.max(1, debtMultiplier),
  );

  return Math.min(effectiveMaximum, Math.max(floor, desired));
}

export function shouldLockProfitForDebt({
  freeBalance,
  positionMargin,
  unrealizedPnl,
  totalDue,
  pressureStage = 'NONE',
  currentR = 0,
}: {
  freeBalance: number;
  positionMargin: number;
  unrealizedPnl: number;
  totalDue: number;
  pressureStage?: DebtPressureStage;
  currentR?: number;
}) {
  if (
    !Number.isFinite(freeBalance) ||
    !Number.isFinite(positionMargin) ||
    !Number.isFinite(unrealizedPnl) ||
    !Number.isFinite(totalDue) ||
    totalDue <= 0 ||
    unrealizedPnl <= 0
  ) {
    return false;
  }

  const releasableEquity = Math.max(0, positionMargin + unrealizedPnl);
  if (freeBalance + releasableEquity >= totalDue) return true;

  // A pressured gambler realizes progressively smaller *net* winners instead
  // of letting every green position ride back into the deadline. Normal funded
  // trading still waits for its strategy target unless the whole debt is covered.
  if (pressureStage === 'DESPERATE') return currentR >= 0.25;
  if (pressureStage === 'PRESSURED') return currentR >= 0.75;
  return false;
}

export function calculateDeadlineCollection(freeBalance: number, totalDue: number) {
  if (!Number.isFinite(freeBalance) || !Number.isFinite(totalDue) || totalDue <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, freeBalance), totalDue);
}
