import {
  DecisionLog,
  ExitReason,
  IndicatorSnapshot,
  Loan,
  MarketTicker,
  NewsEvent,
  OrderSide,
  Position,
  TraderId,
  TraderProfile,
  DataHealthStatus,
} from '../types';
import { binanceFeed } from './binanceFeed';
import { CHARACTER_DATA, CIRAK_DIALOGUES, TRADER_DIALOGUES } from './dialogues';
import { soundService } from './soundAndTts';
import { StrategyBrain } from './strategyBrain';
import { calculateNetBreakEvenPrice, resolvePositionExit } from './positionRisk';
import { calculateTradePnl } from './tradeMath';
import {
  createSeasonId,
  extractLoanHistory,
  MAX_LEDGER_LOGS,
  loadLedger,
  saveLedger,
} from './ledgerStore';
import { canReservePositionSlot, MAX_GLOBAL_OPEN_POSITIONS } from './engineInvariants';
import { summarizeTraderLogs } from './seasonStats';
import {
  calculateDeadlineCollection,
  calculateDebtPressure,
  shouldLockProfitForDebt,
} from './debtPressure';
import {
  EngineSettings,
  loadEngineSettings,
  normalizeMinimumLeverage,
  saveEngineSettings,
} from './gameSettings';

export const INITIAL_TRADERS: Record<TraderId, TraderProfile> = {
  selo: {
    id: 'selo',
    name: 'Selo Roket',
    nickname: 'Selo',
    title: 'Hacim & Momentum Canavarı',
    strategyDescription: 'Gerçek aggTrade hacmi ve CVD aynı yönü doğruladığında, bakiye risk bütçesiyle momentuma katılır.',
    avatarBg: CHARACTER_DATA.selo.avatarBg,
    accentColor: CHARACTER_DATA.selo.accentColor,
    badgeIcon: CHARACTER_DATA.selo.badgeIcon,
    preferredCoins: ['PEPEUSDT', 'DOGEUSDT', 'SOLUSDT'],
    maxLeverage: 50,
    balance: 0,
    initialBalance: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 5,
    isAggressive: true,
    statusText: 'Kapıda borç sırasında 1. sırada bekliyor...',
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
    voicePitch: CHARACTER_DATA.selo.voicePitch,
    voiceRate: CHARACTER_DATA.selo.voiceRate,
  },
  mehmet: {
    id: 'mehmet',
    name: 'Fitilci Mehmet',
    nickname: 'Fitilci',
    title: 'Stop & Fitil Avcısı',
    strategyDescription: 'Gerçek 1 dakikalık mum fitili, RSI, Bollinger ve varsa güncel likidasyon kümesini birlikte arar.',
    avatarBg: CHARACTER_DATA.mehmet.avatarBg,
    accentColor: CHARACTER_DATA.mehmet.accentColor,
    badgeIcon: CHARACTER_DATA.mehmet.badgeIcon,
    preferredCoins: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    maxLeverage: 25,
    balance: 0,
    initialBalance: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 20,
    isAggressive: false,
    statusText: 'Kapıda borç sırasında 2. sırada bekliyor...',
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
    voicePitch: CHARACTER_DATA.mehmet.voicePitch,
    voiceRate: CHARACTER_DATA.mehmet.voiceRate,
  },
  kemal: {
    id: 'kemal',
    name: 'Tahta Kemal',
    nickname: 'Kemal',
    title: 'Emir Defteri & Spoof Dedektifi',
    strategyDescription: 'Gerçek 20 kademe notional dengeyi, 30 saniyelik duvar kalıcılığını ve CVD teyidini izler.',
    avatarBg: CHARACTER_DATA.kemal.avatarBg,
    accentColor: CHARACTER_DATA.kemal.accentColor,
    badgeIcon: CHARACTER_DATA.kemal.badgeIcon,
    preferredCoins: ['BTCUSDT', 'ETHUSDT'],
    maxLeverage: 20,
    balance: 0,
    initialBalance: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 10,
    isAggressive: false,
    statusText: 'Kapıda borç sırasında 3. sırada bekliyor...',
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
    voicePitch: CHARACTER_DATA.kemal.voicePitch,
    voiceRate: CHARACTER_DATA.kemal.voiceRate,
  },
  nuri: {
    id: 'nuri',
    name: 'Fonlama Nuri',
    nickname: 'Nuri',
    title: 'Funding & OI Kurdu',
    strategyDescription: 'Fonlamayı ancak gerçek beş dakikalık Open Interest penceresi dolduğunda kalabalık yönüyle kıyaslar.',
    avatarBg: CHARACTER_DATA.nuri.avatarBg,
    accentColor: CHARACTER_DATA.nuri.accentColor,
    badgeIcon: CHARACTER_DATA.nuri.badgeIcon,
    preferredCoins: ['SOLUSDT', 'DOGEUSDT', 'PEPEUSDT'],
    maxLeverage: 18,
    balance: 0,
    initialBalance: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 15,
    isAggressive: false,
    statusText: 'Kapıda borç sırasında 4. sırada bekliyor...',
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
    voicePitch: CHARACTER_DATA.nuri.voicePitch,
    voiceRate: CHARACTER_DATA.nuri.voiceRate,
  },
  sevil: {
    id: 'sevil',
    name: 'Madam Sevil',
    nickname: 'Madam',
    title: 'Range & Bollinger Kraliçesi',
    strategyDescription: 'Yalnızca güncel mum verisi ve yatay rejimde Bollinger sınırından merkeze dönüş arar.',
    avatarBg: CHARACTER_DATA.sevil.avatarBg,
    accentColor: CHARACTER_DATA.sevil.accentColor,
    badgeIcon: CHARACTER_DATA.sevil.badgeIcon,
    preferredCoins: ['ETHUSDT', 'BTCUSDT', 'SOLUSDT'],
    maxLeverage: 15,
    balance: 0,
    initialBalance: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    activeLoanId: null,
    fearLevel: 10,
    isAggressive: false,
    statusText: 'Kapıda borç sırasında 5. sırada bekliyor...',
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
    voicePitch: CHARACTER_DATA.sevil.voicePitch,
    voiceRate: CHARACTER_DATA.sevil.voiceRate,
  },
};

