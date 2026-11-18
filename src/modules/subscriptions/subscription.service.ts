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
  /// Optional refund account details (account name & number) provided for refund payout.
  refundAccountDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
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

/** Request rows are written lowercase; compare case-insensitively so seeds/imports can't slip through. */
const PENDING_STATUS_FILTER = { equals: "pending", mode: "insensitive" } as const;

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

  // One open request per company: a second tier change must wait for review.
  const alreadyPending = await prisma.pendingSubscriptionRequest.findFirst({
    where: { companyId, status: PENDING_STATUS_FILTER },
    select: { id: true },
  });
  if (alreadyPending) {
    throw new HttpError(400, "A subscription request is already pending approval.");
  }

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
    refundAccountDetails: request.refundAccountDetails,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function getMyPendingSubscription(companyId: string): Promise<PendingSubscriptionRequest | null> {
  if (!companyId) return null;

  const request = await prisma.pendingSubscriptionRequest.findFirst({
    where: { companyId, status: PENDING_STATUS_FILTER },
    orderBy: { createdAt: "desc" },
  });

  if (!request) return null;

  return {
    id: request.id,
    companyId: request.companyId,
    userId: request.userId,
    email: request.email,
    tier: request.tier,
    status: request.status as SubscriptionStatus,
    proofUrl: request.proofUrl,
    referenceId: request.referenceId,
    refundAccountDetails: request.refundAccountDetails,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
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
    refundAccountDetails: r.refundAccountDetails,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function approvePendingSubscription(requestId: string): Promise<{ request: PendingSubscriptionRequest; company: any }> {
  const request = await prisma.pendingSubscriptionRequest.findFirst({
    where: { id: requestId },
  });

  if (!request) {
    throw new HttpError(404, "Pending subscription request not found");
  }

  if (String(request.status).toLowerCase() !== "pending") {
    throw new HttpError(400, "This request is already processed");
  }

  // Get the request's company first, then scope to the caller's company unless SUPER_ADMIN
  const requester = await prisma.user.findFirst({
    where: { id: request.userId },
    select: { companyId: true, role: true },
  });

  // If caller is not SUPER_ADMIN, restrict to their own company's request
  if (requester?.role !== "SUPER_ADMIN" && requester?.companyId !== request.companyId) {
    throw new HttpError(403, "You can only approve requests for your own company");
  }

  // `tier` is already a SubscriptionPlan enum value (STARTER/GROWTH/ENTERPRISE).
  const plan: SubscriptionPlan = request.tier;

  await prisma.$transaction([
    prisma.pendingSubscriptionRequest.update({
      where: { id: requestId },
      data: { status: "approved" },
    }),
    prisma.company.update({
      where: { id: request.companyId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: "ACTIVE",
      },
    }),
  ]);

  const company = await prisma.company.findUnique({ where: { id: request.companyId } });

  return {
    request: {
      id: request.id,
      companyId: request.companyId,
      userId: request.userId,
      email: request.email,
      tier: request.tier,
      status: "approved" as SubscriptionStatus,
      proofUrl: request.proofUrl,
      referenceId: request.referenceId,
      refundAccountDetails: request.refundAccountDetails,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
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

  if (String(request.status).toLowerCase() !== "pending") {
    throw new HttpError(400, "This request is already processed");
  }

  // Rejection only closes the request; the company keeps its current plan.
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
    proofUrl: updated.proofUrl,
    referenceId: updated.referenceId,
    refundAccountDetails: updated.refundAccountDetails,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function cancelPendingSubscription(
  requestId: string,
  refundAccountDetails: string | null,
  companyId = "",
  role = ""
): Promise<PendingSubscriptionRequest> {
  // Find and validate the request
  const request = await prisma.pendingSubscriptionRequest.findFirst({
    where: { id: requestId },
  });

  if (!request) {
    throw new HttpError(404, "Pending subscription request not found");
  }

  // Only the requesting company (or a Super Admin) may cancel this request.
  if (role !== "SUPER_ADMIN" && request.companyId !== companyId) {
    throw new HttpError(403, "You can only cancel requests for your own company");
  }

  if (String(request.status).toLowerCase() !== "pending") {
    throw new HttpError(400, "This request is already processed");
  }

  // If refund details are provided, retain the record for Super Admin audit/refund payout
  // with CANCELLED status and refund account details. Otherwise, delete the request.
  let updated;
  if (refundAccountDetails) {
    updated = await prisma.pendingSubscriptionRequest.update({
      where: { id: requestId },
      data: { status: "cancelled", refundAccountDetails },
    });
  } else {
    await prisma.pendingSubscriptionRequest.delete({
      where: { id: requestId },
    });
    // Return the request before deletion for confirmation UI purposes
    updated = { ...request, status: "cancelled" as SubscriptionStatus, refundAccountDetails: null };
  }

  return {
    id: updated.id,
    companyId: updated.companyId,
    userId: updated.userId,
    email: updated.email,
    tier: updated.tier,
    status: updated.status as SubscriptionStatus,
    proofUrl: updated.proofUrl,
    referenceId: updated.referenceId,
    refundAccountDetails: updated.refundAccountDetails,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}