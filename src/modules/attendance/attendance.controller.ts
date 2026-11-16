import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import { clockInBodySchema, dailyAttendanceQuerySchema } from "./attendance.schema";
import * as attendanceService from "./attendance.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function myToday(req: Request, res: Response) {
  const result = await attendanceService.getTodayStatus(req.auth!.companyId, req.auth!.userId);
  res.json(result);
}

export async function clockIn(req: Request, res: Response) {
  const body = parse(clockInBodySchema, req.body ?? {});
  const log = await attendanceService.clockIn(
    req.auth!.companyId,
    req.auth!.userId,
    body.latitude,
    body.longitude,
  );
  res.status(201).json({ log });
}

export async function clockOut(req: Request, res: Response) {
  const log = await attendanceService.clockOut(req.auth!.companyId, req.auth!.userId);
  res.json({ log });
}

export async function daily(req: Request, res: Response) {
  const query = parse(dailyAttendanceQuerySchema, req.query);
  const result = await attendanceService.getDailyLog(
    req.auth!.companyId,
    { userId: req.auth!.userId, role: req.auth!.role },
    query.date,
  );
  res.json(result);
}
