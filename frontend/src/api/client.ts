export type Role = "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  role: Role;
  departmentId?: string | null;
  managerId?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  status: EmployeeStatus;
  documents?: any[];
  baseSalary?: number | string;
  currencySymbol?: string;
  standardHoursPerDay?: number | string;
  overtimeHourlyRate?: number | string;
  payslipGenerationDay?: number;
  foodAllowanceEnabled?: boolean | null;
  foodAllowanceAmount?: number | string | null;
  accommodationAllowanceEnabled?: boolean | null;
  accommodationAllowanceAmount?: number | string | null;
  punctualityAllowanceEnabled?: boolean | null;
  punctualityAllowanceAmount?: number | string | null;
  uniformAllowanceEnabled?: boolean | null;
  uniformAllowanceAmount?: number | string | null;
  transportPhoneAllowanceEnabled?: boolean | null;
  transportPhoneAllowanceAmount?: number | string | null;
  ramadanAllowanceEnabled?: boolean | null;
  ramadanAllowanceAmount?: number | string | null;
  yearlyBonusEnabled?: boolean | null;
  yearlyBonusAmount?: number | string | null;
  yearlyBonusCriteria?: string | null;
  customRadiusMeters?: number | null;
  shiftStartTime?: string;
  shiftEndTime?: string;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string } | null;
  manager?: { id: string; firstName: string; lastName: string; email: string; title?: string | null } | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  cardBgColor: string;
  sidebarTheme: "light" | "dark" | "brand";
  headingTextColor?: string;
  subTextColor?: string;
  defaultCurrency?: string;
  standardWorkHours?: number | string;
  overtimeMultiplier?: number | string;
  /** IANA timezone shift times are interpreted in, e.g. "Indian/Maldives". */
  timezone?: string;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  allowedRadiusMeters?: number;
  subscriptionPlan: string;
  subscriptionStatus?: string;
}

export interface AuthUser extends Employee {
  company?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    primaryColor?: string;
    cardBgColor?: string;
    sidebarTheme?: "light" | "dark" | "brand";
    headingTextColor?: string;
    subTextColor?: string;
    defaultCurrency?: string;
    standardWorkHours?: number | string;
    overtimeMultiplier?: number | string;
    timezone?: string;
    officeLatitude?: number | null;
    officeLongitude?: number | null;
    allowedRadiusMeters?: number;
    subscriptionPlan: string;
  };
}

export interface LoginResponse {
  accessToken: string;
  company: { id: string; slug: string; name: string };
  user: Employee;
}

export interface EmployeeListResponse {
  employees: Employee[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ProfileResponse {
  employee: Employee;
  history: {
    leaveRequests: any[];
    attendanceLogs: any[];
    payrollRecords: any[];
  } | null;
  permissions: { canEdit: boolean; canViewDocuments: boolean; canViewHistory: boolean; canViewCompensation?: boolean };
}

export interface OrgNode {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: Role;
  status: EmployeeStatus;
  department: { id: string; name: string } | null;
  managerId: string | null;
  reports: OrgNode[];
}

export type LeaveType = "ANNUAL" | "SICK" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    title?: string | null;
    department?: { id: string; name: string } | null;
  };
}

export interface AttendanceLog {
  id: string;
  companyId: string;
  employeeId: string;
  clockIn?: string | null;
  clockOut?: string | null;
  date: string;
  notes?: string | null;
  checkInDistanceMeters?: number | null;
  lateMinutes?: number;
  overtimeMinutes?: number;
  /** Null on rows logged before shift metrics existed (payroll re-derives those). */
  metricsComputedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceTodayResponse {
  date: string;
  log: AttendanceLog | null;
  workedMs: number;
  isClockedIn: boolean;
  shiftStartTime: string;
  shiftEndTime: string;
  lateMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  standardShiftTargetMinutes: number;
}

export type DailyAttendanceStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "LATE" | "ABSENT" | "ON_LEAVE";

export interface DailyAttendanceRow {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    title?: string | null;
    status: EmployeeStatus;
    shiftStartTime?: string;
    shiftEndTime?: string;
    customRadiusMeters?: number | null;
    department?: { id: string; name: string } | null;
  };
  log: AttendanceLog | null;
  attendanceStatus: DailyAttendanceStatus;
  workedMs: number;
  lateMinutes: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  standardShiftTargetMinutes: number;
}

export interface DailyAttendanceResponse {
  date: string;
  timeZone: string;
  summary: { total: number; clockedIn: number; clockedOut: number; late: number; absent: number; onLeave: number };
  rows: DailyAttendanceRow[];
  policy: {
    shiftBased: boolean;
    timeZone: string;
    defaultShiftStart: string;
    defaultShiftEnd: string;
    standardShiftTargetMinutes: number;
  };
}

