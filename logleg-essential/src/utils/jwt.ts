import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";

export interface AuthTokenPayload {
  sub: string; // user id
  companyId: string;
  role: UserRole;
  email: string;
}

export function signAccessToken(payload: AuthTokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret(), options);
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  const { sub, companyId, role, email } = decoded as Record<string, unknown>;
  if (
    typeof sub !== "string" ||
    typeof companyId !== "string" ||
    typeof role !== "string" ||
    typeof email !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return { sub, companyId, role: role as UserRole, email };
}
