"use client";

import { useEffect, useRef, useState } from "react";
import { formatMinute, formatPrice, toneClass } from "@/lib/market/format";
import type { Candle, Quote } from "@/lib/market/types";

const RISE = "#ff5a5f";
const FALL = "#1fbf75";
const MUTED = "#8e9c94";
const GRID = "rgba(215, 176, 114, 0.14)";
const BRASS = "#d7b072";

interface PriceChartProps {
  quote: Quote;
  candles: Candle[];
}

export function PriceChart({ quote, candles }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null ? candles[hover] : candles[candles.length - 1];

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width <= 0 || height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (candles.length === 0) return;

      const pad = { left: 8, right: 64, top: 12, bottom: 22 };
      const volumeHeight = Math.max(36, height * 0.22);
      const priceBottom = height - pad.bottom - volumeHeight;
      const plotWidth = width - pad.left - pad.right;
      const slot = plotWidth / candles.length;

      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      let maxVolume = 1;
      for (const candle of candles) {
        min = Math.min(min, candle.low);
        max = Math.max(max, candle.high);
        maxVolume = Math.max(maxVolume, candle.volume);
      }
      min = Math.min(min, quote.price);
      max = Math.max(max, quote.price);
      const candleSpan = Math.max(max - min, quote.tickSize * 8);
      if (Math.abs(quote.prevClose - quote.price) <= candleSpan * 3) {
        min = Math.min(min, quote.prevClose);
        max = Math.max(max, quote.prevClose);
      }
      const span = Math.max(max - min, quote.tickSize * 8);
      const yPad = span * 0.14;
      min -= yPad;
      max += yPad;

      const yOf = (price: number) => pad.top + ((max - price) / (max - min)) * (priceBottom - pad.top);
      const xOf = (index: number) => pad.left + slot * index + slot / 2;

      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let row = 0; row < 4; row += 1) {
        const price = max - ((max - min) * row) / 3;
        const y = yOf(price);
        ctx.strokeStyle = GRID;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = "#101512";
        const label = formatPrice(price, quote.tickSize);
        const labelWidth = ctx.measureText(label).width + 8;
        ctx.fillRect(width - labelWidth - 2, y - 8, labelWidth, 16);
        ctx.fillStyle = MUTED;
        ctx.fillText(label, width - 6, y);
      }

      if (quote.prevClose >= min && quote.prevClose <= max) {
        const prevY = yOf(quote.prevClose);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(142, 156, 148, 0.7)";
        ctx.beginPath();
        ctx.moveTo(pad.left, prevY);
        ctx.lineTo(width - pad.right, prevY);
        ctx.stroke();
        ctx.restore();
      }

      candles.forEach((candle, index) => {
        const rising = candle.close >= candle.open;
        const color = rising ? RISE : FALL;
        const x = xOf(index);
        const bodyWidth = Math.max(1, Math.min(8, slot * 0.62));
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, yOf(candle.high));
        ctx.lineTo(x, yOf(candle.low));
        ctx.stroke();
        const openY = yOf(candle.open);
        const closeY = yOf(candle.close);
        const top = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);

        const volumeTop = priceBottom + 10;
        const barHeight = (candle.volume / maxVolume) * (height - pad.bottom - volumeTop);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x - bodyWidth / 2, height - pad.bottom - barHeight, bodyWidth, barHeight);
        ctx.globalAlpha = 1;
      });

      const last = candles[candles.length - 1];
      if (last) {
        const y = yOf(last.close);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = BRASS;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.restore();
        const label = formatPrice(last.close, quote.tickSize);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const labelWidth = ctx.measureText(label).width + 8;
        ctx.fillStyle = last.close >= quote.prevClose ? RISE : FALL;
        ctx.fillRect(width - pad.right + 2, y - 8, labelWidth, 16);
        ctx.fillStyle = "#140d0d";
        ctx.fillText(label, width - pad.right + 6, y);
      }

      ctx.fillStyle = MUTED;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const labelCount = Math.min(4, candles.length);
      for (let index = 0; index < labelCount; index += 1) {
        const candleIndex = Math.round((index * (candles.length - 1)) / Math.max(1, labelCount - 1));
        const candle = candles[candleIndex];
        if (!candle) continue;
        ctx.fillText(formatMinute(candle.time), xOf(candleIndex), height - 6);
      }

      if (hover !== null && candles[hover]) {
        const x = xOf(hover);
        ctx.save();
        ctx.strokeStyle = "rgba(231, 238, 232, 0.35)";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        ctx.restore();
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [candles, hover, quote.price, quote.prevClose, quote.tickSize]);

  const move = (clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap || candles.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const padLeft = 8;
    const padRight = 64;
    const plotWidth = rect.width - padLeft - padRight;
    const slot = plotWidth / candles.length;
    const index = Math.floor((clientX - rect.left - padLeft) / slot);
    if (index < 0 || index >= candles.length) {
      setHover(null);
      return;
    }
    setHover(index);
  };

  return (
    <section className="flex min-h-[300px] flex-col lg:min-h-0 lg:flex-1">
      <header className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold">{quote.name}</h2>
            <span className="font-mono text-xs text-muted-foreground">{quote.symbol}</span>
            <span className="text-xs text-muted-foreground">{quote.sector}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-2xl font-semibold ${toneClass(quote.change)}`}>
              {formatPrice(quote.price, quote.tickSize)}
            </span>
            <span className={`font-mono text-sm ${toneClass(quote.change)}`}>
              {quote.change > 0 ? "+" : ""}
              {formatPrice(quote.change, quote.tickSize)} {quote.changePct > 0 ? "+" : ""}
              {(quote.changePct * 100).toFixed(2)}%
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-x-4 text-xs">
          <Stat label="开" value={formatPrice(active?.open ?? quote.open, quote.tickSize)} />
          <Stat label="高" value={formatPrice(active?.high ?? quote.high, quote.tickSize)} />
          <Stat label="低" value={formatPrice(active?.low ?? quote.low, quote.tickSize)} />
          <Stat label="收" value={formatPrice(active?.close ?? quote.price, quote.tickSize)} />
        </dl>
      </header>
      <div
        ref={wrapRef}
        className="relative min-h-[240px] flex-1"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => move(event.clientX)}
      >
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
        {candles.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            等待这一分钟的第一笔成交
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}
