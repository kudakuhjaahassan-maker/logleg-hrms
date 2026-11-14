import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as controller from "./department.controller";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(controller.list));
router.post("/", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.create));
router.put("/:id", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.update));
router.delete("/:id", authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(controller.remove));

export default router;
