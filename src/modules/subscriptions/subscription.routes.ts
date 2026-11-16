import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/authenticate";
import * as subscriptionService from "./subscription.service";

const router = Router();

// POST /api/subscriptions/pending - Create a pending subscription request (user clicks tier button)
router.post(
  "/pending",
  authenticate,
  asyncHandler(subscriptionService.createPendingSubscription)
);

// GET /api/subscriptions/pending - List all pending requests for a company (management dashboard)
router.get(
  "/pending",
  authenticate,
  asyncHandler(subscriptionService.getPendingRequests)
);

// POST /api/subscriptions/approve - Approve/unlock a pending subscription request
router.post(
  "/approve",
  authenticate,
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(subscriptionService.approvePendingSubscription)
);

// POST /api/subscriptions/reject - Reject a pending subscription request
router.post(
  "/reject",
  authenticate,
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(subscriptionService.rejectPendingSubscription)
);

export default router;