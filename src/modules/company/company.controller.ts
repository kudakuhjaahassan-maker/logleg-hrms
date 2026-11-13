import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import { updateCompanySettingsSchema } from "./company.schema";
import * as companyService from "./company.service";

function parse<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) throw new HttpError(400, "Validation failed", e.flatten());
    throw e;
  }
}

export async function get(req: Request, res: Response) {
  const company = await companyService.getCompany(req.auth!.companyId);
  res.json({ company });
}

export async function updateSettings(req: Request, res: Response) {
  const input = parse(updateCompanySettingsSchema, req.body);
  const company = await companyService.updateCompanySettings(req.auth!.companyId, input);
  res.json({ company });
}
