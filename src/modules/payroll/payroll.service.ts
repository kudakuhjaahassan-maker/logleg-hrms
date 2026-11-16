import { EmployeeStatus, Prisma, PayrollStatus, type UserRole } from "@prisma/client";
import { companyTimeZone } from "../../lib/companyTime";
import prisma from "../../lib/prisma";
import { calculateShiftMetrics } from "../../lib/shiftMetrics";
import { startOfLocalDayUtc } from "../../lib/timezone";
import { HttpError } from "../../utils/http";

function canManagePayroll(role: UserRole) {
  return role === "HR_ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER";
}

function daysInMonthUtc(year: number, month1: number) {
  // month1: 1-12
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function clampGenerationDay(day: number, year: number, month1: number) {
  return Math.min(Math.max(day, 1), daysInMonthUtc(year, month1));
}

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return Number(v);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface Period {
  year: number;
  month: number; // 1-12
}

export function previousMonth(ref: Date = new Date()): Period {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + 1; // 1-12
  if (m === 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

export function currentPeriod(ref: Date = new Date()): Period {
  return { year: ref.getUTCFullYear(), month: ref.getUTCMonth() + 1 };
}

function periodRange(p: Period) {
  const start = new Date(Date.UTC(p.year, p.month - 1, 1));
  const end = new Date(Date.UTC(p.year, p.month, 1)); // exclusive
  return { start, end };
}

function isPeriodDue(employee: { payslipGenerationDay: number }, period: Period, now: Date = new Date()) {
  // Payslip for `period` (a month) is generated on the employee's configured day
  // of the following month. It becomes due once that day is reached.
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const genDay = clampGenerationDay(employee.payslipGenerationDay || 28, nextYear, nextMonth);
  const dueAt = new Date(Date.UTC(nextYear, nextMonth - 1, genDay, 0, 0, 0, 0));
  return now.getTime() >= dueAt.getTime();
}

const payslipSelect = {
  id: true,
  companyId: true,
  employeeId: true,
  baseSalary: true,
  regularPay: true,
  overtimeHours: true,
  overtimePay: true,
  allowancesTotal: true,
  yearlyBonus: true,
  allowancesBreakdown: true,
  grossPay: true,
  deductions: true,
  netPay: true,
  currency: true,
  payPeriodMonth: true,
  payPeriodYear: true,
  status: true,
  generatedAt: true,
  processedAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      department: { select: { id: true, name: true } },
    },
  },
} as const;

function computeAllowances(employee: any) {
  const items: { key: string; label: string; amount: number }[] = [];
  const add = (enabled: any, amount: any, key: string, label: string) => {
    if (!enabled) return;
    const amt = round2(toNumber(amount) || 0);
    if (amt <= 0) return;
    items.push({ key, label, amount: amt });
  };
  add(employee.foodAllowanceEnabled, employee.foodAllowanceAmount, "food", "Food Allowance");
  add(employee.accommodationAllowanceEnabled, employee.accommodationAllowanceAmount, "accommodation", "Accommodation Allowance");
  add(employee.punctualityAllowanceEnabled, employee.punctualityAllowanceAmount, "punctuality", "Punctuality Allowance");
  add(employee.uniformAllowanceEnabled, employee.uniformAllowanceAmount, "uniform", "Dress Code / Uniform Allowance");
  add(employee.transportPhoneAllowanceEnabled, employee.transportPhoneAllowanceAmount, "transportPhone", "Transport / Phone Allowance");
  add(employee.ramadanAllowanceEnabled, employee.ramadanAllowanceAmount, "ramadan", "Ramadan Allowance");

  const allowancesTotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const yearlyBonus = employee.yearlyBonusEnabled ? round2(toNumber(employee.yearlyBonusAmount) || 0) : 0;
  if (yearlyBonus > 0) {
    items.push({ key: "yearlyBonus", label: "Yearly Performance Bonus", amount: yearlyBonus });
  }
  return { allowancesTotal, yearlyBonus, breakdown: items };
}

interface OvertimeSource {
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  overtimeMinutes: number;
  metricsComputedAt: Date | null;
}

/**
 * The overtime a single attendance record stands behind, in minutes.
 *
 * Clock-out stamps `metricsComputedAt` as it computes the shift metrics, so a stamped
 * record is authoritative — including a genuine zero. Records logged before that stamp
 * existed carry the column default of 0, which says nothing about the day worked, so
 * their overtime is derived from the employee's shift with the same helper the daily
 * attendance view uses. A positive stored value is always a real computation, so it is
 * trusted either way.
 */
function overtimeMinutesFor(
  log: OvertimeSource,
  shift: { shiftStartTime?: string | null; shiftEndTime?: string | null },
  timeZone: string,
) {
  if (log.metricsComputedAt || log.overtimeMinutes > 0) return log.overtimeMinutes;
  return calculateShiftMetrics(
    log.clockIn,
    log.clockOut,
    shift.shiftStartTime,
    shift.shiftEndTime,
    timeZone,
  ).overtimeMinutes;
}

async function computePeriodStats(
  companyId: string,
  employee: any,
  period: Period,
) {
  // Overtime is stored per attendance row (company-local shift), so only the
  // pre-stamp fallback needs the timezone.
  const { start, end } = periodRange(period);
  const logs = await prisma.attendanceLog.findMany({
    where: {
      companyId,
      employeeId: employee.id,
      date: { gte: start, lt: end },
      clockIn: { not: null },
      clockOut: { not: null },
    },
    select: { date: true, clockIn: true, clockOut: true, overtimeMinutes: true, metricsComputedAt: true },
  });

  const timeZone = await companyTimeZone(companyId);
  const otRate = toNumber(employee.overtimeHourlyRate) || 0;
  const base = toNumber(employee.baseSalary) || 0;

  let totalWorkedHours = 0;
  let regularHours = 0;
  let overtimeMinutesTotal = 0;

  for (const log of logs) {
    if (!log.clockIn || !log.clockOut) continue;
    const workedHours = Math.max(0, (log.clockOut.getTime() - log.clockIn.getTime()) / 3600000);

    // Overtime comes from the attendance record, not from raw worked hours, so a
    // payslip agrees with the daily attendance view.
    const overtimeMinutes = overtimeMinutesFor(log, employee, timeZone);

    overtimeMinutesTotal += overtimeMinutes;
    totalWorkedHours += workedHours;
    regularHours += Math.max(0, workedHours * 60 - overtimeMinutes) / 60;
  }

  totalWorkedHours = round2(totalWorkedHours);
  regularHours = round2(regularHours);
  const overtimeHours = round2(overtimeMinutesTotal / 60);
  const overtimePay = round2(overtimeHours * otRate);
  const regularPay = round2(base);
  const { allowancesTotal, yearlyBonus, breakdown } = computeAllowances(employee);
  const grossPay = round2(regularPay + overtimePay + allowancesTotal + yearlyBonus);
  const deductions = 0;
  const netPay = round2(grossPay - deductions);

  return {
    baseSalary: round2(base),
    regularPay,
    overtimeHours,
    overtimeMinutes: overtimeMinutesTotal,
    overtimePay,
    allowancesTotal,
    yearlyBonus,
    allowancesBreakdown: breakdown,
    grossPay,
    deductions,
    netPay,
    currency: employee.currencySymbol || "$",
    totalWorkedHours,
    regularHours,
    daysCounted: logs.length,
  };
}

async function ensurePayslipForPeriod(companyId: string, employeeId: string, period: Period) {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      companyId: true,
      baseSalary: true,
      currencySymbol: true,
      standardHoursPerDay: true,
      overtimeHourlyRate: true,
      shiftStartTime: true,
      shiftEndTime: true,
      payslipGenerationDay: true,
      foodAllowanceEnabled: true, foodAllowanceAmount: true,
      accommodationAllowanceEnabled: true, accommodationAllowanceAmount: true,
      punctualityAllowanceEnabled: true, punctualityAllowanceAmount: true,
      uniformAllowanceEnabled: true, uniformAllowanceAmount: true,
      transportPhoneAllowanceEnabled: true, transportPhoneAllowanceAmount: true,
      ramadanAllowanceEnabled: true, ramadanAllowanceAmount: true,
      yearlyBonusEnabled: true, yearlyBonusAmount: true, yearlyBonusCriteria: true,
    },
  });
  if (!employee) return null;

  if (!isPeriodDue(employee, period)) return null;

  const existing = await prisma.payrollRecord.findUnique({
    where: {
      companyId_employeeId_payPeriodYear_payPeriodMonth: {
        companyId,
        employeeId: employee.id,
        payPeriodYear: period.year,
        payPeriodMonth: period.month,
      },
    },
  });

  // Do not alter payslips that have already been paid out.
  if (existing && existing.status === PayrollStatus.PAID) return existing;

  const stats = await computePeriodStats(companyId, employee, period);
  const now = new Date();

  const data = {
    baseSalary: new Prisma.Decimal(stats.baseSalary),
    regularPay: new Prisma.Decimal(stats.regularPay),
    overtimeHours: new Prisma.Decimal(stats.overtimeHours),
    overtimePay: new Prisma.Decimal(stats.overtimePay),
    allowancesTotal: new Prisma.Decimal(stats.allowancesTotal),
    yearlyBonus: new Prisma.Decimal(stats.yearlyBonus),
    allowancesBreakdown: stats.allowancesBreakdown as any,
    grossPay: new Prisma.Decimal(stats.grossPay),
    deductions: new Prisma.Decimal(stats.deductions),
    netPay: new Prisma.Decimal(stats.netPay),
    currency: stats.currency,
    status: PayrollStatus.PROCESSED,
    generatedAt: existing?.generatedAt ?? now,
    processedAt: now,
  };

  const record = await prisma.payrollRecord.upsert({
    where: {
      companyId_employeeId_payPeriodYear_payPeriodMonth: {
        companyId,
        employeeId: employee.id,
        payPeriodYear: period.year,
        payPeriodMonth: period.month,
      },
    },
    update: data,
    create: {
      companyId,
      employeeId: employee.id,
      payPeriodYear: period.year,
      payPeriodMonth: period.month,
      ...data,
    },
    select: payslipSelect,
  });
  return record;
}

