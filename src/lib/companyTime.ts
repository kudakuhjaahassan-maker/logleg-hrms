import prisma from "./prisma";

/** IANA timezone a company's shift times and attendance days are interpreted in. */
export async function companyTimeZone(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || "UTC";
}
