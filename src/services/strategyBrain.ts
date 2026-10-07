import {
  IndicatorSnapshot,
  MarketRegime,
  MarketTicker,
  OrderSide,
  RiskMode,
  TraderProfile,
} from '../types';
import { calculateCreditScore } from './creditScore';
import { calculateTradePnl } from './tradeMath';
import {
  calculateEffectiveLeverage,
  DebtPressureProfile,
} from './debtPressure';
import { DEFAULT_ENGINE_SETTINGS } from './gameSettings';

const TAKER_FEE_RATE = 0.0005;
const ROUND_TRIP_SLIPPAGE_RATE = 0.0002;

export interface StrategyEvaluationContext {
  minimumLeverage?: number;
  debtPressure?: DebtPressureProfile;
}

export interface StrategyEvaluationResult {
  shouldEnter: boolean;
  side: OrderSide | null;
  confidenceScore: number;
  reason: string;
  strategyName: string;
  marketRegime: MarketRegime;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  liquidationPrice: number;
  initialStopDistance: number;
  recommendedLeverage: number;
  riskAmount: number;
  notionalSize: number;
  unitSize: number;
  margin: number;
  maxHoldMinutes: number;
}

interface RiskRules {
  riskPercent: number;
  maxMarginPercent: number;
  preferredLeverage: number;
  maxHoldMinutes: number;
  rewardRisk: number;
  stopFloorPercent: number;
  stopCeilingPercent: number;
}

