import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "./department.schema";

export async function listDepartments(companyId: string) {
  return prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
}

export async function createDepartment(companyId: string, input: CreateDepartmentInput) {
  try {
    return await prisma.department.create({
      data: { companyId, name: input.name },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new HttpError(409, "Department name already exists in this company");
    }
    throw error;
  }
}

export async function updateDepartment(
  companyId: string,
  id: string,
  input: UpdateDepartmentInput,
) {
  const existing = await prisma.department.findFirst({ where: { id, companyId } });
  if (!existing) throw new HttpError(404, "Department not found");
  try {
    return await prisma.department.update({
      where: { id },
      data: { name: input.name },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new HttpError(409, "Department name already exists in this company");
    }
    throw error;
  }
}

export async function deleteDepartment(companyId: string, id: string) {
  const existing = await prisma.department.findFirst({ where: { id, companyId } });
  if (!existing) throw new HttpError(404, "Department not found");
  await prisma.department.delete({ where: { id } });
  return { deleted: true };
}
