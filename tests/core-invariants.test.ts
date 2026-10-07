import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DecisionLog,
  IndicatorSnapshot,
  Loan,
  MarketTicker,
  Position,
  TraderProfile,
} from '../src/types/index.ts';
import {
  calculateNetBreakEvenPrice,
  resolvePositionExit,
} from '../src/services/positionRisk.ts';
import { calculateTradePnl } from '../src/services/tradeMath.ts';
import {
  calculateDirectionalBookPersistence,
  calculateOpenInterestDelta,
} from '../src/services/binanceFeed.ts';
import { calculateCreditScore } from '../src/services/creditScore.ts';
import {
  canReservePositionSlot,
  MAX_GLOBAL_OPEN_POSITIONS,
} from '../src/services/engineInvariants.ts';
import { StrategyBrain } from '../src/services/strategyBrain.ts';
import { loadLedger, saveLedger } from '../src/services/ledgerStore.ts';
import { summarizeTraderLogs } from '../src/services/seasonStats.ts';
import {
  calculateDeadlineCollection,
  calculateDebtPressure,
  calculateEffectiveLeverage,
  shouldLockProfitForDebt,
} from '../src/services/debtPressure.ts';
import { normalizeMinimumLeverage } from '../src/services/gameSettings.ts';
import { TradingEngine } from '../src/services/tradingEngine.ts';

const now = 1_800_000_000_000;

function indicator(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
  return {
    timestamp: now,
    symbol: 'BTCUSDT',
    currentPrice: 100,
    klineSampleCount: 60,
    rsi14: 60,
    ema20: 99,
    ema50: 98,
    bbUpper: 104,
    bbLower: 94,
    bbMiddle: 99,
    orderbookImbalance: 0.6,
    orderbookPersistence: 0.8,
    orderbookSampleCount: 20,
    fundingRate: 0,
    spikeShadowRatio: 0.3,
    upperWickRatio: 0.2,
    lowerWickRatio: 0.2,
    volumeSurgeRatio: 2.2,
    atr: 1,
    bbWidth: 0.04,
    spreadPercent: 0.01,
    openInterest: 10_000,
    oiDelta5m: 100,
    oiDelta5mPercent: 1,
    oiHistorySpanMs: 300_000,
    cvd5m: 5_000,
    cvdRatio: 0.65,
    aggTradeCount5m: 100,
    liquidationBurstSide: 'NONE',
    liquidationVolume5m: 0,
    dataQuality: 'READY',
    freshness: {
      price: now,
      book: now,
      mark: now,
      kline: now,
      flow: now,
      openInterest: now,
    },
    ...overrides,
  };
}

function ticker(overrides: Partial<MarketTicker> = {}): MarketTicker {
  return {
    symbol: 'BTCUSDT',
    lastPrice: 100,
    priceChangePercent: 1,
    highPrice: 105,
    lowPrice: 95,
    volume: 1_000,
    quoteVolume: 100_000,
    fundingRate: 0,
    markPrice: 100,
    bestBid: 99.9,
    bestAsk: 100.1,
    bidDepthVolume: 10,
    askDepthVolume: 10,
    orderbookRatio: 0.5,
    updatedAt: now,
    priceUpdatedAt: now,
    bookUpdatedAt: now,
    markUpdatedAt: now,
    klineUpdatedAt: now,
    ...overrides,
  };
}

function trader(overrides: Partial<TraderProfile> = {}): TraderProfile {
  return {
    id: 'selo',
    name: 'Selo Roket',
    nickname: 'Selo',
    title: 'Momentum',
    strategyDescription: '',
    avatarBg: '',
    accentColor: '',
    badgeIcon: '',
    preferredCoins: ['BTCUSDT'],
    maxLeverage: 50,
    balance: 1_000,
    initialBalance: 1_000,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 0,
    isAggressive: true,
    statusText: '',
    riskMode: 'NORMAL',
    consecutiveLosses: 0,
    lastLossTimestamp: 0,
    symbolCooldowns: {},
    creditRating: 'BBB',
    expectedCollectionRate: 50,
    loansPaidOnTime: 0,
    loansPaidLate: 0,
    loansDefaulted: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    voicePitch: 1,
    voiceRate: 1,
    ...overrides,
  };
}

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    traderId: 'selo',
    principal: 1_000,
    interestRate: 20,
    termMinutes: 10,
    createdAt: now - 60_000,
    dueAt: now + 9 * 60_000,
    remainingSeconds: 9 * 60,
    accruedInterest: 200,
    totalDue: 1_200,
    status: 'ACTIVE',
    negotiationRounds: 0,
    actionsTaken: [],
    ...overrides,
  };
}

