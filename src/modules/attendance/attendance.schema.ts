import { z } from "zod";

export const dailyAttendanceQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type DailyAttendanceQuery = z.infer<typeof dailyAttendanceQuerySchema>;
