/**
 * Shift-based attendance math shared by the attendance and payroll modules.
 *
 * Keeping this in one place is what makes a payslip's overtime match the daily
 * attendance view: both derive overtime from the same shift target and the same
 * late-arrival make-up rule.
 */

/** Fallback shift length when an employee's shift times are missing or invalid. */
export const DEFAULT_SHIFT_TARGET_MINUTES = 480;
export const DEFAULT_SHIFT_START = "09:00";
export const DEFAULT_SHIFT_END = "17:00";

export function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function workedMs(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn) return 0;
  const end = clockOut ?? new Date();
  return Math.max(0, end.getTime() - clockIn.getTime());
}

/** "HH:MM" -> minutes since midnight (UTC). Returns null for malformed input. */
export function parseShiftMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function shiftTargetMinutes(shiftStartTime?: string | null, shiftEndTime?: string | null) {
  const start = parseShiftMinutes(shiftStartTime ?? DEFAULT_SHIFT_START);
  const end = parseShiftMinutes(shiftEndTime ?? DEFAULT_SHIFT_END);
  if (start === null || end === null) return DEFAULT_SHIFT_TARGET_MINUTES;
  const target = end - start;
  return target > 0 ? target : DEFAULT_SHIFT_TARGET_MINUTES;
}

export interface ShiftMetrics {
  lateMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  standardShiftTargetMinutes: number;
}

/**
 * Shift metrics for one attendance record.
 *
 * Late minutes come from clocking in after the employee's shift start. Working
 * the full shift target makes that up: once the target is met the late minutes
 * clear and anything beyond the target becomes overtime. A shortfall keeps the
 * remaining deficit as late minutes.
 */
export function calculateShiftMetrics(
  clockIn: Date | null,
  clockOut: Date | null,
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  day?: Date,
): ShiftMetrics {
  const standardShiftTargetMinutes = shiftTargetMinutes(shiftStartTime, shiftEndTime);
  const totalWorkedMinutes = clockIn ? Math.floor(workedMs(clockIn, clockOut) / 60000) : 0;

  if (!clockIn) {
    return { lateMinutes: 0, overtimeMinutes: 0, totalWorkedMinutes: 0, standardShiftTargetMinutes };
  }

  const shiftStartMinutes = parseShiftMinutes(shiftStartTime ?? DEFAULT_SHIFT_START) ?? 0;
  const scheduledStart = new Date((day ?? startOfDayUtc(clockIn)).getTime() + shiftStartMinutes * 60000);
  const arrivedLateMinutes = Math.max(0, Math.floor((clockIn.getTime() - scheduledStart.getTime()) / 60000));

  if (totalWorkedMinutes >= standardShiftTargetMinutes) {
    return {
      lateMinutes: 0,
      overtimeMinutes: totalWorkedMinutes - standardShiftTargetMinutes,
      totalWorkedMinutes,
      standardShiftTargetMinutes,
    };
  }

  // Still short of the shift target: only the lateness that was not made up remains.
  const deficit = standardShiftTargetMinutes - totalWorkedMinutes;
  return {
    lateMinutes: Math.min(arrivedLateMinutes, deficit),
    overtimeMinutes: 0,
    totalWorkedMinutes,
    standardShiftTargetMinutes,
  };
}
