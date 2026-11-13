import { LeaveRequestStatus, Prisma, UserRole } from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import type { CreateLeaveInput, ReviewLeaveInput } from "./leave.schema";

const leaveSelect = {
  id: true,
  companyId: true,
  employeeId: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  status: true,
  reason: true,
  reviewedBy: true,
  reviewedAt: true,
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
} satisfies Prisma.LeaveRequestSelect;

function canManageLeaves(role: UserRole) {
  return role === "MANAGER" || role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

export async function createLeave(companyId: string, employeeId: string, input: CreateLeaveInput) {
  return prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason ?? null,
      status: LeaveRequestStatus.PENDING,
    },
    select: leaveSelect,
  });
}

export async function listLeaves(
  companyId: string,
  viewer: { userId: string; role: UserRole },
  opts: { status?: LeaveRequestStatus; mine?: boolean },
) {
  const where: Prisma.LeaveRequestWhereInput = { companyId };

  if (opts.mine || !canManageLeaves(viewer.role)) {
    where.employeeId = viewer.userId;
  }
  if (opts.status) where.status = opts.status;

  return prisma.leaveRequest.findMany({
    where,
    select: leaveSelect,
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function listPendingForApproval(companyId: string, viewer: { userId: string; role: UserRole }) {
  if (!canManageLeaves(viewer.role)) {
    throw new HttpError(403, "Only managers and HR admins can view pending approvals");
  }
  return prisma.leaveRequest.findMany({
    where: { companyId, status: LeaveRequestStatus.PENDING },
    select: leaveSelect,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function reviewLeave(
  companyId: string,
  leaveId: string,
  reviewer: { userId: string; role: UserRole },
  input: ReviewLeaveInput,
) {
  if (!canManageLeaves(reviewer.role)) {
    throw new HttpError(403, "Only managers and HR admins can review leave requests");
  }

  const existing = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, companyId },
    select: { id: true, status: true },
  });
  if (!existing) throw new HttpError(404, "Leave request not found");
  if (existing.status !== LeaveRequestStatus.PENDING) {
    throw new HttpError(400, "Only pending leave requests can be reviewed");
  }

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status: input.status as LeaveRequestStatus,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
    select: leaveSelect,
  });
}
