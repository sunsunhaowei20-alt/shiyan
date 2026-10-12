import { formatSimTime } from "./time";

export function formatPrice(price: number, tickSize: number) {
  return price.toFixed(tickSize < 0.01 ? 3 : 2);
}

export function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function formatSigned(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatCny(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLots(shares: number) {
  return (shares / 100).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export function formatVolume(shares: number) {
  const lots = shares / 100;
  if (lots >= 10000) return `${(lots / 10000).toFixed(2)}万手`;
  return `${Math.round(lots).toLocaleString("zh-CN")}手`;
}

export function formatTurnover(value: number) {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return formatCny(value);
}

export function formatClock(utcMs: number) {
  const parts = formatSimTime(utcMs);
  return `${parts.date} ${parts.week} ${parts.clock}`;
}

export function formatMinute(utcMs: number) {
  const parts = formatSimTime(utcMs);
  return parts.clock.slice(0, 5);
}

export function toneClass(value: number) {
  if (value > 0.0000001) return "text-rise";
  if (value < -0.0000001) return "text-fall";
  return "text-muted-foreground";
}
