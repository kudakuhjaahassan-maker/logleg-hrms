import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "./employee.schema";
import * as employeeService from "./employee.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function list(req: Request, res: Response) {
  const query = parse(listEmployeesQuerySchema, req.query);
  const result = await employeeService.listEmployees(req.auth!.companyId, query);
  res.json(result);
}

export async function getProfile(req: Request, res: Response) {
  const result = await employeeService.getEmployeeProfile(
    req.auth!.companyId,
    String(req.params.id),
    { userId: req.auth!.userId, role: req.auth!.role },
  );
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = parse(createEmployeeSchema, req.body);
  const employee = await employeeService.createEmployee(req.auth!.companyId, input);
  res.status(201).json({ employee });
}

export async function update(req: Request, res: Response) {
  const input = parse(updateEmployeeSchema, req.body);
  const employee = await employeeService.updateEmployee(
    req,
    req.auth!.companyId,
    String(req.params.id),
    input,
  );
  res.json({ employee });
}

export async function orgChart(req: Request, res: Response) {
  const result = await employeeService.getOrgChart(req.auth!.companyId);
  res.json(result);
}
