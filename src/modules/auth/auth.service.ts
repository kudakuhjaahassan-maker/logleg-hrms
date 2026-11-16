import { createHash, randomBytes } from "node:crypto";
import {
  EmployeeStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken } from "../../utils/jwt";
import { sendMail } from "../../lib/mailer";
import { isProduction } from "../../config/env";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterCompanyInput,
  ResetPasswordInput,
  UpdateMyAccountInput,
} from "./auth.schema";

function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

export async function registerCompany(input: RegisterCompanyInput) {
  const existingCompany = await prisma.company.findFirst({
    where: {
      OR: [
        { slug: input.company.slug },
        ...(input.company.domain ? [{ domain: input.company.domain }] : []),
      ],
    },
    select: { id: true },
  });
  if (existingCompany) {
    throw new HttpError(409, "Company slug or domain is already in use");
  }

  const passwordHash = await hashPassword(input.admin.password);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.company.name,
        slug: input.company.slug,
        domain: input.company.domain,
        settings: input.company.settings ?? {},
        subscriptionPlan: SubscriptionPlan.FREE,
        subscriptionStatus: SubscriptionStatus.TRIALING,
      },
    });

    // Bootstrap the tenant with an HR admin who can manage the company.
    const adminUser = await tx.user.create({
      data: {
        companyId: company.id,
        email: input.admin.email.toLowerCase(),
        passwordHash,
        firstName: input.admin.firstName,
        lastName: input.admin.lastName,
        phone: input.admin.phone,
        role: UserRole.HR_ADMIN,
        status: EmployeeStatus.ACTIVE,
      },
    });

    return { company, adminUser };
  });

  const accessToken = signAccessToken({
    sub: result.adminUser.id,
    companyId: result.company.id,
    role: result.adminUser.role,
    email: result.adminUser.email,
  });

  return {
    company: result.company,
    user: sanitizeUser(result.adminUser),
    accessToken,
  };
}

export async function login(input: LoginInput) {
  const company = await prisma.company.findFirst({
    where: input.companyId
      ? { id: input.companyId }
      : { slug: input.companySlug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      cardBgColor: true,
      sidebarTheme: true,
      headingTextColor: true,
      subTextColor: true,
    },
  });
  if (!company) {
    throw new HttpError(401, "Invalid credentials");
  }

  const user = await prisma.user.findFirst({
    where: {
      companyId: company.id,
      email: input.email.toLowerCase(),
    },
  });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }
  if (user.status !== EmployeeStatus.ACTIVE) {
    throw new HttpError(403, "Account is not active");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid credentials");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
  });

  return {
    accessToken,
    company,
    user: sanitizeUser(user),
  };
}

export async function getCurrentUser(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          cardBgColor: true,
          sidebarTheme: true,
          headingTextColor: true,
          subTextColor: true,
          defaultCurrency: true,
          standardWorkHours: true,
          overtimeMultiplier: true,
          timezone: true,
          officeLatitude: true,
          officeLongitude: true,
          allowedRadiusMeters: true,
          subscriptionPlan: true,
        },
      },
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  return sanitizeUser(user);
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(origin?: string) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/**
 * Starts a self-service password reset. Always answers generically so the
 * endpoint cannot be used to work out which company/email combinations exist.
 */
export async function requestPasswordReset(input: ForgotPasswordInput, origin?: string) {
  const genericMessage = "If an account exists for that email, a reset link has been sent.";

  const company = await prisma.company.findFirst({
    where: { slug: input.companySlug.toLowerCase() },
    select: { id: true, name: true },
  });
  if (!company) return { message: genericMessage };

  const user = await prisma.user.findFirst({
    where: { companyId: company.id, email: input.email.toLowerCase() },
    select: { id: true, companyId: true, email: true, firstName: true, status: true },
  });
  if (!user || user.status !== EmployeeStatus.ACTIVE) return { message: genericMessage };

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction([
    // Invalidate any earlier outstanding links for this account.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, companyId: user.companyId, tokenHash, expiresAt },
    }),
  ]);

  const resetUrl = `${appBaseUrl(origin)}/reset-password?token=${token}`;
  const delivery = await sendMail({
    to: user.email,
    subject: `Reset your ${company.name} password`,
    text: `Hi ${user.firstName},\n\nWe received a request to reset your ${company.name} password. Open this link within the next hour to choose a new one:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${user.firstName},</p>
<p>We received a request to reset your <strong>${company.name}</strong> password. This link expires in one hour.</p>
<p><a href="${resetUrl}">Choose a new password</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
  });

  // In production the response stays generic, but a failed send is reported as an
  // error instead of a false "link sent": otherwise a missing SMTP configuration
  // leaves the user waiting for mail that was never sent.
  if (!delivery.delivered && isProduction) {
    // Carry the provider's reason (e.g. "Resend 403: The domain is not verified") so
    // whoever tests the reset flow can see what to fix instead of a blank failure.
    const reason = delivery.error?.replace(/^\[[^\]]*\]\s*/, "").slice(0, 160).trim();
    throw new HttpError(
      502,
      reason
        ? `We couldn't send the reset email (${reason}). Please ask your administrator to check the email delivery settings.`
        : "We couldn't send the reset email. Please ask your administrator to check the email delivery settings.",
    );
  }

  return {
    message: genericMessage,
    // Exposed only outside production so the flow can be tested without a mail provider.
    ...(isProduction ? {} : { resetUrl, emailDelivered: delivery.delivered }),
  };
}

/** Consumes a reset token and sets the new password. */
export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashResetToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "This reset link is invalid or has expired");
  }

  const user = await prisma.user.findFirst({
    where: { id: record.userId, companyId: record.companyId },
    select: { id: true },
  });
  if (!user) {
    throw new HttpError(400, "This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: "Your password has been reset. You can now sign in." };
}

export async function updateMyAccount(userId: string, companyId: string, input: UpdateMyAccountInput) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (user.status !== EmployeeStatus.ACTIVE) {
    throw new HttpError(403, "Account is not active");
  }

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new HttpError(400, "Current password is incorrect");
  }

  const data: { email?: string; passwordHash?: string } = {};

  if (input.email !== undefined) {
    const email = input.email.toLowerCase();
    if (email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { companyId, email, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new HttpError(409, "An account with this email already exists in this company");
      }
      data.email = email;
    }
  }

  if (input.newPassword !== undefined) {
    data.passwordHash = await hashPassword(input.newPassword);
  }

  if (Object.keys(data).length === 0) {
    // Nothing to change (e.g. same email provided, no new password)
    return sanitizeUser(user);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return sanitizeUser(updated);
}
