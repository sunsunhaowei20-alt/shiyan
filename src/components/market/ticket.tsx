"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyCost, maxAffordableShares, sellNet } from "@/lib/market/fees";
import { formatCny, formatPrice } from "@/lib/market/format";
import { marketStore } from "@/lib/market/store";
import type { OrderType, Side, Snapshot } from "@/lib/market/types";

interface TicketProps {
  snapshot: Snapshot;
  symbol: string;
  side: Side;
  onSide: (side: Side) => void;
}

export function Ticket({ snapshot, symbol, side, onSide }: TicketProps) {
  const quote = snapshot.quotes.find((item) => item.symbol === symbol);
  const book = snapshot.books[symbol];
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [lots, setLots] = useState("1");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const touch = quote ? (side === "buy" ? book?.asks[0]?.price : book?.bids[0]?.price) : undefined;
  const suggested = touch ?? quote?.price ?? 0;
  const priceKey = `${symbol}:${side}:${orderType}`;
  const [draft, setDraft] = useState(() => ({
    key: priceKey,
    price: quote ? formatPrice(suggested, quote.tickSize) : "",
  }));
  if (quote && draft.key !== priceKey) {
    setDraft({ key: priceKey, price: formatPrice(suggested, quote.tickSize) });
  }

  if (!quote) {
    return <section className="p-4 text-sm text-muted-foreground">选择一只证券后可以下单。</section>;
  }

  const price = draft.key === priceKey ? draft.price : formatPrice(suggested, quote.tickSize);
  const lotCount = Number(lots);
  const shares = Number.isFinite(lotCount) ? lotCount * quote.lotSize : 0;
  const limitPrice = Number(price);
  const workingPrice = orderType === "market" ? touch : limitPrice;
  const affordable = maxAffordableShares(
    snapshot.cash,
    side === "buy" ? (workingPrice && workingPrice > 0 ? workingPrice : quote.price) : quote.price,
    quote.lotSize,
  );
  const position = snapshot.positions.find((item) => item.symbol === symbol);
  const estimate =
    workingPrice && workingPrice > 0 && shares > 0
      ? side === "buy"
        ? { notional: shares * workingPrice, fee: buyCost(shares, workingPrice) - shares * workingPrice, total: buyCost(shares, workingPrice) }
        : { notional: shares * workingPrice, fee: sellNet(shares, workingPrice).fee, total: sellNet(shares, workingPrice).proceeds }
      : null;

  const submit = () => {
    if (!Number.isInteger(lotCount) || lotCount <= 0) {
      setNotice({ ok: false, text: "手数需为正整数" });
      return;
    }
    const result = marketStore.placeOrder({
      symbol,
      side,
      type: orderType,
      qty: shares,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
    });
    setNotice({ ok: result.ok, text: result.ok ? result.message : result.error });
  };

  return (
    <form
      id="ticket"
      className="space-y-3 border-b border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">下单</h2>
        <p className="font-mono text-xs text-muted-foreground">
          {snapshot.tPlusOne ? "T+1" : "T+0"} · 1 手 = 100 股
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className={side === "buy" ? "bg-rise text-white hover:bg-rise/90" : ""}
          variant={side === "buy" ? "default" : "outline"}
          onClick={() => onSide("buy")}
        >
          买入
        </Button>
        <Button
          type="button"
          className={side === "sell" ? "bg-fall text-[#062117] hover:bg-fall/90" : ""}
          variant={side === "sell" ? "default" : "outline"}
          onClick={() => onSide("sell")}
        >
          卖出
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant={orderType === "market" ? "secondary" : "ghost"} onClick={() => setOrderType("market")}>
          市价
        </Button>
        <Button type="button" size="sm" variant={orderType === "limit" ? "secondary" : "ghost"} onClick={() => setOrderType("limit")}>
          限价
        </Button>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        {orderType === "market" ? "参考价" : "限价"}
        <Input
          inputMode="decimal"
          value={orderType === "market" ? (touch ? formatPrice(touch, quote.tickSize) : "无对手盘") : price}
          disabled={orderType === "market"}
          step={quote.tickSize}
          onChange={(event) => setDraft({ key: priceKey, price: event.target.value })}
          aria-label={orderType === "market" ? "参考价" : "限价"}
        />
      </label>
      <label className="block space-y-1 text-xs text-muted-foreground">
        手数
        <Input
          inputMode="numeric"
          value={lots}
          onChange={(event) => setLots(event.target.value)}
          aria-label="手数"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {[1, 5, 10, 20].map((value) => (
          <Button key={value} type="button" size="xs" variant="outline" onClick={() => setLots(String(value))}>
            {value} 手
          </Button>
        ))}
        {side === "buy" ? (
          <Button type="button" size="xs" variant="outline" onClick={() => setLots(String(affordable / quote.lotSize))}>
            可买 {affordable / quote.lotSize} 手
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setLots(String(Math.floor((position?.available ?? 0) / quote.lotSize)))}
          >
            可卖 {Math.floor((position?.available ?? 0) / quote.lotSize)} 手
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">涨停</dt>
        <dd className="text-right font-mono text-rise">{formatPrice(quote.limitUp, quote.tickSize)}</dd>
        <dt className="text-muted-foreground">跌停</dt>
        <dd className="text-right font-mono text-fall">{formatPrice(quote.limitDown, quote.tickSize)}</dd>
        <dt className="text-muted-foreground">{side === "buy" ? "预计金额" : "预计成交"}</dt>
        <dd className="text-right font-mono">{estimate ? formatCny(estimate.notional) : "—"}</dd>
        <dt className="text-muted-foreground">费用</dt>
        <dd className="text-right font-mono">{estimate ? formatCny(estimate.fee) : "—"}</dd>
        <dt className="text-muted-foreground">{side === "buy" ? "预计冻结" : "预计到账"}</dt>
        <dd className="text-right font-mono">{estimate ? formatCny(estimate.total) : "—"}</dd>
      </dl>
      {estimate && estimate.notional > 0 && estimate.fee / estimate.notional > 0.005 ? (
        <p className="text-xs text-primary">金额较小，最低佣金 5 元占比会偏高。</p>
      ) : null}
      {notice ? (
        <p role="alert" className={notice.ok ? "text-xs text-foreground" : "text-xs text-rise"}>
          {notice.text}
        </p>
      ) : null}
      <Button
        type="submit"
        className={side === "buy" ? "w-full bg-rise text-white hover:bg-rise/90" : "w-full bg-fall text-[#062117] hover:bg-fall/90"}
      >
        {side === "buy" ? "买入" : "卖出"} {quote.name}
      </Button>
      <p className="text-[11px] leading-5 text-muted-foreground">
        佣金万 2.5，最低 5 元；卖出另计印花税 0.05%。价格是模拟的，不能下到真实交易所。
      </p>
    </form>
  );
}
