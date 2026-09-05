import "server-only";
import type { QuietHours } from "@/server/types";

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * The configured time zone must be a valid IANA zone so the wall-clock
 * comparison in `isWithinQuietHours` is reliable. Falls back to UTC when it
 * is not recognized by the runtime.
 */
export function resolveTimeZone(timeZone: string | undefined): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone ?? "UTC" });
    return timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  } catch {
    return "UTC";
  }
}

export function parseHHMM(value: string): { hour: number; minute: number } | null {
  const match = HH_MM.exec(value?.trim() ?? "");
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function minutesInDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function toMinutes(value: string): number | null {
  const parsed = parseHHMM(value);
  if (!parsed) return null;
  return minutesInDay(parsed.hour, parsed.minute);
}

/**
 * Returns the current wall-clock minute-of-day in `timeZone`.
 */
export function currentMinuteOfDay(now: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return minutesInDay(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
}

/**
 * Whether `now` falls inside the quiet-hours window.
 *
 * Windows are compared in wall-clock minute-of-day in the configured time
 * zone. A window whose start is later than its end crosses midnight (for
 * example 22:00 → 07:00) and is treated as an interval wrapping the day
 * boundary. Invalid time strings disable the window rather than erroring.
 */
export function isWithinQuietHours(quiet: QuietHours, now: Date = new Date()): boolean {
  if (!quiet?.enabled) return false;

  const zone = resolveTimeZone(quiet.timeZone);
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === null || end === null) return false;

  const current = currentMinuteOfDay(now, zone);

  if (start === end) {
    return current >= start;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}
