import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import prisma from "./lib/prisma";
import authRoutes from "./modules/auth/auth.routes";
import departmentRoutes from "./modules/departments/department.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import companyRoutes from "./modules/company/company.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import { HttpError } from "./utils/http";
import { applyOneTimeDataFixes } from "./lib/dataMigrations";
import { logMailerConfiguration, mailStatus } from "./lib/mailer";

const app = express();
app.use(cors());
app.use(express.json());

// Liveness: the platform healthcheck hits this, so it must answer whenever the
// process is up. A transient database blip is reported in the body rather than as
// a 5xx, which would otherwise fail the deploy and take the whole site down.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      service: "logleg-hrms",
      database: "connected",
      email: mailStatus().configured ? mailStatus().provider : "not_configured",
    });
  } catch {
    res.json({
      status: "degraded",
      service: "logleg-hrms",
      database: "disconnected",
      email: mailStatus().configured ? mailStatus().provider : "not_configured",
    });
  }
});

// Readiness: 503 while the database cannot be reached.
app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready", database: "connected" });
  } catch {
    res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/payroll", payrollRoutes);

// Serve the built frontend in production (single-service deployment).
const frontendDist = path.resolve(process.cwd(), "frontend/dist");
if (fs.existsSync(path.join(frontendDist, "index.html"))) {
  app.use(express.static(frontendDist));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || !req.accepts("html")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((_req, _res, next) => {
  next(new HttpError(404, "Route not found"));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const status = message.includes("Missing required environment variable") ? 500 : 500;
  console.error(err);
  return res.status(status).json({ error: { message: "Internal server error" } });
});

const port = Number(process.env.PORT ?? 3000);

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`LOGLEG HRMS API listening on http://0.0.0.0:${port}`);
    logMailerConfiguration();
    // Runs after the port is open and swallows its own errors, so a slow or failed
    // data fix can never keep the service from answering.
    void applyOneTimeDataFixes();
  });
}

export default app;