export type PayrollStatus = "DRAFT" | "PROCESSED" | "PAID";

export interface AllowanceItem { key: string; label: string; amount: number; }

export interface Payslip {
  id: string;
  companyId: string;
  employeeId: string;
  baseSalary: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  allowancesTotal?: number;
  yearlyBonus?: number;
  allowancesBreakdown?: AllowanceItem[];
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  status: PayrollStatus;
  generatedAt?: string | null;
  processedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    title?: string | null;
    department?: { id: string; name: string } | null;
  };
}

export interface CurrentPeriodStats {
  year: number;
  month: number;
  baseSalary: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  allowancesTotal?: number;
  yearlyBonus?: number;
  allowancesBreakdown?: AllowanceItem[];
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  totalWorkedHours: number;
  regularHours: number;
  daysCounted: number;
}

export interface MyCompensationResponse {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    title?: string | null;
    baseSalary: number;
    currencySymbol: string;
    standardHoursPerDay: number;
    overtimeHourlyRate: number;
    payslipGenerationDay: number;
    status: EmployeeStatus;
    department?: { id: string; name: string } | null;
    foodAllowanceEnabled?: boolean; foodAllowanceAmount?: number;
    accommodationAllowanceEnabled?: boolean; accommodationAllowanceAmount?: number;
    punctualityAllowanceEnabled?: boolean; punctualityAllowanceAmount?: number;
    uniformAllowanceEnabled?: boolean; uniformAllowanceAmount?: number;
    transportPhoneAllowanceEnabled?: boolean; transportPhoneAllowanceAmount?: number;
    ramadanAllowanceEnabled?: boolean; ramadanAllowanceAmount?: number;
    yearlyBonusEnabled?: boolean; yearlyBonusAmount?: number; yearlyBonusCriteria?: string | null;
  };
  activeAllowances?: { allowancesTotal: number; yearlyBonus: number; breakdown: AllowanceItem[] };
  currentPeriod: CurrentPeriodStats;
  today: {
    date: string;
    workedHours: number;
    isClockedIn: boolean;
    clockIn?: string | null;
    clockOut?: string | null;
  };
  nextPayslipDate: string;
  payslips: Payslip[];
}

export interface LeaderboardEntry {
  rank: number;
  employeeId: string;
  name: string;
  title?: string | null;
  department?: { id: string; name: string } | null;
  status: EmployeeStatus;
  score: number;
  punctualityRate: number;
  onTimeDays: number;
  lateDays: number;
  presentDays: number;
  totalHours: number;
}
export interface LeaderboardResponse {
  period: { from: string; to: string; days: number };
  metrics: string[];
  leaderboard: LeaderboardEntry[];
  myRank: { rank: number; score: number; punctualityRate: number } | null;
}

export interface PayslipReviewResponse {
  summary: { total: number; processed: number; paid: number; draft: number };
  payslips: Payslip[];
}

export interface PendingSubscriptionInfo {
  id: string;
  email: string;
  tier: string;
  status: string;
  proofUrl?: string | null;
  referenceId?: string | null;
  refundAccountDetails?: string | null;
  createdAt?: string;
  companyName?: string;
}

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getToken() {
  return localStorage.getItem("logleg_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.message || "Request failed";
    throw new ApiError(res.status, message, data?.error?.details);
  }
  return data as T;
}

export interface RegisterCompanyResponse {
  company: { id: string; name: string; slug: string };
  admin: { id: string; email: string; firstName: string; lastName: string; role: Role };
  accessToken: string;
}