type StateListener = () => void;

const formatPrice = (price: number) => price.toFixed(price < 0.01 ? 8 : price < 1 ? 6 : 2);

export class TradingEngine {
  public cashBalance: number = 50000;
  public startingCash: number = 50000;
  public totalDistributedLoans: number = 0;
  public totalCollectedInterest: number = 0;

  public traders: Record<TraderId, TraderProfile> = JSON.parse(JSON.stringify(INITIAL_TRADERS));
  public openPositions: Position[] = [];
  public loans: Loan[] = [];
  public newsFeed: NewsEvent[] = [];
  public decisionLogs: DecisionLog[] = [];
  public seasonId: string = createSeasonId();
  public dataHealth: DataHealthStatus = binanceFeed.getDataHealth();
  public settings: EngineSettings = loadEngineSettings();

  private listeners: Set<StateListener> = new Set();
  private loopInterval: number | null = null;
  private lastLoanEvaluationTime: number = Date.now();
  private lastEntryAttempt: Partial<Record<TraderId, number>> = {};
  private lastPositionNotify = 0;

  constructor() {
    this.init();
  }

  private hydrateLedger() {
    const ledger = loadLedger();
    this.seasonId = ledger.seasonId;
    this.decisionLogs = ledger.logs;

    (Object.keys(this.traders) as TraderId[]).forEach((id) => {
      const trader = this.traders[id];
      const history = ledger.loanHistory[id];
      if (history) Object.assign(trader, history);

      const summary = summarizeTraderLogs(this.decisionLogs, id, this.seasonId);
      trader.totalPnl = summary.totalPnl;
      trader.winCount = summary.winCount;
      trader.lossCount = summary.lossCount;
      trader.consecutiveLosses = summary.consecutiveLosses;
      trader.riskMode = StrategyBrain.evaluateRiskMode(trader);
      const credit = StrategyBrain.evaluateCreditRating(trader);
      trader.creditRating = credit.rating;
      trader.expectedCollectionRate = credit.collectionRate;
    });
  }

  private persistLedger() {
    saveLedger({
      version: 2,
      seasonId: this.seasonId,
      logs: this.decisionLogs,
      loanHistory: extractLoanHistory(this.traders),
      savedAt: Date.now(),
    });
  }

