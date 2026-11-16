import { z } from "zod";

export const dailyAttendanceQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type DailyAttendanceQuery = z.infer<typeof dailyAttendanceQuerySchema>;

/** Optional device location sent with clock-in for geofence verification. */
export const clockInBodySchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .default({});

export type ClockInBody = z.infer<typeof clockInBodySchema>;
