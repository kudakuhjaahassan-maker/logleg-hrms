import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OrgNode } from "../api/client";

function TreeNode({ node }: { node: OrgNode }) {
  return (
    <li className="org-node">
      <div className={`org-card status-border-${node.status}`}>
        <div className="org-name"><Link to={`/employees/${node.id}`} className="link">{node.name}</Link></div>
        <div className="org-title">{node.title || node.role}</div>
        <div className="org-meta">{node.department?.name || "Unassigned"} · {node.email}</div>
        <div><span className={`badge status-${node.status}`}>{node.status}</span></div>
      </div>
      {node.reports.length > 0 && (
        <ul className="org-children">
          {node.reports.map((child) => <TreeNode key={child.id} node={child} />)}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const [roots, setRoots] = useState<OrgNode[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getOrgChart();
        setRoots(res.roots);
        setCount(res.employeeCount);
      } catch (err: any) {
        setError(err?.message || "Failed to load org chart");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Organizational Chart</h1>
          <p className="muted">Reporting hierarchy based on manager relationships ({count} employees).</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="card org-chart-card">
        {loading ? (
          <div className="empty">Loading org chart...</div>
        ) : roots.length === 0 ? (
          <div className="empty">No employees found.</div>
        ) : (
          <div className="org-tree-wrap">
            <ul className="org-tree">
              {roots.map((root) => <TreeNode key={root.id} node={root} />)}
            </ul>
          </div>
        )}
        <p className="hint">Employees without a manager in the company (or with an external/invalid manager reference) appear as top-level nodes.</p>
      </div>
    </div>
  );
}
