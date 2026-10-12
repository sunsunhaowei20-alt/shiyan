export type Side = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "filled" | "cancelled";
export type Board = "main" | "chinext" | "star" | "etf";
export type Session = "open" | "lunch" | "closed";
export type Speed = 0 | 1 | 4 | 16;

export interface InstrumentSpec {
  symbol: string;
  name: string;
  sector: string;
  board: Board;
  tickSize: number;
  lotSize: number;
  prevClose: number;
  volatility: number;
  drift: number;
  spreadBps: number;
  avgMinuteVolume: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Level {
  price: number;
  size: number;
}

export interface Book {
  bids: Level[];
  asks: Level[];
}

export interface Print {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: Side;
  time: number;
  source: "market" | "user";
}

export interface Order {
  id: string;
  symbol: string;
  name: string;
  side: Side;
  type: OrderType;
  price: number;
  qty: number;
  filledQty: number;
  reservedCash: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  name: string;
  side: Side;
  price: number;
  qty: number;
  fee: number;
  time: number;
}

export interface NewsItem {
  id: string;
  time: number;
  headline: string;
  symbol?: string;
  impact: "up" | "down";
}

export interface Quote {
  symbol: string;
  name: string;
  sector: string;
  board: Board;
  tickSize: number;
  lotSize: number;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  limitUp: number;
  limitDown: number;
  change: number;
  changePct: number;
}

export interface PositionView {
  symbol: string;
  name: string;
  qty: number;
  available: number;
  avgCost: number;
  last: number;
  marketValue: number;
  unrealized: number;
  pnlPct: number;
}

export interface Snapshot {
  simTime: number;
  session: Session;
  speed: Speed;
  skipClosed: boolean;
  tPlusOne: boolean;
  cash: number;
  reservedCash: number;
  equity: number;
  dayPnl: number;
  initialCash: number;
  realized: number;
  quotes: Quote[];
  books: Record<string, Book>;
  candles: Record<string, Candle[]>;
  prints: Record<string, Print[]>;
  positions: PositionView[];
  orders: Order[];
  fills: Fill[];
  news: NewsItem[];
}

export type OrderResult =
  | { ok: true; message: string }
  | { ok: false; error: string };
