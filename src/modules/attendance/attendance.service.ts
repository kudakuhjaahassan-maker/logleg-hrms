import { EmployeeStatus, UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";

const EARTH_RADIUS_METERS = 6371000;
/** Fallback shift length when an employee's shift times are missing or invalid. */
const DEFAULT_SHIFT_TARGET_MINUTES = 480;
const DEFAULT_SHIFT_START = "09:00";
const DEFAULT_SHIFT_END = "17:00";

function canViewDailyLogs(role: UserRole) {
  return role === "MANAGER" || role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateParam(dateStr?: string) {
  if (!dateStr) return startOfDayUtc(new Date());
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid date");
  return startOfDayUtc(d);
}

function workedMs(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn) return 0;
  const end = clockOut ?? new Date();
  return Math.max(0, end.getTime() - clockIn.getTime());
}

/** Great-circle distance between two coordinates, in meters. */
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** "HH:MM" -> minutes since midnight (UTC). Returns null for malformed input. */
function parseShiftMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function shiftTargetMinutes(shiftStartTime?: string | null, shiftEndTime?: string | null) {
  const start = parseShiftMinutes(shiftStartTime ?? DEFAULT_SHIFT_START);
  const end = parseShiftMinutes(shiftEndTime ?? DEFAULT_SHIFT_END);
  if (start === null || end === null) return DEFAULT_SHIFT_TARGET_MINUTES;
  const target = end - start;
  return target > 0 ? target : DEFAULT_SHIFT_TARGET_MINUTES;
}

/** Radius allowed for this employee: their override, else the company default. */
function allowedRadiusMeters(companyAllowedRadius: number, customRadiusMeters: number | null) {
  return customRadiusMeters && customRadiusMeters > 0 ? customRadiusMeters : companyAllowedRadius;
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
function calculateShiftMetrics(
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

export async function getTodayStatus(companyId: string, employeeId: string) {
  const today = startOfDayUtc(new Date());
  const [log, employee] = await Promise.all([
    prisma.attendanceLog.findUnique({
      where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
    }),
    prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { shiftStartTime: true, shiftEndTime: true },
    }),
  ]);

  const metrics = calculateShiftMetrics(
    log?.clockIn ?? null,
    log?.clockOut ?? null,
    employee?.shiftStartTime,
    employee?.shiftEndTime,
    today,
  );

  return {
    date: today.toISOString().slice(0, 10),
    log,
    workedMs: log ? workedMs(log.clockIn, log.clockOut) : 0,
    isClockedIn: !!(log?.clockIn && !log?.clockOut),
    shiftStartTime: employee?.shiftStartTime ?? DEFAULT_SHIFT_START,
    shiftEndTime: employee?.shiftEndTime ?? DEFAULT_SHIFT_END,
    ...metrics,
  };
}

export async function clockIn(
  companyId: string,
  employeeId: string,
  latitude?: number,
  longitude?: number,
) {
  const today = startOfDayUtc(new Date());
  const now = new Date();
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (existing?.clockIn) {
    throw new HttpError(400, "Already clocked in for today");
  }

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { officeLatitude: true, officeLongitude: true, allowedRadiusMeters: true },
    }),
    prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { customRadiusMeters: true },
    }),
  ]);
  if (!company) throw new HttpError(404, "Company not found");

  let distanceMeters: number | null = null;
  const officeLat = company.officeLatitude;
  const officeLng = company.officeLongitude;

  if (officeLat !== null && officeLng !== null) {
    const radius = allowedRadiusMeters(company.allowedRadiusMeters, employee?.customRadiusMeters ?? null);
    if (latitude === undefined || longitude === undefined) {
      throw new HttpError(400, "Location is required to clock in. Enable location access and try again.");
    }
    distanceMeters = haversineDistanceMeters(latitude, longitude, officeLat, officeLng);
    if (distanceMeters > radius) {
      throw new HttpError(
        400,
        `You are outside the allowed check-in zone (${Math.round(distanceMeters)}m away, limit ${radius}m).`,
      );
    }
  }

  const log = await prisma.attendanceLog.upsert({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
    update: { clockIn: now, checkInDistanceMeters: distanceMeters },
    create: { companyId, employeeId, date: today, clockIn: now, checkInDistanceMeters: distanceMeters },
  });
  return log;
}

export async function clockOut(companyId: string, employeeId: string) {
  const today = startOfDayUtc(new Date());
  const now = new Date();
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (!existing?.clockIn) {
    throw new HttpError(400, "You must clock in before clocking out");
  }
  if (existing.clockOut) {
    throw new HttpError(400, "Already clocked out for today");
  }

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
    select: { shiftStartTime: true, shiftEndTime: true },
  });
  const metrics = calculateShiftMetrics(
    existing.clockIn,
    now,
    employee?.shiftStartTime,
    employee?.shiftEndTime,
    today,
  );

  const log = await prisma.attendanceLog.update({
    where: { id: existing.id },
    data: {
      clockOut: now,
      lateMinutes: metrics.lateMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
    },
  });
  return log;
}

export async function getDailyLog(
  companyId: string,
  viewer: { userId: string; role: UserRole },
  dateStr?: string,
) {
  if (!canViewDailyLogs(viewer.role)) {
    throw new HttpError(403, "Only managers and HR admins can view daily attendance logs");
  }
  const day = parseDateParam(dateStr);

  const [employees, logs] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, status: { not: EmployeeStatus.TERMINATED } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        title: true,
        status: true,
        shiftStartTime: true,
        shiftEndTime: true,
        customRadiusMeters: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.attendanceLog.findMany({
      where: { companyId, date: day },
    }),
  ]);

  const logByEmployee = new Map(logs.map((l) => [l.employeeId, l]));

  const rows = employees.map((employee) => {
    const log = logByEmployee.get(employee.id) ?? null;
    const metrics = calculateShiftMetrics(
      log?.clockIn ?? null,
      log?.clockOut ?? null,
      employee.shiftStartTime,
      employee.shiftEndTime,
      day,
    );

    let attendanceStatus: "CLOCKED_IN" | "CLOCKED_OUT" | "LATE" | "ABSENT" | "ON_LEAVE";
    if (employee.status === EmployeeStatus.ON_LEAVE) {
      attendanceStatus = "ON_LEAVE";
    } else if (!log?.clockIn) {
      attendanceStatus = "ABSENT";
    } else if (!log.clockOut) {
      attendanceStatus = metrics.lateMinutes > 0 ? "LATE" : "CLOCKED_IN";
    } else {
      attendanceStatus = metrics.lateMinutes > 0 ? "LATE" : "CLOCKED_OUT";
    }

    return {
      employee,
      log,
      attendanceStatus,
      workedMs: log ? workedMs(log.clockIn, log.clockOut) : 0,
      ...metrics,
    };
  });

  const summary = {
    total: rows.length,
    clockedIn: rows.filter((r) => r.attendanceStatus === "CLOCKED_IN").length,
    clockedOut: rows.filter((r) => r.attendanceStatus === "CLOCKED_OUT").length,
    late: rows.filter((r) => r.attendanceStatus === "LATE").length,
    absent: rows.filter((r) => r.attendanceStatus === "ABSENT").length,
    onLeave: rows.filter((r) => r.attendanceStatus === "ON_LEAVE").length,
  };

  return {
    date: day.toISOString().slice(0, 10),
    summary,
    rows,
    policy: {
      shiftBased: true,
      defaultShiftStart: DEFAULT_SHIFT_START,
      defaultShiftEnd: DEFAULT_SHIFT_END,
      standardShiftTargetMinutes: DEFAULT_SHIFT_TARGET_MINUTES,
    },
  };
}
