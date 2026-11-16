import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/authenticate";
import * as authController from "./auth.controller";

const router = Router();

router.post("/register-company", asyncHandler(authController.registerCompany));
router.post("/login", asyncHandler(authController.login));
// Self-service password reset (company admin or employee).
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/reset-password", asyncHandler(authController.resetPassword));
// Explicit employee sign-in endpoint (same credentials flow; employees are tenant users)
router.post("/employee/login", asyncHandler(authController.login));
router.get("/me", authenticate, asyncHandler(authController.me));
// Admin: send a test email to confirm Resend delivery works
router.post("/test-email", authenticate, authorize("HR_ADMIN", "SUPER_ADMIN"), asyncHandler(authController.sendTestEmail));
// Self-service: any authenticated user can update their own email/password (and nothing else)
router.patch("/me", authenticate, asyncHandler(authController.updateMe));

export default router;
