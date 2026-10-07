import { DecisionLog, IndicatorSnapshot, TraderId, TraderProfile } from '../types';

const STORAGE_KEY = 'tefeci_ledger_v2';
const LEGACY_LOG_KEY = 'tefeci_decision_logs';
export const MAX_LEDGER_LOGS = 500;
const TRADER_IDS: TraderId[] = ['selo', 'mehmet', 'kemal', 'nuri', 'sevil'];

export interface PersistedLoanHistory {
  loansPaidOnTime: number;
  loansPaidLate: number;
  loansDefaulted: number;
  totalBorrowed: number;
  totalRepaid: number;
}

export interface LedgerState {
  version: 2;
  seasonId: string;
  logs: DecisionLog[];
  loanHistory: Partial<Record<TraderId, PersistedLoanHistory>>;
  savedAt: number;
}

export function createSeasonId() {
  return `season_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const emptyFreshness = {
  price: 0,
  book: 0,
  mark: 0,
  kline: 0,
  flow: 0,
  openInterest: 0,
};

function normalizeIndicators(raw: Partial<IndicatorSnapshot> | undefined): IndicatorSnapshot {
  return {
    timestamp: Number(raw?.timestamp || 0),
    symbol: String(raw?.symbol || ''),
    currentPrice: Number(raw?.currentPrice || 0),
    klineSampleCount: Number(raw?.klineSampleCount || 0),
    rsi14: Number(raw?.rsi14 || 50),
    ema20: Number(raw?.ema20 || 0),
    ema50: Number(raw?.ema50 || 0),
    bbUpper: Number(raw?.bbUpper || 0),
    bbLower: Number(raw?.bbLower || 0),
    bbMiddle: Number(raw?.bbMiddle || 0),
    orderbookImbalance: Number(raw?.orderbookImbalance ?? 0.5),
    orderbookPersistence: Number(raw?.orderbookPersistence || 0),
    orderbookSampleCount: Number(raw?.orderbookSampleCount || 0),
    fundingRate: Number(raw?.fundingRate || 0),
    spikeShadowRatio: Number(raw?.spikeShadowRatio || 0),
    upperWickRatio: Number(raw?.upperWickRatio || 0),
    lowerWickRatio: Number(raw?.lowerWickRatio || 0),
    volumeSurgeRatio: Number(raw?.volumeSurgeRatio || 0),
    atr: Number(raw?.atr || 0),
    bbWidth: Number(raw?.bbWidth || 0),
    spreadPercent: Number(raw?.spreadPercent || 0),
    openInterest: Number(raw?.openInterest || 0),
    oiDelta5m: Number(raw?.oiDelta5m || 0),
    oiDelta5mPercent: Number(raw?.oiDelta5mPercent || 0),
    oiHistorySpanMs: Number(raw?.oiHistorySpanMs || 0),
    cvd5m: Number(raw?.cvd5m || 0),
    cvdRatio: Number(raw?.cvdRatio ?? 0.5),
    aggTradeCount5m: Number(raw?.aggTradeCount5m || 0),
    liquidationBurstSide: raw?.liquidationBurstSide || 'NONE',
    liquidationVolume5m: Number(raw?.liquidationVolume5m || 0),
    dataQuality: raw?.dataQuality || 'STALE',
    freshness: { ...emptyFreshness, ...(raw?.freshness || {}) },
  };
}

function normalizeLoanHistory(
  raw: Partial<Record<TraderId, PersistedLoanHistory>> | undefined,
): Partial<Record<TraderId, PersistedLoanHistory>> {
  const result: Partial<Record<TraderId, PersistedLoanHistory>> = {};
  TRADER_IDS.forEach((id) => {
    const record = raw?.[id];
    if (!record) return;
    result[id] = {
      loansPaidOnTime: Math.max(0, Number(record.loansPaidOnTime) || 0),
      loansPaidLate: Math.max(0, Number(record.loansPaidLate) || 0),
      loansDefaulted: Math.max(0, Number(record.loansDefaulted) || 0),
      totalBorrowed: Math.max(0, Number(record.totalBorrowed) || 0),
      totalRepaid: Math.max(0, Number(record.totalRepaid) || 0),
    };
  });
  return result;
}

function normalizeLog(raw: Partial<DecisionLog>, fallbackSeason: string): DecisionLog | null {
  if (
    !raw.id ||
    !raw.traderId ||
    !TRADER_IDS.includes(raw.traderId) ||
    !Number.isFinite(Number(raw.realizedPnl))
  ) return null;
  return {
    id: String(raw.id),
    timestamp: Number(raw.timestamp || Date.now()),
    schemaVersion: 2,
    seasonId: String(raw.seasonId || fallbackSeason),
    traderId: raw.traderId,
    traderName: String(raw.traderName || raw.traderId),
    symbol: String(raw.symbol || ''),
    side: raw.side === 'SHORT' ? 'SHORT' : 'LONG',
    leverage: Number(raw.leverage || 1),
    entryPrice: Number(raw.entryPrice || 0),
    exitPrice: Number(raw.exitPrice || 0),
    margin: Number(raw.margin || 0),
    realizedPnl: Number(raw.realizedPnl || 0),
    roePercent: Number(raw.roePercent || 0),
    exitReason: raw.exitReason || 'STOP_LOSS',
    strategyName: String(raw.strategyName || ''),
    entryIndicators: normalizeIndicators(raw.entryIndicators),
    whyOpened: String(raw.whyOpened || ''),
    whyFailedOrWon: String(raw.whyFailedOrWon || ''),
    aiImprovementNote: String(raw.aiImprovementNote || ''),
    confidenceScore: Number(raw.confidenceScore || 0),
    marketRegime: raw.marketRegime || 'RANGE',
    holdingDurationSeconds: Number.isFinite(Number(raw.holdingDurationSeconds))
      ? Number(raw.holdingDurationSeconds)
      : -1,
    feePaid: Number(raw.feePaid || 0),
    rMultiple: Number(raw.rMultiple || 0),
    balanceAfterTrade: Number(raw.balanceAfterTrade || 0),
    cumulativePnl: Number(raw.cumulativePnl || 0),
  };
}

export function loadLedger(): LedgerState {
  const fresh: LedgerState = {
    version: 2,
    seasonId: createSeasonId(),
    logs: [],
    loanHistory: {},
    savedAt: Date.now(),
  };
  if (typeof window === 'undefined') return fresh;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LedgerState>;
      if (parsed.version === 2 && parsed.seasonId) {
        return {
          version: 2,
          seasonId: parsed.seasonId,
          logs: (parsed.logs || [])
            .map((log) => normalizeLog(log, parsed.seasonId!))
            .filter((log): log is DecisionLog => Boolean(log))
            .slice(0, MAX_LEDGER_LOGS),
          loanHistory: normalizeLoanHistory(parsed.loanHistory),
          savedAt: Number(parsed.savedAt || Date.now()),
        };
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_LOG_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<DecisionLog>[];
      fresh.logs = legacy
        .map((log) => normalizeLog(log, 'legacy'))
        .filter((log): log is DecisionLog => Boolean(log))
        .slice(0, MAX_LEDGER_LOGS);
    }
  } catch (error) {
    console.warn('Sicil kaydı okunamadı:', error);
  }
  return fresh;
}

export function extractLoanHistory(
  traders: Record<TraderId, TraderProfile>,
): Partial<Record<TraderId, PersistedLoanHistory>> {
  return Object.fromEntries(
    (Object.keys(traders) as TraderId[]).map((id) => {
      const trader = traders[id];
      return [
        id,
        {
          loansPaidOnTime: trader.loansPaidOnTime,
          loansPaidLate: trader.loansPaidLate,
          loansDefaulted: trader.loansDefaulted,
          totalBorrowed: trader.totalBorrowed,
          totalRepaid: trader.totalRepaid,
        },
      ];
    }),
  );
}

export function saveLedger(state: LedgerState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, logs: state.logs.slice(0, MAX_LEDGER_LOGS), savedAt: Date.now() }),
    );
    window.localStorage.removeItem(LEGACY_LOG_KEY);
  } catch (error) {
    console.warn('Sicil kaydı yazılamadı:', error);
  }
}