export async function generateDuePayslipsForCompany(companyId: string) {
  const employees = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  });
  const period = previousMonth();
  let generated = 0;
  for (const e of employees) {
    const r = await ensurePayslipForPeriod(companyId, e.id, period);
    if (r) generated += 1;
  }
  return { period, generated };
}

export async function generateDuePayslipsForEmployee(companyId: string, employeeId: string) {
  const period = previousMonth();
  const r = await ensurePayslipForPeriod(companyId, employeeId, period);
  return { period, generated: r ? 1 : 0 };
}

export async function getMyCompensation(companyId: string, employeeId: string) {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      baseSalary: true,
      currencySymbol: true,
      standardHoursPerDay: true,
      overtimeHourlyRate: true,
      shiftStartTime: true,
      shiftEndTime: true,
      payslipGenerationDay: true,
      status: true,
      department: { select: { id: true, name: true } },
      foodAllowanceEnabled: true, foodAllowanceAmount: true,
      accommodationAllowanceEnabled: true, accommodationAllowanceAmount: true,
      punctualityAllowanceEnabled: true, punctualityAllowanceAmount: true,
      uniformAllowanceEnabled: true, uniformAllowanceAmount: true,
      transportPhoneAllowanceEnabled: true, transportPhoneAllowanceAmount: true,
      ramadanAllowanceEnabled: true, ramadanAllowanceAmount: true,
      yearlyBonusEnabled: true, yearlyBonusAmount: true, yearlyBonusCriteria: true,
    },
  });
  if (!employee) throw new HttpError(404, "Employee not found");

  // Ensure the latest due payslip exists for this employee.
  await generateDuePayslipsForEmployee(companyId, employeeId);

  const cur = currentPeriod();
  const currentPeriodStats = await computePeriodStats(companyId, employee, cur);
  const activeAllowances = computeAllowances(employee);

  // "Today" is the office's local day, the same key attendance rows are stored under.
  const today = startOfLocalDayUtc(new Date(), await companyTimeZone(companyId));
  const todayLog = await prisma.attendanceLog.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId, date: today } },
  });
  let todayWorkedMs = 0;
  if (todayLog?.clockIn) {
    const end = todayLog.clockOut ?? new Date();
    todayWorkedMs = Math.max(0, end.getTime() - todayLog.clockIn.getTime());
  }

  const payslips = await prisma.payrollRecord.findMany({
    where: { companyId, employeeId },
    orderBy: [{ payPeriodYear: "desc" }, { payPeriodMonth: "desc" }],
    select: payslipSelect,
  });

  // Next generation date for the current period's payslip (generated next month).
  const nextGenMonth = cur.month === 12 ? 1 : cur.month + 1;
  const nextGenYear = cur.month === 12 ? cur.year + 1 : cur.year;
  const genDay = clampGenerationDay(employee.payslipGenerationDay || 28, nextGenYear, nextGenMonth);
  const nextPayslipDate = new Date(Date.UTC(nextGenYear, nextGenMonth - 1, genDay)).toISOString().slice(0, 10);

  return {
    employee: {
      ...employee,
      baseSalary: toNumber(employee.baseSalary),
      standardHoursPerDay: toNumber(employee.standardHoursPerDay),
      overtimeHourlyRate: toNumber(employee.overtimeHourlyRate),
      foodAllowanceAmount: toNumber(employee.foodAllowanceAmount),
      accommodationAllowanceAmount: toNumber(employee.accommodationAllowanceAmount),
      punctualityAllowanceAmount: toNumber(employee.punctualityAllowanceAmount),
      uniformAllowanceAmount: toNumber(employee.uniformAllowanceAmount),
      transportPhoneAllowanceAmount: toNumber(employee.transportPhoneAllowanceAmount),
      ramadanAllowanceAmount: toNumber(employee.ramadanAllowanceAmount),
      yearlyBonusAmount: toNumber(employee.yearlyBonusAmount),
    },
    activeAllowances: {
      allowancesTotal: activeAllowances.allowancesTotal,
      yearlyBonus: activeAllowances.yearlyBonus,
      breakdown: activeAllowances.breakdown,
    },
    currentPeriod: {
      ...cur,
      ...currentPeriodStats,
    },
    today: {
      date: today.toISOString().slice(0, 10),
      workedHours: round2(todayWorkedMs / 3600000),
      isClockedIn: !!(todayLog?.clockIn && !todayLog?.clockOut),
      clockIn: todayLog?.clockIn ?? null,
      clockOut: todayLog?.clockOut ?? null,
    },
    nextPayslipDate,
    payslips: payslips.map((p) => ({
      ...p,
      baseSalary: toNumber(p.baseSalary),
      regularPay: toNumber(p.regularPay),
      overtimeHours: toNumber(p.overtimeHours),
      overtimePay: toNumber(p.overtimePay),
      allowancesTotal: toNumber((p as any).allowancesTotal),
      yearlyBonus: toNumber((p as any).yearlyBonus),
      grossPay: toNumber(p.grossPay),
      deductions: toNumber(p.deductions),
      netPay: toNumber(p.netPay),
    })),
  };
}

