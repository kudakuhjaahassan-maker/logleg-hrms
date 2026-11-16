import { Prisma, type EmployeeStatus, type UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import { hashPassword } from "../../utils/password";
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from "./employee.schema";

const employeeSelect = {
  id: true,
  companyId: true,
  email: true,
  firstName: true,
  lastName: true,
  title: true,
  role: true,
  departmentId: true,
  managerId: true,
  phone: true,
  hireDate: true,
  status: true,
  documents: true,
  baseSalary: true,
  currencySymbol: true,
  standardHoursPerDay: true,
  overtimeHourlyRate: true,
  payslipGenerationDay: true,
  foodAllowanceEnabled: true,
  foodAllowanceAmount: true,
  accommodationAllowanceEnabled: true,
  accommodationAllowanceAmount: true,
  punctualityAllowanceEnabled: true,
  punctualityAllowanceAmount: true,
  uniformAllowanceEnabled: true,
  uniformAllowanceAmount: true,
  transportPhoneAllowanceEnabled: true,
  transportPhoneAllowanceAmount: true,
  ramadanAllowanceEnabled: true,
  ramadanAllowanceAmount: true,
  yearlyBonusEnabled: true,
  yearlyBonusAmount: true,
  yearlyBonusCriteria: true,
  customRadiusMeters: true,
  shiftStartTime: true,
  shiftEndTime: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, email: true, title: true } },
} satisfies Prisma.UserSelect;

async function assertDepartmentInCompany(companyId: string, departmentId: string | null | undefined) {
  if (!departmentId) return;
  const dept = await prisma.department.findFirst({ where: { id: departmentId, companyId } });
  if (!dept) throw new HttpError(400, "Department does not belong to this company");
}

async function assertManagerInCompany(
  companyId: string,
  managerId: string | null | undefined,
  employeeId?: string,
) {
  if (!managerId) return;
  if (employeeId && managerId === employeeId) {
    throw new HttpError(400, "Employee cannot be their own manager");
  }
  const manager = await prisma.user.findFirst({ where: { id: managerId, companyId } });
  if (!manager) throw new HttpError(400, "Manager does not belong to this company");
}

export async function listEmployees(companyId: string, query: ListEmployeesQuery) {
  const where: Prisma.UserWhereInput = { companyId };
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.status) where.status = query.status;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { firstName: { contains: s, mode: "insensitive" } },
        { lastName: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { title: { contains: s, mode: "insensitive" } },
        { department: { name: { contains: s, mode: "insensitive" } } },
      ];
    }
  }

  const [total, employees] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    employees,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getEmployeeProfile(
  companyId: string,
  employeeId: string,
  viewer: { userId: string; role: UserRole },
) {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId },
    select: employeeSelect,
  });
  if (!employee) throw new HttpError(404, "Employee not found");

  const isSelf = viewer.userId === employeeId;
  const isHrOrAdmin = viewer.role === "HR_ADMIN" || viewer.role === "SUPER_ADMIN";
  const isManager = viewer.role === "MANAGER";

  // Employees can view their own full profile; HR/Admin can view anyone.
  // Managers can view directory-level profiles in their tenant (no sensitive docs/history unless HR).
  if (!isSelf && !isHrOrAdmin && !isManager) {
    throw new HttpError(403, "Insufficient permissions to view this profile");
  }

  const canViewSensitive = isSelf || isHrOrAdmin;

  let history: { leaveRequests: any[]; attendanceLogs: any[]; payrollRecords: any[] } | null = null;
  if (canViewSensitive) {
    const [leaveRequests, attendanceLogs, payrollRecords] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { companyId, employeeId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.attendanceLog.findMany({
        where: { companyId, employeeId },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.payrollRecord.findMany({
        where: { companyId, employeeId },
        orderBy: [{ payPeriodYear: "desc" }, { payPeriodMonth: "desc" }],
        take: 24,
      }),
    ]);
    history = { leaveRequests, attendanceLogs, payrollRecords };
  }

  const safeEmployee = canViewSensitive
    ? employee
    : {
        ...employee,
        documents: [],
        baseSalary: null,
        currencySymbol: null,
        standardHoursPerDay: null,
        overtimeHourlyRate: null,
        payslipGenerationDay: null,
        foodAllowanceEnabled: null,
        foodAllowanceAmount: null,
        accommodationAllowanceEnabled: null,
        accommodationAllowanceAmount: null,
        punctualityAllowanceEnabled: null,
        punctualityAllowanceAmount: null,
        uniformAllowanceEnabled: null,
        uniformAllowanceAmount: null,
        transportPhoneAllowanceEnabled: null,
        transportPhoneAllowanceAmount: null,
        ramadanAllowanceEnabled: null,
        ramadanAllowanceAmount: null,
        yearlyBonusEnabled: null,
        yearlyBonusAmount: null,
        yearlyBonusCriteria: null,
      };

  return {
    employee: safeEmployee,
    history,
    permissions: {
      canEdit: isHrOrAdmin,
      canViewDocuments: canViewSensitive,
      canViewHistory: canViewSensitive,
      canViewCompensation: canViewSensitive,
    },
  };
}