function decisionLog(overrides: Partial<DecisionLog> = {}): DecisionLog {
  return {
    id: 'log-1',
    timestamp: now,
    schemaVersion: 2,
    seasonId: 's1',
    traderId: 'selo',
    traderName: 'Selo',
    symbol: 'BTCUSDT',
    side: 'LONG',
    leverage: 5,
    entryPrice: 100,
    exitPrice: 101,
    margin: 100,
    realizedPnl: 10,
    roePercent: 10,
    exitReason: 'TAKE_PROFIT',
    strategyName: 'Test',
    entryIndicators: indicator(),
    whyOpened: '',
    whyFailedOrWon: '',
    aiImprovementNote: '',
    confidenceScore: 80,
    marketRegime: 'RANGE',
    holdingDurationSeconds: 60,
    feePaid: 1,
    rMultiple: 1,
    balanceAfterTrade: 1_010,
    cumulativePnl: 10,
    ...overrides,
  };
}

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: 'p1',
    traderId: 'selo',
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 100,
    currentPrice: 100,
    markPrice: 100,
    size: 10,
    notional: 1_000,
    margin: 100,
    leverage: 10,
    liquidationPrice: 80,
    takeProfitPrice: 110,
    stopLossPrice: 95,
    initialStopLossPrice: 95,
    initialRiskAmount: 60,
    rDistance: 5,
    unrealizedPnl: 0,
    roePercent: 0,
    openTime: now,
    status: 'OPEN',
    strategyReason: '',
    strategyName: 'Test',
    entryIndicators: indicator(),
    liquidationDistancePercent: 20,
    confidenceScore: 80,
    marketRegime: 'TREND_UP',
    isBreakevenSet: false,
    isTrailingActive: false,
    maxFavorableExcursion: 0,
    maxAdverseExcursion: 0,
    maxHoldMinutes: 10,
    ...overrides,
  };
}