export async function listPayslipsForReview(
  companyId: string,
  viewer: { userId: string; role: UserRole },
  filters?: { status?: PayrollStatus; month?: number; year?: number },
) {
  if (!canManagePayroll(viewer.role)) {
    throw new HttpError(403, "Only managers and HR admins can review payslips");
  }
  // Generate any due payslips so the review queue is up to date.
  await generateDuePayslipsForCompany(companyId);

  const where: Prisma.PayrollRecordWhereInput = { companyId };
  if (filters?.status) where.status = filters.status;
  if (filters?.month) where.payPeriodMonth = filters.month;
  if (filters?.year) where.payPeriodYear = filters.year;

  const payslips = await prisma.payrollRecord.findMany({
    where,
    select: payslipSelect,
    orderBy: [{ payPeriodYear: "desc" }, { payPeriodMonth: "desc" }, { employee: { lastName: "asc" } }],
  });

  const summary = {
    total: payslips.length,
    processed: payslips.filter((p) => p.status === PayrollStatus.PROCESSED).length,
    paid: payslips.filter((p) => p.status === PayrollStatus.PAID).length,
    draft: payslips.filter((p) => p.status === PayrollStatus.DRAFT).length,
  };

  return {
    summary,
    payslips: payslips.map((p) => ({
      ...p,
      baseSalary: toNumber(p.baseSalary),
      regularPay: toNumber(p.regularPay),
      overtimeHours: toNumber(p.overtimeHours),
      overtimePay: toNumber(p.overtimePay),
      allowancesTotal: toNumber((p as any).allowancesTotal),
      yearlyBonus: toNumber((p as any).yearlyBonus),
      grossPay: toNumber(p.grossPay),
      deductions: toNumber(p.deductions),
      netPay: toNumber(p.netPay),
    })),
  };
}

