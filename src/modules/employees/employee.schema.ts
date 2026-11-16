import { z } from "zod";
import { EmployeeStatus, UserRole } from "@prisma/client";

export const listEmployeesQuerySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const shiftTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Shift time must be HH:MM (24-hour)");

const employeeBaseSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  title: z.string().max(120).optional().nullable(),
  role: z.nativeEnum(UserRole).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  hireDate: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  documents: z.array(z.record(z.any())).optional(),
  // Compensation
  baseSalary: z.coerce.number().min(0).optional(),
  currencySymbol: z.string().min(1).max(10).optional(),
  standardHoursPerDay: z.coerce.number().min(0).max(24).optional(),
  overtimeHourlyRate: z.coerce.number().min(0).optional(),
  payslipGenerationDay: z.coerce.number().int().min(1).max(31).optional(),
  // Allowances & bonuses (togglable)
  foodAllowanceEnabled: z.boolean().optional(),
  foodAllowanceAmount: z.coerce.number().min(0).optional(),
  accommodationAllowanceEnabled: z.boolean().optional(),
  accommodationAllowanceAmount: z.coerce.number().min(0).optional(),
  punctualityAllowanceEnabled: z.boolean().optional(),
  punctualityAllowanceAmount: z.coerce.number().min(0).optional(),
  uniformAllowanceEnabled: z.boolean().optional(),
  uniformAllowanceAmount: z.coerce.number().min(0).optional(),
  transportPhoneAllowanceEnabled: z.boolean().optional(),
  transportPhoneAllowanceAmount: z.coerce.number().min(0).optional(),
  ramadanAllowanceEnabled: z.boolean().optional(),
  ramadanAllowanceAmount: z.coerce.number().min(0).optional(),
  yearlyBonusEnabled: z.boolean().optional(),
  yearlyBonusAmount: z.coerce.number().min(0).optional(),
  yearlyBonusCriteria: z.string().max(2000).optional().nullable(),
  // Attendance: geofence override and shift window
  customRadiusMeters: z.coerce.number().int().min(0).max(500).optional().nullable(),
  shiftStartTime: shiftTime.optional(),
  shiftEndTime: shiftTime.optional(),
});

export const createEmployeeSchema = employeeBaseSchema.extend({
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
});

export const updateEmployeeSchema = employeeBaseSchema.extend({
  password: z.string().min(8).max(128).optional(),
}).partial().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
