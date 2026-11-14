import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AllowanceItem, type MyCompensationResponse, type Payslip } from "../api/client";
import { useAuth } from "../api/AuthContext";

function fmtMoney(amount: number, symbol: string) {
  return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPeriod(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function downloadPayslip(p: Payslip, employeeName: string) {
  const sym = p.currency || "$";
  const period = fmtPeriod(p.payPeriodYear, p.payPeriodMonth);
  const breakdown: AllowanceItem[] = Array.isArray(p.allowancesBreakdown) ? p.allowancesBreakdown : [];
  const rows = [
    ["Base salary (regular pay)", fmtMoney(p.regularPay, sym)],
    [`Overtime (${Number(p.overtimeHours).toFixed(2)} h)`, fmtMoney(p.overtimePay, sym)],
    ...breakdown.map((b) => [b.label, fmtMoney(b.amount, sym)]),
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Payslip ${period} - ${employeeName}</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:32px;color:#111}
  h1{margin:0 0 4px;font-size:22px} .muted{color:#555;margin:0 0 16px} table{width:100%;border-collapse:collapse;margin-top:12px}
  .logo{height:34px;margin-bottom:14px;display:block}
  th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left} th{color:#374151;font-size:13px;text-transform:uppercase;letter-spacing:.03em}
  .right{text-align:right} .total td{font-weight:700;border-top:2px solid #111} .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px}
  .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;margin:12px 0 4px} .meta div span{color:#555}</style></head><body>
  <img class="logo" src="${window.location.origin}/assets/logleg-logo.png" alt="LOGLEG" />
  <h1>Payslip — ${period}</h1><p class="muted">${employeeName}</p>
  <div class="meta"><div><span>Status:</span> <strong class="badge">${p.status}</strong></div><div><span>Generated:</span> ${p.generatedAt ? String(p.generatedAt).slice(0,10) : "—"}</div><div><span>Gross:</span> ${fmtMoney(p.grossPay, sym)}</div><div><span>Net:</span> ${fmtMoney(p.netPay, sym)}</div></div>
  <table><thead><tr><th>Component</th><th class="right">Amount</th></tr></thead><tbody>
  ${rows.map(([k,v]) => `<tr><td>${k}</td><td class="right">${v}</td></tr>`).join("")}
  <tr class="total"><td>Gross total</td><td class="right">${fmtMoney(p.grossPay, sym)}</td></tr>
  <tr><td>Deductions</td><td class="right">- ${fmtMoney(p.deductions, sym)}</td></tr>
  <tr class="total"><td>Net pay</td><td class="right">${fmtMoney(p.netPay, sym)}</td></tr>
  </tbody></table>
  <script>window.onload=()=>{window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}

export default function CompensationPage() {
  const { user, isHrAdmin } = useAuth();
  const [data, setData] = useState<MyCompensationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.myCompensation();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load compensation details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="page"><div className="empty">Loading compensation...</div></div>;
  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!data) return null;

  const { employee, currentPeriod, today, payslips, nextPayslipDate, activeAllowances } = data;
  const sym = employee.currencySymbol || "$";
  const canManage = isHrAdmin || user?.role === "MANAGER";
  const breakdown: AllowanceItem[] = activeAllowances?.breakdown || currentPeriod.allowancesBreakdown || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Compensation</h1>
          <p className="muted">Salary, working hours, overtime earnings and payslips for {employee.firstName} {employee.lastName}.</p>
        </div>
        {canManage && <Link className="btn btn-secondary" to="/payslips">Review payslips</Link>}
      </div>

      <div className="grid-dashboard">
        <section className="card">
          <div className="card-header-row">
            <h3>Salary & active allowances</h3>
            <span className="subtle">{employee.department?.name || "Unassigned"}</span>
          </div>
          <dl className="details">
            <div><dt>Base salary (monthly)</dt><dd className="strong">{fmtMoney(employee.baseSalary, sym)}</dd></div>
            <div><dt>Currency setting</dt><dd>{employee.currencySymbol || "—"} (e.g. $, MVR)</dd></div>
            <div><dt>Standard hours / day</dt><dd>{employee.standardHoursPerDay} h</dd></div>
            <div><dt>Overtime rate</dt><dd>{fmtMoney(employee.overtimeHourlyRate, sym)} / hour</dd></div>
            <div><dt>Payslip generation day</dt><dd>Day {employee.payslipGenerationDay} of each month</dd></div>
            <div><dt>Next payslip (for {fmtPeriod(currentPeriod.year, currentPeriod.month)})</dt><dd>{nextPayslipDate}</dd></div>
          </dl>
          <div className="allowances-block">
            <div className="strong" style={{ marginBottom: 6 }}>Active allowances & bonuses</div>
            {breakdown.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No active allowances or bonuses.</p>
            ) : (
              <ul className="allowance-list">
                {breakdown.map((b) => (
                  <li key={b.key} className="allowance-item"><span>{b.label}</span><span className="strong">{fmtMoney(b.amount, sym)}</span></li>
                ))}
              </ul>
            )}
            {employee.yearlyBonusEnabled && employee.yearlyBonusCriteria ? (
              <p className="hint" style={{ marginTop: 8 }}>Yearly bonus criteria: {employee.yearlyBonusCriteria}</p>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="card-header-row">
            <h3>This period · {fmtPeriod(currentPeriod.year, currentPeriod.month)}</h3>
            <span className="subtle">Live from attendance</span>
          </div>
          <div className="comp-stats">
            <div className="comp-stat">
              <div className="comp-stat-label">Worked today</div>
              <div className="comp-stat-value">{today.workedHours.toFixed(2)} h</div>
              <div className="subtle">{today.isClockedIn ? "Clocked in" : today.clockOut ? "Clocked out" : "Not clocked in"}</div>
            </div>
            <div className="comp-stat">
              <div className="comp-stat-label">Regular hours (period)</div>
              <div className="comp-stat-value">{currentPeriod.regularHours.toFixed(2)} h</div>
              <div className="subtle">{currentPeriod.daysCounted} day(s) logged</div>
            </div>
            <div className="comp-stat highlight">
              <div className="comp-stat-label">Overtime (period)</div>
              <div className="comp-stat-value">{currentPeriod.overtimeHours.toFixed(2)} h</div>
              <div className="subtle">{fmtMoney(currentPeriod.overtimePay, sym)} earned</div>
            </div>
            <div className="comp-stat">
              <div className="comp-stat-label">Allowances + bonus</div>
              <div className="comp-stat-value">{fmtMoney(Number(currentPeriod.allowancesTotal || 0) + Number(currentPeriod.yearlyBonus || 0), sym)}</div>
              <div className="subtle">Active, included in gross</div>
            </div>
            <div className="comp-stat">
              <div className="comp-stat-label">Estimated gross</div>
              <div className="comp-stat-value">{fmtMoney(currentPeriod.grossPay, sym)}</div>
              <div className="subtle">Base + OT + allowances</div>
            </div>
          </div>
          <p className="hint">Overtime is hours worked beyond {employee.standardHoursPerDay}h per day, paid at {fmtMoney(employee.overtimeHourlyRate, sym)}/h. All active allowances and bonuses are automatically included in gross. Estimate until payslip is generated.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-header-row">
          <h3>Monthly payslips</h3>
          <span className="subtle">{payslips.length} record(s) · downloadable</span>
        </div>
        {payslips.length === 0 ? (
          <p className="muted">No payslips yet. Your payslip for a month appears here once your generation day is reached.</p>
        ) : (
          <div className="table-card" style={{ border: "none", padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Base</th>
                  <th>Overtime</th>
                  <th>Allowances</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">{fmtPeriod(p.payPeriodYear, p.payPeriodMonth)}</td>
                    <td>{fmtMoney(p.baseSalary, p.currency)}</td>
                    <td>{p.overtimeHours.toFixed(2)} h · {fmtMoney(p.overtimePay, p.currency)}</td>
                    <td>{fmtMoney(Number(p.allowancesTotal || 0) + Number(p.yearlyBonus || 0), p.currency)}</td>
                    <td>{fmtMoney(p.grossPay, p.currency)}</td>
                    <td className="strong">{fmtMoney(p.netPay, p.currency)}</td>
                    <td><span className={`badge status-${p.status}`}>{p.status}</span></td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => downloadPayslip(p, `${employee.firstName} ${employee.lastName}`)}>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
