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

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") return <Navigate to="/employee-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "EMPLOYEE") return <Navigate to="/employee-dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
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
        <Route path="settings" element={<SettingsPage />} />
      <Route path="upgrade" element={<UpgradePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
