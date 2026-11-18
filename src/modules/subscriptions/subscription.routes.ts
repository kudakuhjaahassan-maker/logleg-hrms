import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/authenticate";
import * as subscriptionService from "./subscription.service";

const router = Router();

// POST /api/subscriptions/pending - Create a pending subscription request (user clicks tier button)
router.post(
  "/pending",
  authenticate,
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const input: subscriptionService.CreatePendingSubscriptionInput = {
        userId: (req as any).auth?.userId || "",
        email: (req as any).auth?.email || "",
        tier: (req as any).body?.tier,
        companyId: (req as any).auth?.companyId || "",
      };
      const result = await subscriptionService.createPendingSubscription(input);
      res.json(result);
    }
  )
);

// POST /api/subscriptions/request - Submit a tier upgrade with payment proof for review
router.post(
  "/request",
  authenticate,
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const body = ((req as any).body ?? {}) as Record<string, unknown>;
      const input: subscriptionService.CreatePendingSubscriptionInput = {
        userId: (req as any).auth?.userId || "",
        email: (req as any).auth?.email || "",
        tier: String(body.tier ?? ""),
        companyId: (req as any).auth?.companyId || "",
        proofUrl: typeof body.proofUrl === "string" ? body.proofUrl : null,
        referenceId: typeof body.referenceId === "string" ? body.referenceId : null,
      };
      const result = await subscriptionService.createPendingSubscription(input);
      res.status(201).json({ request: result });
    }
  )
);

// GET /api/subscriptions/my-status - The caller company's open tier request (if any)
router.get(
  "/my-status",
  authenticate,
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const companyId: string = (req as any).auth?.companyId || "";
      const request = await subscriptionService.getMyPendingSubscription(companyId);
      res.json({ request });
    }
  )
);

// GET /api/subscriptions/pending - List all pending requests
router.get(
  "/pending",
  authenticate,
  authorize("SUPER_ADMIN"),
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const companyId: string = (req as any).auth?.companyId || "";
      const requests = await subscriptionService.getPendingRequests(companyId);
      res.json({ requests });
    }
  )
);

// POST /api/subscriptions/approve - Approve/unlock a pending subscription request
router.post(
  "/approve",
  authenticate,
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const requestId: string = (req as any).body?.requestId;
      const result = await subscriptionService.approvePendingSubscription(requestId);
      res.json(result);
    }
  )
);

// POST /api/subscriptions/reject - Reject a pending subscription request
router.post(
  "/reject",
  authenticate,
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(
    async (req: import("express").Request, res: import("express").Response) => {
      const requestId: string = (req as any).body?.requestId;
      const result = await subscriptionService.rejectPendingSubscription(requestId);
      res.json(result);
    }
  )
);

export default router;