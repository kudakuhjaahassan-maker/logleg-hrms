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

// GET /api/subscriptions/pending - List all pending requests for a company (management dashboard)
router.get(
  "/pending",
  authenticate,
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
      const companyId: string = (req as any).auth?.companyId || "";
      const result = await subscriptionService.approvePendingSubscription(requestId, companyId);
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