  private init() {
    this.hydrateLedger();

    // Listen to Binance live ticker
    binanceFeed.onMarketUpdate((ticker) => {
      this.updatePositionsWithPrice(ticker);
    });

    // Listen to Binance real whale liquidations (forceOrder stream)
    binanceFeed.onLiquidation((liq) => {
      const notional = liq.price * liq.qty;
      if (notional > 40000) {
        this.addNewsEvent({
          type: 'LIQUIDATION',
          speaker: 'cirak',
          speakerName: 'Cilet Ferhat',
          message: `Binance Balina Avı! ${liq.symbol} tahtasında az önce ${liq.qty.toFixed(0)} adet ($${notional.toFixed(0)}) ${
            liq.side === 'SELL' ? 'LONG' : 'SHORT'
          } likidasyon fitili patlatıldı!`,
          badge: `💥 BİNANCE LİKİT ($${(notional / 1000).toFixed(0)}k)`,
        });
        this.notify();
      }
    });

    // Main evaluation loop every 1.5 seconds
    if (typeof window !== 'undefined') {
      this.loopInterval = window.setInterval(() => {
        this.tickEngine();
      }, 1500);
    }

    // Populate initial loan queue at the door
    this.initializeLoanQueue();

    // Add initial greeting news
    this.addNewsEvent({
      type: 'LOAN_REQUEST',
      speaker: 'cirak',
      speakerName: 'Cilet Ferhat',
      message: `Usta! Kredi filtresini geçen ${this.loans.filter((loan) => loan.status === 'PROPOSAL').length} trader kapıda sermaye bekliyor. İlk borcu kime veriyoruz?`,
      badge: 'KAPIDA KUYRUK VAR',
      urgent: true,
    });
    this.persistLedger();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setMinimumLeverage(value: number) {
    const minimumLeverage = normalizeMinimumLeverage(value);
    if (minimumLeverage === this.settings.minimumLeverage) return;
    this.settings = { ...this.settings, minimumLeverage };
    saveEngineSettings(this.settings);
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Initialize loan requests for all traders in queue order
  public initializeLoanQueue() {
    const queueOrder: { id: TraderId; principal: number; term: number }[] = [
      { id: 'selo', principal: 2500, term: 8 },
      { id: 'mehmet', principal: 2000, term: 12 },
      { id: 'kemal', principal: 3000, term: 15 },
      { id: 'nuri', principal: 2200, term: 10 },
      { id: 'sevil', principal: 2800, term: 14 },
    ];

    queueOrder.forEach((item, index) => {
      if (this.traders[item.id].creditRating === 'D') return;
      const initialInterestRate = 20; // 20%
      const loan: Loan = {
        id: `loan_init_${item.id}`,
        traderId: item.id,
        principal: item.principal,
        interestRate: initialInterestRate,
        termMinutes: item.term,
        createdAt: Date.now() + index * 100,
        dueAt: Date.now() + item.term * 60 * 1000,
        remainingSeconds: item.term * 60,
        accruedInterest: (item.principal * initialInterestRate) / 100,
        totalDue: item.principal + (item.principal * initialInterestRate) / 100,
        status: 'PROPOSAL',
        negotiationRounds: 0,
        actionsTaken: [],
      };
      this.loans.push(loan);
    });
  }

  public resetGame(newStartingCash: number = 50000) {
    // A season reset cannot erase an unresolved debt from the lifetime credit record.
    this.loans
      .filter((loan) => loan.status === 'ACTIVE' || loan.status === 'OVERDUE')
      .forEach((loan) => {
        const trader = this.traders[loan.traderId];
        trader.loansDefaulted++;
        trader.totalBorrowed += loan.principal;
        trader.totalRepaid += loan.repaidAmount || 0;
      });
    const lifetimeLoanHistory = extractLoanHistory(this.traders);
    this.startingCash = newStartingCash;
    this.cashBalance = newStartingCash;
    this.totalDistributedLoans = 0;
    this.totalCollectedInterest = 0;
    this.traders = JSON.parse(JSON.stringify(INITIAL_TRADERS));
    (Object.keys(this.traders) as TraderId[]).forEach((id) => {
      const history = lifetimeLoanHistory[id];
      if (history) Object.assign(this.traders[id], history);
      const credit = StrategyBrain.evaluateCreditRating(this.traders[id]);
      this.traders[id].creditRating = credit.rating;
      this.traders[id].expectedCollectionRate = credit.collectionRate;
    });
    this.seasonId = createSeasonId();
    this.openPositions = [];
    this.loans = [];
    this.newsFeed = [];
    this.lastEntryAttempt = {};
    this.lastLoanEvaluationTime = Date.now();

    this.initializeLoanQueue();

    this.addNewsEvent({
      type: 'LOAN_REQUEST',
      speaker: 'cirak',
      speakerName: 'Cilet Ferhat',
      message: `Yeni sezon açıldı usta! Kasa ${newStartingCash.toLocaleString()} USDT; kredi filtresini geçenler yeniden kapıda. Ömür boyu sicil korundu.`,
      badge: 'YENİ SEZON',
      urgent: true,
    });
    this.persistLedger();
    this.notify();
  }

  // Dynamic Position Management: deterministic liquidation -> stop -> TP -> time-stop.
  private updatePositionsWithPrice(ticker: MarketTicker) {
    const now = Date.now();
    if (
      ticker.lastPrice <= 0 ||
      ticker.markPrice <= 0 ||
      now - ticker.priceUpdatedAt > 5_000 ||
      now - ticker.markUpdatedAt > 7_000
    ) {
      return;
    }

    let touched = false;
    let closed = false;
    for (const pos of [...this.openPositions]) {
      if (pos.symbol !== ticker.symbol) continue;
      touched = true;
      const trader = this.traders[pos.traderId];
      pos.currentPrice = ticker.lastPrice;
      pos.markPrice = ticker.markPrice;

      const livePnl = calculateTradePnl(
        pos.entryPrice,
        ticker.lastPrice,
        pos.size,
        pos.side,
      );
      pos.unrealizedPnl = Math.max(-pos.margin, livePnl.netPnl);
      pos.roePercent = pos.margin > 0 ? (pos.unrealizedPnl / pos.margin) * 100 : 0;
      pos.liquidationDistancePercent = pos.side === 'LONG'
        ? ((ticker.markPrice - pos.liquidationPrice) / ticker.markPrice) * 100
        : ((pos.liquidationPrice - ticker.markPrice) / ticker.markPrice) * 100;
      pos.maxFavorableExcursion = Math.max(
        pos.maxFavorableExcursion,
        pos.unrealizedPnl,
      );
      pos.maxAdverseExcursion = Math.min(
        pos.maxAdverseExcursion,
        pos.unrealizedPnl,
      );

      const currentR = pos.initialRiskAmount > 0
        ? pos.unrealizedPnl / pos.initialRiskAmount
        : 0;
      if (currentR >= 1 && !pos.isBreakevenSet) {
        pos.isBreakevenSet = true;
        const breakEven = calculateNetBreakEvenPrice(pos.entryPrice, pos.side);
        pos.stopLossPrice = pos.side === 'LONG'
          ? Math.max(pos.stopLossPrice, breakEven)
          : Math.min(pos.stopLossPrice, breakEven);
        this.addNewsEvent({
          type: 'RISK_ALERT',
          speaker: 'cirak',
          speakerName: 'Cilet Ferhat',
          message: `${trader.name} ${pos.symbol} işleminde +1R gördü; stop ücret ve kaymayı da karşılayan net başa başa taşındı.`,
          badge: '🛡️ NET BAŞA BAŞ',
        });
      }

      if (currentR >= 1.6) {
        pos.isTrailingActive = true;
        const trailingDistance = Math.max(pos.entryIndicators.atr, pos.rDistance * 0.65);
        if (pos.side === 'LONG') {
          pos.stopLossPrice = Math.max(
            pos.stopLossPrice,
            ticker.lastPrice - trailingDistance,
          );
        } else {
          pos.stopLossPrice = Math.min(
            pos.stopLossPrice,
            ticker.lastPrice + trailingDistance,
          );
        }
      }

      const exit = resolvePositionExit(pos, ticker, now);
      if (exit) {
        this.closePosition(pos, exit.exitPrice, exit.reason);
        closed = true;
        continue;
      }

      const activeLoan = trader.activeLoanId
        ? this.loans.find((loan) =>
            loan.id === trader.activeLoanId &&
            (loan.status === 'ACTIVE' || loan.status === 'OVERDUE'))
        : undefined;
      const debtPressure = calculateDebtPressure(activeLoan, now);
      if (
        activeLoan &&
        shouldLockProfitForDebt({
          freeBalance: trader.balance,
          positionMargin: pos.margin,
          unrealizedPnl: pos.unrealizedPnl,
          totalDue: activeLoan.totalDue,
          pressureStage: debtPressure.stage,
          currentR,
        })
      ) {
        this.closePosition(pos, ticker.lastPrice, 'DEBT_PROFIT_LOCK');
        closed = true;
      }
    }

    if (closed || (touched && now - this.lastPositionNotify >= 500)) {
      this.lastPositionNotify = now;
      this.notify();
    }
  }

  // Periodic engine tick: evaluate trader strategies & loans
  private tickEngine() {
    const now = Date.now();

    // 1. Update loans and expose truthful feed health.
    this.updateLoans();
    this.dataHealth = binanceFeed.getDataHealth();

    // 2. The two slots are global, not per trader. Synchronous checks in the
    // entry method make this invariant hold even when several signals arrive together.
    const symbols = binanceFeed.getSymbols();
    for (const traderId of Object.keys(this.traders) as TraderId[]) {
      const trader = this.traders[traderId];
      const activeLoan = trader.activeLoanId
        ? this.loans.find((loan) => loan.id === trader.activeLoanId)
        : undefined;
      const debtPressure = calculateDebtPressure(activeLoan, now);
      if (
        debtPressure.stage !== 'OVERDUE' &&
        canReservePositionSlot(this.openPositions, traderId) &&
        trader.balance >= 100 &&
        now - (this.lastEntryAttempt[traderId] || 0) >= 5_000
      ) {
        for (const symbol of symbols) {
          const indicators = binanceFeed.getIndicators(symbol);
          const ticker = binanceFeed.getTicker(symbol);
          if (indicators && ticker) {
            const before = this.openPositions.length;
            this.evaluateTraderStrategy(trader, symbol, ticker, indicators);
            if (this.openPositions.length > before) break;
          }
        }
      }

      // 3. Trader ran out of money and has no pending/active loan: Re-enter loan queue!
      if (
        trader.balance < 100 &&
        trader.creditRating !== 'D' &&
        !trader.activeLoanId &&
        !this.loans.some((l) => l.traderId === trader.id && l.status === 'PROPOSAL') &&
        now - this.lastLoanEvaluationTime > 10000
      ) {
        this.triggerLoanRequest(trader);
        this.lastLoanEvaluationTime = now;
      }
    }

    this.notify();
  }

  // Strategy Execution Engine powered by StrategyBrain
  private evaluateTraderStrategy(
    trader: TraderProfile,
    symbol: string,
    ticker: MarketTicker,
    ind: IndicatorSnapshot
  ) {
    // Hard slot reservation: no code path may exceed two simultaneous positions.
    if (!canReservePositionSlot(this.openPositions, trader.id)) return;

    // Evaluate trade candidate using StrategyBrain. Active debt is explicit
    // strategy context: as the deadline approaches, gambler-mode thresholds,
    // leverage and wallet risk rise within the hard engine caps.
    const activeLoan = trader.activeLoanId
      ? this.loans.find((loan) => loan.id === trader.activeLoanId)
      : undefined;
    const evalResult = StrategyBrain.evaluate(trader, symbol, ticker, ind, {
      minimumLeverage: this.settings.minimumLeverage,
      debtPressure: calculateDebtPressure(activeLoan, Date.now()),
    });
    if (!evalResult.shouldEnter || !evalResult.side) {
      return;
    }

    // Ensure trader has enough balance
    if (trader.balance < evalResult.margin) {
      return;
    }

    // Re-check the global slot immediately before committing the margin.
    if (this.openPositions.length >= MAX_GLOBAL_OPEN_POSITIONS) return;
    trader.balance -= evalResult.margin;

    const newPos: Position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      traderId: trader.id,
      symbol,
      side: evalResult.side,
      entryPrice: evalResult.entryPrice,
      currentPrice: evalResult.entryPrice,
      markPrice: ticker.markPrice,
      size: evalResult.unitSize,
      notional: evalResult.notionalSize,
      margin: evalResult.margin,
      leverage: evalResult.recommendedLeverage,
      liquidationPrice: evalResult.liquidationPrice,
      takeProfitPrice: evalResult.takeProfitPrice,
      stopLossPrice: evalResult.stopLossPrice,
      initialStopLossPrice: evalResult.stopLossPrice,
      initialRiskAmount: evalResult.riskAmount,
      rDistance: evalResult.initialStopDistance,
      unrealizedPnl: 0,
      roePercent: 0,
      openTime: Date.now(),
      status: 'OPEN',
      strategyReason: evalResult.reason,
      entryIndicators: { ...ind },
      confidenceScore: evalResult.confidenceScore,
      marketRegime: evalResult.marketRegime,
      isBreakevenSet: false,
      isTrailingActive: false,
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      maxHoldMinutes: evalResult.maxHoldMinutes,
      strategyName: evalResult.strategyName,
      liquidationDistancePercent:
        evalResult.side === 'LONG'
          ? ((evalResult.entryPrice - evalResult.liquidationPrice) / evalResult.entryPrice) * 100
          : ((evalResult.liquidationPrice - evalResult.entryPrice) / evalResult.entryPrice) * 100,
    };

    this.openPositions.unshift(newPos);
    this.lastEntryAttempt[trader.id] = Date.now();
    trader.statusText = `${symbol} ${evalResult.side} ${evalResult.recommendedLeverage}x açtı (Puan: ${evalResult.confidenceScore})`;

    // Speech & News
    const entryQuotes = TRADER_DIALOGUES[trader.id].tradeEntry;
    const quote = entryQuotes[Math.floor(Math.random() * entryQuotes.length)];
    soundService.speak(quote, trader.id);

    this.addNewsEvent({
      type: 'WHALE_ALERT',
      speaker: trader.id,
      speakerName: trader.name,
      message: `${symbol} tahtasında ${evalResult.recommendedLeverage}x ${evalResult.side} pozisyon açtı! (Teyit: ${evalResult.confidenceScore}/100, Rejim: ${evalResult.marketRegime}). "${quote}"`,
      badge: `${symbol} ${evalResult.recommendedLeverage}x [${evalResult.confidenceScore}p]`,
    });
  }

  // Close position using adverse execution slippage and both taker fees.
  private closePosition(
    pos: Position,
    exitPrice: number,
    exitReason: ExitReason,
  ) {
    if (!this.openPositions.some((candidate) => candidate.id === pos.id)) return;
    const trader = this.traders[pos.traderId];
    const pnl = calculateTradePnl(
      pos.entryPrice,
      exitPrice,
      pos.size,
      pos.side,
    );
    const finalPnl = exitReason === 'LIQUIDATED'
      ? -pos.margin
      : Math.max(-pos.margin, pnl.netPnl);

    trader.balance += Math.max(0, pos.margin + finalPnl);
    trader.totalPnl += finalPnl;
    pos.status = exitReason === 'LIQUIDATED' ? 'LIQUIDATED' : 'CLOSED';
    pos.closeTime = Date.now();
    pos.closePrice = exitPrice;
    pos.realizedPnl = finalPnl;

    const isWin = finalPnl >= 0;
    if (isWin) {
      trader.winCount++;
      trader.consecutiveLosses = 0;
      trader.riskMode = 'NORMAL';
      soundService.playCashSound();
      const quotes = TRADER_DIALOGUES[trader.id].bigWinShout;
      const speech = quotes[Math.floor(Math.random() * quotes.length)];
      soundService.speak(speech, trader.id);
      this.addNewsEvent({
        type: 'MASSIVE_PROFIT',
        speaker: trader.id,
        speakerName: trader.name,
        message: `${pos.symbol} işlemi ${finalPnl.toFixed(1)} USDT net sonuçla kapandı [${exitReason}]. Ücret ve kayma sonuca dahildir.`,
        badge: `${finalPnl >= 0 ? '+' : ''}${finalPnl.toFixed(0)} USDT [${exitReason}]`,
      });
    } else {
      trader.lossCount++;
      trader.consecutiveLosses++;
      trader.lastLossTimestamp = Date.now();
      trader.symbolCooldowns[pos.symbol] = Date.now() + 60_000;
      trader.riskMode = StrategyBrain.evaluateRiskMode(trader);

      if (exitReason === 'LIQUIDATED') {
        soundService.playLiquidationSound();
        const quotes = TRADER_DIALOGUES[trader.id].liquidationShout;
        const speech = quotes[Math.floor(Math.random() * quotes.length)];
        soundService.speak(speech, trader.id);
        this.addNewsEvent({
          type: 'LIQUIDATION',
          speaker: 'cirak',
          speakerName: 'Cilet Ferhat',
          message: CIRAK_DIALOGUES.liquidationAlert(trader.name, pos.symbol, pos.margin),
          badge: `💥 LİKİDASYON -${pos.margin.toFixed(0)} USDT`,
          urgent: true,
        });
      } else {
        this.addNewsEvent({
          type: trader.consecutiveLosses >= 2 ? 'RISK_ALERT' : 'LIQUIDATION',
          speaker: trader.consecutiveLosses >= 2 ? 'cirak' : trader.id,
          speakerName: trader.consecutiveLosses >= 2 ? 'Cilet Ferhat' : trader.name,
          message: `${trader.name} ${pos.symbol} işlemini ${finalPnl.toFixed(1)} USDT net zararla kapattı [${exitReason}].`,
          badge: `${finalPnl.toFixed(0)} USDT [${exitReason}]`,
          urgent: trader.consecutiveLosses >= 2,
        });
      }
    }

    trader.statusText = `${pos.symbol} ${exitReason}: ${finalPnl >= 0 ? '+' : ''}${finalPnl.toFixed(1)} USDT net`;
    this.recordDecisionLog(pos, exitPrice, finalPnl, exitReason, pnl.feePaid);
    this.openPositions = this.openPositions.filter((candidate) => candidate.id !== pos.id);

    if (isWin) this.checkAutoLoanRepayment(trader);
    if (trader.balance < 100 && !trader.activeLoanId && trader.creditRating !== 'D') {
      window.setTimeout(() => this.triggerLoanRequest(trader), 1_500);
    }
  }

  // Record trade into Decision Logs (saved to localStorage for Sicil)
  private recordDecisionLog(
    pos: Position,
    exitPrice: number,
    realizedPnl: number,
    exitReason: ExitReason,
    feePaid: number
  ) {
    const trader = this.traders[pos.traderId];
    const ind = pos.entryIndicators;
    const holdingDuration = Math.round((Date.now() - pos.openTime) / 1000);
    const rMultiple = pos.initialRiskAmount > 0 ? realizedPnl / pos.initialRiskAmount : 0;

    let whyFailed = '';
    let improvementNote = '';

    switch (exitReason) {
      case 'LIQUIDATED':
        whyFailed = `Mark price modellenen ${formatPrice(pos.liquidationPrice)} USDT likidasyon seviyesini geçti; izole marjin kaybedildi. Giriş RSI: ${ind.rsi14}, teyit: ${pos.confidenceScore}/100.`;
        improvementNote = 'Aynı kurulum tekrarlandığında kaldıraç azaltılmalı veya işlem atlanmalıdır; stop her zaman likidasyon seviyesinden güvenli uzaklıkta kalmalıdır.';
        break;
      case 'TIME_STOP':
        whyFailed = `Pozisyon ${pos.maxHoldMinutes} dakikalık azami süre içinde pozitif ilerleme gösteremedi ve güncel piyasa fiyatından kapatıldı.`;
        improvementNote = 'Giriş zamanlaması ve akış teyidi gözden geçirilmeli; süreyi uzatmak yerine düşük ilerlemeli kurulumlar elenmelidir.';
        break;
      case 'STOP_LOSS':
        whyFailed = `Gözlenen piyasa fiyatı ilk stop seviyesini (${formatPrice(pos.initialStopLossPrice)} USDT) tetikledi veya gap ile geçti. Rejim: ${pos.marketRegime}.`;
        improvementNote = 'ATR mesafesi ve karşıt akış filtresi incelenmeli; risk bütçesi büyütülmeden zayıf teyitler elenmelidir.';
        break;
      case 'BREAKEVEN':
        whyFailed = 'Ücret ve varsayılan kaymayı karşılayan net başa baş stopu tetiklendi.';
        improvementNote = `Risk korunarak işlem ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R ile sonlandı.`;
        break;
      case 'TRAILING_STOP':
        whyFailed = 'Fiyat +1,6R sonrasında etkinleşen takip eden stopa döndü.';
        improvementNote = `Takip eden stop, açık kârı ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R sonuçla kilitledi.`;
        break;
      case 'TAKE_PROFIT':
        whyFailed = 'Pozisyon stratejinin take-profit limitine ulaştı.';
        improvementNote = `Kurulum ücret ve kayma sonrası ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R üretti.`;
        break;
      case 'DEBT_PROFIT_LOCK':
        whyFailed = 'Açık kâr ve serbest bakiye sözleşme borcunu karşılayınca pozisyon erken kapatıldı.';
        improvementNote = `Borç önceliğiyle ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R kilitlendi; normal hedef beklenmedi.`;
        break;
      case 'DEBT_DEADLINE':
        whyFailed = 'Sözleşme vadesi dolduğu için pozisyon taze piyasa fiyatından zorunlu kapatıldı.';
        improvementNote = `Vade tasfiyesi işlemi ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R ile sonlandırdı.`;
        break;
      default:
        whyFailed = `Pozisyon ${exitReason} nedeniyle kapandı.`;
        improvementNote = `Net sonuç ${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R.`;
    }

    const log: DecisionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      schemaVersion: 2,
      seasonId: this.seasonId,
      traderId: trader.id,
      traderName: trader.name,
      symbol: pos.symbol,
      side: pos.side,
      leverage: pos.leverage,
      entryPrice: pos.entryPrice,
      exitPrice,
      margin: pos.margin,
      realizedPnl,
      roePercent: (realizedPnl / pos.margin) * 100,
      exitReason,
      strategyName: pos.strategyName,
      entryIndicators: ind,
      whyOpened: pos.strategyReason,
      whyFailedOrWon: whyFailed,
      aiImprovementNote: improvementNote,
      confidenceScore: pos.confidenceScore,
      marketRegime: pos.marketRegime,
      holdingDurationSeconds: holdingDuration,
      feePaid,
      rMultiple,
      balanceAfterTrade: trader.balance,
      cumulativePnl: trader.totalPnl,
    };

    this.decisionLogs.unshift(log);
    this.decisionLogs = this.decisionLogs.slice(0, MAX_LEDGER_LOGS);
    this.persistLedger();
  }

