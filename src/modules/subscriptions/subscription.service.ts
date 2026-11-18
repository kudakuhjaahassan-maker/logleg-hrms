import prisma from "../../lib/prisma";
import { HttpError } from "../../utils/http";
import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export interface PendingSubscriptionRequest {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  tier: SubscriptionPlan;
  status: SubscriptionStatus;
  /** Uploaded payment slip (data URL or hosted URL) when supplied. */
  proofUrl?: string | null;
  /** Bank transaction reference when supplied. */
  referenceId?: string | null;
  createdAt: Date;
}

export interface CreatePendingSubscriptionInput {
  userId: string;
  email: string;
  /** "starter" | "growth" | "enterprise" (any casing) — normalized to SubscriptionPlan. */
  tier: string;
  companyId: string;
  proofUrl?: string | null;
  referenceId?: string | null;
}

const ALLOWED_TIERS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;

/** Maps the checkout's lowercase tier names onto the SubscriptionPlan enum. */
function normalizeTier(tier: unknown): SubscriptionPlan {
  const normalized = String(tier ?? "").trim().toUpperCase();
  if (!ALLOWED_TIERS.includes(normalized as (typeof ALLOWED_TIERS)[number])) {
    throw new HttpError(400, "Invalid subscription tier. Choose starter, growth or enterprise.");
  }
  return normalized as SubscriptionPlan;
}

export async function createPendingSubscription(input: CreatePendingSubscriptionInput): Promise<PendingSubscriptionRequest> {
  const { userId, email, companyId, proofUrl, referenceId } = input;

  if (!userId || !companyId) {
    throw new HttpError(401, "Authentication required to request a subscription");
  }

  const tier = normalizeTier(input.tier);

  const request = await prisma.pendingSubscriptionRequest.create({
    data: {
      userId,
      email,
      tier,
      status: "pending",
      companyId,
      proofUrl: proofUrl || null,
      referenceId: referenceId || null,
    },
    include: {
      company: {
        select: { id: true, name: true, slug: true },
      },
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  return {
    id: request.id,
    companyId: request.companyId,
    userId: request.userId,
    email: request.email,
    tier: request.tier,
    status: request.status as SubscriptionStatus,
    proofUrl: request.proofUrl,
    referenceId: request.referenceId,
    createdAt: request.createdAt,
  };
}

export async function getPendingRequests(companyId: string): Promise<PendingSubscriptionRequest[]> {
  const requests = await prisma.pendingSubscriptionRequest.findMany({
    where: { companyId },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    userId: r.userId,
    email: r.email,
    tier: r.tier,
    status: r.status as SubscriptionStatus,
    proofUrl: r.proofUrl,
    referenceId: r.referenceId,
    createdAt: r.createdAt,
  }));
}

export async function approvePendingSubscription(requestId: string, companyId: string): Promise<{ request: PendingSubscriptionRequest; company: any }> {
  // First, find and validate the request belongs to the company
  const request = await prisma.pendingSubscriptionRequest.findFirst({
    where: { id: requestId, companyId },
  });

  if (!request) {
    throw new HttpError(404, "Pending subscription request not found");
  }

  if (request.status !== "pending") {
    throw new HttpError(400, "This request is already processed");
  }

  // Update the company's subscription tier and status
  const planMap: { [key: string]: SubscriptionPlan } = {
    starter: "STARTER",
    growth: "GROWTH",
    enterprise: "ENTERPRISE",
  };

  const plan = planMap[request.tier.toLowerCase()];
  if (!plan) {
    throw new HttpError(400, "Invalid tier value");
  }

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: "ACTIVE",
    },
  });

  // Update the request status to approved
  await prisma.pendingSubscriptionRequest.update({
    where: { id: requestId },
    data: { status: "approved" },
  });

  return {
    request: {
      id: request.id,
      companyId: request.companyId,
      userId: request.userId,
      email: request.email,
      tier: request.tier,
      status: "approved" as SubscriptionStatus,
      createdAt: request.createdAt,
    },
    company,
  };
}

export async function rejectPendingSubscription(requestId: string): Promise<PendingSubscriptionRequest> {
  // Find and validate the request
  const request = await prisma.pendingSubscriptionRequest.findFirst({
    where: { id: requestId },
  });

  if (!request) {
    throw new HttpError(404, "Pending subscription request not found");
  }

  // Update the request status to rejected
  const updated = await prisma.pendingSubscriptionRequest.update({
    where: { id: requestId },
    data: { status: "rejected" },
  });

  return {
    id: updated.id,
    companyId: updated.companyId,
    userId: updated.userId,
    email: updated.email,
    tier: updated.tier,
    status: "rejected" as SubscriptionStatus,
    createdAt: updated.createdAt,
  };
}