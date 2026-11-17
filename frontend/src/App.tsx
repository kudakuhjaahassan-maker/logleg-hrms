import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./api/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import DirectoryPage from "./pages/DirectoryPage";
import ProfilePage from "./pages/ProfilePage";
import OrgChartPage from "./pages/OrgChartPage";
import LeavePage from "./pages/LeavePage";
import LeaveApprovalsPage from "./pages/LeaveApprovalsPage";
import AttendancePage from "./pages/AttendancePage";
import SettingsPage from "./pages/SettingsPage";
import CompensationPage from "./pages/CompensationPage";
import PayslipsAdminPage from "./pages/PayslipsAdminPage";
import UpgradePage from "./pages/UpgradePage";
import EmployeeDashboardPage from "./pages/EmployeeDashboardPage";
import ManagementSubscriptionsPage from "./pages/ManagementSubscriptionsPage";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback" style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Application Error</h2>
          <p>We encountered an unexpected error. Please try reloading the page.</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: "1rem" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return <div className="page-loading">Loading authentication state...</div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/employee-dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/employee-dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<AdminOnly><DashboardPage /></AdminOnly>} />
          <Route path="employee-dashboard" element={<EmployeeDashboardPage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="employees/:id" element={<ProfilePage />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="leave-approvals" element={<LeaveApprovalsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="compensation" element={<CompensationPage />} />
          <Route path="payslips" element={<PayslipsAdminPage />} />
          <Route path="upgrade" element={<UpgradePage />} />
          <Route path="management/subscriptions" element={<AdminOnly><ManagementSubscriptionsPage /></AdminOnly>} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AppErrorBoundary>
  );
}
