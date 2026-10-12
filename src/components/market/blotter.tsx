"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCny, formatLots, formatPrice, toneClass } from "@/lib/market/format";
import { formatSimTime } from "@/lib/market/time";
import { marketStore } from "@/lib/market/store";
import type { Snapshot } from "@/lib/market/types";

interface BlotterProps {
  snapshot: Snapshot;
  onSelect: (symbol: string) => void;
}

export function Blotter({ snapshot, onSelect }: BlotterProps) {
  const marketValue = snapshot.positions.reduce((sum, position) => sum + position.marketValue, 0);
  const unrealized = snapshot.positions.reduce((sum, position) => sum + position.unrealized, 0);

  return (
    <section className="flex min-h-[280px] flex-1 flex-col p-3">
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <Metric label="持仓市值" value={formatCny(marketValue)} />
        <Metric label="浮动盈亏" value={formatCny(unrealized)} tone={toneClass(unrealized)} />
        <Metric label="已实现" value={formatCny(snapshot.realized)} tone={toneClass(snapshot.realized)} />
      </div>
      <Tabs defaultValue="positions" className="min-h-0 flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="positions">持仓</TabsTrigger>
          <TabsTrigger value="orders">委托</TabsTrigger>
          <TabsTrigger value="fills">成交</TabsTrigger>
        </TabsList>
        <TabsContent value="positions" className="mt-2 min-h-0 overflow-auto">
          {snapshot.positions.length === 0 ? (
            <Empty text="还没有持仓。买入成交后，成本、可卖数量和浮动盈亏会显示在这里。" />
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-normal">证券</th>
                  <th className="py-1 text-right font-normal">持仓/可卖</th>
                  <th className="py-1 text-right font-normal">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.positions.map((position) => (
                  <tr key={position.symbol} className="border-t border-border/70">
                    <td className="py-2">
                      <button type="button" className="text-left" onClick={() => onSelect(position.symbol)}>
                        <span className="block font-medium">{position.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{position.symbol}</span>
                      </button>
                    </td>
                    <td className="py-2 text-right font-mono">
                      {formatLots(position.qty)}
                      <span className="block text-[11px] text-muted-foreground">{formatLots(position.available)} 可卖</span>
                    </td>
                    <td className={`py-2 text-right font-mono ${toneClass(position.unrealized)}`}>
                      {formatCny(position.unrealized)}
                      <span className="block text-[11px]">{(position.pnlPct * 100).toFixed(2)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
        <TabsContent value="orders" className="mt-2 overflow-auto">
          {snapshot.orders.length === 0 ? (
            <Empty text="没有委托。限价单没有立刻碰到对手价时，会留在这里等成交。" />
          ) : (
            <ul className="space-y-2">
              {snapshot.orders.slice(0, 12).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-2 border-t border-border/70 py-2 text-xs">
                  <button type="button" className="text-left" onClick={() => onSelect(order.symbol)}>
                    <span className={order.side === "buy" ? "text-rise" : "text-fall"}>
                      {order.side === "buy" ? "买入" : "卖出"}
                    </span>{" "}
                    {order.name}
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {order.type === "market" ? "市价" : formatPrice(order.price, 0.01)} · {formatLots(order.qty)} 手 · {statusLabel(order.status)}
                    </span>
                  </button>
                  {order.status === "open" ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => marketStore.cancelOrder(order.id)}>
                      撤单
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="fills" className="mt-2 overflow-auto">
          {snapshot.fills.length === 0 ? (
            <Empty text="还没有你的成交。市场上的逐笔在中间栏，这里只记你自己的单子。" />
          ) : (
            <ul className="space-y-2">
              {snapshot.fills.slice(0, 12).map((fill) => (
                <li key={fill.id} className="border-t border-border/70 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className={fill.side === "buy" ? "text-rise" : "text-fall"}>
                        {fill.side === "buy" ? "买入" : "卖出"}
                      </span>{" "}
                      {fill.name}
                    </span>
                    <span className="font-mono">{formatLots(fill.qty)} 手</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatSimTime(fill.time).clock} · {fill.price.toFixed(3)} · 费用 {formatCny(fill.fee)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-6 text-xs leading-5 text-muted-foreground">{text}</p>;
}

function statusLabel(status: string) {
  if (status === "open") return "已报";
  if (status === "filled") return "已成";
  return "已撤";
}
