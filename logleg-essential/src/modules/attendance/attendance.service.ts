import { EmployeeStatus, Prisma, UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";

const EARTH_RADIUS_METERS = 6371000; // Earth's radius in meters
const STANDARD_SHIFT_TARGET_MINUTES = 480; // 8 hours = 480 minutes

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function parseShiftTimeToMinutes(shiftTime: string): number {
  // Parse HH:MM format to total minutes from midnight
  const [hours, minutes] = shiftTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToShiftTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

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

function isLate(clockIn: Date | null, day: Date) {
  if (!clockIn) return false;
  const threshold = new Date(day);
  threshold.setUTCHours(WORK_START_HOUR, LATE_GRACE_MINUTES, 0, 0);
  return clockIn.getTime() > threshold.getTime();
}

function workedMs(clockIn: Date | null, clockOut: Date | null) {
  if (!clockIn) return 0;
  const end = clockOut ?? new Date();
  return Math.max(0, end.getTime() - clockIn.getTime());
}

function getAllowedRadiusMeters(companyId: string, employeeId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  // Use employee's custom radius if set, otherwise company default (20 meters)
  const customRadius = employee?.customRadiusMeters;
  const companyRadius = company?.allowedRadiusMeters ?? 20;
  return customRadius ?? companyRadius;
}

function calculateShiftMetrics(
  clockIn: Date | null,
  clockOut: Date | null,
  shiftStartTime: string,
  shiftEndTime: string,
): { lateMinutes: number; overtimeMinutes: number; totalWorkedMinutes: number; standardShiftTargetMinutes: number } {
  const shiftStartMin = parseShiftTimeToMinutes(shiftStartTime);
  const shiftEndMin = parseShiftTimeToMinutes(shiftEndTime);
  const standardShiftTargetMinutes = shiftEndMin - shiftStartMin; // e.g., 480 for 8h shift

  let totalWorkedMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;

  if (clockIn && clockOut) {
    totalWorkedMinutes = Math.max(0, workedMs(clockIn, clockOut) / 60000); // convert ms to minutes
  }

  if (clockIn) {
    const clockInMin = clockIn.getUTCHours() * 60 + clockIn.getUTCMinutes();
    // Calculate minutes late from shift start
    if (clockInMin > shiftStartMin) {
      lateMinutes = clockInMin - shiftStartMin;
    }
  }

  // Overtime calculation: if total worked >= standard target
  // First, use worked minutes to make up any late minutes
  if (totalWorkedMinutes >= standardShiftTargetMinutes) {
    // Morning late time is fully made up by working late
    lateMinutes = 0;
    // Any minutes beyond standard shift target are overtime
    overtimeMinutes = Math.max(0, totalWorkedMinutes - standardShiftTargetMinutes);
  } else {
    // Not enough hours worked - any deficit is added to late minutes
    // (capped at total worked minutes to not exceed them)
    const deficit = standardShiftTargetMinutes - totalWorkedMinutes;
    lateMinutes = Math.min(deficit, totalWorkedMinutes);
    overtimeMinutes = 0;
  }

  return { lateMinutes, overtimeMinutes, totalWorkedMinutes, standardShiftTargetMinutes };
}

export async function getTodayStatus(companyId: string, employeeId: string) {
  const today = startOfDayUtc(new Date());
  const log = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  return {
    date: today.toISOString().slice(0, 10),
    log,
    workedMs: log ? workedMs(log.clockIn, log.clockOut) : 0,
    isClockedIn: !!(log?.clockIn && !log?.clockOut),
  };
}

export async function clockIn(companyId: string, employeeId: string, latitude?: number, longitude?: number) {
  const today = startOfDayUtc(new Date());
  const now = new Date();
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (existing?.clockIn) {
    throw new HttpError(400, "Already clocked in for today");
  }

  // Geofence check: calculate distance from office and compare against allowed radius
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  const allowedRadius = getAllowedRadiusMeters(companyId, employeeId);

  let distanceMeters = 0;
  let geofenceBlocked = false;
  let distanceMessage = "";

  if (latitude !== undefined && longitude !== undefined && company?.officeLatitude !== undefined && company?.officeLongitude !== undefined) {
    const officeLat = company.officeLatitude;
    const officeLng = company.officeLongitude;
    distanceMeters = haversineDistanceMeters(latitude, longitude, officeLat, officeLng);
    if (distanceMeters > allowedRadius) {
      geofenceBlocked = true;
      distanceMessage = `You are outside your allowed check-in zone (${Math.round(distanceMeters)} meters away).`;
    }
  }

  const log = await prisma.attendanceLog.upsert({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
    update: { 
      clockIn: now,
      checkInDistanceMeters: geofenceBlocked ? null : distanceMeters,
    },
    create: { companyId, employeeId, date: today, clockIn: now, checkInDistanceMeters: geofenceBlocked ? null : distanceMeters },
  });

  if (geofenceBlocked) {
    throw new HttpError(400, distanceMessage);
  }

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
  const log = await prisma.attendanceLog.update({
    where: { id: existing.id },
    data: { clockOut: now },
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
        department: { select: { id: true, name: true } },
        shiftStartTime: true,
        shiftEndTime: true,
        customRadiusMeters: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.attendanceLog.findMany({
      where: { companyId, date: day },
    }),
  ]);

  const logByEmployee = new Map(logs.map((l) => [l.employeeId, l]));

  const rows = employees.map((e) => {
    const log = logByEmployee.get(e.id) ?? null;
    let attendanceStatus: "CLOCKED_IN" | "CLOCKED_OUT" | "LATE" | "ABSENT" | "ON_LEAVE";
    if (e.status === EmployeeStatus.ON_LEAVE) {
      attendanceStatus = "ON_LEAVE";
    } else if (!log?.clockIn) {
      attendanceStatus = "ABSENT";
    } else if (!log.clockOut) {
      attendanceStatus = isLate(log.clockIn, day) ? "LATE" : "CLOCKED_IN";
    } else {
      attendanceStatus = isLate(log.clockIn, day) ? "LATE" : "CLOCKED_OUT";
    }

    // Calculate shift metrics if employee has shift times and has clocked in/out
    let { lateMinutes, overtimeMinutes, totalWorkedMinutes, standardShiftTargetMinutes } = { lateMinutes: 0, overtimeMinutes: 0, totalWorkedMinutes: 0, standardShiftTargetMinutes: 480 };
    if (log?.clockIn && log?.clockOut && e.shiftStartTime && e.shiftEndTime) {
      const metrics = calculateShiftMetrics(
        log.clockIn,
        log.clockOut,
        e.shiftStartTime,
        e.shiftEndTime,
      );
      lateMinutes = metrics.lateMinutes;
      overtimeMinutes = metrics.overtimeMinutes;
      totalWorkedMinutes = metrics.totalWorkedMinutes;
      standardShiftTargetMinutes = metrics.standardShiftTargetMinutes;
    }

    return {
      employee: e,
      log,
      attendanceStatus,
      lateMinutes,
      overtimeMinutes,
      totalWorkedMinutes,
      standardShiftTargetMinutes,
    };
  });

  const summary = {
    total: rows.length,
    clockedIn: rows.filter((r) => r.attendanceStatus === "CLOCKED_IN").length,
    clockedOut: rows.filter((r) => r.attendanceStatus === "CLOCKED_OUT").length,
    late: rows.filter((r) => r.lateMinutes > 0).length,
    absent: rows.filter((r) => r.attendanceStatus === "ABSENT").length,
    onLeave: rows.filter((r) => r.attendanceStatus === "ON_LEAVE").length,
  };

  return { date: day.toISOString().slice(0, 10), summary, rows, policy: { workStartHour: WORK_START_HOUR, lateGraceMinutes: LATE_GRACE_MINUTES } };
}