  // Loan Mechanics
  public triggerLoanRequest(trader: TraderProfile) {
    if (trader.activeLoanId || trader.creditRating === 'D') return;

    const principal = Math.round((1500 + Math.random() * 2500) / 100) * 100;
    const initialInterestRate = 20; // 20%
    const termMinutes = 10; // 10 minutes

    const loan: Loan = {
      id: `loan_${Date.now()}_${trader.id}`,
      traderId: trader.id,
      principal,
      interestRate: initialInterestRate,
      termMinutes,
      createdAt: Date.now(),
      dueAt: Date.now() + termMinutes * 60 * 1000,
      remainingSeconds: termMinutes * 60,
      accruedInterest: (principal * initialInterestRate) / 100,
      totalDue: principal + (principal * initialInterestRate) / 100,
      status: 'PROPOSAL',
      negotiationRounds: 0,
      actionsTaken: [],
    };

    this.loans.unshift(loan);

    // Speak loan request
    const quotes = TRADER_DIALOGUES[trader.id].loanRequest;
    const speech = quotes[Math.floor(Math.random() * quotes.length)];
    soundService.speak(speech, trader.id);

    this.addNewsEvent({
      type: 'LOAN_REQUEST',
      speaker: trader.id,
      speakerName: trader.name,
      message: `Kapıya geldi: "${speech}" (${principal} USDT borç talep ediyor)`,
      badge: `BORÇ TALEBİ: ${principal} USDT`,
      urgent: true,
    });

    this.notify();
  }

