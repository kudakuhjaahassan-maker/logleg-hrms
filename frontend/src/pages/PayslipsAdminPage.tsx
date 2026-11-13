import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, type Payslip, type PayrollStatus } from "../api/client";
import { useAuth } from "../api/AuthContext";

function fmtMoney(amount: number, symbol: string) {
  return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPeriod(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

const statuses: Array<PayrollStatus | ""> = ["", "PROCESSED", "PAID", "DRAFT"];

export default function PayslipsAdminPage() {
  const { user, isHrAdmin } = useAuth();
  const canManage = isHrAdmin || user?.role === "MANAGER";
  const canDisburse = isHrAdmin; // mark paid is HR/admin in backend

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState({ total: 0, processed: 0, paid: 0, draft: 0 });
  const [status, setStatus] = useState<PayrollStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPayslips(status ? { status } : undefined);
      setPayslips(res.payslips);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err?.message || "Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canManage]);

  if (!canManage) return <Navigate to="/dashboard" replace />;

  const generate = async () => {
    setBusy("generate");
    setError(null);
    setInfo(null);
    try {
      const res = await api.generatePayslips();
      setInfo(`Generated/updated payslips for ${fmtPeriod(res.period.year, res.period.month)} (${res.generated} employee record(s) due).`);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to generate payslips");
    } finally {
      setBusy(null);
    }
  };

  const mark = async (id: string, next: PayrollStatus) => {
    setBusy(id);
    setError(null);
    try {
      await api.updatePayslipStatus(id, next);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update payslip");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Payslips Review</h1>
          <p className="muted">Automatically generated payslips (based on attendance and overtime) ready for review and payout.</p>
        </div>
        <div className="header-actions">
          {isHrAdmin && (
            <button className="btn btn-primary" onClick={generate} disabled={busy === "generate"}>
              {busy === "generate" ? "Generating..." : "Generate due payslips"}
            </button>
          )}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{summary.total}</div></div>
        <div className="stat-card"><div className="stat-label">Ready (processed)</div><div className="stat-value">{summary.processed}</div></div>
        <div className="stat-card"><div className="stat-label">Paid</div><div className="stat-value">{summary.paid}</div></div>
        <div className="stat-card"><div className="stat-label">Draft</div><div className="stat-value">{summary.draft}</div></div>
      </div>

      <div className="card filters">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PayrollStatus | "")}>
          {statuses.map((s) => <option key={s || "all"} value={s}>{s || "All statuses"}</option>)}
        </select>
        <div className="muted count">Showing {payslips.length} payslip(s)</div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert success">{info}</div>}

      <div className="card table-card">
        {loading ? (
          <div className="empty">Loading payslips...</div>
        ) : payslips.length === 0 ? (
          <div className="empty">No payslips found. Payslips are generated on each employee's configured day of the month (for the previous month) once attendance is recorded.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Base</th>
                <th>Overtime</th>
                <th>Allowances</th>
                <th>Gross / Net</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="strong">{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : p.employeeId}</div>
                    <div className="subtle">{p.employee?.email}{p.employee?.department ? ` · ${p.employee.department.name}` : ""}</div>
                  </td>
                  <td>{fmtPeriod(p.payPeriodYear, p.payPeriodMonth)}</td>
                  <td>{fmtMoney(p.baseSalary, p.currency)}</td>
                  <td>{p.overtimeHours.toFixed(2)} h<br /><span className="subtle">{fmtMoney(p.overtimePay, p.currency)}</span></td>
                  <td>{fmtMoney(Number(p.allowancesTotal || 0) + Number(p.yearlyBonus || 0), p.currency)}</td>
                  <td>
                    <div>{fmtMoney(p.grossPay, p.currency)}</div>
                    <div className="strong">Net {fmtMoney(p.netPay, p.currency)}</div>
                    <div className="subtle">incl. allowances</div>
                  </td>
                  <td><span className={`badge status-${p.status}`}>{p.status}</span></td>
                  <td className="actions">
                    {canDisburse && p.status !== "PAID" && (
                      <button className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => mark(p.id, "PAID")}>
                        {busy === p.id ? "…" : "Mark paid"}
                      </button>
                    )}
                    {canDisburse && p.status === "PAID" && (
                      <button className="btn btn-sm btn-secondary" disabled={busy === p.id} onClick={() => mark(p.id, "PROCESSED")}>
                        Reopen
                      </button>
                    )}
                    {!canDisburse && <span className="subtle">HR disburses</span>}
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
