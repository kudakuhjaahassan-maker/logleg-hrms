import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./employee.controller";

const router = Router();

router.use(authenticate);

// Directory & org chart visible to authenticated users within the tenant
router.get("/", asyncHandler(controller.list));
router.get("/org-chart", asyncHandler(controller.orgChart));
router.get("/:id", asyncHandler(controller.getProfile));

// HR admin management
router.post("/", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.create));
router.put("/:id", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.update));

export default router;