  // Shark accepts or proposes loan to trader
  public submitLoanOffer(
    loanId: string,
    proposedRate: number,
    proposedTermMinutes: number
  ): { accepted: boolean; counterOffer?: { rate: number; term: number; speech: string } } {
    const loan = this.loans.find((l) => l.id === loanId);
    if (
      !loan ||
      loan.status !== 'PROPOSAL' ||
      !Number.isFinite(proposedRate) ||
      !Number.isFinite(proposedTermMinutes)
    ) return { accepted: false };

    proposedRate = Math.round(Math.min(50, Math.max(5, proposedRate)));
    proposedTermMinutes = Math.round(Math.min(30, Math.max(3, proposedTermMinutes)));
    const trader = this.traders[loan.traderId];
    if (trader.creditRating === 'D') return { accepted: false };

    // Check if player has enough money in cash balance
    if (this.cashBalance < loan.principal) {
      soundService.speak('Usta kasada para kalmadı, adamı boş çevirmek zorundayız!', 'cirak');
      return { accepted: false };
    }

    // Trader counter-offer negotiation logic
    loan.negotiationRounds++;
    const acceptsDirectly =
      loan.negotiationRounds >= 3 ||
      trader.id === 'selo' || // Selo never bargains much
      proposedRate <= 15; // Low rate accepted immediately

    if (acceptsDirectly) {
      // Finalized agreement
      loan.interestRate = proposedRate;
      loan.termMinutes = proposedTermMinutes;
      loan.dueAt = Date.now() + proposedTermMinutes * 60 * 1000;
      loan.remainingSeconds = proposedTermMinutes * 60;
      loan.accruedInterest = (loan.principal * proposedRate) / 100;
      loan.totalDue = loan.principal + loan.accruedInterest;
      loan.status = 'ACTIVE';

      // Money moves: from Shark's cash to Trader's trading balance
      this.cashBalance -= loan.principal;
      this.totalDistributedLoans += loan.principal;
      trader.balance += loan.principal;
      trader.initialBalance += loan.principal;
      trader.activeLoanId = loan.id;
      trader.statusText = `${loan.principal}$ sermayeyle masaya oturdu, scalp arıyor...`;

      soundService.playGavelSound();
      soundService.playCashSound();

      const acceptSpeech = `Anlaştık tefeci! ${loan.principal} USDT'yi aldım, %${proposedRate} faiziyle vadesinde teslim edeceğim.`;
      soundService.speak(acceptSpeech, trader.id);

      this.addNewsEvent({
        type: 'LOAN_REQUEST',
        speaker: trader.id,
        speakerName: trader.name,
        message: `Anlaşma sağlandı! ${loan.principal} USDT borç verildi (%${proposedRate} faiz, ${proposedTermMinutes} dk vade). Masaya geçti!`,
        badge: `BORÇ AKTİF: ${loan.principal} USDT`,
      });

      this.notify();
      return { accepted: true };
    } else {
      // Trader counters!
      const counterRate = Math.max(8, proposedRate - (3 + Math.floor(Math.random() * 5)));
      const counterTerm = Math.min(25, proposedTermMinutes + 5);

      const counterQuotes = TRADER_DIALOGUES[trader.id].counterOffer;
      let counterSpeech = counterQuotes[Math.floor(Math.random() * counterQuotes.length)];
      counterSpeech = counterSpeech.replace('{rate}', counterRate.toString());

      loan.lastCounterOffer = {
        principal: loan.principal,
        interestRate: counterRate,
        termMinutes: counterTerm,
        speech: counterSpeech,
      };

      soundService.speak(counterSpeech, trader.id);
      this.notify();

      return {
        accepted: false,
        counterOffer: {
          rate: counterRate,
          term: counterTerm,
          speech: counterSpeech,
        },
      };
    }
  }

