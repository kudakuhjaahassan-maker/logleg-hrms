import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import PasswordField from "../components/PasswordField";

function homeForRole(role?: string) {
  if (role === "EMPLOYEE") return "/employee-dashboard";
  // HR_ADMIN, SUPER_ADMIN, MANAGER (and any admin roles) go to the main company dashboard
  return "/dashboard";
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M15 9h2a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2M9 19h2" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </svg>
  );
}
function PayrollIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}
function AllowanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M7 6.5h7.5a3 3 0 0 1 0 6H9.5a3 3 0 0 0 0 6H17" />
    </svg>
  );
}
function PortalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h3M8 17h6" />
    </svg>
  );
}

const features = [
  { title: "Automated Payroll", text: "Payslips generated on schedule, ready for review and payout.", Icon: PayrollIcon },
  { title: "Custom Allowances", text: "Food, housing, Ramadan and performance bonuses included in gross.", Icon: AllowanceIcon },
  { title: "Employee Self-Service", text: "Staff see salary, overtime, rank and payslips in their own portal.", Icon: PortalIcon },
];

export default function LoginPage() {
  const { token, user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"admin" | "employee">("admin");
  const [companySlug, setCompanySlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to={homeForRole(user?.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const signedIn = await login(email, password, companySlug);
      navigate(homeForRole(signedIn.role), { replace: true });
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-hero">
          <div className="login-hero-glow" aria-hidden="true" />
          <div className="login-hero-brand">
            <img className="login-hero-logo" src="/assets/logleg-logo.png" alt="LOGLEG logo" />
          </div>
          <h1 className="login-hero-title">
            Streamline Your Workforce.<br />
            Empower Your People.<br />
            <span className="login-hero-accent">LOGLEG HRMS.</span>
          </h1>
          <p className="login-hero-copy">
            One workspace for your people, payroll and performance — built for growing teams.
          </p>
          <ul className="login-features">
            {features.map(({ title, text, Icon }) => (
              <li className="login-feature" key={title}>
                <span className="login-feature-icon"><Icon /></span>
                <span>
                  <strong>{title}</strong>
                  <span className="login-feature-text">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="login-hero-footer">Payroll · Allowances · Attendance · Self-service</div>
        </aside>

        <main className="login-panel">
          <div className="login-mobile-brand">
            <img src="/assets/logleg-logo.png" alt="LOGLEG logo" />
            <h1>Streamline Your Workforce. Empower Your People. <span>LOGLEG HRMS.</span></h1>
          </div>

          <div className="login-card">
            <div className="login-brand">
              <h1>Welcome back</h1>
              <p>Sign in to your company workspace</p>
            </div>

            <div className="login-toggle" role="tablist" aria-label="Sign-in type">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "admin"}
                className={mode === "admin" ? "login-toggle-btn active" : "login-toggle-btn"}
                onClick={() => setMode("admin")}
              >
                Admin / HR
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "employee"}
                className={mode === "employee" ? "login-toggle-btn active" : "login-toggle-btn"}
                onClick={() => setMode("employee")}
              >
                Employee
              </button>
            </div>
            <p className="login-mode-hint">
              {mode === "employee"
                ? "Employees: sign in with your company slug and the email/password provided by your admin. You’ll be taken to your employee portal."
                : "Admins & HR: sign in to manage your company dashboard. Employees can also use the Employee tab."}
            </p>

            <form onSubmit={onSubmit} className="form">
              <label>
                Company slug
                <span className="input-icon-wrap">
                  <span className="input-icon"><BuildingIcon /></span>
                  <input value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} placeholder="acme" required />
                </span>
              </label>
              <label>
                Email
                <span className="input-icon-wrap">
                  <span className="input-icon"><MailIcon /></span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
                </span>
              </label>
              <label>
                Password
                <span className="input-icon-wrap">
                  <span className="input-icon"><LockIcon /></span>
                  <PasswordField
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </span>
              </label>
              <div className="login-forgot">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
              {error && <div className="alert error">{error}</div>}
              <button className="btn btn-primary btn-block login-submit" type="submit" disabled={loading}>
                {loading ? "Signing in..." : mode === "employee" ? "Sign in as employee" : "Sign in"}
              </button>
            </form>
            <p className="hint">
              Don’t have a company account? <Link to="/register">Register your company</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