const RISK_RULES: Record<TraderProfile['id'], RiskRules> = {
  selo: {
    riskPercent: 0.014,
    maxMarginPercent: 0.28,
    preferredLeverage: 10,
    maxHoldMinutes: 10,
    rewardRisk: 1.7,
    stopFloorPercent: 0.005,
    stopCeilingPercent: 0.018,
  },
  mehmet: {
    riskPercent: 0.01,
    maxMarginPercent: 0.25,
    preferredLeverage: 7,
    maxHoldMinutes: 15,
    rewardRisk: 1.9,
    stopFloorPercent: 0.0045,
    stopCeilingPercent: 0.016,
  },
  kemal: {
    riskPercent: 0.008,
    maxMarginPercent: 0.22,
    preferredLeverage: 6,
    maxHoldMinutes: 12,
    rewardRisk: 1.8,
    stopFloorPercent: 0.004,
    stopCeilingPercent: 0.014,
  },
  nuri: {
    riskPercent: 0.008,
    maxMarginPercent: 0.22,
    preferredLeverage: 5,
    maxHoldMinutes: 20,
    rewardRisk: 2.1,
    stopFloorPercent: 0.005,
    stopCeilingPercent: 0.018,
  },
  sevil: {
    riskPercent: 0.007,
    maxMarginPercent: 0.2,
    preferredLeverage: 4,
    maxHoldMinutes: 18,
    rewardRisk: 1.7,
    stopFloorPercent: 0.0035,
    stopCeilingPercent: 0.012,
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFresh = (timestamp: number, maxAge: number) => {
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && timestamp > 0 && age >= -2_000 && age <= maxAge;
};

export class StrategyBrain {
  public static detectMarketRegime(
    ticker: MarketTicker,
    ind: IndicatorSnapshot,
  ): MarketRegime {
    const emaDiffPercent = ind.ema50 > 0
      ? (ind.ema20 - ind.ema50) / ind.ema50
      : 0;
    if (ind.bbWidth >= 0.025 && emaDiffPercent > 0.002 && ticker.lastPrice > ind.ema20) {
      return 'TREND_UP';
    }
    if (ind.bbWidth >= 0.025 && emaDiffPercent < -0.002 && ticker.lastPrice < ind.ema20) {
      return 'TREND_DOWN';
    }
    return 'RANGE';
  }

  public static evaluateRiskMode(trader: TraderProfile): RiskMode {
    if (trader.consecutiveLosses >= 2) return 'BUZDA';
    if (trader.consecutiveLosses === 1) return 'TEMKINLI';
    return 'NORMAL';
  }

  public static evaluateCreditRating(trader: TraderProfile): {
    rating: TraderProfile['creditRating'];
    collectionRate: number;
    score: number;
  } {
    const score = calculateCreditScore(trader);
    const rating: TraderProfile['creditRating'] =
      score >= 90 ? 'AAA' :
        score >= 78 ? 'AA' :
          score >= 62 ? 'A' :
            score >= 45 ? 'BBB' :
              score >= 25 ? 'CCC' : 'D';
    return {
      rating,
      collectionRate: Math.round(score),
      score,
    };
  }

  private static hasCoreData(ticker: MarketTicker, ind: IndicatorSnapshot) {
    return (
      ticker.lastPrice > 0 &&
      ticker.markPrice > 0 &&
      isFresh(ticker.priceUpdatedAt, 5_000) &&
      isFresh(ticker.markUpdatedAt, 7_000) &&
      ind.currentPrice > 0 &&
      ind.klineSampleCount >= 50 &&
      ind.ema20 > 0 &&
      ind.ema50 > 0 &&
      ind.atr > 0 &&
      isFresh(ind.timestamp, 5_000) &&
      isFresh(ind.freshness.price, 5_000) &&
      isFresh(ind.freshness.mark, 7_000) &&
      isFresh(ind.freshness.kline, 10_000)
    );
  }

  private static noTrade(
    marketRegime: MarketRegime,
    confidenceScore: number,
    reason: string,
  ): StrategyEvaluationResult {
    return {
      shouldEnter: false,
      side: null,
      confidenceScore,
      reason,
      strategyName: '',
      marketRegime,
      entryPrice: 0,
      stopLossPrice: 0,
      takeProfitPrice: 0,
      liquidationPrice: 0,
      initialStopDistance: 0,
      recommendedLeverage: 1,
      riskAmount: 0,
      notionalSize: 0,
      unitSize: 0,
      margin: 0,
      maxHoldMinutes: 0,
    };
  }

  public static evaluate(
    trader: TraderProfile,
    symbol: string,
    ticker: MarketTicker,
    ind: IndicatorSnapshot,
    context: StrategyEvaluationContext = {},
  ): StrategyEvaluationResult {
    const regime = this.detectMarketRegime(ticker, ind);
    const debtPressure = context.debtPressure || {
      stage: 'NONE' as const,
      remainingSeconds: Number.POSITIVE_INFINITY,
      remainingRatio: 1,
      confidenceAdjustment: 0,
      leverageMultiplier: 1,
      riskMultiplier: 1,
      maxMarginMultiplier: 1,
    };
    if (
      ticker.symbol !== symbol ||
      ind.symbol !== symbol ||
      trader.balance <= 0 ||
      !this.hasCoreData(ticker, ind)
    ) {
      return this.noTrade(regime, 0, 'Gerçek fiyat/mark/mum verisi hazır veya güncel değil.');
    }

    const cooldownUntil = trader.symbolCooldowns[symbol] || 0;
    if (Date.now() < cooldownUntil) {
      return this.noTrade(regime, 0, 'Rövanş işlem kilidi hâlâ devrede.');
    }

    const riskMode = this.evaluateRiskMode(trader);
    const baseThreshold = riskMode === 'BUZDA' ? 82 : riskMode === 'TEMKINLI' ? 75 : 68;
    // Debt pressure can make a funded trader more reckless, but it never
    // bypasses real-data freshness or strategy-specific source gates.
    const threshold = Math.max(
      50,
      baseThreshold + debtPressure.confidenceAdjustment,
    );
    let longScore = 0;
    let shortScore = 0;
    let strategyName = trader.title;
    let reason = '';

    switch (trader.id) {
      case 'mehmet': {
        strategyName = 'Fitil ve Likidasyon Dönüşü';
        if (ind.lowerWickRatio >= 0.45) longScore += 28;
        if (ind.rsi14 <= 37) longScore += 22;
        if (ticker.lastPrice <= ind.bbLower * 1.003) longScore += 18;
        if (ind.liquidationBurstSide === 'LONG') longScore += 26;
        if (ind.upperWickRatio >= 0.45) shortScore += 28;
        if (ind.rsi14 >= 63) shortScore += 22;
        if (ticker.lastPrice >= ind.bbUpper * 0.997) shortScore += 18;
        if (ind.liquidationBurstSide === 'SHORT') shortScore += 26;
        break;
      }
      case 'kemal': {
        strategyName = 'Kalıcı Derinlik ve CVD';
        if (
          !isFresh(ind.freshness.book, 3_000) ||
          !isFresh(ind.freshness.flow, 5_000) ||
          ind.orderbookSampleCount < 6 ||
          ind.aggTradeCount5m < 25 ||
          ind.spreadPercent > 0.08
        ) {
          return this.noTrade(regime, 0, 'Derinlik/CVD örneği yetersiz, bayat veya makas fazla açık.');
        }
        if (ind.orderbookImbalance >= 0.58) longScore += 25;
        if (ind.orderbookPersistence >= 0.55) longScore += 25;
        if (ind.cvdRatio >= 0.56) longScore += 24;
        if (ticker.lastPrice >= ind.ema20) longScore += 10;
        if (ind.orderbookImbalance <= 0.42) shortScore += 25;
        if (ind.orderbookPersistence <= -0.55) shortScore += 25;
        if (ind.cvdRatio <= 0.44) shortScore += 24;
        if (ticker.lastPrice <= ind.ema20) shortScore += 10;
        if (ind.orderbookImbalance > 0.62 && ind.cvdRatio < 0.4) {
          return this.noTrade(regime, 0, 'Alış duvarı CVD tarafından doğrulanmadı; olası spoofing.');
        }
        break;
      }
      case 'nuri': {
        strategyName = 'Fonlama ve Gerçek 5dk OI';
        if (
          !isFresh(ind.freshness.openInterest, 65_000) ||
          ind.oiHistorySpanMs < 285_000
        ) {
          return this.noTrade(regime, 0, 'OI geçmişi gerçek beş dakikalık pencereyi henüz doldurmadı.');
        }
        if (ind.fundingRate <= -0.0001) longScore += 40;
        if (ind.oiDelta5mPercent > 0.05) longScore += 25;
        if (regime !== 'TREND_DOWN') longScore += 15;
        if (ind.rsi14 >= 28 && ind.rsi14 <= 60) longScore += 10;
        if (ind.fundingRate >= 0.0002) shortScore += 40;
        if (ind.oiDelta5mPercent > 0.05) shortScore += 25;
        if (regime !== 'TREND_UP') shortScore += 15;
        if (ind.rsi14 >= 40 && ind.rsi14 <= 72) shortScore += 10;
        break;
      }
      case 'selo': {
        strategyName = 'Hacim ve Agresif Akış';
        if (!isFresh(ind.freshness.flow, 5_000) || ind.aggTradeCount5m < 25) {
          return this.noTrade(regime, 0, 'Gerçek aggTrade/CVD akışı güncel veya yeterli değil.');
        }
        if (ind.volumeSurgeRatio >= 1.8) {
          const volumePoints = Math.min(32, ind.volumeSurgeRatio * 12);
          if (ticker.lastPrice > ind.ema20 && ind.ema20 >= ind.ema50) {
            longScore += volumePoints;
            if (ind.cvdRatio >= 0.58) longScore += 30;
            if (ind.rsi14 >= 50 && ind.rsi14 <= 75) longScore += 18;
            if (regime === 'TREND_UP') longScore += 12;
          }
          if (ticker.lastPrice < ind.ema20 && ind.ema20 <= ind.ema50) {
            shortScore += volumePoints;
            if (ind.cvdRatio <= 0.42) shortScore += 30;
            if (ind.rsi14 >= 25 && ind.rsi14 <= 50) shortScore += 18;
            if (regime === 'TREND_DOWN') shortScore += 12;
          }
        }
        break;
      }
      case 'sevil': {
        strategyName = 'Bollinger Yatay Dönüş';
        if (regime !== 'RANGE' || ind.volumeSurgeRatio > 1.8) {
          return this.noTrade(regime, 0, 'Yatay rejim bozulduğu için ortalamaya dönüş kapalı.');
        }
        if (ticker.lastPrice <= ind.bbLower * 1.003) longScore += 40;
        if (ind.rsi14 <= 38) longScore += 28;
        if (ind.lowerWickRatio >= 0.3) longScore += 16;
        if (ticker.lastPrice >= ind.bbUpper * 0.997) shortScore += 40;
        if (ind.rsi14 >= 62) shortScore += 28;
        if (ind.upperWickRatio >= 0.3) shortScore += 16;
        break;
      }
    }

    const bestScore = Math.max(longScore, shortScore);
    if (bestScore < threshold || longScore === shortScore) {
      return this.noTrade(regime, Math.round(bestScore), 'Yeterli ve tek yönlü teyit oluşmadı.');
    }

    const side: OrderSide = longScore > shortScore ? 'LONG' : 'SHORT';
    const rules = RISK_RULES[trader.id];
    const modeFactor = riskMode === 'BUZDA' ? 0.45 : riskMode === 'TEMKINLI' ? 0.7 : 1;
    const leverage = calculateEffectiveLeverage({
      preferredLeverage: rules.preferredLeverage,
      traderMaxLeverage: trader.maxLeverage,
      minimumLeverage:
        context.minimumLeverage ?? DEFAULT_ENGINE_SETTINGS.minimumLeverage,
      riskModeFactor: modeFactor,
      debtMultiplier: debtPressure.leverageMultiplier,
    });

    const liquidationBuffer = 0.9 / leverage;
    // A player-selected high leverage floor may override a character's normal
    // ceiling. Keep the modeled stop materially in front of liquidation even
    // in that mode; leverage may raise drama, never invert the exit ordering.
    const safeStopCeiling = Math.min(
      rules.stopCeilingPercent,
      liquidationBuffer * 0.7,
    );
    const effectiveStopFloor = Math.min(rules.stopFloorPercent, safeStopCeiling);
    const stopDistancePercent = clamp(
      Math.max(effectiveStopFloor, (ind.atr / ticker.lastPrice) * 1.2),
      effectiveStopFloor,
      safeStopCeiling,
    );
    const stopDistance = ticker.lastPrice * stopDistancePercent;
    const normalizedStopPrice = side === 'LONG'
      ? 1 - stopDistancePercent
      : 1 + stopDistancePercent;
    const lossPerNotional = Math.abs(calculateTradePnl(
      1,
      normalizedStopPrice,
      1,
      side,
      TAKER_FEE_RATE,
      ROUND_TRIP_SLIPPAGE_RATE,
    ).netPnl);
    const adjustedRiskPercent = Math.min(
      0.04,
      rules.riskPercent * modeFactor * debtPressure.riskMultiplier,
    );
    const adjustedMarginPercent = Math.min(
      0.5,
      rules.maxMarginPercent * debtPressure.maxMarginMultiplier,
    );
    const riskBudget = trader.balance * adjustedRiskPercent;
    const expectedLossPerMargin = leverage * lossPerNotional;
    const riskSizedMargin = riskBudget / expectedLossPerMargin;
    const margin = Math.min(
      riskSizedMargin,
      trader.balance * adjustedMarginPercent,
      1_500,
    );
    if (!Number.isFinite(margin) || margin < 5) {
      return this.noTrade(regime, Math.round(bestScore), 'Risk bütçesi asgari pozisyonu karşılamıyor.');
    }

    const entryPrice = ticker.lastPrice;
    const stopLossPrice = side === 'LONG'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
    const takeProfitPrice = side === 'LONG'
      ? entryPrice + stopDistance * rules.rewardRisk
      : entryPrice - stopDistance * rules.rewardRisk;
    const liquidationPrice = side === 'LONG'
      ? entryPrice * (1 - liquidationBuffer)
      : entryPrice * (1 + liquidationBuffer);
    const notionalSize = margin * leverage;
    const unitSize = notionalSize / entryPrice;
    const riskAmount = Math.abs(calculateTradePnl(
      entryPrice,
      stopLossPrice,
      unitSize,
      side,
      TAKER_FEE_RATE,
      ROUND_TRIP_SLIPPAGE_RATE,
    ).netPnl);
    const maxHoldMinutes = debtPressure.stage === 'NONE'
      ? rules.maxHoldMinutes
      : Math.min(
          rules.maxHoldMinutes,
          Math.max(0.25, debtPressure.remainingSeconds / 60),
        );
    const debtNote = debtPressure.stage === 'PRESSURED'
      ? ' Orta vade baskısı risk iştahını artırdı.'
      : debtPressure.stage === 'DESPERATE'
        ? ' Son vade baskısı kumarbaz modunu tetikledi.'
        : '';

    reason = `${strategyName}: ${side} yönünde ${Math.round(bestScore)}/100 gerçek veri teyidi; işlem riski bakiyenin %${(adjustedRiskPercent * 100).toFixed(2)}'i ile sınırlandı.${debtNote}`;

    return {
      shouldEnter: true,
      side,
      confidenceScore: Math.min(100, Math.round(bestScore)),
      reason,
      strategyName,
      marketRegime: regime,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      liquidationPrice,
      initialStopDistance: stopDistance,
      recommendedLeverage: leverage,
      riskAmount,
      notionalSize,
      unitSize,
      margin,
      maxHoldMinutes,
    };
  }
}
