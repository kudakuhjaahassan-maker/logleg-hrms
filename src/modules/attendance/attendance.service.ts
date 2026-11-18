import { EmployeeStatus, UserRole } from "@prisma/client";
import { companyTimeZone } from "../../lib/companyTime";
import prisma from "../../lib/prisma";
import {
  calculateShiftMetrics,
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_TARGET_MINUTES,
  startOfDayUtc,
  workedMs,
} from "../../lib/shiftMetrics";
import { startOfLocalDayUtc } from "../../lib/timezone";
import { HttpError } from "../../utils/http";

const EARTH_RADIUS_METERS = 6371000;

function canViewDailyLogs(role: UserRole) {
  return role === "MANAGER" || role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

function parseDateParam(dateStr: string | undefined, timeZone: string) {
  if (!dateStr) return startOfLocalDayUtc(new Date(), timeZone);
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid date");
  return startOfDayUtc(d);
}

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

function allowedRadiusMeters(companyAllowedRadius: number, customRadiusMeters: number | null) {
  return customRadiusMeters && customRadiusMeters > 0 ? customRadiusMeters : companyAllowedRadius;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getTodayStatus(companyId: string, employeeId: string) {
  const [timeZone, employee] = await Promise.all([
    companyTimeZone(companyId),
    prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { shiftStartTime: true, shiftEndTime: true },
    }),
  ]);
  const today = startOfLocalDayUtc(new Date(), timeZone);
  const log = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });

  const metrics = calculateShiftMetrics(
    log?.clockIn ?? null,
    log?.clockOut ?? null,
    employee?.shiftStartTime,
    employee?.shiftEndTime,
    timeZone,
  );

  return {
    date: today.toISOString().slice(0, 10),
    timeZone,
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
  const now = new Date();
  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        officeLatitude: true,
        officeLongitude: true,
        allowedRadiusMeters: true,
        timezone: true,
      },
    }),
    prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { customRadiusMeters: true },
    }),
  ]);
  if (!company) throw new HttpError(404, "Company not found");

  const today = startOfLocalDayUtc(now, company.timezone);
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (existing?.clockIn) {
    throw new HttpError(400, "Already clocked in for today");
  }

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
  const now = new Date();
  const [timeZone, employee] = await Promise.all([
    companyTimeZone(companyId),
    prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { shiftStartTime: true, shiftEndTime: true },
    }),
  ]);
  const today = startOfLocalDayUtc(now, timeZone);
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (!existing?.clockIn) {
    throw new HttpError(400, "You must clock in before clocking out");
  }
  if (existing.clockOut) {
    throw new HttpError(400, "Already clocked out for today");
  }

  const metrics = calculateShiftMetrics(
    existing.clockIn,
    now,
    employee?.shiftStartTime,
    employee?.shiftEndTime,
    timeZone,
  );

  const log = await prisma.attendanceLog.update({
    where: { id: existing.id },
    data: {
      clockOut: now,
      lateMinutes: metrics.lateMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      metricsComputedAt: now,
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
  const timeZone = await companyTimeZone(companyId);
  const day = parseDateParam(dateStr, timeZone);

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
      timeZone,
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
    timeZone,
    summary,
    rows,
    policy: {
      shiftBased: true,
      timeZone,
      defaultShiftStart: DEFAULT_SHIFT_START,
      defaultShiftEnd: DEFAULT_SHIFT_END,
      standardShiftTargetMinutes: DEFAULT_SHIFT_TARGET_MINUTES,
    },
  };
}

export async function getTrends(companyId: string) {
  const timeZone = await companyTimeZone(companyId);
  const today = new Date();
  const thirtyDaysAgo = addDays(today, -30);

  const [employees, allLogs] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, status: { not: EmployeeStatus.TERMINATED } },
      select: { id: true, status: true },
    }),
    prisma.attendanceLog.findMany({
      where: {
        companyId,
        date: {
          gte: thirtyDaysAgo,
          lte: today,
        },
      },
    }),
  ]);

  const totalActiveEmployees = employees.length;
  if (totalActiveEmployees === 0) {
    return [];
  }

  // Count present/on-time employees per day
  const dailyCounts: Record<string, number> = {};
  let currentDate = new Date(thirtyDaysAgo);
  while (currentDate <= today) {
    const dayKey: string = currentDate.toISOString().slice(0, 10);
    dailyCounts[dayKey] = 0;
    currentDate = addDays(currentDate, 1);
  }

  // Count present/on-time employees from logs
  for (const log of allLogs) {
    const logDate = String(log.date);
    const employee = employees.find((e) => e.id === log.employeeId);
    if (!employee) continue;
    if (employee.status === EmployeeStatus.ON_LEAVE || employee.status === EmployeeStatus.TERMINATED) continue;
    // Present/on-time: employee is clocked in (no clock-out yet) OR clocked in on time
    const isClockedIn = log.clockIn && !log.clockOut;
    if (isClockedIn) {
      if (dailyCounts[logDate] !== undefined) {
        dailyCounts[logDate] = dailyCounts[logDate] + 1;
      }
    }
  }

  // Build result for the past 14 days (or as many as available)
  const result: Array<{ date: string; attendanceRate: number }> = [];
  const endDate = addDays(today, -14);
  let resultDate = addDays(today, -14);
  while (resultDate <= today) {
    const dayKey: string = resultDate.toISOString().slice(0, 10);
    const count = dailyCounts[dayKey] ?? 0;
    const attendanceRate = totalActiveEmployees > 0 ? count : 0;
    result.push({ date: dayKey, attendanceRate: Math.round((attendanceRate / totalActiveEmployees) * 100 * 100) / 100 });
    resultDate = addDays(resultDate, 1);
  }

  return result;
}
