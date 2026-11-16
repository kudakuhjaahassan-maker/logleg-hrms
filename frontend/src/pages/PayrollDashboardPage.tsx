// @tsx
import React from "react";
import { Navigate, useParams } from "react-router-dom";

export const PayrollDashboardPage = () => {
  const { user } = useParams();

  // Simple placeholder - redirect if needed
  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Payroll Dashboard</h1>
          <p className="muted">Payroll management interface</p>
        </div>
      </div>
      <div className="card">
        <p className="muted">Payroll dashboard loading...</p>
      </div>
    </div>
  );
};
