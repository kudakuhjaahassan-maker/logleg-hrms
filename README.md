# LOGLEG (HRMS)

LOGLEG is a modern B2B Human Resource Management System (HRMS) and internal operations platform foundation. This repository contains a multi-tenant PostgreSQL schema (Prisma), an Express/TypeScript API with authentication and RBAC, and a React (Vite) dashboard for Core HR and the Employee Directory.

## Tech stack

- **Backend:** Node.js (>= 20), TypeScript, Express
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT (`jsonwebtoken`) + bcrypt password hashing (`bcryptjs`)
- **Validation:** Zod
- **Frontend:** React 19 + Vite + TypeScript + React Router (`frontend/`)

## Project architecture

```text
.
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ src/                         # Backend API
│  ├─ config/env.ts
│  ├─ lib/prisma.ts
│  ├─ middleware/
│  │  ├─ authenticate.ts        # JWT auth + tenant-scoped user loading
│  │  └─ authorize.ts           # RBAC guards and tenant-scope helper
│  ├─ modules/
│  │  ├─ auth/                  # Company bootstrap, login, /me
│  │  ├─ departments/           # Tenant-scoped department CRUD
│  │  └─ employees/             # Directory, profile, CRUD, org chart
│  ├─ types/express.d.ts
│  ├─ utils/{asyncHandler,http,jwt,password}.ts
│  └─ server.ts                 # App bootstrap, routes, CORS, errors
├─ frontend/                    # React dashboard (Vite)
│  ├─ src/
│  │  ├─ api/{client.ts,AuthContext.tsx}
│  │  ├─ components/{Layout,EmployeeModal}.tsx
│  │  ├─ pages/{Login,Directory,Profile,OrgChart}Page.tsx
│  │  └─ styles/app.css
│  ├─ vite.config.ts            # Dev proxy: /api -> http://localhost:3000
│  └─ package.json
├─ .env.example
└─ README.md
```

## Multi-tenancy model

LOGLEG uses **row-level multi-tenancy** (shared DB/schema):

- Every tenant-owned table includes `company_id`.
- Tenant data is related to `Company` (cascade at tenant boundary).
- Tenant-aware uniqueness: `users(company_id, email)`, `departments(company_id, name)`, one attendance log per employee/day/company, one payroll record per employee/period/company.
- Indexes on `company_id` and common filters support tenant-scoped queries.

**Rule:** every application read/write must be scoped to the authenticated tenant (`req.auth.companyId`), except explicit cross-tenant `SUPER_ADMIN` operations. All Step 2/3 API routes use `authenticate` and enforce tenant scoping in services; HR mutations are protected with `authorize(...)`.

## Database schema

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). Models:
1. **Company** (`companies`) — tenant info, slug/domain, `subscriptionPlan`, `subscriptionStatus`, `settings` (JSON), timestamps.
2. **User** (`users`) — `companyId`, `email`, `passwordHash`, `firstName`, `lastName`, **`title`**, `role` (`SUPER_ADMIN|HR_ADMIN|MANAGER|EMPLOYEE`), `departmentId?`, `managerId?` (self-relation), `phone?`, `hireDate?`, `status`, **`documents` (JSON, HR-managed metadata)**, timestamps.
3. **Department** (`departments`) — `companyId`, `name`.
4. **LeaveRequest** (`leave_requests`) — `companyId`, `employeeId`, `leaveType`, `startDate`, `endDate`, `status`, `reason`, review fields.
5. **AttendanceLog** (`attendance_logs`) — `companyId`, `employeeId`, `clockIn`, `clockOut`, `date`, notes.
6. **PayrollRecord** (`payroll_records`) — `companyId`, `employeeId`, `baseSalary`, `deductions`, `netPay` (Decimal), `currency`, `payPeriodMonth`, `payPeriodYear`, status.

> **Schema update (Step 3):** `User` now includes `title` and `documents`. After pulling these changes, run `npm run db:push` (or a migration) and `npm run db:generate` to sync your database and Prisma Client.

## Step 2 — Authentication & RBAC

- **Password security:** bcrypt hashing/verification ([`src/utils/password.ts`](src/utils/password.ts)).
- **JWT access tokens:** payload `{ sub, companyId, role, email }` ([`src/utils/jwt.ts`](src/utils/jwt.ts)).
- **`authenticate`** ([`src/middleware/authenticate.ts`](src/middleware/authenticate.ts)): verifies `Bearer` token, re-loads the user from DB (tenant + `ACTIVE` status), sets `req.auth`.
- **`authorize` / `resolveTenantScope`** ([`src/middleware/authorize.ts`](src/middleware/authorize.ts)): role guards and cross-tenant protection.
- **Tenant-aware login:** requires `companySlug` or `companyId` (emails are unique per company).

### Auth endpoints (`/api/auth`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/register-company` | Public | Create tenant + initial `HR_ADMIN`; returns `{ company, user, accessToken }` |
| `POST` | `/login` | Public | Login with `email`, `password`, and `companySlug`/`companyId` |
| `GET` | `/me` | Bearer | Current user (company/department/manager context) |

