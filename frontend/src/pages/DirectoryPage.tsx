import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Department, type Employee } from "../api/client";
import { useAuth } from "../api/AuthContext";
import EmployeeModal from "../components/EmployeeModal";

export default function DirectoryPage() {
  const { isHrAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dirRes, deptRes, allRes] = await Promise.all([
        api.listEmployees({ search, departmentId, status, page: 1, pageSize: 100 }),
        api.listDepartments(),
        api.listEmployees({ page: 1, pageSize: 100 }),
      ]);
      setEmployees(dirRes.employees);
      setDepartments(deptRes.departments);
      setAllEmployees(allRes.employees);
    } catch (err: any) {
      setError(err?.message || "Failed to load directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, status]);

  // debounce-like simple search submit behavior
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => { setEditing(null); setModalMode("create"); setModalOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setModalMode("edit"); setModalOpen(true); };

  const countLabel = useMemo(() => `${employees.length} employee${employees.length === 1 ? "" : "s"}`, [employees]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Employee Directory</h1>
          <p className="muted">Search and filter employees across your organization.</p>
        </div>
        {isHrAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Add Employee</button>}
      </div>

      <div className="card filters">
        <input
          className="input"
          placeholder="Search by name, email, title, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="ON_LEAVE">ON_LEAVE</option>
          <option value="TERMINATED">TERMINATED</option>
        </select>
        <div className="muted count">{countLabel}</div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="card table-card">
        {loading ? (
          <div className="empty">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="empty">No employees found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Department</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className="link strong" to={`/employees/${e.id}`}>{e.firstName} {e.lastName}</Link>
                    <div className="subtle">{e.role}</div>
                  </td>
                  <td>{e.title || "—"}</td>
                  <td>{e.department?.name || "Unassigned"}</td>
                  <td>{e.email}</td>
                  <td><span className={`badge status-${e.status}`}>{e.status}</span></td>
                  <td className="actions">
                    <Link className="btn btn-sm btn-secondary" to={`/employees/${e.id}`}>View</Link>
                    {isHrAdmin && <button className="btn btn-sm" onClick={() => openEdit(e)}>Edit</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeModal
        open={modalOpen}
        mode={modalMode}
        employee={editing}
        departments={departments}
        employees={allEmployees}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
