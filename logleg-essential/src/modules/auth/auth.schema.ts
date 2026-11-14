import { z } from "zod";

export const registerCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2).max(120),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
    domain: z.string().min(3).max(120).optional(),
    settings: z.record(z.any()).optional(),
  }),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    phone: z.string().max(40).optional(),
  }),
});

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    companySlug: z.string().min(1).optional(),
    companyId: z.string().uuid().optional(),
  })
  .refine((data) => data.companySlug || data.companyId, {
    message: "Either companySlug or companyId is required",
    path: ["companySlug"],
  });

export const updateMyAccountSchema = z
  .object({
    email: z.string().email().optional(),
    newPassword: z.string().min(8).max(128).optional(),
    currentPassword: z.string().min(1),
  })
  .refine((data) => data.email !== undefined || data.newPassword !== undefined, {
    message: "Provide a new email and/or a new password",
    path: ["email"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  companySlug: z.string().min(1, "Company slug is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset token is required"),
  newPassword: z.string().min(8).max(128),
});

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMyAccountInput = z.infer<typeof updateMyAccountSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
