import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../../utils/http";
import { sendMail } from "../../lib/mailer";

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

/** Send a test email (admin-only). */
export async function sendTestEmail(req: Request, res: Response) {
  if (!req.auth) {
    throw new HttpError(401, "Authentication required");
  }
  // Only HR_ADMIN or SUPER_ADMIN can send test emails
  const userRole = req.auth.role;
  if (userRole !== "HR_ADMIN" && userRole !== "SUPER_ADMIN") {
    throw new HttpError(403, "You do not have permission to perform this action");
  }

  const testRecipient = process.env.TEST_EMAIL_RECIPIENT || "test@logleg-hrms.dev";

  const result = await sendMail({
    to: testRecipient,
    subject: "LOGLEG HRMS - Test Email",
    text: "This is a test email from LOGLEG HRMS to confirm the email delivery system is working.\n\nIf you receive this, the Resend HTTPS API integration is functioning correctly.",
    html: `<p>This is a test email from <strong>LOGLEG HRMS</strong> to confirm the email delivery system is working.</p><p>If you receive this, the <a href="https://resend.com">Resend</a> HTTPS API integration is functioning correctly.</p>`,
  });

  if (!result.delivered) {
    throw new HttpError(502, `Test email failed to deliver: ${result.error}`);
  }

  res.json({
    message: `Test email sent to ${testRecipient}`,
    delivered: result.delivered,
    provider: result.error ? "smtp" : "resend",
  });
}