describe('financial math', () => {
  test('net break-even covers both fees and adverse slippage for long and short', () => {
    for (const side of ['LONG', 'SHORT'] as const) {
      const breakEven = calculateNetBreakEvenPrice(100, side);
      const pnl = calculateTradePnl(100, breakEven, 25, side);
      assert.ok(Math.abs(pnl.netPnl) < 1e-8, `${side} net PnL was ${pnl.netPnl}`);
    }
  });

  test('strategy sizes from a wallet risk budget, not a fixed margin percentage', () => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const result = StrategyBrain.evaluate(trader(), 'BTCUSDT', ticker(), indicator());
      assert.equal(result.shouldEnter, true);
      assert.ok(result.margin > 0 && result.margin <= 280);
      const stopped = calculateTradePnl(
        result.entryPrice,
        result.stopLossPrice,
        result.unitSize,
        result.side!,
      );
      assert.ok(Math.abs(stopped.netPnl) <= result.riskAmount * 1.01);
      assert.ok(result.riskAmount <= 14.01, `risk was ${result.riskAmount}`);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('leverage floor and debt pressure', () => {
  test('minimum leverage is normalized and can override a character ceiling only up to 50x', () => {
    assert.equal(normalizeMinimumLeverage(-10), 1);
    assert.equal(normalizeMinimumLeverage(19.6), 20);
    assert.equal(normalizeMinimumLeverage(999), 50);
    assert.equal(normalizeMinimumLeverage('invalid'), 2);

    assert.equal(calculateEffectiveLeverage({
      preferredLeverage: 4,
      traderMaxLeverage: 15,
      minimumLeverage: 20,
      riskModeFactor: 0.45,
      debtMultiplier: 1,
    }), 20);
    assert.equal(calculateEffectiveLeverage({
      preferredLeverage: 10,
      traderMaxLeverage: 50,
      minimumLeverage: 50,
      riskModeFactor: 1,
      debtMultiplier: 3,
    }), 50);
  });

  test('gambler pressure escalates in the final half and final fifth of a loan', () => {
    const funded = calculateDebtPressure({
      status: 'ACTIVE',
      dueAt: now + 8 * 60_000,
      termMinutes: 10,
    }, now);
    const pressured = calculateDebtPressure({
      status: 'ACTIVE',
      dueAt: now + 4 * 60_000,
      termMinutes: 10,
    }, now);
    const desperate = calculateDebtPressure({
      status: 'ACTIVE',
      dueAt: now + 60_000,
      termMinutes: 10,
    }, now);

    assert.equal(funded.stage, 'FUNDED');
    assert.equal(pressured.stage, 'PRESSURED');
    assert.equal(desperate.stage, 'DESPERATE');
    assert.ok(pressured.riskMultiplier > funded.riskMultiplier);
    assert.ok(desperate.riskMultiplier > pressured.riskMultiplier);
    assert.ok(desperate.confidenceAdjustment < pressured.confidenceAdjustment);
  });

  test('high leverage keeps stop ahead of modeled liquidation while debt raises bounded risk', () => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const pressure = calculateDebtPressure({
        status: 'ACTIVE',
        dueAt: now + 60_000,
        termMinutes: 10,
      }, now);
      const result = StrategyBrain.evaluate(
        trader(),
        'BTCUSDT',
        ticker(),
        indicator(),
        { minimumLeverage: 50, debtPressure: pressure },
      );
      assert.equal(result.shouldEnter, true);
      assert.equal(result.recommendedLeverage, 50);
      assert.ok(result.stopLossPrice > result.liquidationPrice);
      assert.ok(result.riskAmount <= 23.81, `risk was ${result.riskAmount}`);
      assert.ok(result.maxHoldMinutes <= 1);
    } finally {
      Date.now = realNow;
    }
  });

  test('debt profit lock and deadline collection never invent money', () => {
    assert.equal(shouldLockProfitForDebt({
      freeBalance: 900,
      positionMargin: 250,
      unrealizedPnl: 25,
      totalDue: 1_150,
    }), true);
    assert.equal(shouldLockProfitForDebt({
      freeBalance: 1_000,
      positionMargin: 250,
      unrealizedPnl: -1,
      totalDue: 1_100,
      pressureStage: 'DESPERATE',
      currentR: 2,
    }), false);
    assert.equal(shouldLockProfitForDebt({
      freeBalance: 100,
      positionMargin: 100,
      unrealizedPnl: 10,
      totalDue: 1_200,
      pressureStage: 'PRESSURED',
      currentR: 0.8,
    }), true);
    assert.equal(shouldLockProfitForDebt({
      freeBalance: 100,
      positionMargin: 100,
      unrealizedPnl: 10,
      totalDue: 1_200,
      pressureStage: 'PRESSURED',
      currentR: 0.4,
    }), false);
    assert.equal(calculateDeadlineCollection(350, 1_200), 350);
    assert.equal(calculateDeadlineCollection(2_000, 1_200), 1_200);
    assert.equal(calculateDeadlineCollection(-5, 1_200), 0);
  });
});

describe('exit ordering', () => {
  test('liquidation has priority over all other simultaneous triggers', () => {
    const result = resolvePositionExit(
      position({ stopLossPrice: 105, takeProfitPrice: 95 }),
      ticker({ lastPrice: 100, markPrice: 79 }),
      now,
    );
    assert.equal(result?.reason, 'LIQUIDATED');
  });

  test('stop has priority over TP and uses the observed gap price', () => {
    const result = resolvePositionExit(
      position({ stopLossPrice: 105, takeProfitPrice: 95 }),
      ticker({ lastPrice: 100, markPrice: 100 }),
      now,
    );
    assert.deepEqual(result, { reason: 'STOP_LOSS', exitPrice: 100 });
  });

  test('time stop only runs after price-level exits and the configured hold period', () => {
    const result = resolvePositionExit(
      position({ openTime: now - 11 * 60_000, unrealizedPnl: -1 }),
      ticker(),
      now,
    );
    assert.equal(result?.reason, 'TIME_STOP');
  });
});

describe('market-data integrity', () => {
  test('OI delta remains unavailable until a genuine five-minute window exists', () => {
    const short = calculateOpenInterestDelta(
      [{ oi: 100, time: now - 4 * 60_000 }],
      110,
      now,
    );
    assert.equal(short.hasFullWindow, false);
    assert.equal(short.delta, 0);

    const full = calculateOpenInterestDelta(
      [
        { oi: 100, time: now - 5 * 60_000 },
        { oi: 105, time: now - 60_000 },
      ],
      110,
      now,
    );
    assert.equal(full.hasFullWindow, true);
    assert.equal(full.delta, 10);
    assert.equal(full.percent, 10);
  });

  test('order-book persistence preserves direction', () => {
    assert.ok(calculateDirectionalBookPersistence([0.7, 0.65, 0.4]) > 0);
    assert.ok(calculateDirectionalBookPersistence([0.3, 0.35, 0.6]) < 0);
  });

  test('strategies reject missing and stale required real sources', () => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      assert.equal(
        StrategyBrain.evaluate(trader(), 'BTCUSDT', ticker({ lastPrice: 0 }), indicator()).shouldEnter,
        false,
      );
      assert.equal(
        StrategyBrain.evaluate(
          trader(),
          'BTCUSDT',
          ticker(),
          indicator({ freshness: { ...indicator().freshness, flow: now - 6_000 } }),
        ).shouldEnter,
        false,
      );
      assert.equal(
        StrategyBrain.evaluate(
          trader(),
          'BTCUSDT',
          ticker(),
          indicator({ klineSampleCount: 49 }),
        ).shouldEnter,
        false,
      );
    } finally {
      Date.now = realNow;
    }
  });
});

