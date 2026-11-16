import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPasswordPage() {
  const [companySlug, setCompanySlug] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevResetUrl(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email, companySlug });
      setMessage(res.message);
      if (res.resetUrl) setDevResetUrl(res.resetUrl);
    } catch (err: any) {
      setError(err?.message || "Could not start the password reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img className="auth-logo" src="/assets/logleg-logo.png" alt="LOGLEG" />
          <h1>Reset your password</h1>
          <p>We’ll email you a link to choose a new password.</p>
        </div>

        <form onSubmit={onSubmit} className="form">
          <label>
            Company slug
            <input
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
              placeholder="acme"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
          {devResetUrl && (
            <div className="alert">
              Email delivery isn’t configured in this environment. Use this link to continue:{" "}
              <a className="link" href={devResetUrl}>Reset password</a>
            </div>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="hint">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
