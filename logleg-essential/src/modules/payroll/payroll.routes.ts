import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./payroll.controller";

const router = Router();

router.use(authenticate);

router.get("/me", asyncHandler(controller.myCompensation));
router.get("/leaderboard", asyncHandler(controller.leaderboard));
router.get("/payslips", authorize("MANAGER", "HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.reviewList));
router.post("/generate", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.generate));
router.patch(
  "/payslips/:id/status",
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(controller.updateStatus),
);

export default router;