export const api = {
  login: (body: { email: string; password: string; companySlug?: string; companyId?: string }) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  registerCompany: (body: {
    company: { name: string; slug: string; domain?: string };
    admin: { email: string; password: string; firstName: string; lastName: string; phone?: string };
  }) => request<RegisterCompanyResponse>("/auth/register-company", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  forgotPassword: (body: { email: string; companySlug: string }) =>
    request<{ message: string; resetUrl?: string; emailDelivered?: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resetPassword: (body: { token: string; newPassword: string }) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getCompany: () => request<{ company: Company }>("/company"),
  updateCompanySettings: (body: {
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    cardBgColor?: string;
    sidebarTheme?: "light" | "dark" | "brand";
    headingTextColor?: string;
    subTextColor?: string;
    timezone?: string;
    officeLatitude?: number | null;
    officeLongitude?: number | null;
    allowedRadiusMeters?: number;
  }) =>
    request<{ company: Company }>("/company/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  updatePayrollConfig: (
    body: Partial<{
      defaultCurrency: string;
      standardWorkHours: number;
      overtimeMultiplier: number;
      timezone: string;
      officeLatitude: number | null;
      officeLongitude: number | null;
      allowedRadiusMeters: number;
    }>,
  ) =>
    request<{ company: Company }>("/payroll-config", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getPayrollConfig: () =>
    request<{
      defaultCurrency: string;
      standardWorkHours: number;
      overtimeMultiplier: number;
      timezone: string;
      officeLatitude: number | null;
      officeLongitude: number | null;
      allowedRadiusMeters: number;
    }>("/payroll-config"),

  listDepartments: () => request<{ departments: Department[] }>("/departments"),
  createDepartment: (body: { name: string }) =>
    request<{ department: Department }>("/departments", { method: "POST", body: JSON.stringify(body) }),

  listEmployees: (params: { search?: string; departmentId?: string; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<EmployeeListResponse>(`/employees${q ? `?${q}` : ""}`);
  },
  getEmployee: (id: string) => request<ProfileResponse>(`/employees/${id}`),
  createEmployee: (body: any) =>
    request<{ employee: Employee }>("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: any) =>
    request<{ employee: Employee }>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  getOrgChart: () => request<{ roots: OrgNode[]; employeeCount: number }>("/employees/org-chart"),

  createLeave: (body: { leaveType: LeaveType; startDate: string; endDate: string; reason?: string }) =>
    request<{ leaveRequest: LeaveRequest }>("/leaves", { method: "POST", body: JSON.stringify(body) }),
  listLeaves: (params?: { status?: string; mine?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.mine !== undefined) qs.set("mine", String(params.mine));
    const q = qs.toString();
    return request<{ leaveRequests: LeaveRequest[] }>(`/leaves${q ? `?${q}` : ""}`);
  },
  listPendingLeaves: () => request<{ leaveRequests: LeaveRequest[] }>("/leaves/pending"),
  reviewLeave: (id: string, status: "APPROVED" | "REJECTED") =>
    request<{ leaveRequest: LeaveRequest }>(`/leaves/${id}/review`, { method: "PATCH", body: JSON.stringify({ status }) }),

  attendanceToday: () => request<AttendanceTodayResponse>("/attendance/today"),
  clockIn: (location?: { latitude: number; longitude: number }) =>
    request<{ log: AttendanceLog }>("/attendance/clock-in", {
      method: "POST",
      body: location ? JSON.stringify(location) : undefined,
    }),
  clockOut: () => request<{ log: AttendanceLog }>("/attendance/clock-out", { method: "POST" }),
  dailyAttendance: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<DailyAttendanceResponse>(`/attendance/daily${qs}`);
  },

  myCompensation: () => request<MyCompensationResponse>("/payroll/me"),
  getLeaderboard: () => request<LeaderboardResponse>("/payroll/leaderboard"),
  listPayslips: (params?: { status?: string; month?: number; year?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.month) qs.set("month", String(params.month));
    if (params?.year) qs.set("year", String(params.year));
    const q = qs.toString();
    return request<PayslipReviewResponse>(`/payroll/payslips${q ? `?${q}` : ""}`);
  },
  generatePayslips: () => request<{ message: string; period: { year: number; month: number }; generated: number }>(
    "/payroll/generate",
    { method: "POST" },
  ),
  updatePayslipStatus: (id: string, status: PayrollStatus) =>
    request<{ payslip: Payslip }>(`/payroll/payslips/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  updateMyAccount: (data: { email?: string; newPassword?: string; currentPassword: string }) =>
    request<{ user: AuthUser }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  subscriptionsCreatePending: (body: { userId: string; email: string; tier: string }) =>
    request<{ id: string; email: string; tier: string; status: string }>("/subscriptions/pending", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  subscriptionsRequest: (body: { tier: string; proofUrl?: string; referenceId?: string }) =>
    request<{ request: PendingSubscriptionInfo }>("/subscriptions/request", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  subscriptionsMyStatus: () => request<{ request: PendingSubscriptionInfo | null }>("/subscriptions/my-status"),
  subscriptionsListPending: () =>
    request<{ requests: PendingSubscriptionInfo[] }>("/subscriptions/pending"),
  subscriptionsApprove: (requestId: string) =>
    request<{ id: string }>("/subscriptions/approve", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    }),
  subscriptionsReject: (requestId: string) =>
    request<{ id: string }>("/subscriptions/reject", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    }),
  subscriptionsCancelPending: (body: { requestId?: string; refundAccountDetails?: string }) =>
    request<{ id: string; status: string }>("/subscriptions/cancel-pending", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  subscriptionsRequestRefund: (body: { requestId: string; refundAccountDetails: string }) =>
    request<{ id: string; status: string }>("/subscriptions/request-refund", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
