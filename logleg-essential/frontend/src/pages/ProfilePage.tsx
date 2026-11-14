import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Department, type Employee, type ProfileResponse } from "../api/client";
import { useAuth } from "../api/AuthContext";
import EmployeeModal from "../components/EmployeeModal";
import PasswordField from "../components/PasswordField";

export default function ProfilePage() {
  const { id } = useParams();
  const { user, isHrAdmin, refreshMe } = useAuth();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [acctEmail, setAcctEmail] = useState("");
  const [acctNewPassword, setAcctNewPassword] = useState("");
  const [acctCurrentPassword, setAcctCurrentPassword] = useState("");
  const [acctSaving, setAcctSaving] = useState(false);
  const [acctError, setAcctError] = useState<string | null>(null);
  const [acctSuccess, setAcctSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, deptRes, dirRes] = await Promise.all([
        api.getEmployee(id),
        api.listDepartments(),
        api.listEmployees({ page: 1, pageSize: 100 }),
      ]);
      setData(profile);
      setDepartments(deptRes.departments);
      setAllEmployees(dirRes.employees);
    } catch (err: any) {
      setError(err?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (data?.employee) setAcctEmail(data.employee.email || "");
  }, [data?.employee?.email]);

  const onSaveAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setAcctError(null);
    setAcctSuccess(null);
    const nextEmail = acctEmail.trim().toLowerCase();
    const emailChanged = nextEmail && nextEmail !== data.employee.email.toLowerCase();
    if (!emailChanged && !acctNewPassword) {
      setAcctError("Enter a new email and/or a new password to save changes.");
      return;
    }
    if (!acctCurrentPassword) {
      setAcctError("Current password is required to update your email or password.");
      return;
    }
    setAcctSaving(true);
    try {
      const payload: { email?: string; newPassword?: string; currentPassword: string } = {
        currentPassword: acctCurrentPassword,
      };
      if (emailChanged) payload.email = nextEmail;
      if (acctNewPassword) payload.newPassword = acctNewPassword;
      await api.updateMyAccount(payload);
      setAcctCurrentPassword("");
      setAcctNewPassword("");
      setAcctSuccess("Account updated successfully." + (acctNewPassword ? " Your password has been changed." : ""));
      await refreshMe();
      await load();
    } catch (err: any) {
      setAcctError(err?.message || "Failed to update account");
    } finally {
      setAcctSaving(false);
    }
  };

  if (loading) return <div className="page"><div className="empty">Loading profile...</div></div>;
  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!data) return null;

  const { employee, history, permissions } = data;
  const isSelf = user?.id === employee.id;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/directory" className="link muted">← Back to directory</Link>
          <h1>{employee.firstName} {employee.lastName}</h1>
          <p className="muted">{employee.title || employee.role} · {employee.department?.name || "Unassigned"}</p>
        </div>
        <div className="header-actions">
          {isSelf && <span className="badge">Your profile</span>}
          {permissions.canEdit && <button className="btn btn-primary" onClick={() => setModalOpen(true)}>Edit employee</button>}
        </div>
      </div>

      <div className="grid-profile">
        <section className="card">
          <h3>Employee Information</h3>
          <dl className="details">
            <div><dt>Full name</dt><dd>{employee.firstName} {employee.lastName}</dd></div>
            <div><dt>Email</dt><dd>{employee.email}</dd></div>
            <div><dt>Title</dt><dd>{employee.title || "—"}</dd></div>
            <div><dt>Department</dt><dd>{employee.department?.name || "Unassigned"}</dd></div>
            <div><dt>Manager</dt><dd>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "—"}</dd></div>
            <div><dt>Role</dt><dd>{employee.role}</dd></div>
            <div><dt>Status</dt><dd><span className={`badge status-${employee.status}`}>{employee.status}</span></dd></div>
            <div><dt>Phone</dt><dd>{employee.phone || "—"}</dd></div>
            <div><dt>Hire date</dt><dd>{employee.hireDate ? String(employee.hireDate).slice(0, 10) : "—"}</dd></div>
          </dl>
          {permissions.canViewCompensation && (
            <div className="profile-subsection">
              <h4>Compensation</h4>
              <dl className="details">
                <div><dt>Base salary</dt><dd>{employee.currencySymbol || "$"} {Number(employee.baseSalary ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
                <div><dt>Standard hours / day</dt><dd>{Number(employee.standardHoursPerDay ?? 8)} h</dd></div>
                <div><dt>Overtime rate</dt><dd>{employee.currencySymbol || "$"} {Number(employee.overtimeHourlyRate ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / h</dd></div>
                <div><dt>Payslip generation day</dt><dd>Day {employee.payslipGenerationDay ?? 28} of each month</dd></div>
              </dl>
              {isSelf && <Link className="link" to="/compensation">View salary, overtime &amp; payslips →</Link>}
            </div>
          )}

          {isSelf && (
            <div className="profile-subsection">
              <h4>Account (email &amp; password)</h4>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                You can update your own email address and password here. Other profile details can only be changed by your company admin/HR.
              </p>
              <form className="form" onSubmit={onSaveAccount}>
                <label>
                  Email
                  <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} required />
                </label>
                <label>
                  New password <span className="subtle">(leave blank to keep current)</span>
                  <PasswordField value={acctNewPassword} onChange={(e) => setAcctNewPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete="new-password" />
                </label>
                <label>
                  Current password <span className="subtle">(required to save)</span>
                  <PasswordField value={acctCurrentPassword} onChange={(e) => setAcctCurrentPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                {acctError && <div className="alert error">{acctError}</div>}
                {acctSuccess && <div className="alert success">{acctSuccess}</div>}
                <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="btn btn-primary" type="submit" disabled={acctSaving}>
                    {acctSaving ? "Saving..." : "Save email / password"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        <section className="card">
          <h3>Documents {permissions.canViewDocuments ? "" : "(restricted)"}</h3>
          {!permissions.canViewDocuments ? (
            <p className="muted">Documents are visible to the employee and HR/admin.</p>
          ) : Array.isArray(employee.documents) && employee.documents.length > 0 ? (
            <ul className="doc-list">
              {employee.documents.map((doc: any, i: number) => (
                <li key={i} className="doc-item">
                  <div>
                    <div className="strong">{doc.name || doc.title || `Document ${i + 1}`}</div>
                    <div className="subtle">{doc.type || doc.category || "Document"}{doc.uploadedAt ? ` · ${String(doc.uploadedAt).slice(0,10)}` : ""}</div>
                  </div>
                  {doc.url && <a className="link" href={doc.url} target="_blank" rel="noreferrer">Open</a>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No documents on file.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h3>History {permissions.canViewHistory ? "" : "(restricted)"}</h3>
        {!permissions.canViewHistory || !history ? (
          <p className="muted">Attendance, leave, and payroll history are visible to the employee and HR/admin.</p>
        ) : (
          <div className="history-grid">
            <div>
              <h4>Leave Requests</h4>
              {history.leaveRequests.length === 0 ? <p className="muted">No leave requests.</p> : (
                <ul className="history-list">
                  {history.leaveRequests.map((r: any) => (
                    <li key={r.id}>
                      <span className="strong">{r.leaveType}</span> · {String(r.startDate).slice(0,10)} → {String(r.endDate).slice(0,10)} · <span className={`badge status-${r.status}`}>{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4>Attendance (recent)</h4>
              {history.attendanceLogs.length === 0 ? <p className="muted">No attendance logs.</p> : (
                <ul className="history-list">
                  {history.attendanceLogs.map((a: any) => (
                    <li key={a.id}>
                      <span className="strong">{String(a.date).slice(0,10)}</span> · in: {a.clockIn ? new Date(a.clockIn).toLocaleTimeString() : "—"} · out: {a.clockOut ? new Date(a.clockOut).toLocaleTimeString() : "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4>Payroll / Payslips</h4>
              {history.payrollRecords.length === 0 ? <p className="muted">No payroll records.</p> : (
                <ul className="history-list">
                  {history.payrollRecords.map((p: any) => {
                    const sym = p.currency || "$";
                    const otH = p.overtimeHours != null ? Number(p.overtimeHours) : null;
                    const otP = p.overtimePay != null ? Number(p.overtimePay) : null;
                    return (
                      <li key={p.id}>
                        <span className="strong">{p.payPeriodYear}-{String(p.payPeriodMonth).padStart(2,"0")}</span> · Net {sym} {Number(p.netPay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {otH != null ? <> · OT {otH.toFixed(2)}h ({sym} {Number(otP || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</> : null}
                        {" · "}<span className={`badge status-${p.status}`}>{p.status}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {permissions.canEdit && (
        <EmployeeModal
          open={modalOpen}
          mode="edit"
          employee={employee}
          departments={departments}
          employees={allEmployees}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
