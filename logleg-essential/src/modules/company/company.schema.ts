import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colour must be a hex value, e.g. #2563eb");

const headingTextColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Heading text colour must be a hex value, e.g. #0f172a");
const subTextColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Sub text colour must be a hex value, e.g. #64748b");

const sidebarTheme = z.enum(["light", "dark", "brand"], {
  errorMap: () => ({ message: "sidebarTheme must be light, dark, or brand" }),
});

export const updateCompanySettingsSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    logoUrl: z
      .union([z.string().url("logoUrl must be a valid URL"), z.literal(""), z.null()])
      .optional(),
    primaryColor: hexColor.optional(),
    cardBgColor: hexColor.optional(),
    sidebarTheme: sidebarTheme.optional(),
    headingTextColor: headingTextColor.optional(),
    subTextColor: subTextColor.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
