import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import type { UpdateCompanySettingsInput } from "./company.schema";

const publicCompanySelect = {
  id: true,
  name: true,
  slug: true,
  domain: true,
  logoUrl: true,
  primaryColor: true,
  cardBgColor: true,
  sidebarTheme: true,
  defaultCurrency: true,
  standardWorkHours: true,
  overtimeMultiplier: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: publicCompanySelect,
  });
  if (!company) throw new HttpError(404, "Company not found");
  return company;
}

export async function updateCompanySettings(
  companyId: string,
  input: UpdateCompanySettingsInput,
) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new HttpError(404, "Company not found");

  const data: {
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    cardBgColor?: string;
    sidebarTheme?: string;
    headingTextColor?: string;
    subTextColor?: string;
    defaultCurrency?: string;
    standardWorkHours?: number;
    overtimeMultiplier?: number;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl === "" ? null : input.logoUrl;
  if (input.primaryColor !== undefined) data.primaryColor = input.primaryColor.toLowerCase();
  if (input.cardBgColor !== undefined) data.cardBgColor = input.cardBgColor.toLowerCase();
  if (input.sidebarTheme !== undefined) data.sidebarTheme = input.sidebarTheme;
  if (input.headingTextColor !== undefined) data.headingTextColor = input.headingTextColor;
  if (input.subTextColor !== undefined) data.subTextColor = input.subTextColor;
  if (input.defaultCurrency !== undefined) data.defaultCurrency = input.defaultCurrency;
  if (input.standardWorkHours !== undefined) data.standardWorkHours = input.standardWorkHours;
  if (input.overtimeMultiplier !== undefined) data.overtimeMultiplier = input.overtimeMultiplier;

  return prisma.company.update({
    where: { id: companyId },
    data,
    select: publicCompanySelect,
  });
}