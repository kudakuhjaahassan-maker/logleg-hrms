import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { HttpError } from "../utils/http";

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new HttpError(401, "Authentication required"));
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return next(new HttpError(403, "Insufficient permissions"));
    }
    return next();
  };
}

/// Helper: SUPER_ADMIN can operate across tenants when explicitly intended;
/// all other roles must be scoped to req.auth.companyId.
export function resolveTenantScope(req: Request, requestedCompanyId?: string): string {
  if (!req.auth) {
    throw new HttpError(401, "Authentication required");
  }
  if (req.auth.role === "SUPER_ADMIN" && requestedCompanyId) {
    return requestedCompanyId;
  }
  if (requestedCompanyId && requestedCompanyId !== req.auth.companyId) {
    throw new HttpError(403, "Cannot access another company's resources");
  }
  return req.auth.companyId;
}
