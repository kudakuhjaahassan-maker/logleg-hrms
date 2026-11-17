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
import { ErrorBoundary } from "./components/ErrorBoundary";

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined, info: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading, user } = useAuth();
  // Show loading state while auth initializes — prevents white screen on state mismatch
  if (loading) return <div className="page-loading">Loading authentication state...</div>;
  // If no token, redirect to login
  if (!token) return <Navigate to="/login" replace />;
  // Default role to EMPLOYEE if undefined — prevents crash from missing role
  const safeRole = user?.role ?? "EMPLOYEE";
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  // Safe optional chaining — handles undefined role during init
  if (user?.role === "EMPLOYEE") return <Navigate to="/employee-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Safe role check with fallback
  if (user?.role === "EMPLOYEE") return <Navigate to="/employee-dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary fallback={<div className="error-fallback">\n        <h2>Application Error</h2>\n        <p>We encountered an unexpected error. The page will reload.\n        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>\n      </div>}>\n      <Routes>
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}