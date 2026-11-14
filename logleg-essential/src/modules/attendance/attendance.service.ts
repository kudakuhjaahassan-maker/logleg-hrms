import { EmployeeStatus, Prisma, UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";

const WORK_START_HOUR = 9; // 09:00
const LATE_GRACE_MINUTES = 15; // late if clock-in after 09:15

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

export async function clockIn(companyId: string, employeeId: string) {
  const today = startOfDayUtc(new Date());
  const now = new Date();
  const existing = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  if (existing?.clockIn) {
    throw new HttpError(400, "Already clocked in for today");
  }

  const log = await prisma.attendanceLog.upsert({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
    update: { clockIn: now },
    create: { companyId, employeeId, date: today, clockIn: now },
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
    return {
      employee: e,
      log,
      attendanceStatus,
      workedMs: log ? workedMs(log.clockIn, log.clockOut) : 0,
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

  return { date: day.toISOString().slice(0, 10), summary, rows, policy: { workStartHour: WORK_START_HOUR, lateGraceMinutes: LATE_GRACE_MINUTES } };
}