## Step 3 — Core HR & Employee Directory (backend API + dashboard)

### Backend API (all routes authenticated + tenant-scoped)

#### Departments (`/api/departments`)
| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Any authenticated (tenant) | List company departments (with employee counts) |
| `POST` | `/` | `HR_ADMIN`, `SUPER_ADMIN` | Create department |
| `PUT` | `/:id` | `HR_ADMIN`, `SUPER_ADMIN` | Rename department (tenant-checked) |
| `DELETE` | `/:id` | `HR_ADMIN`, `SUPER_ADMIN` | Delete department (tenant-checked) |

#### Employees (`/api/employees`)
| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Any authenticated (tenant) | **Employee directory** — paginated, searchable and filterable by `search`, `departmentId`, `status` (`page`, `pageSize`). Returns name, title, department, email, status, role, etc. |
| `GET` | `/org-chart` | Any authenticated (tenant) | **Org chart** — hierarchical tree built from `manager_id` relationships (`{ roots, employeeCount }`) |
| `GET` | `/:id` | Authenticated (tenant, permission-checked) | **Employee profile** — employee info; documents/history returned only to the employee themself or `HR_ADMIN`/`SUPER_ADMIN` (managers see directory-level profile without sensitive docs/history) |
| `POST` | `/` | `HR_ADMIN`, `SUPER_ADMIN` | **Add employee** — validates department/manager belong to same company, hashes password, enforces tenant-unique email |
| `PUT` | `/:id` | `HR_ADMIN`, `SUPER_ADMIN` | **Edit employee** — update fields, reassign department/manager (same-company validated), optional password reset |

**Directory query example:**
```bash
curl "http://localhost:3000/api/employees?search=ana&departmentId=<uuid>&status=ACTIVE&page=1&pageSize=20" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Profile response shape (`GET /api/employees/:id`):** `{ employee, history, permissions }` where `history` (when permitted) includes recent `leaveRequests`, `attendanceLogs`, and `payrollRecords` for the employee (tenant-scoped), and `permissions` indicates `canEdit`, `canViewDocuments`, `canViewHistory`.

**Org chart:** employees whose `managerId` is null or not found within the company are returned as top-level roots; each node includes `reports[]` recursively.

### Frontend dashboard (`frontend/`)

A React/Vite dashboard (dev server proxies `/api` to the backend):

1. **Login** (`/login`) — tenant-scoped sign-in (`companySlug`, email, password).
2. **Employee Directory** (`/directory`) — searchable table, filterable by **department** and **status**, showing employee **name, title, department, email, and status** (plus role). Row actions: view profile; **HR admins** can **Add Employee** and **Edit** via a modal.
3. **Add/Edit Employee Modal** — HR admin form to create or update employees, including role/status, **department and manager assignment**, contact/title, hire date, and password/set-new-password.
4. **Employee Profile View** (`/employees/:id`) — detailed employee information; **employee can see their own info**, and **HR/admin can view documents and history** (leave, attendance, payroll) when permitted by the API. HR/admin can edit from the profile.
5. **Org Chart** (`/org-chart`) — visual hierarchy tree showing reporting lines based on `manager_id` relationships.

All frontend data access goes through authenticated API calls (`Authorization: Bearer <token>`), and the backend enforces tenant scoping and RBAC on every route.

## Initialize and run

### 1. Prerequisites
- Node.js >= 20 and npm
- PostgreSQL 14+

### 2. Backend setup
```bash
npm install
cp .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS, PORT
```

### 3. Database (apply schema + generate client)
```bash
npm run db:generate
npm run db:push          # or: npx prisma db push
# dev migrations alternative: npm run db:migrate -- --name init
# prod: npm run db:migrate:deploy
```

> If you already had a database from earlier steps, re-run `db:push`/migrate and `db:generate` to apply Step 3 schema additions (`User.title`, `User.documents`).

### 4. Run the backend API
```bash
npm run dev              # http://localhost:3000 (watch)
# or: npm run build && npm start
```
- Health/DB: `GET http://localhost:3000/health`
- Optional seed: `npm run db:seed` (demo data with placeholder password hashes; prefer real users via `POST /api/auth/register-company`)

### 5. Run the frontend dashboard
```bash
cd frontend
npm install
npm run dev              # Vite dev server (default http://localhost:5173)
```
The Vite dev server proxies `/api` to `http://localhost:3000` (see [`frontend/vite.config.ts`](frontend/vite.config.ts)). Ensure the backend is running and the database is reachable.

### 6. Verify
- Backend typecheck: `npm run typecheck`
- Frontend typecheck/build: `cd frontend && npm run build`
- API: register/login/me, departments, employees list/org-chart/profile
- UI: sign in → Directory (search/filter, HR add/edit) → Profile (info/docs/history by permission) → Org Chart

