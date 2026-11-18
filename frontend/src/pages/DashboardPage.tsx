import React from "react";
import { Link } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import ClockWidget from "../components/ClockWidget";
import AttendanceTrendChart from "../components/AttendanceTrendChart";
export const DashboardPage = () => {
  const { user } = useUser();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  return (
    <div className="dashboard-container">
      <ClockWidget />
      {isAdmin && <AttendanceTrendChart data={[]} />}
      <h2>Quick Links</h2>
      <div className="quick-links">
        {user && (
          <Link className="quick-link" to={`/employees/${user.id}`}>
            <span className="quick-link-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-2-2l-7-7l-2 2l7 7z" />
              </svg>
            </span>
            <strong>My Profile</strong>
            <span>Your information and history</span>
          </Link>
        )}
        <Link className="quick-link" to="/departments">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
            </svg>
          </span>
          <strong>Directory</strong>
          <span>View company directory</span>
        </Link>
        <Link className="quick-link" to="/org-chart">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2hz" />
            </svg>
          </span>
          <strong>Org Chart</strong>
          <span>View organizational chart</span>
        </Link>
        <Link className="quick-link" to="/leave">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2V6h2v12h-2V6zM7 22h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v8z" />
            </svg>
          </span>
          <strong>Leave</strong>
          <span>Submit and manage leave</span>
        </Link>
        <Link className="quick-link" to="/compensation">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2hz" />
            </svg>
          </span>
          <strong>Compensation</strong>
          <span>View compensation details</span>
        </Link>
        <Link className="quick-link" to="/attendance">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 18 12 12 18" />
            </svg>
          </span>
          <strong>Attendance</strong>
          <span>Track attendance</span>
        </Link>
        <Link className="quick-link" to="/payslips">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <strong>Payslips</strong>
          <span>View payslips</span>
        </Link>
        <Link className="quick-link" to="/profile">
          <span className="quick-link-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </span>
          <strong>Profile</strong>
          <span>View and edit profile</span>
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;