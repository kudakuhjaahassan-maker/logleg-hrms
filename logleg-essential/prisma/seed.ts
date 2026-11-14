import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  EmployeeStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      name: "Acme Inc.",
      slug: "acme",
      domain: "acme.example",
      subscriptionPlan: SubscriptionPlan.GROWTH,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      settings: {
        timezone: "UTC",
        workWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
    },
  });

  const hrDepartment = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: "Human Resources" } },
    update: {},
    create: { companyId: company.id, name: "Human Resources" },
  });

  const engineeringDepartment = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: "Engineering" } },
    update: {},
    create: { companyId: company.id, name: "Engineering" },
  });

  // NOTE: Replace with a real password hashing flow (e.g. bcrypt/argon2) before production use.
  const demoPasswordHash = "CHANGE_ME_HASHED_PASSWORD";

  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "hr.admin@acme.example" } },
    update: {},
    create: {
      companyId: company.id,
      email: "hr.admin@acme.example",
      passwordHash: demoPasswordHash,
      firstName: "Hannah",
      lastName: "Reed",
      role: UserRole.HR_ADMIN,
      departmentId: hrDepartment.id,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date("2024-01-15"),
    },
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "employee@acme.example" } },
    update: {},
    create: {
      companyId: company.id,
      email: "employee@acme.example",
      passwordHash: demoPasswordHash,
      firstName: "Evan",
      lastName: "Lee",
      role: UserRole.EMPLOYEE,
      departmentId: engineeringDepartment.id,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date("2024-06-01"),
    },
  });

  console.log("Seed completed:", { company: company.slug });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
