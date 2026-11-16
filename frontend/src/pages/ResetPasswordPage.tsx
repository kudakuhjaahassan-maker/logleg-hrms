import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import PasswordField from "../components/PasswordField";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err: any) {
      setError(err?.message || "Could not reset your password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img className="auth-logo" src="/assets/logleg-logo.png" alt="LOGLEG" />
          <h1>Choose a new password</h1>
          <p>Your reset link is valid for one hour.</p>
        </div>

        {!token ? (
          <>
            <div className="alert error">This reset link is missing its token.</div>
            <p className="hint">
              <Link to="/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : done ? (
          <>
            <div className="alert success">Password updated. Taking you to sign in…</div>
            <p className="hint">
              <Link to="/login">Go to sign in now</Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="form">
            <label>
              New password
              <PasswordField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm new password
              <PasswordField
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <div className="alert error">{error}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Set new password"}
            </button>
          </form>
        )}

        <p className="hint">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
