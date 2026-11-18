import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./attendance.controller";

const router = Router();

router.use(authenticate);

router.get("/today", asyncHandler(controller.myToday));
// Geofence check-in: optional JSON body { latitude: number, longitude: number }
router.post("/clock-in", asyncHandler(controller.clockIn));
router.post("/clock-out", asyncHandler(controller.clockOut));
router.get("/daily", authorize("MANAGER", "HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.daily));
router.get("/trends", authorize("SUPER_ADMIN", "HR_ADMIN"), asyncHandler(controller.trends));

export default router;
