import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type Department, type Employee, type EmployeeStatus, type Role } from "../api/client";
import PasswordField from "./PasswordField";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  employee?: Employee | null;
  departments: Department[];
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

const roles: Role[] = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"];
const statuses: EmployeeStatus[] = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"];

export default function EmployeeModal({ open, mode, employee, departments, employees, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const allowanceDefaults = {
    foodAllowanceEnabled: false, foodAllowanceAmount: 0,
    accommodationAllowanceEnabled: false, accommodationAllowanceAmount: 0,
    punctualityAllowanceEnabled: false, punctualityAllowanceAmount: 0,
    uniformAllowanceEnabled: false, uniformAllowanceAmount: 0,
    transportPhoneAllowanceEnabled: false, transportPhoneAllowanceAmount: 0,
    ramadanAllowanceEnabled: false, ramadanAllowanceAmount: 0,
    yearlyBonusEnabled: false, yearlyBonusAmount: 0, yearlyBonusCriteria: "",
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && employee) {
      setForm({
        email: employee.email || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        title: employee.title || "",
        role: employee.role || "EMPLOYEE",
        departmentId: employee.departmentId || "",
        managerId: employee.managerId || "",
        phone: employee.phone || "",
        hireDate: employee.hireDate ? String(employee.hireDate).slice(0, 10) : "",
        status: employee.status || "ACTIVE",
        password: "",
        baseSalary: employee.baseSalary ?? 0,
        currencySymbol: employee.currencySymbol || "$",
        standardHoursPerDay: employee.standardHoursPerDay ?? 8,
        overtimeHourlyRate: employee.overtimeHourlyRate ?? 0,
        payslipGenerationDay: employee.payslipGenerationDay ?? 28,
        foodAllowanceEnabled: !!employee.foodAllowanceEnabled,
        foodAllowanceAmount: employee.foodAllowanceAmount ?? 0,
        accommodationAllowanceEnabled: !!employee.accommodationAllowanceEnabled,
        accommodationAllowanceAmount: employee.accommodationAllowanceAmount ?? 0,
        punctualityAllowanceEnabled: !!employee.punctualityAllowanceEnabled,
        punctualityAllowanceAmount: employee.punctualityAllowanceAmount ?? 0,
        uniformAllowanceEnabled: !!employee.uniformAllowanceEnabled,
        uniformAllowanceAmount: employee.uniformAllowanceAmount ?? 0,
        transportPhoneAllowanceEnabled: !!employee.transportPhoneAllowanceEnabled,
        transportPhoneAllowanceAmount: employee.transportPhoneAllowanceAmount ?? 0,
        ramadanAllowanceEnabled: !!employee.ramadanAllowanceEnabled,
        ramadanAllowanceAmount: employee.ramadanAllowanceAmount ?? 0,
        yearlyBonusEnabled: !!employee.yearlyBonusEnabled,
        yearlyBonusAmount: employee.yearlyBonusAmount ?? 0,
        yearlyBonusCriteria: employee.yearlyBonusCriteria || "",
      });
    } else {
      setForm({
        email: "",
        firstName: "",
        lastName: "",
        title: "",
        role: "EMPLOYEE",
        departmentId: "",
        managerId: "",
        phone: "",
        hireDate: "",
        status: "ACTIVE",
        password: "",
        baseSalary: 0,
        currencySymbol: "$",
        standardHoursPerDay: 8,
        overtimeHourlyRate: 0,
        payslipGenerationDay: 28,
        ...allowanceDefaults,
      });
    }
  }, [open, mode, employee]);

  const managerOptions = useMemo(
    () => employees.filter((e) => !employee || e.id !== employee.id),
    [employees, employee],
  );

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        title: form.title || null,
        role: form.role,
        departmentId: form.departmentId || null,
        managerId: form.managerId || null,
        phone: form.phone || null,
        hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : null,
        status: form.status,
        baseSalary: Number(form.baseSalary ?? 0),
        currencySymbol: String(form.currencySymbol || "$").trim() || "$",
        standardHoursPerDay: Number(form.standardHoursPerDay ?? 8),
        overtimeHourlyRate: Number(form.overtimeHourlyRate ?? 0),
        payslipGenerationDay: Number(form.payslipGenerationDay ?? 28),
        foodAllowanceEnabled: !!form.foodAllowanceEnabled,
        foodAllowanceAmount: Number(form.foodAllowanceAmount ?? 0),
        accommodationAllowanceEnabled: !!form.accommodationAllowanceEnabled,
        accommodationAllowanceAmount: Number(form.accommodationAllowanceAmount ?? 0),
        punctualityAllowanceEnabled: !!form.punctualityAllowanceEnabled,
        punctualityAllowanceAmount: Number(form.punctualityAllowanceAmount ?? 0),
        uniformAllowanceEnabled: !!form.uniformAllowanceEnabled,
        uniformAllowanceAmount: Number(form.uniformAllowanceAmount ?? 0),
        transportPhoneAllowanceEnabled: !!form.transportPhoneAllowanceEnabled,
        transportPhoneAllowanceAmount: Number(form.transportPhoneAllowanceAmount ?? 0),
        ramadanAllowanceEnabled: !!form.ramadanAllowanceEnabled,
        ramadanAllowanceAmount: Number(form.ramadanAllowanceAmount ?? 0),
        yearlyBonusEnabled: !!form.yearlyBonusEnabled,
        yearlyBonusAmount: Number(form.yearlyBonusAmount ?? 0),
        yearlyBonusCriteria: form.yearlyBonusCriteria ? String(form.yearlyBonusCriteria) : null,
      };
      if (mode === "create") {
        payload.password = form.password;
        await api.createEmployee(payload);
      } else if (employee) {
        if (form.password) payload.password = form.password;
        await api.updateEmployee(employee.id, payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === "create" ? "Add Employee" : "Edit Employee"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="form modal-body" onSubmit={onSubmit}>
          <div className="grid-2">
            <label>First name<input value={form.firstName || ""} onChange={(e) => set("firstName", e.target.value)} required /></label>
            <label>Last name<input value={form.lastName || ""} onChange={(e) => set("lastName", e.target.value)} required /></label>
          </div>
          <div className="grid-2">
            <label>Email<input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} required /></label>
            <label>Title<input value={form.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Software Engineer" /></label>
          </div>
          <div className="grid-2">
            <label>Department
              <select value={form.departmentId || ""} onChange={(e) => set("departmentId", e.target.value)}>
                <option value="">Unassigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Manager
              <select value={form.managerId || ""} onChange={(e) => set("managerId", e.target.value)}>
                <option value="">No manager</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid-3">
            <label>Role
              <select value={form.role || "EMPLOYEE"} onChange={(e) => set("role", e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status || "ACTIVE"} onChange={(e) => set("status", e.target.value)}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Hire date<input type="date" value={form.hireDate || ""} onChange={(e) => set("hireDate", e.target.value)} /></label>
          </div>
          <div className="grid-2">
            <label>Phone<input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></label>
            <label>
              {mode === "create" ? "Password" : "New password (optional)"}
              <PasswordField value={form.password || ""} onChange={(e) => set("password", e.target.value)} minLength={mode === "create" ? 8 : undefined} required={mode === "create"} placeholder={mode === "edit" ? "Leave blank to keep current" : ""} autoComplete="new-password" />
            </label>
          </div>

          <div className="form-section">
            <div className="form-section-title">Compensation & payslip</div>
            <div className="grid-3">
              <label>Base salary (monthly)
                <input type="number" min="0" step="0.01" value={form.baseSalary ?? 0} onChange={(e) => set("baseSalary", e.target.value)} />
              </label>
              <label>Currency symbol
                <input value={form.currencySymbol || "$"} onChange={(e) => set("currencySymbol", e.target.value)} placeholder="$, MVR, €" maxLength={10} />
              </label>
              <label>Payslip generation day
                <input type="number" min="1" max="31" value={form.payslipGenerationDay ?? 28} onChange={(e) => set("payslipGenerationDay", e.target.value)} />
              </label>
            </div>
            <div className="grid-2">
              <label>Standard hours per day
                <input type="number" min="0" max="24" step="0.25" value={form.standardHoursPerDay ?? 8} onChange={(e) => set("standardHoursPerDay", e.target.value)} />
              </label>
              <label>Overtime hourly rate
                <input type="number" min="0" step="0.01" value={form.overtimeHourlyRate ?? 0} onChange={(e) => set("overtimeHourlyRate", e.target.value)} />
              </label>
            </div>
            <p className="field-hint">The payslip for the previous month is automatically generated on the selected day each month (overtime is calculated from attendance beyond standard hours).</p>
          </div>

          <div className="form-section">
            <div className="form-section-title">Allowances & bonuses (togglable)</div>
            <p className="field-hint" style={{ marginTop: 0 }}>Active allowances are added to gross salary each pay period. Toggle on and set an amount for each item that applies.</p>
            <div className="allowance-grid">
              {([
                ["foodAllowance", "Food Allowance"],
                ["accommodationAllowance", "Accommodation Allowance"],
                ["punctualityAllowance", "Punctuality Allowance"],
                ["uniformAllowance", "Dress Code / Uniform Allowance"],
                ["transportPhoneAllowance", "Transport / Phone Allowance"],
                ["ramadanAllowance", "Ramadan Allowance"],
              ] as const).map(([key, label]) => {
                const en = `${key}Enabled`;
                const amt = `${key}Amount`;
                return (
                  <div className="allowance-row" key={key}>
                    <label className="toggle-label">
                      <input type="checkbox" checked={!!form[en]} onChange={(e) => set(en, e.target.checked)} />
                      <span>{label}</span>
                    </label>
                    <input
                      className="allowance-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form[amt] ?? 0}
                      onChange={(e) => set(amt, e.target.value)}
                      disabled={!form[en]}
                      aria-label={`${label} amount`}
                      placeholder="Amount"
                    />
                  </div>
                );
              })}
            </div>

            <div className="allowance-bonus-block">
              <div className="allowance-row">
                <label className="toggle-label">
                  <input type="checkbox" checked={!!form.yearlyBonusEnabled} onChange={(e) => set("yearlyBonusEnabled", e.target.checked)} />
                  <span>Yearly Performance Bonus</span>
                </label>
                <input
                  className="allowance-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.yearlyBonusAmount ?? 0}
                  onChange={(e) => set("yearlyBonusAmount", e.target.value)}
                  disabled={!form.yearlyBonusEnabled}
                  aria-label="Yearly performance bonus amount"
                  placeholder="Amount"
                />
              </div>
              <label className="bonus-criteria">
                Year-end bonus criteria / target (based on annual performance scores or targets)
                <textarea
                  rows={2}
                  value={form.yearlyBonusCriteria || ""}
                  onChange={(e) => set("yearlyBonusCriteria", e.target.value)}
                  disabled={!form.yearlyBonusEnabled}
                  placeholder="e.g. Score ≥ 90% on annual review, or exceed yearly targets"
                />
              </label>
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