  // Debt is a real deadline, not a decorative countdown. Free cash repays
  // immediately; at maturity every position is closed at a fresh real price.
  // If the feed is stale we wait rather than inventing an execution price.
  private updateLoans() {
    const now = Date.now();
    for (const loan of this.loans) {
      if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') continue;
      const trader = this.traders[loan.traderId];

      if (trader.balance >= loan.totalDue) {
        this.settleLoan(loan, trader);
        continue;
      }

      if (loan.status === 'ACTIVE') {
        loan.remainingSeconds = Math.max(0, Math.ceil((loan.dueAt - now) / 1000));
        if (loan.remainingSeconds > 0) continue;

        loan.status = 'OVERDUE';
        loan.wasEverOverdue = true;
        soundService.playSirenSound();
        const alert = CIRAK_DIALOGUES.overdueAlert(trader.name, loan.totalDue);
        soundService.speak(alert, 'cirak');
        this.addNewsEvent({
          type: 'LOAN_OVERDUE',
          speaker: 'cirak',
          speakerName: 'Cilet Ferhat',
          message: `${alert} Açık pozisyonlar taze piyasa fiyatından kapatılıyor.`,
          badge: `⚠️ VADE BİTTİ: ${loan.totalDue.toFixed(0)} USDT`,
          urgent: true,
        });
      }

      loan.remainingSeconds = 0;
      const debtorPositions = this.openPositions.filter(
        (position) => position.traderId === trader.id,
      );
      for (const position of debtorPositions) {
        const ticker = binanceFeed.getTicker(position.symbol);
        const hasFreshPrice = Boolean(
          ticker &&
          ticker.lastPrice > 0 &&
          now - ticker.priceUpdatedAt >= -2_000 &&
          now - ticker.priceUpdatedAt <= 5_000,
        );
        if (!ticker || !hasFreshPrice) continue;
        this.closePosition(position, ticker.lastPrice, 'DEBT_DEADLINE');
        if (!trader.activeLoanId) break;
      }

      if (!trader.activeLoanId) continue;
      if (trader.balance >= loan.totalDue) {
        this.settleLoan(loan, trader);
        continue;
      }

      const stillOpen = this.openPositions.some(
        (position) => position.traderId === trader.id,
      );
      if (stillOpen) {
        trader.statusText = 'Vade bitti; gerçek çıkış fiyatı için canlı veri bekleniyor.';
        continue;
      }

      this.defaultLoanAtDeadline(loan, trader);
    }
  }

