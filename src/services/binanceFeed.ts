import { DataHealthStatus, IndicatorSnapshot, MarketTicker } from '../types';

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

function isValidKline(kline: KlineData) {
  return (
    Number.isFinite(kline.openTime) &&
    Number.isFinite(kline.closeTime) &&
    Number.isFinite(kline.open) &&
    Number.isFinite(kline.high) &&
    Number.isFinite(kline.low) &&
    Number.isFinite(kline.close) &&
    Number.isFinite(kline.volume) &&
    kline.open > 0 &&
    kline.high > 0 &&
    kline.low > 0 &&
    kline.close > 0 &&
    kline.high >= kline.low &&
    kline.volume >= 0
  );
}

export interface LiquidationOrderEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  timestamp: number;
}

interface FlowBucket {
  second: number;
  buyNotional: number;
  sellNotional: number;
  count: number;
}

interface FlowWindow {
  buckets: FlowBucket[];
  buyNotional: number;
  sellNotional: number;
  count: number;
  lastUpdate: number;
}

interface BookSample {
  time: number;
  ratio: number;
}

interface BookWindow {
  samples: BookSample[];
  ewmaRatio: number;
  lastUpdate: number;
  levelCount: number;
}

interface OpenInterestWindow {
  current: number;
  history: { oi: number; time: number }[];
  lastUpdate: number;
}

export type MarketUpdateCallback = (ticker: MarketTicker) => void;
export type IndicatorsUpdateCallback = (symbol: string, indicators: IndicatorSnapshot) => void;
export type LiquidationEventCallback = (event: LiquidationOrderEvent) => void;

type SocketKind = 'public' | 'market';

const REST_BASE = 'https://fapi.binance.com';
const PUBLIC_WS_BASE = 'wss://fstream.binance.com/public/stream?streams=';
const MARKET_WS_BASE = 'wss://fstream.binance.com/market/stream?streams=';
const FIVE_MINUTES = 5 * 60 * 1000;

export function calculateDirectionalBookPersistence(ratios: number[]) {
  if (!ratios.length) return 0;
  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const bullish = mean >= 0.5;
  const aligned = ratios.filter((ratio) => bullish ? ratio >= 0.5 : ratio < 0.5).length;
  return (bullish ? 1 : -1) * (aligned / ratios.length);
}

export function calculateOpenInterestDelta(
  history: { oi: number; time: number }[],
  current: number,
  now: number,
  windowMs = FIVE_MINUTES,
  toleranceMs = 15_000,
) {
  if (!history.length || current <= 0) {
    return { delta: 0, percent: 0, spanMs: 0, hasFullWindow: false };
  }
  const ordered = [...history].sort((a, b) => a.time - b.time);
  const spanMs = now - ordered[0].time;
  const targetTime = now - windowMs;
  const hasFullWindow = ordered[0].time <= targetTime + toleranceMs;
  if (!hasFullWindow) return { delta: 0, percent: 0, spanMs, hasFullWindow };

  const reference = ordered.reduce((best, sample) =>
    Math.abs(sample.time - targetTime) < Math.abs(best.time - targetTime)
      ? sample
      : best,
  );
  const delta = current - reference.oi;
  const percent = reference.oi > 0 ? (delta / reference.oi) * 100 : 0;
  return { delta, percent, spanMs, hasFullWindow };
}

