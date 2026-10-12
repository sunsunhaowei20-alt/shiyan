import { INITIAL_CASH, buyCost, buyFee, sellNet } from "./fees";
import { clamp, gaussian, hashString, money, mulberry32, roundTick } from "./math";
import {
  BACKFILL_START,
  SESSION_ANCHOR,
  nextOpen,
  sameTradingDay,
  secondsUntilClose,
  sessionStatus,
  shanghaiParts,
} from "./time";
import type {
  Book,
  Candle,
  Fill,
  InstrumentSpec,
  Level,
  NewsItem,
  Order,
  OrderResult,
  OrderType,
  PositionView,
  Print,
  Quote,
  Side,
  Snapshot,
  Speed,
} from "./types";
import { HEADLINES, UNIVERSE, limitPercent } from "./universe";

const SIM_SECONDS_PER_REAL_SECOND = 20;
const TRADING_YEAR_SECONDS = 252 * 4 * 3600;
const MAX_CANDLES = 240;
const MAX_PRINTS = 40;
const MAX_NEWS = 24;
const MAX_FILLS = 80;

interface LiveInstrument extends InstrumentSpec {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  pendingShock: number;
}

interface Position {
  symbol: string;
  qty: number;
  frozen: number;
  todayBought: number;
  avgCost: number;
}

export interface EngineOptions {
  rng?: () => number;
  backfill?: boolean;
  speed?: Speed;
  skipClosed?: boolean;
  tPlusOne?: boolean;
}

interface PersistedInstrument {
  symbol: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
}

export interface PersistedState {
  version: 1;
  simTime: number;
  speed: Speed;
  skipClosed: boolean;
  tPlusOne: boolean;
  cash: number;
  initialCash: number;
  dayOpenEquity: number;
  realized: number;
  seq: number;
  instruments: PersistedInstrument[];
  candles: Record<string, Candle[]>;
  prints: Record<string, Print[]>;
  positions: Position[];
  orders: Order[];
  fills: Fill[];
  news: NewsItem[];
}

export class MarketEngine {
  private readonly rng: () => number;
  private readonly instruments: LiveInstrument[];
  private readonly candles = new Map<string, Candle[]>();
  private readonly prints = new Map<string, Print[]>();
  private readonly books = new Map<string, Book>();
  private readonly positions = new Map<string, Position>();
  private orders: Order[] = [];
  private fills: Fill[] = [];
  private news: NewsItem[] = [];
  private simTime: number;
  private speed: Speed;
  private skipClosed: boolean;
  private tPlusOne: boolean;
  private cash: number;
  private initialCash: number;
  private dayOpenEquity: number;
  private realized: number;
  private seq: number;
  private cached: Snapshot | null = null;

  constructor(options: EngineOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.speed = options.speed ?? 1;
    this.skipClosed = options.skipClosed ?? true;
    this.tPlusOne = options.tPlusOne ?? true;
    this.cash = INITIAL_CASH;
    this.initialCash = INITIAL_CASH;
    this.realized = 0;
    this.seq = 1;
    this.simTime = options.backfill === false ? SESSION_ANCHOR : BACKFILL_START;
    this.instruments = UNIVERSE.map((spec) => ({
      ...spec,
      price: spec.prevClose,
      open: spec.prevClose,
      high: spec.prevClose,
      low: spec.prevClose,
      volume: 0,
      turnover: 0,
      pendingShock: 0,
    }));
    for (const instrument of this.instruments) {
      this.candles.set(instrument.symbol, []);
      this.prints.set(instrument.symbol, []);
      this.rebuildBook(instrument);
    }
    if (options.backfill !== false) {
      this.backfillTo(SESSION_ANCHOR);
    }
    this.dayOpenEquity = this.markEquity();
  }

