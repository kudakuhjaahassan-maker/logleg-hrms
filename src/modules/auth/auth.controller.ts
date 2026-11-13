import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import {
  forgotPasswordSchema,
  loginSchema,
  registerCompanySchema,
  resetPasswordSchema,
  updateMyAccountSchema,
} from "./auth.schema";
import * as authService from "./auth.service";

function parseOrThrow<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, "Validation failed", error.flatten());
    }
    throw error;
  }
}

export async function registerCompany(req: Request, res: Response) {
  const input = parseOrThrow(registerCompanySchema, req.body);
  const result = await authService.registerCompany(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = parseOrThrow(loginSchema, req.body);
  const result = await authService.login(input);
  res.json(result);
}

export async function forgotPassword(req: Request, res: Response) {
  const input = parseOrThrow(forgotPasswordSchema, req.body);
  // Prefer the browser origin so the emailed link points at the tenant's own deployment.
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const result = await authService.requestPasswordReset(input, origin);
  res.json(result);
}

export async function resetPassword(req: Request, res: Response) {
  const input = parseOrThrow(resetPasswordSchema, req.body);
  const result = await authService.resetPassword(input);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  if (!req.auth) {
    throw new HttpError(401, "Authentication required");
  }
  const user = await authService.getCurrentUser(req.auth.userId, req.auth.companyId);
  res.json({ user });
}

export async function updateMe(req: Request, res: Response) {
  if (!req.auth) {
    throw new HttpError(401, "Authentication required");
  }
  const input = parseOrThrow(updateMyAccountSchema, req.body);
  const user = await authService.updateMyAccount(req.auth.userId, req.auth.companyId, input);
  res.json({ user });
}
