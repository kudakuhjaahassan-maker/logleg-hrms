import type { NextFunction, Request, Response } from "express";
import { EmployeeStatus, UserRole } from "@prisma/client";
import prisma from "../lib/prisma";
import { HttpError } from "../utils/http";
import { verifyAccessToken } from "../utils/jwt";

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing or invalid Authorization header");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);

    // Always re-load the user to enforce tenant scope and current account status.
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      throw new HttpError(401, "Invalid or expired session");
    }
    if (user.status !== EmployeeStatus.ACTIVE) {
      throw new HttpError(403, "Account is not active");
    }

    req.auth = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, "Invalid or expired token"));
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.auth?.role;
    if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
      throw new HttpError(403, "You do not have permission to perform this action");
    }
    next();
  };
}