export async function createEmployee(companyId: string, input: CreateEmployeeInput) {
  await assertDepartmentInCompany(companyId, input.departmentId ?? null);
  await assertManagerInCompany(companyId, input.managerId ?? null);

  const passwordHash = await hashPassword(input.password);
  try {
    const employee = await prisma.user.create({
      data: {
        companyId,
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title ?? null,
        role: input.role,
        departmentId: input.departmentId ?? null,
        managerId: input.managerId ?? null,
        phone: input.phone ?? null,
        hireDate: input.hireDate ?? null,
        status: input.status,
        documents: (input.documents ?? []) as Prisma.InputJsonValue,
        baseSalary: input.baseSalary !== undefined ? new Prisma.Decimal(input.baseSalary) : undefined,
        currencySymbol: input.currencySymbol,
        standardHoursPerDay:
          input.standardHoursPerDay !== undefined ? new Prisma.Decimal(input.standardHoursPerDay) : undefined,
        overtimeHourlyRate:
          input.overtimeHourlyRate !== undefined ? new Prisma.Decimal(input.overtimeHourlyRate) : undefined,
        payslipGenerationDay: input.payslipGenerationDay,
        foodAllowanceEnabled: input.foodAllowanceEnabled,
        foodAllowanceAmount:
          input.foodAllowanceAmount !== undefined ? new Prisma.Decimal(input.foodAllowanceAmount) : undefined,
        accommodationAllowanceEnabled: input.accommodationAllowanceEnabled,
        accommodationAllowanceAmount:
          input.accommodationAllowanceAmount !== undefined ? new Prisma.Decimal(input.accommodationAllowanceAmount) : undefined,
        punctualityAllowanceEnabled: input.punctualityAllowanceEnabled,
        punctualityAllowanceAmount:
          input.punctualityAllowanceAmount !== undefined ? new Prisma.Decimal(input.punctualityAllowanceAmount) : undefined,
        uniformAllowanceEnabled: input.uniformAllowanceEnabled,
        uniformAllowanceAmount:
          input.uniformAllowanceAmount !== undefined ? new Prisma.Decimal(input.uniformAllowanceAmount) : undefined,
        transportPhoneAllowanceEnabled: input.transportPhoneAllowanceEnabled,
        transportPhoneAllowanceAmount:
          input.transportPhoneAllowanceAmount !== undefined ? new Prisma.Decimal(input.transportPhoneAllowanceAmount) : undefined,
        ramadanAllowanceEnabled: input.ramadanAllowanceEnabled,
        ramadanAllowanceAmount:
          input.ramadanAllowanceAmount !== undefined ? new Prisma.Decimal(input.ramadanAllowanceAmount) : undefined,
        yearlyBonusEnabled: input.yearlyBonusEnabled,
        yearlyBonusAmount:
          input.yearlyBonusAmount !== undefined ? new Prisma.Decimal(input.yearlyBonusAmount) : undefined,
        yearlyBonusCriteria: input.yearlyBonusCriteria,
        customRadiusMeters: input.customRadiusMeters ? input.customRadiusMeters : null,
        shiftStartTime: input.shiftStartTime,
        shiftEndTime: input.shiftEndTime,
      },
      select: employeeSelect,
    });
    return employee;
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new HttpError(409, "An employee with this email already exists in this company");
    }
    throw error;
  }
}

