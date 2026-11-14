import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./leave.controller";

const router = Router();

router.use(authenticate);

router.post("/", asyncHandler(controller.create));
router.get("/", asyncHandler(controller.list));
router.get("/pending", authorize("MANAGER", "HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.pending));
router.patch("/:id/review", authorize("MANAGER", "HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.review));

export default router;