  static restore(data: PersistedState, rng?: () => number) {
    const engine = new MarketEngine({ backfill: false, rng, speed: data.speed });
    engine.simTime = data.simTime;
    engine.speed = data.speed;
    engine.skipClosed = data.skipClosed;
    engine.tPlusOne = data.tPlusOne;
    engine.cash = data.cash;
    engine.initialCash = data.initialCash;
    engine.dayOpenEquity = data.dayOpenEquity;
    engine.realized = data.realized;
    engine.seq = data.seq;
    engine.orders = data.orders.map((order) => ({ ...order }));
    engine.fills = data.fills.map((fill) => ({ ...fill }));
    engine.news = data.news.map((item) => ({ ...item }));
    for (const position of data.positions) {
      engine.positions.set(position.symbol, { ...position });
    }
    for (const saved of data.instruments) {
      const instrument = engine.instrument(saved.symbol);
      if (!instrument) continue;
      instrument.price = saved.price;
      instrument.prevClose = saved.prevClose;
      instrument.open = saved.open;
      instrument.high = saved.high;
      instrument.low = saved.low;
      instrument.volume = saved.volume;
      instrument.turnover = saved.turnover;
      engine.candles.set(saved.symbol, (data.candles[saved.symbol] ?? []).map((candle) => ({ ...candle })));
      engine.prints.set(saved.symbol, (data.prints[saved.symbol] ?? []).map((print) => ({ ...print })));
      engine.rebuildBook(instrument);
    }
    engine.cached = null;
    return engine;
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
    this.cached = null;
  }

  setSkipClosed(skipClosed: boolean) {
    this.skipClosed = skipClosed;
    this.cached = null;
  }

  setTPlusOne(tPlusOne: boolean) {
    this.tPlusOne = tPlusOne;
    this.cached = null;
  }

  jumpToNextOpen() {
    if (sessionStatus(this.simTime) === "open") return;
    this.advanceTo(nextOpen(this.simTime));
    this.cached = null;
  }

  debugSetTime(utcMs: number) {
    this.simTime = utcMs;
    for (const instrument of this.instruments) this.rebuildBook(instrument);
    this.cached = null;
  }

  debugSetPrice(symbol: string, price: number) {
    const instrument = this.instrument(symbol);
    if (!instrument) return;
    const band = this.band(instrument);
    instrument.price = clamp(roundTick(price, instrument.tickSize), band.down, band.up);
    instrument.high = Math.max(instrument.high, instrument.price);
    instrument.low = Math.min(instrument.low, instrument.price);
    this.rebuildBook(instrument);
    this.matchResting();
    this.cached = null;
  }

  stepRealMs(realMs: number) {
    if (this.speed === 0 || realMs <= 0) return;
    let remaining = (realMs / 1000) * this.speed * SIM_SECONDS_PER_REAL_SECOND;
    let guard = 0;
    while (remaining > 0.05 && guard < 48) {
      guard += 1;
      const status = sessionStatus(this.simTime);
      if (status !== "open") {
        if (this.skipClosed) {
          this.advanceTo(nextOpen(this.simTime));
          continue;
        }
        const idle = Math.min(remaining, 30);
        this.simTime += idle * 1000;
        remaining -= idle;
        continue;
      }
      const untilClose = secondsUntilClose(this.simTime);
      const slice = Math.min(5, remaining, Math.max(untilClose, 0));
      if (slice <= 0) {
        this.simTime += 1000;
        remaining = Math.max(0, remaining - 1);
        continue;
      }
      this.diffuse(slice);
      this.matchResting();
      this.simTime += slice * 1000;
      remaining -= slice;
    }
    this.cached = null;
  }

