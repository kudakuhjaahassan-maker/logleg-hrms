import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function Layout() {
  const { user, company, isHrAdmin, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const brandName = (!loading && company?.name) || "LOGLEG";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const navLinks = (
    <>
      {loading ? (
        <>
          <span className="loading">Loading...</span>
        </>
      ) : user?.role === "EMPLOYEE" ? (
        <>
          <NavLink to="/employee-dashboard" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            My Portal
          </NavLink>
          <NavLink to="/leave" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Leave
          </NavLink>
          <NavLink to="/compensation" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Compensation
          </NavLink>
        </>
      ) : (
        <>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Dashboard
          </NavLink>
          <NavLink to="/directory" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Directory
          </NavLink>
          <NavLink to="/org-chart" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Org Chart
          </NavLink>
          <NavLink to="/leave" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Leave
          </NavLink>
          <NavLink to="/compensation" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Compensation
          </NavLink>
          <NavLink to="/upgrade" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Upgrade Plan
          </NavLink>
          {(user?.role === "MANAGER" || user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN") && (
            <>
              <NavLink to="/leave-approvals" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Approvals
              </NavLink>
              <NavLink to="/attendance" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Attendance
              </NavLink>
              <NavLink to="/payslips" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Payslips
              </NavLink>
              <NavLink to="/management/subscriptions" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Subscription Requests
              </NavLink>
            </>
          )}
        </>
      )}
      {(!loading) && user && (
        <NavLink
          to={`/employees/${user.id}`}
          className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
        >
          My Profile
        </NavLink>
      )}
      {isHrAdmin && (!loading) && (
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Settings
        </NavLink>
      )}
    </>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src={company?.logoUrl || "/assets/logleg-logo.png"}
            alt={`${brandName} logo`}
          />
          <div className="brand-text">
            <div className="brand-title">{brandName}</div>
            <div className="brand-sub">HRMS &amp; Internal Operations</div>
          </div>
        </div>

        <nav className="nav nav-desktop" aria-label="Primary">
          {navLinks}
        </nav>

        <div className="user-area user-area-desktop">
          {(!loading) && user && (
            <div className="user-meta">
              <div className="user-name">
                {user.firstName} {user.lastName}
              </div>
              <div className="user-role">{user.role}</div>
            </div>
          )}
          <button className="btn btn-secondary" onClick={logout}>Log out</button>
        </div>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </header>

      <div className="drawer-overlay ${menuOpen ? "open" : ""} z-100" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside
        id="mobile-nav-drawer"
        className="mobile-drawer ${menuOpen ? "open" : ""} z-95 backdrop-blur-xl border border-slate-200/60"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-drawer-header">
          {(!loading) && user && (
            <div className="mobile-drawer-user">
              <div className="user-name">{user.firstName} {user.lastName}</div>
              <div className="user-role">{user.role}{company?.name ? ` · ${company.name}` : ""}</div>
            </div>
          )}
          <button type="button" className="menu-toggle close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav className="nav nav-mobile" aria-label="Mobile primary">
          {navLinks}
        </nav>
        <div className="mobile-drawer-actions">
          <button className="btn btn-secondary btn-block" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
