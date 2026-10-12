"use client";

import { formatLots, formatPrice, toneClass } from "@/lib/market/format";
import { formatSimTime } from "@/lib/market/time";
import type { Print, Quote } from "@/lib/market/types";

interface TapeProps {
  quote: Quote;
  prints: Print[];
}

export function Tape({ quote, prints }: TapeProps) {
  return (
    <section className="flex h-[280px] min-h-0 flex-col border-t border-border lg:h-full">
      <header className="px-3 py-2 text-xs text-muted-foreground">逐笔</header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {prints.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">还没有成交回报</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-1 py-1 text-left font-normal">时间</th>
                <th className="px-1 py-1 text-right font-normal">价格</th>
                <th className="px-1 py-1 text-right font-normal">手数</th>
              </tr>
            </thead>
            <tbody>
              {prints.slice(0, 18).map((print) => (
                <tr key={print.id} className="font-mono">
                  <td className="px-1 py-0.5 text-muted-foreground">
                    {formatSimTime(print.time).clock.slice(0, 8)}
                    {print.source === "user" ? <span className="ml-1 text-primary">我</span> : null}
                  </td>
                  <td className={`px-1 py-0.5 text-right ${toneClass(print.side === "buy" ? 1 : -1)}`}>
                    {formatPrice(print.price, quote.tickSize)}
                  </td>
                  <td className="px-1 py-0.5 text-right">{formatLots(print.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