export async function updatePayslipStatus(
  companyId: string,
  payslipId: string,
  status: PayrollStatus,
) {
  const existing = await prisma.payrollRecord.findFirst({
    where: { id: payslipId, companyId },
  });
  if (!existing) throw new HttpError(404, "Payslip not found");

  const data: Prisma.PayrollRecordUpdateInput = { status };
  const now = new Date();
  if (status === PayrollStatus.PAID) {
    data.paidAt = now;
    data.processedAt = existing.processedAt ?? now;
  } else if (status === PayrollStatus.PROCESSED) {
    data.processedAt = now;
    data.paidAt = null;
  } else {
    data.paidAt = null;
  }

  const updated = await prisma.payrollRecord.update({
    where: { id: payslipId },
    data,
    select: payslipSelect,
  });
  return {
    ...updated,
    baseSalary: toNumber(updated.baseSalary),
    regularPay: toNumber(updated.regularPay),
    overtimeHours: toNumber(updated.overtimeHours),
    overtimePay: toNumber(updated.overtimePay),
    allowancesTotal: toNumber((updated as any).allowancesTotal),
    yearlyBonus: toNumber((updated as any).yearlyBonus),
    grossPay: toNumber(updated.grossPay),
    deductions: toNumber(updated.deductions),
    netPay: toNumber(updated.netPay),
  };
}