  private defaultLoanAtDeadline(loan: Loan, trader: TraderProfile) {
    const partialPayment = calculateDeadlineCollection(
      trader.balance,
      loan.totalDue,
    );
    if (partialPayment > 0) {
      trader.balance -= partialPayment;
      this.cashBalance += partialPayment;
      loan.repaidAmount = (loan.repaidAmount || 0) + partialPayment;
      loan.totalDue = Math.max(0, loan.totalDue - partialPayment);
    }

    loan.status = 'DEFAULTED';
    trader.loansDefaulted++;
    trader.totalBorrowed += loan.principal;
    trader.totalRepaid += loan.repaidAmount || 0;
    trader.activeLoanId = null;
    const credit = StrategyBrain.evaluateCreditRating(trader);
    trader.creditRating = credit.rating;
    trader.expectedCollectionRate = credit.collectionRate;
    trader.statusText = 'Vade tasfiyesi yetmedi; borç temerrüde düştü.';
    this.addNewsEvent({
      type: 'LOAN_OVERDUE',
      speaker: 'cirak',
      speakerName: 'Cilet Ferhat',
      message: partialPayment > 0
        ? `${trader.name} vade tasfiyesinde ${partialPayment.toFixed(0)} USDT ödedi; kalan ${loan.totalDue.toFixed(0)} USDT temerrüt olarak sicile işlendi.`
        : `${trader.name} vade tasfiyesinde ödeme çıkaramadı; ${loan.totalDue.toFixed(0)} USDT temerrüt olarak sicile işlendi.`,
      badge: partialPayment > 0 ? '⛔ KISMİ TAHSİLAT / TEMERRÜT' : '⛔ TEMERRÜT',
      urgent: true,
    });
    this.persistLedger();
  }