  placeOrder(input: {
    symbol: string;
    side: Side;
    type: OrderType;
    qty: number;
    limitPrice?: number;
  }): OrderResult {
    const instrument = this.instrument(input.symbol);
    if (!instrument) return { ok: false, error: "找不到这只证券" };
    if (sessionStatus(this.simTime) !== "open") {
      return { ok: false, error: "当前不是连续竞价时段" };
    }
    if (!Number.isFinite(input.qty) || input.qty <= 0 || input.qty % instrument.lotSize !== 0) {
      return { ok: false, error: `数量需为 ${instrument.lotSize} 股的整数倍` };
    }

    const book = this.books.get(instrument.symbol) ?? { bids: [], asks: [] };
    const band = this.band(instrument);
    let limitPrice = input.limitPrice;
    if (input.type === "limit") {
      if (limitPrice === undefined || !Number.isFinite(limitPrice)) {
        return { ok: false, error: "请填写限价" };
      }
      limitPrice = roundTick(limitPrice, instrument.tickSize);
      if (limitPrice < band.down || limitPrice > band.up) {
        return { ok: false, error: "限价超出涨跌停范围" };
      }
    }

    if (input.side === "buy") {
      const ask = book.asks[0];
      if (input.type === "market" && !ask) {
        return { ok: false, error: "涨停封板，没有卖盘可成交" };
      }
      const reservePrice = input.type === "market" ? ask!.price : limitPrice!;
      const reserve = money(buyCost(input.qty, reservePrice));
      if (this.cash + 0.001 < reserve) {
        return { ok: false, error: "可用资金不足" };
      }
      const order = this.createOrder(instrument, input.side, input.type, reservePrice, input.qty);
      this.cash = money(this.cash - reserve);
      order.reservedCash = reserve;
      const canFillNow =
        input.type === "market" || (ask !== undefined && limitPrice! >= ask.price);
      if (canFillNow && ask) {
        this.fillBuy(order, ask.price);
        this.cached = null;
        return {
          ok: true,
          message: `买入成交 ${input.qty / instrument.lotSize} 手 @ ${this.formatPx(ask.price, instrument.tickSize)}`,
        };
      }
      if (canFillNow && !ask) {
        this.refund(order);
        this.cached = null;
        return { ok: false, error: "涨停封板，没有卖盘可成交" };
      }
      this.orders.unshift(order);
      this.cached = null;
      return { ok: true, message: `限价买入已申报，冻结 ${reserve.toFixed(2)} 元` };
    }

    const available = this.availableQty(input.symbol);
    if (available < input.qty) {
      if (this.tPlusOne && this.position(input.symbol).todayBought > 0 && available <= 0) {
        return { ok: false, error: "T+1：今日买入的股份下一交易日才能卖出" };
      }
      return { ok: false, error: "可卖数量不足" };
    }
    const bid = book.bids[0];
    if (input.type === "market" && !bid) {
      return { ok: false, error: "跌停封板，没有买盘可成交" };
    }
    const orderPrice = input.type === "market" ? bid!.price : limitPrice!;
    const position = this.position(input.symbol);
    position.frozen += input.qty;
    const order = this.createOrder(instrument, "sell", input.type, orderPrice, input.qty);
    const canFillNow = input.type === "market" || (bid !== undefined && limitPrice! <= bid.price);
    if (canFillNow && bid) {
      this.fillSell(order, bid.price);
      this.cached = null;
      return {
        ok: true,
        message: `卖出成交 ${input.qty / instrument.lotSize} 手 @ ${this.formatPx(bid.price, instrument.tickSize)}`,
      };
    }
    if (canFillNow && !bid) {
      position.frozen -= input.qty;
      this.cached = null;
      return { ok: false, error: "跌停封板，没有买盘可成交" };
    }
    this.orders.unshift(order);
    this.cached = null;
    return { ok: true, message: "限价卖出已申报" };
  }

