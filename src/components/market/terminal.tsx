"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Blotter } from "@/components/market/blotter";
import { OrderBook } from "@/components/market/order-book";
import { PriceChart } from "@/components/market/price-chart";
import { RulesDialog } from "@/components/market/rules-dialog";
import { Tape } from "@/components/market/tape";
import { Ticket } from "@/components/market/ticket";
import { boardLabel } from "@/lib/market/universe";
import { formatClock, formatCny, formatPct, formatPrice, toneClass } from "@/lib/market/format";
import { marketStore } from "@/lib/market/store";
import type { NewsItem, Quote, Session, Side, Speed } from "@/lib/market/types";

function subscribe(onChange: () => void) {
  marketStore.boot();
  const unsubscribe = marketStore.subscribe(onChange);
  return () => {
    unsubscribe();
    marketStore.halt();
  };
}

export function Terminal() {
  const snapshot = useSyncExternalStore(subscribe, marketStore.getSnapshot, marketStore.getServerSnapshot);
  const [selected, setSelected] = useState("600519");
  const [side, setSide] = useState<Side>("buy");
  const quote = snapshot.quotes.find((item) => item.symbol === selected) ?? snapshot.quotes[0];

  if (!quote) return <TerminalSkeleton />;

  const up = snapshot.quotes.filter((item) => item.change > 0).length;
  const down = snapshot.quotes.filter((item) => item.change < 0).length;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            市
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">市演</p>
            <p className="mt-1 text-[10px] tracking-[0.18em] text-muted-foreground">PAPER EXCHANGE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`size-1.5 rounded-full ${snapshot.session === "open" && snapshot.speed > 0 ? "bg-rise motion-safe:animate-pulse" : "bg-muted-foreground"}`}
          />
          <span>{sessionLabel(snapshot.session)}</span>
          <span className="font-mono text-muted-foreground">{formatClock(snapshot.simTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          {([0, 1, 4, 16] as Speed[]).map((speed) => (
            <Button
              key={speed}
              type="button"
              size="xs"
              variant={snapshot.speed === speed ? "secondary" : "ghost"}
              onClick={() => marketStore.setSpeed(speed)}
            >
              {speed === 0 ? "暂停" : `${speed}x`}
            </Button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-rise">{up} 涨</span>
          <span className="mx-1.5 text-fall">{down} 跌</span>
          <span>{snapshot.quotes.length - up - down} 平</span>
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <AccountStat label="总资产" value={formatCny(snapshot.equity)} />
          <AccountStat label="当日盈亏" value={formatCny(snapshot.dayPnl)} tone={toneClass(snapshot.dayPnl)} />
          <AccountStat label="可用" value={formatCny(snapshot.cash)} />
          {snapshot.session !== "open" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => marketStore.jumpToNextOpen()}>
              下一交易日
            </Button>
          ) : null}
          <RulesDialog snapshot={snapshot} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 pb-24 lg:grid-cols-[272px_minmax(0,1fr)_332px] lg:pb-0">
        <aside className="flex max-h-[380px] flex-col border-b border-border lg:max-h-none lg:min-h-0 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
            <span>行情</span>
            <span>涨跌幅</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {snapshot.quotes.map((item) => (
              <QuoteRow
                key={item.symbol}
                quote={item}
                selected={item.symbol === quote.symbol}
                onSelect={setSelected}
              />
            ))}
          </div>
          <NewsList items={snapshot.news} className="hidden max-h-52 overflow-y-auto border-t border-border lg:block" />
        </aside>

        <section className="flex min-h-0 flex-col lg:overflow-hidden">
          <NewsList items={snapshot.news.slice(0, 2)} className="border-b border-border lg:hidden" />
          <PriceChart quote={quote} candles={snapshot.candles[quote.symbol] ?? []} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:h-[250px] lg:min-h-[250px]">
            <OrderBook quote={quote} book={snapshot.books[quote.symbol]} />
            <Tape quote={quote} prints={snapshot.prints[quote.symbol] ?? []} />
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l lg:overflow-y-auto">
          <Ticket snapshot={snapshot} symbol={quote.symbol} side={side} onSide={setSide} />
          <Blotter snapshot={snapshot} onSelect={setSelected} />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 grid grid-cols-2 gap-2 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <Button
          type="button"
          className="bg-rise text-white hover:bg-rise/90"
          onClick={() => {
            setSide("buy");
            document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          买入 {quote.name}
        </Button>
        <Button
          type="button"
          className="bg-fall text-[#062117] hover:bg-fall/90"
          onClick={() => {
            setSide("sell");
            document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          卖出 {quote.name}
        </Button>
      </div>
    </div>
  );
}

function QuoteRow({
  quote,
  selected,
  onSelect,
}: {
  quote: Quote;
  selected: boolean;
  onSelect: (symbol: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(quote.symbol)}
      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 border-l-2 px-3 py-2 text-left ${selected ? "border-primary bg-accent/80" : "border-transparent hover:bg-muted/70"}`}
    >
      <span>
        <span className="block text-sm font-medium">{quote.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {quote.symbol} · {boardLabel(quote.board)}
        </span>
      </span>
      <span className="text-right">
        <span className={`block font-mono text-sm ${toneClass(quote.change)}`}>
          {formatPrice(quote.price, quote.tickSize)}
        </span>
        <span className={`font-mono text-[11px] ${toneClass(quote.change)}`}>{formatPct(quote.changePct)}</span>
      </span>
    </button>
  );
}

function NewsList({ items, className }: { items: NewsItem[]; className?: string }) {
  return (
    <div className={className}>
      <p className="px-3 pt-2 text-xs text-muted-foreground">快讯</p>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">开盘后，行业消息会偶尔冲击价格。</p>
      ) : (
        <ul>
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="px-3 py-2 text-xs leading-5 break-words">
              <span className={`font-mono ${item.impact === "up" ? "text-rise" : "text-fall"}`}>
                {formatClock(item.time).slice(11)}
              </span>{" "}
              {item.headline}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function sessionLabel(session: Session) {
  if (session === "open") return "连续竞价";
  if (session === "lunch") return "午间休市";
  return "已收盘";
}

function TerminalSkeleton() {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          市
        </span>
        <div>
          <p className="text-sm font-semibold">市演</p>
          <p className="mt-1 text-xs text-muted-foreground">正在回放 9:30 以来的模拟走势</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-[272px_1fr_332px]">
        <div className="h-80 animate-pulse rounded-xl bg-card" />
        <div className="h-80 animate-pulse rounded-xl bg-card" />
        <div className="h-80 animate-pulse rounded-xl bg-card" />
      </div>
    </div>
  );
}