describe('account and credit invariants', () => {
  test('the global position cap is exactly two and one slot per trader', () => {
    const slots: Pick<Position, 'traderId'>[] = [{ traderId: 'selo' }, { traderId: 'mehmet' }];
    assert.equal(MAX_GLOBAL_OPEN_POSITIONS, 2);
    assert.equal(canReservePositionSlot(slots, 'kemal'), false);
    assert.equal(canReservePositionSlot(slots.slice(0, 1), 'selo'), false);
    assert.equal(canReservePositionSlot(slots.slice(0, 1), 'kemal'), true);
  });

  test('season hydration excludes lifetime logs and rebuilds the current loss streak', () => {
    const logs = [
      decisionLog({ id: 'old', seasonId: 'old', timestamp: now - 3_000, realizedPnl: 100 }),
      decisionLog({ id: 'win', seasonId: 's1', timestamp: now - 2_000, realizedPnl: 20 }),
      decisionLog({ id: 'loss-1', seasonId: 's1', timestamp: now - 1_000, realizedPnl: -5 }),
      decisionLog({ id: 'loss-2', seasonId: 's1', timestamp: now, realizedPnl: -7 }),
    ];
    assert.deepEqual(summarizeTraderLogs(logs, 'selo', 's1'), {
      totalPnl: 8,
      winCount: 1,
      lossCount: 2,
      consecutiveLosses: 2,
    });
    assert.equal(summarizeTraderLogs(logs, 'selo').totalPnl, 108);
  });

  test('repayment behavior, not trading wins, drives credit score', () => {
    const onTime = calculateCreditScore({
      loansPaidOnTime: 3,
      loansPaidLate: 0,
      loansDefaulted: 0,
      totalBorrowed: 300,
      totalRepaid: 360,
    });
    const late = calculateCreditScore({
      loansPaidOnTime: 0,
      loansPaidLate: 3,
      loansDefaulted: 0,
      totalBorrowed: 300,
      totalRepaid: 360,
    });
    const defaulted = calculateCreditScore({
      loansPaidOnTime: 0,
      loansPaidLate: 0,
      loansDefaulted: 3,
      totalBorrowed: 300,
      totalRepaid: 0,
    });
    assert.ok(onTime > late);
    assert.ok(late > defaulted);
    assert.equal(calculateCreditScore({
      loansPaidOnTime: 0,
      loansPaidLate: 0,
      loansDefaulted: 0,
      totalBorrowed: 0,
      totalRepaid: 0,
    }), 50);
  });
});

