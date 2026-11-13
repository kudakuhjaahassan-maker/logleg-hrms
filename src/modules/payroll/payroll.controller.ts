import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import { listPayslipsQuerySchema, updatePayslipStatusSchema } from "./payroll.schema";
import * as payrollService from "./payroll.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function myCompensation(req: Request, res: Response) {
  const result = await payrollService.getMyCompensation(req.auth!.companyId, req.auth!.userId);
  res.json(result);
}

export async function reviewList(req: Request, res: Response) {
  const query = parse(listPayslipsQuerySchema, req.query);
  const result = await payrollService.listPayslipsForReview(
    req.auth!.companyId,
    { userId: req.auth!.userId, role: req.auth!.role },
    { status: query.status, month: query.month, year: query.year },
  );
  res.json(result);
}

export async function generate(req: Request, res: Response) {
  const result = await payrollService.generateDuePayslipsForCompany(req.auth!.companyId);
  res.json({ message: "Payslip generation completed", ...result });
}

export async function updateStatus(req: Request, res: Response) {
  const input = parse(updatePayslipStatusSchema, req.body);
  const payslip = await payrollService.updatePayslipStatus(
    req.auth!.companyId,
    String(req.params.id),
    input.status,
  );
  res.json({ payslip });
}

export async function leaderboard(req: Request, res: Response) {
  const result = await payrollService.getLeaderboard(req.auth!.companyId, req.auth!.userId);
  res.json(result);
}
