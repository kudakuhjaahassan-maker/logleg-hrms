import type { Request, Response } from "express";
import { ZodError } from "zod";
import { LeaveRequestStatus } from "@prisma/client";
import { HttpError } from "../../utils/http";
import { createLeaveSchema, listLeavesQuerySchema, reviewLeaveSchema } from "./leave.schema";
import * as leaveService from "./leave.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function create(req: Request, res: Response) {
  const input = parse(createLeaveSchema, req.body);
  const leave = await leaveService.createLeave(req.auth!.companyId, req.auth!.userId, input);
  res.status(201).json({ leaveRequest: leave });
}

export async function list(req: Request, res: Response) {
  const query = parse(listLeavesQuerySchema, req.query);
  const leaves = await leaveService.listLeaves(
    req.auth!.companyId,
    { userId: req.auth!.userId, role: req.auth!.role },
    { status: query.status as LeaveRequestStatus | undefined, mine: query.mine },
  );
  res.json({ leaveRequests: leaves });
}

export async function pending(req: Request, res: Response) {
  const leaves = await leaveService.listPendingForApproval(
    req.auth!.companyId,
    { userId: req.auth!.userId, role: req.auth!.role },
  );
  res.json({ leaveRequests: leaves });
}

export async function review(req: Request, res: Response) {
  const input = parse(reviewLeaveSchema, req.body);
  const leave = await leaveService.reviewLeave(
    req.auth!.companyId,
    String(req.params.id),
    { userId: req.auth!.userId, role: req.auth!.role },
    input,
  );
  res.json({ leaveRequest: leave });
}
