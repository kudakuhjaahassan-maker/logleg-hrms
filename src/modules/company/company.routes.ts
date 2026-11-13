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

export default router;
