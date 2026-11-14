import { FormEvent, useEffect, useState } from "react";
import { api, type LeaveRequest, type LeaveType } from "../api/client";

const leaveTypes: LeaveType[] = ["ANNUAL", "SICK", "UNPAID"];

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ leaveType: "ANNUAL" as LeaveType, startDate: "", endDate: "", reason: "" });

  const load = async () => {
    try {
      setError(null);
      const res = await api.listLeaves({ mine: true });
      setRequests(res.leaveRequests);
    } catch (e: any) {
      setError(e?.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.createLeave({
        leaveType: form.leaveType,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        reason: form.reason || undefined,
      });
      setSuccess("Leave request submitted.");
      setForm({ leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leave</h1>
          <p className="muted">Submit a leave request and track your request status.</p>
        </div>
      </div>

      <div className="grid-leave">
        <section className="card">
          <h3>New Leave Request</h3>
          <form className="form" onSubmit={onSubmit}>
            <label>Leave type
              <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}>
                {leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label>Start date<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label>End date<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            </div>
            <label>Reason
              <textarea rows={4} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional reason for your request" />
            </label>
            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</button>
          </form>
        </section>

        <section className="card">
          <h3>My Leave Requests</h3>
          {loading ? <div className="empty">Loading...</div> : requests.length === 0 ? (
            <p className="muted">You have not submitted any leave requests.</p>
          ) : (
            <div className="table-card inner">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">{r.leaveType}</td>
                      <td>{String(r.startDate).slice(0,10)} → {String(r.endDate).slice(0,10)}</td>
                      <td className="reason-cell">{r.reason || "—"}</td>
                      <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
