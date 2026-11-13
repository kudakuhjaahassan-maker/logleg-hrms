import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./attendance.controller";

const router = Router();

router.use(authenticate);

router.get("/today", asyncHandler(controller.myToday));
router.post("/clock-in", asyncHandler(controller.clockIn));
router.post("/clock-out", asyncHandler(controller.clockOut));
router.get("/daily", authorize("MANAGER", "HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.daily));

export default router;
