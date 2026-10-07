export type TraderId = 'mehmet' | 'kemal' | 'nuri' | 'selo' | 'sevil';
export type CharacterId = TraderId | 'cirak';

export type RiskMode = 'NORMAL' | 'TEMKINLI' | 'BUZDA';
export type MarketRegime = 'TREND_UP' | 'TREND_DOWN' | 'RANGE';
export type DataQuality = 'READY' | 'WARMING' | 'STALE';

export interface TraderProfile {
  id: TraderId;
  name: string;
  nickname: string;
  title: string;
  strategyDescription: string;
  avatarBg: string;
  accentColor: string;
  badgeIcon: string;
  preferredCoins: string[];
  maxLeverage: number;
  balance: number;
  initialBalance: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  activeLoanId: string | null;
  fearLevel: number;
  isAggressive: boolean;
  statusText: string;
  riskMode: RiskMode;
  consecutiveLosses: number;
  lastLossTimestamp: number;
  symbolCooldowns: Record<string, number>;
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'CCC' | 'D';
  expectedCollectionRate: number; // 0-100 repayment-based score; not a calibrated probability
  loansPaidOnTime: number;
  loansPaidLate: number;
  loansDefaulted: number;
  totalBorrowed: number;
  totalRepaid: number;
  voicePitch: number;
  voiceRate: number;
}

export type OrderSide = 'LONG' | 'SHORT';

// Unix epoch milliseconds for the last valid message from each real source.
export interface SourceFreshness {
  price: number;
  book: number;
  mark: number;
  kline: number;
  flow: number;
  openInterest: number;
}

export interface IndicatorSnapshot {
  timestamp: number;
  symbol: string;
  currentPrice: number;
  klineSampleCount: number;
  rsi14: number;
  ema20: number;
  ema50: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  orderbookImbalance: number;
  orderbookPersistence: number; // -1 persistent asks, +1 persistent bids
  orderbookSampleCount: number;
  fundingRate: number;
  spikeShadowRatio: number;
  upperWickRatio: number;
  lowerWickRatio: number;
  volumeSurgeRatio: number;
  atr: number;
  bbWidth: number;
  spreadPercent: number;
  openInterest: number;
  oiDelta5m: number;
  oiDelta5mPercent: number;
  oiHistorySpanMs: number;
  cvd5m: number;
  cvdRatio: number;
  aggTradeCount5m: number;
  liquidationBurstSide: 'LONG' | 'SHORT' | 'NONE';
  liquidationVolume5m: number;
  dataQuality: DataQuality;
  freshness: SourceFreshness;
}

export type DataHealthState =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'BLOCKED'
  | 'OFFLINE';

export interface DataHealthStatus {
  status: DataHealthState;
  latencyMs: number | null;
  lastMessageTime: number;
  lastPriceMessageTime: number;
  activeStreamsCount: number;
  totalMessagesReceived: number;
  readySymbols: number;
  oiReadySymbols: number;
  totalSymbols: number;
  detail: string;
}

export interface Position {
  id: string;
  traderId: TraderId;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  currentPrice: number;
  markPrice: number;
  size: number;
  notional: number;
  margin: number;
  leverage: number;
  liquidationPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  initialStopLossPrice: number;
  initialRiskAmount: number;
  rDistance: number;
  unrealizedPnl: number;
  roePercent: number;
  openTime: number;
  closeTime?: number;
  closePrice?: number;
  realizedPnl?: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  strategyReason: string;
  entryIndicators: IndicatorSnapshot;
  liquidationDistancePercent: number;
  confidenceScore: number;
  marketRegime: MarketRegime;
  isBreakevenSet: boolean;
  isTrailingActive: boolean;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  maxHoldMinutes: number;
  strategyName: string;
}

export interface Loan {
  id: string;
  traderId: TraderId;
  principal: number;
  interestRate: number;
  termMinutes: number;
  createdAt: number;
  dueAt: number;
  remainingSeconds: number;
  accruedInterest: number;
  totalDue: number;
  status: 'PROPOSAL' | 'ACTIVE' | 'OVERDUE' | 'PAID' | 'DEFAULTED';
  negotiationRounds: number;
  wasEverOverdue?: boolean;
  paidAt?: number;
  repaidAmount?: number;
  lastCounterOffer?: {
    principal: number;
    interestRate: number;
    termMinutes: number;
    speech: string;
  };
  actionsTaken: ('THREATENED' | 'INTEREST_DOUBLED' | 'TERM_EXTENDED')[];
}

export type ExitReason =
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'BREAKEVEN'
  | 'TRAILING_STOP'
  | 'TIME_STOP'
  | 'LIQUIDATED'
  | 'MARGIN_CUT'
  | 'DEBT_PROFIT_LOCK'
  | 'DEBT_DEADLINE';

export interface DecisionLog {
  id: string;
  timestamp: number;
  schemaVersion: 2;
  seasonId: string;
  traderId: TraderId;
  traderName: string;
  symbol: string;
  side: OrderSide;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  margin: number;
  realizedPnl: number;
  roePercent: number;
  exitReason: ExitReason;
  strategyName: string;
  entryIndicators: IndicatorSnapshot;
  whyOpened: string;
  whyFailedOrWon: string;
  aiImprovementNote: string;
  confidenceScore: number;
  marketRegime: MarketRegime;
  holdingDurationSeconds: number; // -1 means unknown in migrated legacy data
  feePaid: number;
  rMultiple: number;
  balanceAfterTrade: number;
  cumulativePnl: number;
}

export interface NewsEvent {
  id: string;
  timestamp: number;
  type:
    | 'LIQUIDATION'
    | 'LOAN_REQUEST'
    | 'LOAN_OVERDUE'
    | 'THREAT'
    | 'MASSIVE_PROFIT'
    | 'WHALE_ALERT'
    | 'LOAN_PAID'
    | 'RISK_ALERT';
  speaker: CharacterId;
  speakerName: string;
  message: string;
  badge: string;
  urgent?: boolean;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  fundingRate: number;
  markPrice: number;
  bestBid: number;
  bestAsk: number;
  bidDepthVolume: number;
  askDepthVolume: number;
  orderbookRatio: number;
  updatedAt: number;
  priceUpdatedAt: number;
  bookUpdatedAt: number;
  markUpdatedAt: number;
  klineUpdatedAt: number;
}

export interface AppState {
  cashBalance: number;
  startingBalance: number;
  totalDistributedLoans: number;
  totalCollectedInterest: number;
  selectedSymbols: string[];
  soundEnabled: boolean;
  ttsEnabled: boolean;
  minimumLeverage: number;
  jargonLevel: 'orta' | 'sert';
}
