import { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext";
import { api, type LeaveRequest } from "../api/client";

export default function LeaveApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = user?.role === "MANAGER" || user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  const load = async () => {
    try {
      setError(null);
      const res = await api.listPendingLeaves();
      setRequests(res.leaveRequests);
    } catch (e: any) {
      setError(e?.message || "Failed to load pending requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canManage) load(); else setLoading(false); }, [canManage]);

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    setError(null);
    try {
      await api.reviewLeave(id, status);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update request");
    } finally {
      setBusyId(null);
    }
  };

  if (!canManage) {
    return <div className="page"><div className="alert error">Only managers and HR admins can access leave approvals.</div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leave Approvals</h1>
          <p className="muted">Review and approve or reject pending leave requests in your company.</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="card table-card">
        {loading ? <div className="empty">Loading pending requests...</div> : requests.length === 0 ? (
          <div className="empty">No pending leave requests.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="strong">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}</div>
                    <div className="subtle">{r.employee?.email}</div>
                  </td>
                  <td>{r.employee?.department?.name || "—"}</td>
                  <td>{r.leaveType}</td>
                  <td>{String(r.startDate).slice(0,10)} → {String(r.endDate).slice(0,10)}</td>
                  <td className="reason-cell">{r.reason || "—"}</td>
                  <td>{String(r.createdAt).slice(0,10)}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => review(r.id, "APPROVED")}>Approve</button>
                    <button className="btn btn-sm btn-danger" disabled={busyId === r.id} onClick={() => review(r.id, "REJECTED")}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
