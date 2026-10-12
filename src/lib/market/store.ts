"use client";

import { MarketEngine, type PersistedState } from "./engine";
import type { OrderResult, OrderType, Side, Snapshot, Speed } from "./types";

const STORAGE_KEY = "shiyan.v1";
const SERVER_SNAPSHOT = emptySnapshot();

function emptySnapshot(): Snapshot {
  return {
    simTime: 0,
    session: "closed",
    speed: 1,
    skipClosed: true,
    tPlusOne: true,
    cash: 0,
    reservedCash: 0,
    equity: 0,
    dayPnl: 0,
    initialCash: 0,
    realized: 0,
    quotes: [],
    books: {},
    candles: {},
    prints: {},
    positions: [],
    orders: [],
    fills: [],
    news: [],
  };
}

function readStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (data.version !== 1) return null;
    if (!Array.isArray(data.instruments) || !Array.isArray(data.orders)) return null;
    if (!data.candles || !data.prints) return null;
    return data;
  } catch {
    return null;
  }
}

class MarketStore {
  private engine: MarketEngine | null = null;
  private snapshot: Snapshot = emptySnapshot();
  private readonly listeners = new Set<() => void>();
  private timer: number | null = null;
  private saveTimer: number | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  getServerSnapshot = () => SERVER_SNAPSHOT;

  boot() {
    if (typeof window === "undefined") return;
    if (!this.engine) {
      const saved = readStorage();
      try {
        this.engine = saved ? MarketEngine.restore(saved) : new MarketEngine();
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        this.engine = new MarketEngine();
      }
      this.snapshot = this.engine.getState();
    }
    if (this.timer != null) return;
    this.timer = window.setInterval(() => {
      this.engine?.stepRealMs(250);
      this.publish();
      this.scheduleSave();
    }, 250);
  }

  halt() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.persist();
  }

  setSpeed(speed: Speed) {
    this.engine?.setSpeed(speed);
    this.publish();
    this.scheduleSave();
  }

  setSkipClosed(skipClosed: boolean) {
    this.engine?.setSkipClosed(skipClosed);
    this.publish();
    this.scheduleSave();
  }

  setTPlusOne(tPlusOne: boolean) {
    this.engine?.setTPlusOne(tPlusOne);
    this.publish();
    this.scheduleSave();
  }

  jumpToNextOpen() {
    this.engine?.jumpToNextOpen();
    this.publish();
    this.scheduleSave();
  }

  placeOrder(input: {
    symbol: string;
    side: Side;
    type: OrderType;
    qty: number;
    limitPrice?: number;
  }): OrderResult {
    if (!this.engine) return { ok: false, error: "行情还没准备好" };
    const result = this.engine.placeOrder(input);
    this.publish();
    this.scheduleSave();
    return result;
  }

  cancelOrder(orderId: string): OrderResult {
    if (!this.engine) return { ok: false, error: "行情还没准备好" };
    const result = this.engine.cancelOrder(orderId);
    this.publish();
    this.scheduleSave();
    return result;
  }

  reset() {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    this.engine = new MarketEngine();
    this.publish();
  }

  private publish() {
    if (!this.engine) return;
    this.snapshot = this.engine.getState();
    for (const listener of this.listeners) listener();
  }

  private scheduleSave() {
    if (typeof window === "undefined") return;
    if (this.saveTimer != null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), 800);
  }

  private persist() {
    if (typeof window === "undefined" || !this.engine) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.engine.serialize()));
    } catch {
      // Ignore quota and private-mode failures. The session still runs in memory.
    }
  }
}

export const marketStore = new MarketStore();
