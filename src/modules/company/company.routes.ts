import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./company.controller";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(controller.get));
router.patch(
  "/settings",
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(controller.updateSettings),
);

router.patch(
  "/payroll-config",
  authorize("HR_ADMIN", "SUPER_ADMIN"),
  asyncHandler(controller.updatePayrollConfig),
);

router.get(
  "/payroll-config",
  asyncHandler(controller.getPayrollConfig),
);

export default router;
