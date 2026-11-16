import test from "node:test";
import assert from "node:assert/strict";
import { isValidTimeZone, localDateKey, localMinutesOfDay, startOfLocalDayUtc } from "../src/lib/timezone";
import { calculateShiftMetrics, shiftTargetMinutes } from "../src/lib/shiftMetrics";

// Company-time shift math. Shift times are wall-clock values on the office clock,
// so "09:00" in the Maldives (UTC+5) means 04:00 UTC. These cases exist because
// this has regressed: comparing against UTC clock-ins made everyone either late
// by five hours or never late at all.

const MALDIVES = "Indian/Maldives";
const utc = (iso: string) => new Date(iso);

test("local wall clock reads in the company timezone", () => {
  assert.equal(localMinutesOfDay(utc("2026-11-16T04:00:00Z"), MALDIVES), 540); // 09:00 local
  assert.equal(localMinutesOfDay(utc("2026-11-16T04:00:00Z"), "UTC"), 240);
});

test("a 09:00 shift is late by local minutes, not UTC minutes", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T04:10:00Z"), utc("2026-11-16T11:00:00Z"), "09:00", "17:00", MALDIVES);
  assert.equal(metrics.lateMinutes, 10); // 09:10 local
  assert.equal(metrics.overtimeMinutes, 0); // short of the 8h target
});

test("the same instant is on time for a UTC office", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T04:10:00Z"), utc("2026-11-16T11:00:00Z"), "09:00", "17:00", "UTC");
  assert.equal(metrics.lateMinutes, 0);
});

test("clocking in before the local shift start is not late", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T03:55:00Z"), utc("2026-11-16T11:00:00Z"), "09:00", "17:00", MALDIVES);
  assert.equal(metrics.lateMinutes, 0); // 08:55 local
});

test("working past the local shift end pays overtime", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T04:00:00Z"), utc("2026-11-16T13:30:00Z"), "09:00", "17:00", MALDIVES);
  assert.equal(metrics.overtimeMinutes, 90); // 09:00-18:30 local
  assert.equal(metrics.lateMinutes, 0);
});

test("a late arrival that works the full local shift clears late minutes", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T04:30:00Z"), utc("2026-11-16T13:00:00Z"), "09:00", "17:00", MALDIVES);
  assert.equal(metrics.lateMinutes, 0); // 09:30-18:00 local, 8.5h worked
  assert.equal(metrics.overtimeMinutes, 30);
});

test("per-employee duty start is respected in company time", () => {
  const metrics = calculateShiftMetrics(utc("2026-11-16T02:05:00Z"), utc("2026-11-16T10:00:00Z"), "07:00", "15:00", MALDIVES);
  assert.equal(metrics.lateMinutes, 5); // 07:05 local against a 07:00 duty start
});

test("the attendance day starts at local midnight", () => {
  assert.equal(localDateKey(utc("2026-11-15T20:30:00Z"), MALDIVES), "2026-11-16"); // 01:30 local
  assert.equal(startOfLocalDayUtc(utc("2026-11-15T20:30:00Z"), MALDIVES).toISOString(), "2026-11-16T00:00:00.000Z");
});

test("shift target comes from the duty window", () => {
  assert.equal(shiftTargetMinutes("09:00", "16:00"), 420);
  assert.equal(shiftTargetMinutes("09:00", "17:00"), 480);
});

test("timezone validation accepts IANA names only", () => {
  assert.equal(isValidTimeZone(MALDIVES), true);
  assert.equal(isValidTimeZone("GMT+5"), false);
});