## Security notes

- Never log or return `passwordHash`; API responses sanitize user objects.
- Keep `JWT_SECRET` strong/unique per environment; keep `.env` out of version control.
- Enforce tenant scoping on every query (`companyId` from `req.auth`); validate department/manager/employee IDs belong to the same company before writes (implemented in services). Consider PostgreSQL RLS for defense-in-depth.
- Profile documents/history are restricted to the employee and `HR_ADMIN`/`SUPER_ADMIN` by the API.
- Add rate limiting, lockout/audit logging, refresh-token/session revocation, and HTTPS in production.

## Step 4 — Leave Management & Attendance Tracking

### Backend API (authenticated + tenant-scoped)

#### Leave (`/api/leaves`)
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/` | Any authenticated employee | Submit a leave request (`leaveType`: `ANNUAL`\|`SICK`\|`UNPAID`, `startDate`, `endDate`, `reason?`) for the current user (`PENDING`) |
| `GET` | `/` | Authenticated | List leave requests. Managers/HR admins see company requests (optionally `?status=PENDING|APPROVED|REJECTED|CANCELED`); employees see their own. `?mine=true` forces own requests. |
| `GET` | `/pending` | `MANAGER`, `HR_ADMIN`, `SUPER_ADMIN` | **Approval dashboard data**: pending requests with employee/department context |
| `PATCH` | `/:id/review` | `MANAGER`, `HR_ADMIN`, `SUPER_ADMIN` | Approve/reject a pending request (`{ "status": "APPROVED"|"REJECTED" }`), records `reviewedBy`/`reviewedAt` (tenant-checked) |

#### Attendance (`/api/attendance`)
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/today` | Any authenticated employee | Current user's today attendance status/log + `workedMs` + `isClockedIn` |
| `POST` | `/clock-in` | Any authenticated employee | Clock in for today (one log per employee/day/company; prevents duplicate clock-in) |
| `POST` | `/clock-out` | Any authenticated employee | Clock out for today (requires prior clock-in; prevents duplicate clock-out) |
| `GET` | `/daily?date=YYYY-MM-DD` | `MANAGER`, `HR_ADMIN`, `SUPER_ADMIN` | **Daily attendance log** for the company: per-employee row with clock-in/out, worked time, and status (`CLOCKED_IN`, `CLOCKED_OUT`, `LATE`, `ABSENT`, `ON_LEAVE`) plus summary counts and policy |

**Attendance policy (daily log):** UTC day based on `date`; expected start **09:00 UTC**, **late** if clock-in after **09:15 UTC**. **ABSENT** = no clock-in recorded for an active (non-terminated, not `ON_LEAVE` status) employee. `ON_LEAVE` reflects employee status; clock-in/out times and worked duration are included when present.

### Frontend UI (integrated with existing auth, tenant scoping, layout)

- **Dashboard** (`/dashboard`, home): employee **Clock In / Clock Out widget** (today status, times, worked hours) + recent leave requests/quick links.
- **Leave** (`/leave`): employees can **submit leave requests** (Annual/Sick/Unpaid, start/end date, reason) and view **their request history/status**.
- **Leave Approvals** (`/leave-approvals`, managers/HR admins): **approval dashboard** listing pending requests with approve/reject actions.
- **Daily Attendance** (`/attendance`, managers/HR admins): date-selectable **daily attendance log** showing who is clocked in, clocked out, late, absent, or on leave, with summary counts.
- Navigation updated in the app layout; manager/HR/admin-only views are shown/guarded appropriately in the UI and enforced by the API.

**Run:** backend `npm run dev` (port 3000), frontend `cd frontend && npm run dev` (Vite proxies `/api` to backend). Ensure DB is migrated/synced (`npm run db:push`) and `.env` is configured.

## Step 5 — Company Branding & Settings

Each company stores its own branding on the tenant row (`Company.logoUrl`, `Company.primaryColor`), so the workspace look is scoped per tenant.

### Backend API (`/api/company`, authenticated + tenant-scoped)
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Any authenticated employee | Current company profile incl. `logoUrl`, `primaryColor`, plan/status |
| `PATCH` | `/settings` | `HR_ADMIN`, `SUPER_ADMIN` | Update `name`, `logoUrl` (URL or `null`/`""` to clear) and `primaryColor` (hex, e.g. `#2563eb`) |

`GET /api/auth/me` and `POST /api/auth/login` now also return `company.logoUrl` and `company.primaryColor` so the client can brand the shell immediately.

### Frontend
- **Settings** (`/settings`, HR admin only): edit company name, **logo URL** and **primary brand colour** (colour picker + hex input) with a live preview of the header, nav and buttons.
- Branding is applied globally via CSS custom properties (`--primary`, `--primary-dark`, `--primary-soft`) set from the signed-in company, so the header, logo, active navigation, buttons and highlights all use the corporate accent colour.
- The header shows the company logo (falling back to the company initial) and company name.
