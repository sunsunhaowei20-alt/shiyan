import type { Session } from "./types";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface ShanghaiParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export function shanghaiEpoch(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) {
  return Date.UTC(year, monthIndex, day, hour, minute, second) - SHANGHAI_OFFSET_MS;
}

export function shanghaiParts(utcMs: number): ShanghaiParts {
  const shifted = new Date(utcMs + SHANGHAI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export const BACKFILL_START = shanghaiEpoch(2026, 9, 12, 9, 30, 0);
export const SESSION_ANCHOR = shanghaiEpoch(2026, 9, 12, 10, 16, 0);

function daySeconds(parts: ShanghaiParts) {
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

export function sessionStatus(utcMs: number): Session {
  const parts = shanghaiParts(utcMs);
  if (parts.weekday === 0 || parts.weekday === 6) return "closed";
  const seconds = daySeconds(parts);
  const openMorning = 9 * 3600 + 30 * 60;
  const closeMorning = 11 * 3600 + 30 * 60;
  const openAfternoon = 13 * 3600;
  const closeAfternoon = 15 * 3600;
  if (seconds >= openMorning && seconds < closeMorning) return "open";
  if (seconds >= openAfternoon && seconds < closeAfternoon) return "open";
  if (seconds >= closeMorning && seconds < openAfternoon) return "lunch";
  return "closed";
}

export function secondsUntilClose(utcMs: number) {
  const parts = shanghaiParts(utcMs);
  const seconds = daySeconds(parts);
  const closeMorning = 11 * 3600 + 30 * 60;
  const closeAfternoon = 15 * 3600;
  if (seconds < closeMorning) return closeMorning - seconds;
  if (seconds < closeAfternoon) return closeAfternoon - seconds;
  return 0;
}

export function nextOpen(utcMs: number) {
  let cursor = utcMs + 1000;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const parts = shanghaiParts(cursor);
    const weekend = parts.weekday === 0 || parts.weekday === 6;
    const minutes = parts.hour * 60 + parts.minute;
    if (!weekend && minutes < 9 * 60 + 30) {
      return shanghaiEpoch(parts.year, parts.month, parts.day, 9, 30, 0);
    }
    if (!weekend && minutes >= 11 * 60 + 30 && minutes < 13 * 60) {
      return shanghaiEpoch(parts.year, parts.month, parts.day, 13, 0, 0);
    }
    cursor = shanghaiEpoch(parts.year, parts.month, parts.day, 0, 0, 0) + 24 * 60 * 60 * 1000;
  }
  return cursor;
}

export function formatSimTime(utcMs: number) {
  const parts = shanghaiParts(utcMs);
  const pad = (value: number) => value.toString().padStart(2, "0");
  const weekday = "日一二三四五六"[parts.weekday] ?? "";
  return {
    date: `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`,
    clock: `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    week: `周${weekday}`,
    minuteKey: `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`,
  };
}

export function sameTradingDay(left: number, right: number) {
  const a = shanghaiParts(left);
  const b = shanghaiParts(right);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
