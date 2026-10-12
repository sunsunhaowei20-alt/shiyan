"use client";

import { formatLots, formatPrice, toneClass } from "@/lib/market/format";
import type { Book, Quote } from "@/lib/market/types";

interface OrderBookProps {
  quote: Quote;
  book: Book | undefined;
}

export function OrderBook({ quote, book }: OrderBookProps) {
  const asks = [...(book?.asks ?? [])].reverse();
  const bids = book?.bids ?? [];
  const maxSize = Math.max(1, ...asks.map((level) => level.size), ...bids.map((level) => level.size));

  return (
    <section className="flex h-[280px] min-h-0 flex-col border-t border-border sm:border-r lg:h-full">
      <header className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <span>盘口</span>
        <span>手</span>
      </header>
      <div className="grid flex-1 grid-rows-[1fr_auto_1fr] overflow-hidden px-2 pb-2">
        <div className="flex flex-col justify-end gap-0.5">
          {asks.length === 0 ? (
            <p className="px-2 text-xs text-rise">涨停，卖方无挂单</p>
          ) : (
            asks.map((level, index) => (
              <LevelRow
                key={`ask-${level.price}`}
                label={`卖${asks.length - index}`}
                price={formatPrice(level.price, quote.tickSize)}
                size={formatLots(level.size)}
                ratio={level.size / maxSize}
                tone="text-fall"
              />
            ))
          )}
        </div>
        <div className={`my-1 flex items-center justify-between rounded-md bg-muted/70 px-2 py-1 font-mono ${toneClass(quote.change)}`}>
          <span className="text-xs text-muted-foreground">最新</span>
          <span className="text-sm font-semibold">{formatPrice(quote.price, quote.tickSize)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {bids.length === 0 ? (
            <p className="px-2 text-xs text-fall">跌停，买方无挂单</p>
          ) : (
            bids.map((level, index) => (
              <LevelRow
                key={`bid-${level.price}`}
                label={`买${index + 1}`}
                price={formatPrice(level.price, quote.tickSize)}
                size={formatLots(level.size)}
                ratio={level.size / maxSize}
                tone="text-rise"
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function LevelRow({
  label,
  price,
  size,
  ratio,
  tone,
}: {
  label: string;
  price: string;
  size: string;
  ratio: number;
  tone: string;
}) {
  return (
    <div className="relative grid grid-cols-[2.2rem_1fr_auto] items-center gap-2 px-1 font-mono text-xs">
      <span
        className="absolute inset-y-0 right-0 rounded-sm bg-muted"
        style={{ width: `${Math.max(6, ratio * 100)}%`, opacity: 0.55 }}
      />
      <span className="relative text-muted-foreground">{label}</span>
      <span className={`relative ${tone}`}>{price}</span>
      <span className="relative text-foreground">{size}</span>
    </div>
  );
}
