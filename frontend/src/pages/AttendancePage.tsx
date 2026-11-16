import { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext";
import { api, type DailyAttendanceResponse } from "../api/client";

function formatMs(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    CLOCKED_IN: "status-ACTIVE",
    CLOCKED_OUT: "status-APPROVED",
    LATE: "status-ON_LEAVE",
    ABSENT: "status-TERMINATED",
    ON_LEAVE: "status-PENDING",
  };
  return <span className={`badge ${map[s] || ""}`}>{s.replace("_", " ")}</span>;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DailyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = user?.role === "MANAGER" || user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.dailyAttendance(date);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load attendance log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canView) load(); else setLoading(false); }, [date, canView]);

  if (!canView) {
    return <div className="page"><div className="alert error">Only managers and HR admins can access the daily attendance log.</div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Daily Attendance</h1>
          <p className="muted">See who is clocked in, late, or absent for the selected day.</p>
        </div>
        <div className="header-actions">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {data && (
        <div className="summary-grid">
          <div className="card summary-card"><div className="summary-label">Total</div><div className="summary-value">{data.summary.total}</div></div>
          <div className="card summary-card"><div className="summary-label">Clocked in</div><div className="summary-value">{data.summary.clockedIn}</div></div>
          <div className="card summary-card"><div className="summary-label">Clocked out</div><div className="summary-value">{data.summary.clockedOut}</div></div>
          <div className="card summary-card warn"><div className="summary-label">Late</div><div className="summary-value">{data.summary.late}</div></div>
          <div className="card summary-card danger"><div className="summary-label">Absent</div><div className="summary-value">{data.summary.absent}</div></div>
          <div className="card summary-card"><div className="summary-label">On leave</div><div className="summary-value">{data.summary.onLeave}</div></div>
        </div>
      )}

      <div className="card table-card">
        {loading ? <div className="empty">Loading attendance...</div> : !data ? null : data.rows.length === 0 ? (
          <div className="empty">No employees found for this company.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Shift</th>
                <th>Clock in</th>
                <th>Clock out</th>
                <th>Worked</th>
                <th>Late</th>
                <th>Overtime</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.employee.id}>
                  <td>
                    <div className="strong">{r.employee.firstName} {r.employee.lastName}</div>
                    <div className="subtle">{r.employee.email}{r.employee.title ? ` · ${r.employee.title}` : ""}</div>
                  </td>
                  <td>{r.employee.department?.name || "—"}</td>
                  <td>{r.employee.shiftStartTime || "—"}–{r.employee.shiftEndTime || "—"}</td>
                  <td>{r.log?.clockIn ? new Date(r.log.clockIn).toLocaleTimeString() : "—"}</td>
                  <td>{r.log?.clockOut ? new Date(r.log.clockOut).toLocaleTimeString() : "—"}</td>
                  <td>{formatMs(r.workedMs)}</td>
                  <td>{r.lateMinutes > 0 ? formatMs(r.lateMinutes * 60000) : "—"}</td>
                  <td>{r.overtimeMinutes > 0 ? formatMs(r.overtimeMinutes * 60000) : "—"}</td>
                  <td>{statusBadge(r.attendanceStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && (
        <p className="hint">
          Policy (UTC day {data.date}): each employee's own shift window applies (default {data.policy.defaultShiftStart}–{data.policy.defaultShiftEnd}, {Math.round(data.policy.standardShiftTargetMinutes / 60)}h target).
          Working the full target makes up a late arrival; minutes beyond it count as overtime. “Absent” means no clock-in recorded for an active (non-terminated, not on-leave status) employee.
        </p>
      )}
    </div>
  );
}