  // Action 1: "Çırağı Gönder, Korkut"
  public executeThreatAction(loanId: string) {
    const loan = this.loans.find((l) => l.id === loanId);
    if (!loan || (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE')) return;

    const trader = this.traders[loan.traderId];
    loan.actionsTaken.push('THREATENED');
    trader.fearLevel = 100;

    soundService.playSirenSound();
    const threatDialogues = TRADER_DIALOGUES[trader.id].threatReaction;
    const traderReply = threatDialogues[Math.floor(Math.random() * threatDialogues.length)];

    soundService.speak(CIRAK_DIALOGUES.threatSuccess(trader.name), 'cirak');
    setTimeout(() => soundService.speak(traderReply, trader.id), 1800);

    // If trader has enough balance, they panic-pay immediately!
    if (trader.balance >= loan.totalDue) {
      this.settleLoan(loan, trader);
    } else {
      // Partial payment with all free balance except a 100 USDT operating buffer.
      const partialPayment = Math.max(0, trader.balance - 100);
      if (partialPayment > 0) {
        trader.balance -= partialPayment;
        this.cashBalance += partialPayment;
        loan.repaidAmount = (loan.repaidAmount || 0) + partialPayment;
        loan.totalDue -= partialPayment;
      }

      this.addNewsEvent({
        type: 'THREAT',
        speaker: 'cirak',
        speakerName: 'Cilet Ferhat',
        message: partialPayment > 0
          ? `Ferhat dükkanı bastı! ${trader.name} ${partialPayment.toFixed(0)} USDT kısmi ödeme yaptı: "${traderReply}".`
          : `Ferhat dükkanı bastı fakat ${trader.name} serbest bakiyeden ödeme çıkaramadı: "${traderReply}".`,
        badge: partialPayment > 0 ? '🗡️ KISMİ TAHSİLAT' : '🗡️ TAHSİLAT YOK',
      });
    }

    this.notify();
  }

  // Action 2: increase interest without quietly gifting a fresh deadline.
  public executeDoubleInterestAction(loanId: string) {
    const loan = this.loans.find((l) => l.id === loanId);
    if (!loan || (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE')) return;

    loan.actionsTaken.push('INTEREST_DOUBLED');
    loan.interestRate = Math.min(300, Math.round(loan.interestRate * 1.6));
    const addedInterest = loan.principal * (loan.interestRate / 100);
    loan.accruedInterest = addedInterest;
    loan.totalDue = Math.max(
      0,
      loan.principal + addedInterest - (loan.repaidAmount || 0),
    );
    loan.remainingSeconds = Math.max(
      0,
      Math.ceil((loan.dueAt - Date.now()) / 1000),
    );

    soundService.playGavelSound();
    const trader = this.traders[loan.traderId];
    const alert = `Usta faizi bindirdik! ${trader.name} artık ${loan.totalDue.toFixed(0)} USDT borçlu; eski vade aynen işliyor.`;
    soundService.speak(alert, 'cirak');

    this.addNewsEvent({
      type: 'LOAN_OVERDUE',
      speaker: 'cirak',
      speakerName: 'Cilet Ferhat',
      message: `${trader.name} için faiz %${loan.interestRate}'ye çıktı. Yeni borç ${loan.totalDue.toFixed(0)} USDT; vade uzatılmadı.`,
      badge: `📈 FAİZ BİNDİ (%${loan.interestRate})`,
      urgent: loan.status === 'OVERDUE',
    });

    this.notify();
  }

  // Repayment has priority over keeping an arbitrary trading buffer.
  private checkAutoLoanRepayment(trader: TraderProfile) {
    if (!trader.activeLoanId) return;
    const loan = this.loans.find((l) => l.id === trader.activeLoanId);
    if (!loan || (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE')) return;

    if (trader.balance >= loan.totalDue) {
      this.settleLoan(loan, trader);
    }
  }

  // Settle loan successfully
  private settleLoan(loan: Loan, trader: TraderProfile) {
    const paidAmount = loan.totalDue;
    const previouslyRepaid = loan.repaidAmount || 0;
    const totalPaid = paidAmount + previouslyRepaid;
    const wasLate = Boolean(loan.wasEverOverdue) || Date.now() > loan.dueAt;
    trader.balance = Math.max(0, trader.balance - paidAmount);
    trader.totalBorrowed += loan.principal;
    trader.totalRepaid += totalPaid;
    this.cashBalance += paidAmount;
    this.totalCollectedInterest += loan.accruedInterest;
    loan.status = 'PAID';
    loan.paidAt = Date.now();
    loan.repaidAmount = totalPaid;
    loan.totalDue = totalPaid;
    trader.activeLoanId = null;
    if (wasLate) trader.loansPaidLate++;
    else trader.loansPaidOnTime++;
    const credit = StrategyBrain.evaluateCreditRating(trader);
    trader.creditRating = credit.rating;
    trader.expectedCollectionRate = credit.collectionRate;
    this.persistLedger();

    soundService.playCashSound();
    const repayQuotes = TRADER_DIALOGUES[trader.id].debtRepayment;
    const speech = repayQuotes[Math.floor(Math.random() * repayQuotes.length)];
    soundService.speak(speech, trader.id);

    this.addNewsEvent({
      type: 'LOAN_PAID',
      speaker: trader.id,
      speakerName: trader.name,
      message: `Borç ödendi! ${loan.totalDue.toFixed(0)} USDT tahsil edildi (Kâr faiz: +${loan.accruedInterest.toFixed(0)} USDT). "${speech}"`,
      badge: `💰 BORÇ TAHSİL EDİLDİ`,
    });

    this.notify();
  }

  private addNewsEvent(event: Omit<NewsEvent, 'id' | 'timestamp'>) {
    const fullEvent: NewsEvent = {
      id: `news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      ...event,
    };
    this.newsFeed.unshift(fullEvent);
    if (this.newsFeed.length > 50) this.newsFeed.pop();
  }

  public destroy() {
    if (this.loopInterval) clearInterval(this.loopInterval);
  }
}

export const tradingEngine = new TradingEngine();
