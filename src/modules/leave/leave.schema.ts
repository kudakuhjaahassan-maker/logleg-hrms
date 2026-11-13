import { z } from "zod";
import { LeaveRequestStatus, LeaveType } from "@prisma/client";

export const createLeaveSchema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(2000).optional().nullable(),
}).refine((d) => d.endDate >= d.startDate, {
  message: "endDate must be on or after startDate",
  path: ["endDate"],
});

export const listLeavesQuerySchema = z.object({
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  mine: z.coerce.boolean().optional(),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
