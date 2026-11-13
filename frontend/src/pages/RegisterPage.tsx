import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";
import PasswordField from "../components/PasswordField";

export default function RegisterPage() {
  const { token } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const onCompanyNameChange = (v: string) => {
    setCompanyName(v);
    if (!companySlug) setCompanySlug(slugify(v));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.registerCompany({
        company: { name: companyName, slug: companySlug },
        admin: { email, password, firstName, lastName },
      });
      localStorage.setItem("logleg_token", res.accessToken);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark lg">L</div>
          <h1>Create your company</h1>
          <p>Register your organization and first admin account</p>
        </div>
        <form onSubmit={onSubmit} className="form">
          <label>
            Company name
            <input value={companyName} onChange={(e) => onCompanyNameChange(e.target.value)} placeholder="Acme Inc." required />
          </label>
          <label>
            Company slug
            <input value={companySlug} onChange={(e) => setCompanySlug(slugify(e.target.value))} placeholder="acme" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
          </div>
          <label>
            Admin email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@company.com" required />
          </label>
          <label>
            Password
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create company & admin"}
          </button>
        </form>
        <p className="hint">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