describe('loan deadline enforcement', () => {
  test('available free balance repays immediately without a 500 USDT buffer', () => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const engine = new TradingEngine();
      const activeLoan = loan();
      engine.loans = [activeLoan];
      engine.traders.selo.activeLoanId = activeLoan.id;
      engine.traders.selo.balance = 1_200;
      const cashBefore = engine.cashBalance;

      (engine as unknown as { updateLoans: () => void }).updateLoans();

      assert.equal(activeLoan.status, 'PAID');
      assert.equal(engine.traders.selo.balance, 0);
      assert.equal(engine.traders.selo.activeLoanId, null);
      assert.equal(engine.traders.selo.loansPaidOnTime, 1);
      assert.equal(engine.cashBalance, cashBefore + 1_200);
      engine.destroy();
    } finally {
      Date.now = realNow;
    }
  });

  test('maturity collects only real free balance and defaults the remainder', () => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const engine = new TradingEngine();
      const maturedLoan = loan({
        dueAt: now - 1,
        remainingSeconds: 0,
      });
      engine.loans = [maturedLoan];
      engine.openPositions = [];
      engine.traders.selo.activeLoanId = maturedLoan.id;
      engine.traders.selo.balance = 350;
      const cashBefore = engine.cashBalance;

      (engine as unknown as { updateLoans: () => void }).updateLoans();

      assert.equal(maturedLoan.status, 'DEFAULTED');
      assert.equal(maturedLoan.repaidAmount, 350);
      assert.equal(maturedLoan.totalDue, 850);
      assert.equal(engine.traders.selo.balance, 0);
      assert.equal(engine.traders.selo.activeLoanId, null);
      assert.equal(engine.traders.selo.loansDefaulted, 1);
      assert.equal(engine.traders.selo.creditRating, 'D');
      assert.equal(engine.cashBalance, cashBefore + 350);
      engine.destroy();
    } finally {
      Date.now = realNow;
    }
  });
});

// Kept as the last suite because it temporarily installs a browser-like global.
describe('ledger persistence', () => {
  test('migrates legacy logs and persists schema-v2 season data', () => {
    const values = new Map<string, string>();
    values.set('tefeci_decision_logs', JSON.stringify([{
      id: 'legacy-1',
      timestamp: now,
      traderId: 'selo',
      traderName: 'Selo',
      symbol: 'BTCUSDT',
      side: 'LONG',
      realizedPnl: 12,
    }]));
    const localStorage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, value); },
    } as Storage;
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    try {
      const migrated = loadLedger();
      assert.equal(migrated.logs.length, 1);
      assert.equal(migrated.logs[0].schemaVersion, 2);
      assert.equal(migrated.logs[0].seasonId, 'legacy');
      assert.equal(migrated.logs[0].holdingDurationSeconds, -1);

      saveLedger(migrated);
      assert.equal(localStorage.getItem('tefeci_decision_logs'), null);
      const stored = JSON.parse(localStorage.getItem('tefeci_ledger_v2')!);
      assert.equal(stored.version, 2);
      assert.equal(stored.seasonId, migrated.seasonId);
    } finally {
      if (previous) Object.defineProperty(globalThis, 'window', previous);
      else delete (globalThis as { window?: unknown }).window;
    }
  });
});