  cancelOrder(orderId: string): OrderResult {
    const order = this.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "open") return { ok: false, error: "委托已不在队列中" };
    if (order.side === "buy") this.refund(order);
    else {
      const position = this.positions.get(order.symbol);
      if (position) position.frozen = Math.max(0, position.frozen - (order.qty - order.filledQty));
    }
    order.status = "cancelled";
    order.updatedAt = this.simTime;
    this.cached = null;
    return { ok: true, message: "已撤单" };
  }

  serialize(): PersistedState {
    return {
      version: 1,
      simTime: this.simTime,
      speed: this.speed,
      skipClosed: this.skipClosed,
      tPlusOne: this.tPlusOne,
      cash: this.cash,
      initialCash: this.initialCash,
      dayOpenEquity: this.dayOpenEquity,
      realized: this.realized,
      seq: this.seq,
      instruments: this.instruments.map((instrument) => ({
        symbol: instrument.symbol,
        price: instrument.price,
        prevClose: instrument.prevClose,
        open: instrument.open,
        high: instrument.high,
        low: instrument.low,
        volume: instrument.volume,
        turnover: instrument.turnover,
      })),
      candles: Object.fromEntries(this.candles),
      prints: Object.fromEntries(this.prints),
      positions: [...this.positions.values()].map((position) => ({ ...position })),
      orders: this.orders.map((order) => ({ ...order })),
      fills: this.fills.map((fill) => ({ ...fill })),
      news: this.news.map((item) => ({ ...item })),
    };
  }

  getState(): Snapshot {
    if (this.cached) return this.cached;
    const quotes = this.instruments.map((instrument) => this.toQuote(instrument));
    const books: Record<string, Book> = {};
    const candles: Record<string, Candle[]> = {};
    const prints: Record<string, Print[]> = {};
    for (const instrument of this.instruments) {
      const book = this.books.get(instrument.symbol) ?? { bids: [], asks: [] };
      books[instrument.symbol] = {
        bids: book.bids.map((level) => ({ ...level })),
        asks: book.asks.map((level) => ({ ...level })),
      };
      candles[instrument.symbol] = (this.candles.get(instrument.symbol) ?? []).map((candle) => ({ ...candle }));
      prints[instrument.symbol] = (this.prints.get(instrument.symbol) ?? []).map((print) => ({ ...print }));
    }
    const positions: PositionView[] = [];
    for (const position of this.positions.values()) {
      if (position.qty <= 0) continue;
      const instrument = this.instrument(position.symbol);
      if (!instrument) continue;
      const marketValue = position.qty * instrument.price;
      const cost = position.avgCost * position.qty;
      positions.push({
        symbol: position.symbol,
        name: instrument.name,
        qty: position.qty,
        available: this.availableQty(position.symbol),
        avgCost: position.avgCost,
        last: instrument.price,
        marketValue,
        unrealized: marketValue - cost,
        pnlPct: cost === 0 ? 0 : (marketValue - cost) / cost,
      });
    }
    const reservedCash = this.reservedCash();
    const equity = this.markEquity();
    this.cached = {
      simTime: this.simTime,
      session: sessionStatus(this.simTime),
      speed: this.speed,
      skipClosed: this.skipClosed,
      tPlusOne: this.tPlusOne,
      cash: this.cash,
      reservedCash,
      equity,
      dayPnl: equity - this.dayOpenEquity,
      initialCash: this.initialCash,
      realized: this.realized,
      quotes,
      books,
      candles,
      prints,
      positions,
      orders: this.orders.map((order) => ({ ...order })),
      fills: this.fills.map((fill) => ({ ...fill })),
      news: this.news.map((item) => ({ ...item })),
    };
    return this.cached;
  }

  private backfillTo(target: number) {
    let guard = 0;
    while (this.simTime < target && guard < 4000) {
      guard += 1;
      const slice = Math.min(5, (target - this.simTime) / 1000);
      if (sessionStatus(this.simTime) === "open") {
        this.diffuse(slice);
        this.matchResting();
      }
      this.simTime += slice * 1000;
    }
    this.cached = null;
  }

  private advanceTo(next: number) {
    const previousTime = this.simTime;
    const dayChanged = !sameTradingDay(previousTime, next);
    if (dayChanged) {
      for (const instrument of this.instruments) {
        instrument.prevClose = instrument.price;
        const overnightYears = 18 / (252 * 24);
        const gap =
          instrument.drift * overnightYears + instrument.volatility * 0.12 * gaussian(this.rng);
        const band = this.band(instrument);
        const opened = clamp(roundTick(instrument.price * Math.exp(gap), instrument.tickSize), band.down, band.up);
        instrument.price = opened;
        instrument.open = opened;
        instrument.high = opened;
        instrument.low = opened;
        instrument.volume = 0;
        instrument.turnover = 0;
        instrument.pendingShock = 0;
        this.candles.set(instrument.symbol, []);
        this.rebuildBook(instrument);
      }
      for (const position of this.positions.values()) position.todayBought = 0;
      this.pushNews("新交易日开盘，隔夜缺口已计入模拟价格", undefined, "up");
      this.simTime = next;
      this.dayOpenEquity = this.markEquity();
      return;
    }
    this.simTime = next;
    this.pushNews("午间休市结束，连续竞价恢复", undefined, "up");
    for (const instrument of this.instruments) this.rebuildBook(instrument);
  }

  private diffuse(dtSec: number) {
    const dtYears = dtSec / TRADING_YEAR_SECONDS;
    const marketShock = gaussian(this.rng);
    const sectorShock = new Map<string, number>();
    for (const instrument of this.instruments) {
      if (!sectorShock.has(instrument.sector)) sectorShock.set(instrument.sector, gaussian(this.rng));
    }
    if (this.rng() < 1 - Math.exp(-dtSec / (8 * 60))) this.emitHeadline();
    const volBoost = this.volBoost();

    for (const instrument of this.instruments) {
      const band = this.band(instrument);
      const sigma = instrument.volatility * volBoost * Math.sqrt(dtYears);
      const idiosyncratic = gaussian(this.rng);
      const factor =
        0.62 * idiosyncratic + 0.28 * marketShock + 0.22 * (sectorShock.get(instrument.sector) ?? 0);
      let ret = (instrument.drift - 0.5 * instrument.volatility ** 2) * dtYears + sigma * factor;
      ret += instrument.pendingShock;
      instrument.pendingShock = 0;
      const previous = instrument.price;
      const next = clamp(roundTick(previous * Math.exp(ret), instrument.tickSize), band.down, band.up);
      if (instrument.volume === 0) {
        instrument.open = next;
        instrument.high = next;
        instrument.low = next;
      }
      instrument.price = next;
      instrument.high = Math.max(instrument.high, next);
      instrument.low = Math.min(instrument.low, next);
      const excitement = 1 + Math.min(4, Math.abs(Math.log(next / previous) || 0) * 80);
      const shares = Math.max(
        0,
        Math.round(instrument.avgMinuteVolume * (dtSec / 60) * (0.35 + this.rng()) * excitement),
      );
      instrument.volume += shares;
      instrument.turnover += shares * next;
      this.bumpCandle(instrument, next, shares);
      this.rebuildBook(instrument);
      if (shares > 0 && this.rng() < 0.9) this.addMarketPrint(instrument, shares);
    }
  }

  private matchResting() {
    for (const order of this.orders) {
      if (order.status !== "open") continue;
      const instrument = this.instrument(order.symbol);
      const book = this.books.get(order.symbol);
      if (!instrument || !book) continue;
      if (order.side === "buy") {
        const ask = book.asks[0];
        if (!ask || ask.price > order.price) continue;
        this.fillBuy(order, ask.price);
      } else {
        const bid = book.bids[0];
        if (!bid || bid.price < order.price) continue;
        this.fillSell(order, bid.price);
      }
    }
  }

  private emitHeadline() {
    const headline = HEADLINES[Math.floor(this.rng() * HEADLINES.length)];
    if (!headline) return;
    const magnitude = headline.shock * (0.85 + this.rng() * 0.3);
    for (const instrument of this.instruments) {
      if (headline.symbol && instrument.symbol === headline.symbol) instrument.pendingShock += magnitude;
      else if (headline.sector && instrument.sector === headline.sector) instrument.pendingShock += magnitude * 0.6;
    }
    this.pushNews(headline.text, headline.symbol, magnitude >= 0 ? "up" : "down");
  }

  private pushNews(headline: string, symbol: string | undefined, impact: "up" | "down") {
    this.news.unshift({
      id: this.nextId("news"),
      time: this.simTime,
      headline,
      symbol,
      impact,
    });
    if (this.news.length > MAX_NEWS) this.news.length = MAX_NEWS;
  }

  private fillBuy(order: Order, price: number) {
    const instrument = this.instrument(order.symbol);
    if (!instrument) return;
    const qty = order.qty - order.filledQty;
    const notional = price * qty;
    const fee = buyFee(notional);
    const cost = money(notional + fee);
    const refund = money(order.reservedCash - cost);
    this.cash = money(this.cash + refund);
    order.reservedCash = 0;
    const position = this.position(order.symbol);
    const costBasis = notional + fee;
    const nextQty = position.qty + qty;
    position.avgCost = nextQty === 0 ? 0 : (position.avgCost * position.qty + costBasis) / nextQty;
    position.qty = nextQty;
    position.todayBought += qty;
    order.filledQty = order.qty;
    order.status = "filled";
    order.updatedAt = this.simTime;
    order.price = price;
    this.recordFill(order, price, qty, fee);
  }

  private fillSell(order: Order, price: number) {
    const position = this.positions.get(order.symbol);
    const instrument = this.instrument(order.symbol);
    if (!position || !instrument) return;
    const qty = order.qty - order.filledQty;
    const { fee, proceeds } = sellNet(qty, price);
    this.cash = money(this.cash + proceeds);
    this.realized = money(this.realized + (proceeds - position.avgCost * qty));
    position.qty -= qty;
    position.frozen = Math.max(0, position.frozen - qty);
    if (position.qty <= 0) {
      position.qty = 0;
      position.avgCost = 0;
      position.frozen = 0;
      position.todayBought = 0;
    }
    order.filledQty = order.qty;
    order.status = "filled";
    order.updatedAt = this.simTime;
    order.price = price;
    this.recordFill(order, price, qty, fee);
  }

  private recordFill(order: Order, price: number, qty: number, fee: number) {
    this.fills.unshift({
      id: this.nextId("fill"),
      orderId: order.id,
      symbol: order.symbol,
      name: order.name,
      side: order.side,
      price,
      qty,
      fee,
      time: this.simTime,
    });
    if (this.fills.length > MAX_FILLS) this.fills.length = MAX_FILLS;
    this.addPrint({
      symbol: order.symbol,
      price,
      size: qty,
      side: order.side,
      source: "user",
    });
    if (!this.orders.includes(order)) this.orders.unshift(order);
    if (this.orders.length > 80) {
      const open = this.orders.filter((item) => item.status === "open");
      const recent = this.orders.filter((item) => item.status !== "open").slice(0, 40);
      this.orders = [...open, ...recent];
    }
  }

  private refund(order: Order) {
    this.cash = money(this.cash + order.reservedCash);
    order.reservedCash = 0;
  }

  private createOrder(
    instrument: LiveInstrument,
    side: Side,
    type: OrderType,
    price: number,
    qty: number,
  ): Order {
    return {
      id: this.nextId("ord"),
      symbol: instrument.symbol,
      name: instrument.name,
      side,
      type,
      price,
      qty,
      filledQty: 0,
      reservedCash: 0,
      status: "open",
      createdAt: this.simTime,
      updatedAt: this.simTime,
    };
  }

  private bumpCandle(instrument: LiveInstrument, price: number, volume: number) {
    const bucket = this.minuteBucket(this.simTime);
    const series = this.candles.get(instrument.symbol);
    if (!series) return;
    const last = series[series.length - 1];
    if (!last || last.time !== bucket) {
      series.push({ time: bucket, open: price, high: price, low: price, close: price, volume });
      if (series.length > MAX_CANDLES) series.shift();
      return;
    }
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
    last.volume += volume;
  }

  private minuteBucket(utcMs: number) {
    return Math.floor(utcMs / 60000) * 60000;
  }

  private addMarketPrint(instrument: LiveInstrument, volume: number) {
    const book = this.books.get(instrument.symbol);
    const side: Side = this.rng() > 0.5 ? "buy" : "sell";
    const level = side === "buy" ? book?.asks[0] : book?.bids[0];
    const price = level?.price ?? instrument.price;
    const size = Math.max(instrument.lotSize, Math.round((volume * (0.08 + this.rng() * 0.2)) / instrument.lotSize) * instrument.lotSize);
    this.addPrint({ symbol: instrument.symbol, price, size, side, source: "market" });
  }

  private addPrint(print: Omit<Print, "id" | "time">) {
    const list = this.prints.get(print.symbol);
    if (!list) return;
    list.unshift({ ...print, id: this.nextId("px"), time: this.simTime });
    if (list.length > MAX_PRINTS) list.length = MAX_PRINTS;
  }

  private rebuildBook(instrument: LiveInstrument) {
    const band = this.band(instrument);
    const tick = instrument.tickSize;
    const atUp = instrument.price >= band.up - tick / 2;
    const atDown = instrument.price <= band.down + tick / 2;
    const spreadTicks = Math.max(1, Math.round((instrument.price * instrument.spreadBps) / 10000 / tick));
    const rng = mulberry32(hashString(instrument.symbol) ^ Math.floor(this.simTime / 15000));
    const levels = (start: number, direction: -1 | 1) => {
      const result: Level[] = [];
      for (let index = 0; index < 5; index += 1) {
        const price = roundTick(start + direction * index * tick, tick);
        if (price < band.down || price > band.up) continue;
        if (direction < 0 && price >= instrument.price) continue;
        if (direction > 0 && price <= instrument.price) continue;
        const lots = Math.max(1, Math.round((6 + rng() * 36) * (1 + index * 0.45)));
        result.push({ price, size: lots * instrument.lotSize });
      }
      return result;
    };

    const bidStart = roundTick(instrument.price - spreadTicks * tick, tick);
    const askStart = roundTick(instrument.price + spreadTicks * tick, tick);
    const bids = atDown ? [] : levels(Math.min(bidStart, roundTick(instrument.price - tick, tick)), -1);
    const asks = atUp ? [] : levels(Math.max(askStart, roundTick(instrument.price + tick, tick)), 1);
    if (!atDown && bids.length === 0) {
      const price = roundTick(instrument.price - tick, tick);
      if (price >= band.down) bids.push({ price, size: instrument.lotSize * 8 });
    }
    if (!atUp && asks.length === 0) {
      const price = roundTick(instrument.price + tick, tick);
      if (price <= band.up) asks.push({ price, size: instrument.lotSize * 8 });
    }
    this.books.set(instrument.symbol, { bids, asks });
  }

  private volBoost() {
    if (sessionStatus(this.simTime) !== "open") return 1;
    const parts = shanghaiParts(this.simTime);
    const seconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
    const fromMorning = Math.abs(seconds - (9 * 3600 + 30 * 60));
    const fromAfternoon = Math.abs(seconds - 13 * 3600);
    if (Math.min(fromMorning, fromAfternoon) < 15 * 60 || secondsUntilClose(this.simTime) < 15 * 60) {
      return 1.7;
    }
    return 1;
  }

  private band(instrument: LiveInstrument) {
    const pct = limitPercent(instrument.board);
    return {
      up: roundTick(instrument.prevClose * (1 + pct), instrument.tickSize),
      down: roundTick(instrument.prevClose * (1 - pct), instrument.tickSize),
    };
  }

  private toQuote(instrument: LiveInstrument): Quote {
    const band = this.band(instrument);
    const change = instrument.price - instrument.prevClose;
    return {
      symbol: instrument.symbol,
      name: instrument.name,
      sector: instrument.sector,
      board: instrument.board,
      tickSize: instrument.tickSize,
      lotSize: instrument.lotSize,
      price: instrument.price,
      prevClose: instrument.prevClose,
      open: instrument.open,
      high: instrument.high,
      low: instrument.low,
      volume: instrument.volume,
      turnover: instrument.turnover,
      limitUp: band.up,
      limitDown: band.down,
      change,
      changePct: instrument.prevClose === 0 ? 0 : change / instrument.prevClose,
    };
  }

  private availableQty(symbol: string) {
    const position = this.positions.get(symbol);
    if (!position) return 0;
    const lockedToday = this.tPlusOne ? position.todayBought : 0;
    return Math.max(0, position.qty - position.frozen - lockedToday);
  }

  private position(symbol: string) {
    const existing = this.positions.get(symbol);
    if (existing) return existing;
    const created: Position = { symbol, qty: 0, frozen: 0, todayBought: 0, avgCost: 0 };
    this.positions.set(symbol, created);
    return created;
  }

  private reservedCash() {
    return this.orders.reduce((sum, order) => (order.status === "open" ? sum + order.reservedCash : sum), 0);
  }

  private markEquity() {
    let marketValue = 0;
    for (const position of this.positions.values()) {
      const instrument = this.instrument(position.symbol);
      if (!instrument) continue;
      marketValue += position.qty * instrument.price;
    }
    return money(this.cash + this.reservedCash() + marketValue);
  }

  private instrument(symbol: string) {
    return this.instruments.find((item) => item.symbol === symbol);
  }

  private formatPx(price: number, tick: number) {
    return price.toFixed(tick < 0.01 ? 3 : 2);
  }

  private nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq.toString(36)}`;
  }
}
