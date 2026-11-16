/**
 * Helpers for reading wall-clock time in a company's own timezone.
 *
 * Shift times ("09:00") are local wall-clock values, so "late" has to be judged
 * against the clock on the office wall — 09:00 in the Maldives (UTC+5) is 04:00
 * UTC — and the attendance day has to start at local midnight.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let cached = formatterCache.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, cached);
  }
  return cached;
}

/** True when `timeZone` is a timezone the runtime knows (IANA name, e.g. "Asia/Colombo"). */
export function isValidTimeZone(timeZone: string) {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Wall-clock date/time components of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string) => {
    const value = parts.find((p) => p.type === type)?.value;
    return value === undefined ? 0 : Number(value);
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // some ICU builds report midnight as 24
    minute: get("minute"),
    second: get("second"),
  };
}

/** "YYYY-MM-DD" of the calendar day `date` falls on in `timeZone`. */
export function localDateKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * The instant we store for an attendance `date` column: UTC midnight of the local
 * calendar day. Attendance rows are keyed by their local day, so this keeps
 * "2026-11-16" meaning 16 November in the office's timezone.
 */
export function startOfLocalDayUtc(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** Minutes elapsed since local midnight, e.g. 04:00 UTC in UTC+5 -> 540 (09:00 local). */
export function localMinutesOfDay(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}
