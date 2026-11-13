import { z } from "zod";
import { PayrollStatus } from "@prisma/client";

export const listPayslipsQuerySchema = z.object({
  status: z.nativeEnum(PayrollStatus).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const updatePayslipStatusSchema = z.object({
  status: z.nativeEnum(PayrollStatus),
});

export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
export type UpdatePayslipStatusInput = z.infer<typeof updatePayslipStatusSchema>;
