import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import { createDepartmentSchema, updateDepartmentSchema } from "./department.schema";
import * as departmentService from "./department.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function list(req: Request, res: Response) {
  const companyId = req.auth!.companyId;
  const departments = await departmentService.listDepartments(companyId);
  res.json({ departments });
}

export async function create(req: Request, res: Response) {
  const companyId = req.auth!.companyId;
  const input = parse(createDepartmentSchema, req.body);
  const department = await departmentService.createDepartment(companyId, input);
  res.status(201).json({ department });
}

export async function update(req: Request, res: Response) {
  const companyId = req.auth!.companyId;
  const input = parse(updateDepartmentSchema, req.body);
  const department = await departmentService.updateDepartment(
    companyId,
    String(req.params.id),
    input,
  );
  res.json({ department });
}

export async function remove(req: Request, res: Response) {
  const companyId = req.auth!.companyId;
  const result = await departmentService.deleteDepartment(companyId, String(req.params.id));
  res.json(result);
}