class BinanceFeedService {
  private publicWs: WebSocket | null = null;
  private marketWs: WebSocket | null = null;
  private symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'PEPEUSDT'];
  private marketTickers: Map<string, MarketTicker> = new Map();
  private klinesHistory: Map<string, KlineData[]> = new Map();
  private indicatorsCache: Map<string, IndicatorSnapshot> = new Map();
  private flowWindows: Map<string, FlowWindow> = new Map();
  private bookWindows: Map<string, BookWindow> = new Map();
  private openInterestMap: Map<string, OpenInterestWindow> = new Map();
  private liquidationsMap: Map<string, LiquidationOrderEvent[]> = new Map();

  private marketCallbacks: Set<MarketUpdateCallback> = new Set();
  private indicatorCallbacks: Set<IndicatorsUpdateCallback> = new Set();
  private liquidationCallbacks: Set<LiquidationEventCallback> = new Set();

  private reconnectAttempts: Record<SocketKind, number> = { public: 0, market: 0 };
  private reconnectTimeouts: Partial<Record<SocketKind, number>> = {};
  private lastSocketMessage: Record<SocketKind, number> = { public: 0, market: 0 };
  private publicConnected = false;
  private marketConnected = false;
  private isDestroyed = false;
  private isReconfiguring = false;
  private pollInterval: number | null = null;
  private oiPollInterval: number | null = null;
  private indicatorTimers: Map<string, number> = new Map();
  private lastIndicatorCompute: Map<string, number> = new Map();
  private restPollInFlight = false;
  private oiPollInFlight = false;

  private totalMessagesReceived = 0;
  private lastMessageTime = 0;
  private lastPriceMessageTime = 0;
  private latencyMs: number | null = null;
  private restGeoBlocked = false;
  private lastError = '';

  constructor() {
    if (typeof window !== 'undefined') this.initFeed();
  }

  public getSymbols(): string[] {
    return [...this.symbols];
  }

  public setSymbols(newSymbols: string[]) {
    const normalized = [...new Set(newSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (normalized.length === 0) return;
    this.symbols = normalized;
    this.pruneRemovedSymbols();
    this.reconfigureSockets();
    void this.fetchInitialData();
  }

  public onMarketUpdate(cb: MarketUpdateCallback): () => void {
    this.marketCallbacks.add(cb);
    return () => this.marketCallbacks.delete(cb);
  }

  public onIndicatorsUpdate(cb: IndicatorsUpdateCallback): () => void {
    this.indicatorCallbacks.add(cb);
    return () => this.indicatorCallbacks.delete(cb);
  }

  public onLiquidation(cb: LiquidationEventCallback): () => void {
    this.liquidationCallbacks.add(cb);
    return () => this.liquidationCallbacks.delete(cb);
  }

  public getTicker(symbol: string): MarketTicker | undefined {
    const ticker = this.marketTickers.get(symbol.toUpperCase());
    return ticker && ticker.lastPrice > 0 ? ticker : undefined;
  }

  public getIndicators(symbol: string): IndicatorSnapshot | undefined {
    return this.indicatorsCache.get(symbol.toUpperCase());
  }

  public getAllTickers(): MarketTicker[] {
    return Array.from(this.marketTickers.values()).filter((ticker) => ticker.lastPrice > 0);
  }

  public getDataHealth(): DataHealthStatus {
    const now = Date.now();
    const readySymbols = this.symbols.filter(
      (symbol) => this.indicatorsCache.get(symbol)?.dataQuality === 'READY',
    ).length;
    const oiReadySymbols = this.symbols.filter((symbol) => {
      const updatedAt = this.openInterestMap.get(symbol)?.lastUpdate || 0;
      return updatedAt > 0 && now - updatedAt <= 20_000;
    }).length;
    const publicLive =
      this.publicConnected && now - this.lastSocketMessage.public < 10_000;
    const marketLive =
      this.marketConnected && now - this.lastSocketMessage.market < 10_000;
    const activeStreamCount =
      (publicLive ? this.symbols.length * 2 : 0) +
      (marketLive ? this.symbols.length * 5 : 0);
    const bothSocketsLive = publicLive && marketLive;
    const oiFullyReady = oiReadySymbols === this.symbols.length;

    if (bothSocketsLive && readySymbols > 0 && oiFullyReady && !this.restGeoBlocked) {
      return {
        status: 'CONNECTED',
        latencyMs: this.latencyMs,
        lastMessageTime: this.lastMessageTime,
        lastPriceMessageTime: this.lastPriceMessageTime,
        activeStreamsCount: activeStreamCount,
        totalMessagesReceived: this.totalMessagesReceived,
        readySymbols,
        oiReadySymbols,
        totalSymbols: this.symbols.length,
        detail: 'Binance public/market WebSocket ve OI REST kaynakları canlı',
      };
    }

    if (this.restGeoBlocked && !publicLive && !marketLive) {
      return {
        status: 'BLOCKED',
        latencyMs: this.latencyMs,
        lastMessageTime: 0,
        lastPriceMessageTime: 0,
        activeStreamsCount: activeStreamCount,
        totalMessagesReceived: this.totalMessagesReceived,
        readySymbols,
        oiReadySymbols,
        totalSymbols: this.symbols.length,
        detail: 'Binance bu ağ bölgesinden erişimi kısıtladı; işlem motoru kilitli',
      };
    }

    if (readySymbols > 0) {
      const detail = this.restGeoBlocked
        ? 'WebSocket canlı; OI REST bölgesel olarak engelli ve OI stratejisi kilitli'
        : !bothSocketsLive
          ? 'WebSocket eksik; doğrulanmış REST kaynaklarıyla sınırlı çalışma'
          : 'OI REST kaynağı ısınıyor veya erişilemiyor; OI stratejisi kilitli';
      return {
        status: 'DEGRADED',
        latencyMs: this.latencyMs,
        lastMessageTime: this.lastMessageTime,
        lastPriceMessageTime: this.lastPriceMessageTime,
        activeStreamsCount: activeStreamCount,
        totalMessagesReceived: this.totalMessagesReceived,
        readySymbols,
        oiReadySymbols,
        totalSymbols: this.symbols.length,
        detail,
      };
    }

    const connecting = this.publicWs || this.marketWs;
    return {
      status: connecting ? 'CONNECTING' : 'OFFLINE',
      latencyMs: this.latencyMs,
      lastMessageTime: this.lastMessageTime,
      lastPriceMessageTime: this.lastPriceMessageTime,
      activeStreamsCount: activeStreamCount,
      totalMessagesReceived: this.totalMessagesReceived,
      readySymbols,
      oiReadySymbols,
      totalSymbols: this.symbols.length,
      detail: this.lastError || 'Canlı piyasa kaynakları bekleniyor',
    };
  }

  private initFeed() {
    void this.fetchInitialData();
    this.connectSocket('public');
    this.connectSocket('market');

    this.pollInterval = window.setInterval(() => {
      void this.runRestPoll();
    }, 4_000);

    this.oiPollInterval = window.setInterval(() => {
      void this.runOpenInterestPoll();
    }, 8_000);
  }

  public async fetchAvailableFuturesSymbols(): Promise<string[]> {
    const data = await this.fetchJson<{
      symbols: { symbol: string; contractType: string; status: string }[];
    }>(`${REST_BASE}/fapi/v1/exchangeInfo`);

    if (!data) return [...this.symbols];
    return data.symbols
      .filter(
        (symbol) =>
          symbol.contractType === 'PERPETUAL' &&
          symbol.status === 'TRADING' &&
          symbol.symbol.endsWith('USDT'),
      )
      .map((symbol) => symbol.symbol);
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (response.status === 451) {
        this.restGeoBlocked = true;
        this.lastError = 'Binance HTTP 451 bölgesel erişim kısıtı';
        return null;
      }
      if (!response.ok) {
        this.lastError = `Binance HTTP ${response.status}`;
        return null;
      }
      this.restGeoBlocked = false;
      this.lastError = '';
      return (await response.json()) as T;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Piyasa verisi alınamadı';
      return null;
    }
  }

  private async fetchInitialData() {
    await Promise.all(this.symbols.map((symbol) => this.fetchKlinesAndDepth(symbol)));
    await this.runOpenInterestPoll();
  }

  private async runRestPoll() {
    if (this.restPollInFlight) return;
    this.restPollInFlight = true;
    try {
      const now = Date.now();
      const publicLive = this.publicConnected && now - this.lastSocketMessage.public < 10_000;
      const marketLive = this.marketConnected && now - this.lastSocketMessage.market < 10_000;
      if (!publicLive || !marketLive) {
        await Promise.all(this.symbols.map((symbol) => this.fetchKlinesAndDepth(symbol)));
      }
      await Promise.all([this.pollMarketData(), this.measureLatency()]);
      this.refreshStaleQualities();
    } finally {
      this.restPollInFlight = false;
    }
  }

  private async runOpenInterestPoll() {
    if (this.oiPollInFlight) return;
    this.oiPollInFlight = true;
    try {
      await this.pollOpenInterest();
    } finally {
      this.oiPollInFlight = false;
    }
  }

  private async measureLatency() {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const data = await this.fetchJson<{ serverTime: number }>(`${REST_BASE}/fapi/v1/time`);
    if (data) {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.latencyMs = Math.round(end - start);
    } else {
      this.latencyMs = null;
    }
  }

  private async pollOpenInterest() {
    await Promise.all(
      this.symbols.map(async (symbol) => {
        const data = await this.fetchJson<{ openInterest: string }>(
          `${REST_BASE}/fapi/v1/openInterest?symbol=${symbol}`,
        );
        const oi = Number(data?.openInterest || 0);
        if (!this.symbols.includes(symbol) || !Number.isFinite(oi) || oi <= 0) return;

        const now = Date.now();
        const window = this.openInterestMap.get(symbol) || {
          current: oi,
          history: [],
          lastUpdate: 0,
        };
        window.history.push({ oi, time: now });
        window.history = window.history.filter((sample) => sample.time >= now - 15 * 60_000);
        window.current = oi;
        window.lastUpdate = now;
        this.openInterestMap.set(symbol, window);
        this.scheduleIndicatorRecompute(symbol);
      }),
    );
  }

  private async fetchKlinesAndDepth(symbol: string) {
    const [klines, premium, depth] = await Promise.all([
      this.fetchJson<(string | number)[][]>(
        `${REST_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=60`,
      ),
      this.fetchJson<{ lastFundingRate: string; markPrice: string }>(
        `${REST_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`,
      ),
      this.fetchJson<{ bids: string[][]; asks: string[][] }>(
        `${REST_BASE}/fapi/v1/depth?symbol=${symbol}&limit=20`,
      ),
    ]);

    if (!this.symbols.includes(symbol)) return;
    const now = Date.now();
    if (klines?.length) {
      const parsed = klines
        .map((kline) => ({
          openTime: Number(kline[0]),
          open: Number(kline[1]),
          high: Number(kline[2]),
          low: Number(kline[3]),
          close: Number(kline[4]),
          volume: Number(kline[5]),
          closeTime: Number(kline[6]),
        }))
        .filter(isValidKline);
      if (parsed.length) this.klinesHistory.set(symbol, parsed);
    }

    const lastKline = this.klinesHistory.get(symbol)?.at(-1);
    const realPrice = lastKline?.close || 0;
    const ticker = this.getOrCreateTicker(symbol);
    if (Number.isFinite(realPrice) && realPrice > 0) {
      // A recent ticker is a better current-price source than the latest 1m close.
      if (ticker.lastPrice <= 0 || now - ticker.priceUpdatedAt > 10_000) {
        ticker.lastPrice = realPrice;
        ticker.priceUpdatedAt = now;
      }
      if (ticker.highPrice <= 0) ticker.highPrice = lastKline?.high || realPrice;
      if (ticker.lowPrice <= 0) ticker.lowPrice = lastKline?.low || realPrice;
      if (ticker.volume <= 0) ticker.volume = lastKline?.volume || 0;
      ticker.klineUpdatedAt = now;
    }

    const markPrice = Number(premium?.markPrice || 0);
    if (Number.isFinite(markPrice) && markPrice > 0) {
      const fundingRate = Number(premium?.lastFundingRate || 0);
      ticker.markPrice = markPrice;
      if (Number.isFinite(fundingRate)) ticker.fundingRate = fundingRate;
      ticker.markUpdatedAt = now;
    }

    if (depth?.bids?.length && depth?.asks?.length) {
      this.applyDepth(symbol, depth.bids, depth.asks, now);
    }

    ticker.updatedAt = now;
    this.emitTicker(ticker);
    this.scheduleIndicatorRecompute(symbol, true);
  }

  private async pollMarketData() {
    await Promise.all(this.symbols.map(async (symbol) => {
      const source = await this.fetchJson<{
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        highPrice: string;
        lowPrice: string;
        volume: string;
        quoteVolume: string;
      }>(`${REST_BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      if (!source) return;

      const lastPrice = Number(source.lastPrice);
      if (!this.symbols.includes(symbol) || !Number.isFinite(lastPrice) || lastPrice <= 0) return;
      const now = Date.now();
      const ticker = this.getOrCreateTicker(symbol);
      ticker.lastPrice = lastPrice;
      ticker.priceChangePercent = Number(source.priceChangePercent);
      ticker.highPrice = Number(source.highPrice);
      ticker.lowPrice = Number(source.lowPrice);
      ticker.volume = Number(source.volume);
      ticker.quoteVolume = Number(source.quoteVolume);
      ticker.priceUpdatedAt = now;
      ticker.updatedAt = now;
      this.emitTicker(ticker);
      this.scheduleIndicatorRecompute(symbol);
    }));
  }

  private connectSocket(kind: SocketKind) {
    if (this.isDestroyed || typeof window === 'undefined') return;

    const streams = kind === 'public' ? this.buildPublicStreams() : this.buildMarketStreams();
    const url = `${kind === 'public' ? PUBLIC_WS_BASE : MARKET_WS_BASE}${streams.join('/')}`;

    try {
      const socket = new WebSocket(url);
      if (kind === 'public') this.publicWs = socket;
      else this.marketWs = socket;

      socket.onopen = () => {
        this.reconnectAttempts[kind] = 0;
        if (kind === 'public') this.publicConnected = true;
        else this.marketConnected = true;
      };

      socket.onmessage = (event) => {
        this.totalMessagesReceived++;
        this.lastMessageTime = Date.now();
        this.lastSocketMessage[kind] = this.lastMessageTime;
        try {
          this.handleWsMessage(JSON.parse(event.data));
        } catch {
          this.lastError = 'WebSocket mesajı çözümlenemedi';
        }
      };

      socket.onerror = () => {
        this.lastError = `${kind} WebSocket hatası`;
      };

      socket.onclose = () => {
        this.lastSocketMessage[kind] = 0;
        if (kind === 'public') this.publicConnected = false;
        else this.marketConnected = false;
        if (!this.isDestroyed && !this.isReconfiguring) this.scheduleReconnect(kind);
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : `${kind} bağlantısı açılamadı`;
      this.scheduleReconnect(kind);
    }
  }

  private buildPublicStreams() {
    return this.symbols.flatMap((symbol) => {
      const lower = symbol.toLowerCase();
      return [`${lower}@bookTicker`, `${lower}@depth20@500ms`];
    });
  }

  private buildMarketStreams() {
    return this.symbols.flatMap((symbol) => {
      const lower = symbol.toLowerCase();
      return [
        `${lower}@ticker`,
        `${lower}@markPrice@1s`,
        `${lower}@kline_1m`,
        `${lower}@aggTrade`,
        `${lower}@forceOrder`,
      ];
    });
  }

  private handleWsMessage(payload: { stream: string; data: Record<string, unknown> }) {
    if (!payload?.data || !payload.stream) return;
    const stream = payload.stream;
    const data = payload.data;
    const streamType = stream.split('@')[1] || '';
    const symbol = String(data.s || stream.split('@')[0]).toUpperCase();
    if (!this.symbols.includes(symbol)) return;

    if (streamType.startsWith('forceOrder')) {
      this.handleLiquidation(symbol, data);
      return;
    }

    if (streamType === 'aggTrade') {
      this.addAggTrade(
        symbol,
        Number(data.T || Date.now()),
        Number(data.p || 0),
        Number(data.q || 0),
        data.m === true,
      );
      this.scheduleIndicatorRecompute(symbol);
      return;
    }

    const now = Date.now();
    const ticker = this.getOrCreateTicker(symbol);

    if (streamType === 'ticker') {
      const price = Number(data.c || 0);
      if (!Number.isFinite(price) || price <= 0) return;
      ticker.lastPrice = price;
      ticker.priceChangePercent = Number(data.P || 0);
      ticker.highPrice = Number(data.h || price);
      ticker.lowPrice = Number(data.l || price);
      ticker.volume = Number(data.v || 0);
      ticker.quoteVolume = Number(data.q || 0);
      ticker.priceUpdatedAt = now;
      ticker.updatedAt = now;
      this.lastPriceMessageTime = now;
      this.emitTicker(ticker);
    } else if (streamType === 'bookTicker') {
      const bid = Number(data.b || 0);
      const ask = Number(data.a || 0);
      if (
        !Number.isFinite(bid) ||
        !Number.isFinite(ask) ||
        bid <= 0 ||
        ask < bid
      ) return;
      ticker.bestBid = bid;
      ticker.bestAsk = ask;
      ticker.bookUpdatedAt = now;
      ticker.updatedAt = now;
      if (ticker.lastPrice > 0) this.emitTicker(ticker);
    } else if (streamType.startsWith('depth20')) {
      this.applyDepth(
        symbol,
        (data.b as string[][]) || [],
        (data.a as string[][]) || [],
        now,
      );
      if (ticker.lastPrice > 0) this.emitTicker(ticker);
    } else if (streamType.startsWith('markPrice')) {
      const mark = Number(data.p || 0);
      if (!Number.isFinite(mark) || mark <= 0) return;
      const funding = Number(data.r || 0);
      ticker.markPrice = mark;
      if (Number.isFinite(funding)) ticker.fundingRate = funding;
      ticker.markUpdatedAt = now;
      ticker.updatedAt = now;
      if (ticker.lastPrice > 0) this.emitTicker(ticker);
    } else if (streamType === 'kline_1m') {
      const kline = data.k as Record<string, string | number> | undefined;
      if (!kline) return;
      const parsed: KlineData = {
        openTime: Number(kline.t),
        open: Number(kline.o),
        high: Number(kline.h),
        low: Number(kline.l),
        close: Number(kline.c),
        volume: Number(kline.v),
        closeTime: Number(kline.T),
      };
      if (!isValidKline(parsed)) return;
      this.updateKline(symbol, parsed);
      ticker.klineUpdatedAt = now;
      if (ticker.lastPrice <= 0 && parsed.close > 0) {
        ticker.lastPrice = parsed.close;
        ticker.priceUpdatedAt = now;
      }
      ticker.updatedAt = now;
      if (ticker.lastPrice > 0) this.emitTicker(ticker);
    }

    this.scheduleIndicatorRecompute(symbol);
  }

  private handleLiquidation(symbol: string, data: Record<string, unknown>) {
    const order = data.o as Record<string, string> | undefined;
    if (!order) return;
    const price = Number(order.ap || order.p || 0);
    const qty = Number(order.z || order.q || 0);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return;

    if (order.S !== 'BUY' && order.S !== 'SELL') return;
    const event: LiquidationOrderEvent = {
      symbol,
      side: order.S,
      price,
      qty,
      timestamp: Number(order.T || Date.now()),
    };
    const now = Date.now();
    const list = this.pruneLiquidations(symbol, now);
    list.push(event);
    this.liquidationsMap.set(symbol, list);
    this.liquidationCallbacks.forEach((callback) => callback(event));
    this.scheduleIndicatorRecompute(symbol);
  }

  private addAggTrade(
    symbol: string,
    time: number,
    price: number,
    qty: number,
    isBuyerMaker: boolean,
  ) {
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return;
    const window = this.flowWindows.get(symbol) || {
      buckets: [],
      buyNotional: 0,
      sellNotional: 0,
      count: 0,
      lastUpdate: 0,
    };
    const second = Math.floor(time / 1000) * 1000;
    let bucket = window.buckets.at(-1);
    if (!bucket || bucket.second !== second) {
      bucket = { second, buyNotional: 0, sellNotional: 0, count: 0 };
      window.buckets.push(bucket);
    }

    const notional = price * qty;
    if (isBuyerMaker) {
      bucket.sellNotional += notional;
      window.sellNotional += notional;
    } else {
      bucket.buyNotional += notional;
      window.buyNotional += notional;
    }
    bucket.count++;
    window.count++;
    window.lastUpdate = time;
    this.pruneFlow(window, Date.now());
    this.flowWindows.set(symbol, window);
  }

  private pruneFlow(window: FlowWindow, now: number) {
    const cutoff = now - FIVE_MINUTES;
    while (window.buckets.length && window.buckets[0].second < cutoff) {
      const removed = window.buckets.shift()!;
      window.buyNotional -= removed.buyNotional;
      window.sellNotional -= removed.sellNotional;
      window.count -= removed.count;
    }
    window.buyNotional = Math.max(0, window.buyNotional);
    window.sellNotional = Math.max(0, window.sellNotional);
    window.count = Math.max(0, window.count);
  }

  private applyDepth(symbol: string, bids: string[][], asks: string[][], now: number) {
    const normalizeLevels = (levels: string[][]) => levels
      .map((level) => [Number(level[0]), Number(level[1])] as const)
      .filter(([price, quantity]) =>
        Number.isFinite(price) && Number.isFinite(quantity) && price > 0 && quantity >= 0,
      )
      .slice(0, 20);
    const validBids = normalizeLevels(bids);
    const validAsks = normalizeLevels(asks);
    if (
      !validBids.length ||
      !validAsks.length ||
      validAsks[0][0] < validBids[0][0]
    ) return;

    const bidNotional = validBids.reduce(
      (sum, [price, quantity]) => sum + price * quantity,
      0,
    );
    const askNotional = validAsks.reduce(
      (sum, [price, quantity]) => sum + price * quantity,
      0,
    );
    if (!Number.isFinite(bidNotional + askNotional) || bidNotional + askNotional <= 0) return;

    const ratio = bidNotional / (bidNotional + askNotional);
    const book = this.bookWindows.get(symbol) || {
      samples: [],
      ewmaRatio: ratio,
      lastUpdate: 0,
      levelCount: 0,
    };
    book.ewmaRatio = book.samples.length ? book.ewmaRatio * 0.72 + ratio * 0.28 : ratio;
    book.samples.push({ time: now, ratio });
    book.samples = book.samples.filter((sample) => sample.time >= now - 30_000).slice(-120);
    book.lastUpdate = now;
    book.levelCount = Math.min(validBids.length, validAsks.length);
    this.bookWindows.set(symbol, book);

    const ticker = this.getOrCreateTicker(symbol);
    ticker.bestBid = validBids[0][0];
    ticker.bestAsk = validAsks[0][0];
    ticker.bidDepthVolume = validBids.reduce((sum, [, quantity]) => sum + quantity, 0);
    ticker.askDepthVolume = validAsks.reduce((sum, [, quantity]) => sum + quantity, 0);
    ticker.orderbookRatio = book.ewmaRatio;
    ticker.bookUpdatedAt = now;
    ticker.updatedAt = now;
    this.scheduleIndicatorRecompute(symbol);
  }

  private pruneLiquidations(symbol: string, now: number) {
    const filtered = (this.liquidationsMap.get(symbol) || []).filter(
      (event) => event.timestamp >= now - FIVE_MINUTES,
    );
    this.liquidationsMap.set(symbol, filtered);
    return filtered;
  }

  private updateKline(symbol: string, kline: KlineData) {
    const list = this.klinesHistory.get(symbol) || [];
    const index = list.findIndex((item) => item.openTime === kline.openTime);
    if (index >= 0) list[index] = kline;
    else list.push(kline);
    if (list.length > 80) list.splice(0, list.length - 80);
    this.klinesHistory.set(symbol, list);
  }

  private getOrCreateTicker(symbol: string): MarketTicker {
    const existing = this.marketTickers.get(symbol);
    if (existing) return existing;
    const ticker: MarketTicker = {
      symbol,
      lastPrice: 0,
      priceChangePercent: 0,
      highPrice: 0,
      lowPrice: 0,
      volume: 0,
      quoteVolume: 0,
      fundingRate: 0,
      markPrice: 0,
      bestBid: 0,
      bestAsk: 0,
      bidDepthVolume: 0,
      askDepthVolume: 0,
      orderbookRatio: 0.5,
      updatedAt: 0,
      priceUpdatedAt: 0,
      bookUpdatedAt: 0,
      markUpdatedAt: 0,
      klineUpdatedAt: 0,
    };
    this.marketTickers.set(symbol, ticker);
    return ticker;
  }

  private emitTicker(ticker: MarketTicker) {
    if (ticker.lastPrice <= 0) return;
    this.marketCallbacks.forEach((callback) => {
      try {
        callback({ ...ticker });
      } catch (error) {
        console.error('Ticker callback error:', error);
      }
    });
  }

  private scheduleIndicatorRecompute(symbol: string, immediate = false) {
    if (!this.symbols.includes(symbol)) return;
    const now = Date.now();
    const last = this.lastIndicatorCompute.get(symbol) || 0;
    const wait = immediate ? 0 : Math.max(0, 500 - (now - last));

    if (wait === 0) {
      const existing = this.indicatorTimers.get(symbol);
      if (existing) window.clearTimeout(existing);
      this.indicatorTimers.delete(symbol);
      this.recomputeIndicators(symbol);
      return;
    }

    if (this.indicatorTimers.has(symbol)) return;
    const timer = window.setTimeout(() => {
      this.indicatorTimers.delete(symbol);
      this.recomputeIndicators(symbol);
    }, wait);
    this.indicatorTimers.set(symbol, timer);
  }

  private recomputeIndicators(symbol: string) {
    const ticker = this.marketTickers.get(symbol);
    const klines = this.klinesHistory.get(symbol) || [];
    if (!ticker || ticker.lastPrice <= 0 || klines.length === 0) return;

    const now = Date.now();
    this.lastIndicatorCompute.set(symbol, now);
    const closes = klines.map((kline) => kline.close);
    closes[closes.length - 1] = ticker.lastPrice;

    let rsi14 = 50;
    if (closes.length >= 15) {
      let gains = 0;
      let losses = 0;
      for (let i = closes.length - 14; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      rsi14 = avgLoss === 0
        ? avgGain === 0 ? 50 : 100
        : 100 - 100 / (1 + avgGain / avgLoss);
    }

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, Math.min(50, closes.length));
    const bbWindow = closes.slice(-20);
    const bbMiddle = bbWindow.reduce((sum, value) => sum + value, 0) / bbWindow.length;
    const variance =
      bbWindow.reduce((sum, value) => sum + Math.pow(value - bbMiddle, 2), 0) /
      bbWindow.length;
    const deviation = Math.sqrt(variance);
    const bbUpper = bbMiddle + 2 * deviation;
    const bbLower = bbMiddle - 2 * deviation;

    const lastKline = klines.at(-1)!;
    const body = Math.abs(lastKline.close - lastKline.open) || ticker.lastPrice * 0.00001;
    const upperWick = Math.max(0, lastKline.high - Math.max(lastKline.open, lastKline.close));
    const lowerWick = Math.max(0, Math.min(lastKline.open, lastKline.close) - lastKline.low);
    const upperWickRatio = upperWick / body;
    const lowerWickRatio = lowerWick / body;

    const volumeHistory = klines.slice(-21, -1);
    const averageVolume =
      volumeHistory.reduce((sum, kline) => sum + kline.volume, 0) /
      Math.max(1, volumeHistory.length);
    const volumeSurgeRatio = averageVolume > 0 ? lastKline.volume / averageVolume : 0;

    const trWindow = klines.slice(-15);
    let atr = 0;
    for (let i = 1; i < trWindow.length; i++) {
      const current = trWindow[i];
      const previousClose = trWindow[i - 1].close;
      atr += Math.max(
        current.high - current.low,
        Math.abs(current.high - previousClose),
        Math.abs(current.low - previousClose),
      );
    }
    atr = trWindow.length > 1 ? atr / (trWindow.length - 1) : 0;

    const book = this.bookWindows.get(symbol);
    const bookSamples = book?.samples || [];
    const orderbookPersistence = calculateDirectionalBookPersistence(
      bookSamples.map((sample) => sample.ratio),
    );

    const flow = this.flowWindows.get(symbol);
    if (flow) this.pruneFlow(flow, now);
    const totalFlow = (flow?.buyNotional || 0) + (flow?.sellNotional || 0);
    const cvdRatio = totalFlow > 0 ? (flow?.buyNotional || 0) / totalFlow : 0.5;
    const cvd5m = (flow?.buyNotional || 0) - (flow?.sellNotional || 0);

    const oiWindow = this.openInterestMap.get(symbol);
    const openInterest = oiWindow?.current || 0;
    const oiHistory = oiWindow?.history || [];
    const oiMetrics = calculateOpenInterestDelta(oiHistory, openInterest, now);
    const oiDelta5m = oiMetrics.delta;
    const oiDelta5mPercent = oiMetrics.percent;
    const oiHistorySpanMs = oiMetrics.spanMs;

    const liquidations = this.pruneLiquidations(symbol, now);
    let longLiquidations = 0;
    let shortLiquidations = 0;
    liquidations.forEach((event) => {
      const notional = event.price * event.qty;
      if (event.side === 'SELL') longLiquidations += notional;
      else shortLiquidations += notional;
    });
    const liquidationVolume5m = longLiquidations + shortLiquidations;
    let liquidationBurstSide: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
    if (longLiquidations > 50_000 && longLiquidations > shortLiquidations * 2) {
      liquidationBurstSide = 'LONG';
    } else if (shortLiquidations > 50_000 && shortLiquidations > longLiquidations * 2) {
      liquidationBurstSide = 'SHORT';
    }

    const freshness = {
      price: ticker.priceUpdatedAt,
      book: book?.lastUpdate || 0,
      mark: ticker.markUpdatedAt,
      kline: ticker.klineUpdatedAt,
      flow: flow?.lastUpdate || 0,
      openInterest: oiWindow?.lastUpdate || 0,
    };
    // READY means the common price/mark/candle core is usable. Strategy-specific
    // book, flow and OI requirements are gated independently in StrategyBrain.
    const baseReady =
      now - freshness.price <= 5_000 &&
      now - freshness.mark <= 7_000 &&
      now - freshness.kline <= 10_000 &&
      klines.length >= 50;
    const anyCoreStale =
      (freshness.price > 0 && now - freshness.price > 10_000) ||
      (freshness.mark > 0 && now - freshness.mark > 14_000) ||
      (freshness.kline > 0 && now - freshness.kline > 20_000);
    const dataQuality = baseReady ? 'READY' : anyCoreStale ? 'STALE' : 'WARMING';

    const midPrice = (ticker.bestBid + ticker.bestAsk) / 2;
    const spreadPercent =
      midPrice > 0 && ticker.bestAsk >= ticker.bestBid
        ? ((ticker.bestAsk - ticker.bestBid) / midPrice) * 100
        : 0;

    const snapshot: IndicatorSnapshot = {
      timestamp: now,
      symbol,
      currentPrice: ticker.lastPrice,
      klineSampleCount: klines.length,
      rsi14: Number(rsi14.toFixed(2)),
      ema20: Number(ema20.toFixed(8)),
      ema50: Number(ema50.toFixed(8)),
      bbUpper: Number(bbUpper.toFixed(8)),
      bbLower: Number(bbLower.toFixed(8)),
      bbMiddle: Number(bbMiddle.toFixed(8)),
      orderbookImbalance: Number((book?.ewmaRatio ?? 0.5).toFixed(4)),
      orderbookPersistence: Number(orderbookPersistence.toFixed(3)),
      orderbookSampleCount: bookSamples.length,
      fundingRate: Number(ticker.fundingRate.toFixed(8)),
      spikeShadowRatio: Number(Math.max(upperWickRatio, lowerWickRatio).toFixed(2)),
      upperWickRatio: Number(upperWickRatio.toFixed(2)),
      lowerWickRatio: Number(lowerWickRatio.toFixed(2)),
      volumeSurgeRatio: Number(volumeSurgeRatio.toFixed(2)),
      atr: Number(atr.toFixed(8)),
      bbWidth: bbMiddle > 0 ? Number(((bbUpper - bbLower) / bbMiddle).toFixed(5)) : 0,
      spreadPercent: Number(spreadPercent.toFixed(5)),
      openInterest: Number(openInterest.toFixed(4)),
      oiDelta5m: Number(oiDelta5m.toFixed(4)),
      oiDelta5mPercent: Number(oiDelta5mPercent.toFixed(4)),
      oiHistorySpanMs,
      cvd5m: Number(cvd5m.toFixed(2)),
      cvdRatio: Number(cvdRatio.toFixed(4)),
      aggTradeCount5m: flow?.count || 0,
      liquidationBurstSide,
      liquidationVolume5m: Number(liquidationVolume5m.toFixed(2)),
      dataQuality,
      freshness,
    };

    this.indicatorsCache.set(symbol, snapshot);
    this.indicatorCallbacks.forEach((callback) => {
      try {
        callback(symbol, { ...snapshot });
      } catch {
        // Consumer failures must not break the feed.
      }
    });
  }

  private refreshStaleQualities() {
    this.symbols.forEach((symbol) => this.scheduleIndicatorRecompute(symbol, true));
  }

  private calculateEMA(values: number[], period: number) {
    if (!values.length) return 0;
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * multiplier + ema * (1 - multiplier);
    }
    return ema;
  }

  private scheduleReconnect(kind: SocketKind) {
    if (this.reconnectTimeouts[kind] || this.isDestroyed) return;
    this.reconnectAttempts[kind]++;
    const base = Math.min(1_000 * Math.pow(1.6, this.reconnectAttempts[kind]), 30_000);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectTimeouts[kind] = window.setTimeout(() => {
      delete this.reconnectTimeouts[kind];
      this.connectSocket(kind);
    }, delay);
  }

  private reconfigureSockets() {
    this.isReconfiguring = true;
    (['public', 'market'] as SocketKind[]).forEach((kind) => {
      this.lastSocketMessage[kind] = 0;
      const timer = this.reconnectTimeouts[kind];
      if (timer) window.clearTimeout(timer);
      delete this.reconnectTimeouts[kind];
      const socket = kind === 'public' ? this.publicWs : this.marketWs;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (kind === 'public') {
        this.publicWs = null;
        this.publicConnected = false;
      } else {
        this.marketWs = null;
        this.marketConnected = false;
      }
    });
    this.isReconfiguring = false;
    this.connectSocket('public');
    this.connectSocket('market');
  }

  private pruneRemovedSymbols() {
    const selected = new Set(this.symbols);
    [
      this.marketTickers,
      this.klinesHistory,
      this.indicatorsCache,
      this.flowWindows,
      this.bookWindows,
      this.openInterestMap,
      this.liquidationsMap,
    ].forEach((map) => {
      for (const key of map.keys()) if (!selected.has(key)) map.delete(key);
    });
  }

  public destroy() {
    this.isDestroyed = true;
    this.publicWs?.close();
    this.marketWs?.close();
    Object.values(this.reconnectTimeouts).forEach((timer) => timer && clearTimeout(timer));
    this.indicatorTimers.forEach((timer) => clearTimeout(timer));
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.oiPollInterval) clearInterval(this.oiPollInterval);
  }
}

export const binanceFeed = new BinanceFeedService();