// --- Leaderboard / scoreboard (company-wide, based on attendance & punctuality) ---
const LB_WORK_START_HOUR = 9;
const LB_LATE_GRACE_MINUTES = 15;

function lbStartOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function lbIsLate(clockIn: Date | null, day: Date) {
  if (!clockIn) return false;
  const threshold = new Date(day);
  threshold.setUTCHours(LB_WORK_START_HOUR, LB_LATE_GRACE_MINUTES, 0, 0);
  return clockIn.getTime() > threshold.getTime();
}

export async function getLeaderboard(companyId: string, viewerUserId: string) {
  const today = lbStartOfDayUtc(new Date());
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 29); // last 30 days inclusive

  const employees = await prisma.user.findMany({
    where: { companyId, status: { not: EmployeeStatus.TERMINATED } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      status: true,
      department: { select: { id: true, name: true } },
    },
  });

  const logs = await prisma.attendanceLog.findMany({
    where: { companyId, date: { gte: since, lte: today } },
    select: { employeeId: true, date: true, clockIn: true, clockOut: true },
  });

  const byEmp = new Map<string, { onTime: number; late: number; present: number; totalHours: number }>();
  for (const e of employees) byEmp.set(e.id, { onTime: 0, late: 0, present: 0, totalHours: 0 });
  for (const log of logs) {
    const agg = byEmp.get(log.employeeId);
    if (!agg) continue;
    if (log.clockIn) {
      agg.present += 1;
      const day = lbStartOfDayUtc(new Date(log.date));
      if (lbIsLate(log.clockIn, day)) agg.late += 1; else agg.onTime += 1;
      if (log.clockOut) {
        agg.totalHours += Math.max(0, (log.clockOut.getTime() - log.clockIn.getTime()) / 3600000);
      }
    }
  }

  const rows = employees.map((e) => {
    const a = byEmp.get(e.id)!;
    const punctualityRate = a.present > 0 ? round2((a.onTime / a.present) * 100) : 0;
    // Score: rewards on-time attendance and presence (punctuality/attendance metrics)
    const score = a.onTime * 10 + a.present * 3 - a.late * 2;
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      title: e.title,
      department: e.department,
      status: e.status,
      score,
      punctualityRate,
      onTimeDays: a.onTime,
      lateDays: a.late,
      presentDays: a.present,
      totalHours: round2(a.totalHours),
    };
  });

  rows.sort((x, y) => y.score - x.score || y.punctualityRate - x.punctualityRate || x.name.localeCompare(y.name));
  const leaderboard = rows.map((r, i) => ({ rank: i + 1, ...r }));
  const me = leaderboard.find((r) => r.employeeId === viewerUserId) || null;

  return {
    period: { from: since.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10), days: 30 },
    metrics: ["punctuality (on-time clock-ins)", "attendance (days present)", "hours logged"],
    leaderboard,
    myRank: me ? { rank: me.rank, score: me.score, punctualityRate: me.punctualityRate } : null,
  };
}