export async function updateEmployee(
  companyId: string,
  employeeId: string,
  input: UpdateEmployeeInput,
) {
  const existing = await prisma.user.findFirst({ where: { id: employeeId, companyId } });
  if (!existing) throw new HttpError(404, "Employee not found");

  if (input.departmentId !== undefined) {
    await assertDepartmentInCompany(companyId, input.departmentId);
  }
  if (input.managerId !== undefined) {
    await assertManagerInCompany(companyId, input.managerId, employeeId);
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.title !== undefined) data.title = input.title;
  if (input.role !== undefined) data.role = input.role;
  if (input.departmentId !== undefined) {
    data.department = input.departmentId
      ? { connect: { id: input.departmentId } }
      : { disconnect: true };
  }
  if (input.managerId !== undefined) {
    data.manager = input.managerId
      ? { connect: { id: input.managerId } }
      : { disconnect: true };
  }
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.hireDate !== undefined) data.hireDate = input.hireDate;
  if (input.status !== undefined) data.status = input.status as EmployeeStatus;
  if (input.documents !== undefined) data.documents = input.documents as Prisma.InputJsonValue;
  if (input.baseSalary !== undefined) data.baseSalary = new Prisma.Decimal(input.baseSalary);
  if (input.currencySymbol !== undefined) data.currencySymbol = input.currencySymbol;
  if (input.standardHoursPerDay !== undefined)
    data.standardHoursPerDay = new Prisma.Decimal(input.standardHoursPerDay);
  if (input.overtimeHourlyRate !== undefined)
    data.overtimeHourlyRate = new Prisma.Decimal(input.overtimeHourlyRate);
  if (input.payslipGenerationDay !== undefined) data.payslipGenerationDay = input.payslipGenerationDay;

  if (input.foodAllowanceEnabled !== undefined) data.foodAllowanceEnabled = input.foodAllowanceEnabled;
  if (input.foodAllowanceAmount !== undefined) data.foodAllowanceAmount = new Prisma.Decimal(input.foodAllowanceAmount);
  if (input.accommodationAllowanceEnabled !== undefined) data.accommodationAllowanceEnabled = input.accommodationAllowanceEnabled;
  if (input.accommodationAllowanceAmount !== undefined) data.accommodationAllowanceAmount = new Prisma.Decimal(input.accommodationAllowanceAmount);
  if (input.punctualityAllowanceEnabled !== undefined) data.punctualityAllowanceEnabled = input.punctualityAllowanceEnabled;
  if (input.punctualityAllowanceAmount !== undefined) data.punctualityAllowanceAmount = new Prisma.Decimal(input.punctualityAllowanceAmount);
  if (input.uniformAllowanceEnabled !== undefined) data.uniformAllowanceEnabled = input.uniformAllowanceEnabled;
  if (input.uniformAllowanceAmount !== undefined) data.uniformAllowanceAmount = new Prisma.Decimal(input.uniformAllowanceAmount);
  if (input.transportPhoneAllowanceEnabled !== undefined) data.transportPhoneAllowanceEnabled = input.transportPhoneAllowanceEnabled;
  if (input.transportPhoneAllowanceAmount !== undefined) data.transportPhoneAllowanceAmount = new Prisma.Decimal(input.transportPhoneAllowanceAmount);
  if (input.ramadanAllowanceEnabled !== undefined) data.ramadanAllowanceEnabled = input.ramadanAllowanceEnabled;
  if (input.ramadanAllowanceAmount !== undefined) data.ramadanAllowanceAmount = new Prisma.Decimal(input.ramadanAllowanceAmount);
  if (input.yearlyBonusEnabled !== undefined) data.yearlyBonusEnabled = input.yearlyBonusEnabled;
  if (input.yearlyBonusAmount !== undefined) data.yearlyBonusAmount = new Prisma.Decimal(input.yearlyBonusAmount);
  if (input.yearlyBonusCriteria !== undefined) data.yearlyBonusCriteria = input.yearlyBonusCriteria;
  if (input.customRadiusMeters !== undefined)
    data.customRadiusMeters = input.customRadiusMeters ? input.customRadiusMeters : null;
  if (input.shiftStartTime !== undefined) data.shiftStartTime = input.shiftStartTime;
  if (input.shiftEndTime !== undefined) data.shiftEndTime = input.shiftEndTime;

  if (input.password) data.passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.update({
      where: { id: employeeId },
      data,
      select: employeeSelect,
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new HttpError(409, "An employee with this email already exists in this company");
    }
    throw error;
  }
}

type OrgNode = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: UserRole;
  status: EmployeeStatus;
  department: { id: string; name: string } | null;
  managerId: string | null;
  reports: OrgNode[];
};

export async function getOrgChart(companyId: string) {
  const employees = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      role: true,
      status: true,
      managerId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const nodes = new Map<string, OrgNode>();
  for (const e of employees) {
    nodes.set(e.id, {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      email: e.email,
      title: e.title,
      role: e.role,
      status: e.status,
      department: e.department,
      managerId: e.managerId,
      reports: [],
    });
  }

  const roots: OrgNode[] = [];
  for (const node of nodes.values()) {
    if (node.managerId && nodes.has(node.managerId)) {
      nodes.get(node.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (list: OrgNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of list) sortTree(n.reports);
  };
  sortTree(roots);

  return { roots, employeeCount: employees.length };
}
