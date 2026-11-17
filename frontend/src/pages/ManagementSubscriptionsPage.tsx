import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";

interface PendingRequest {
  id: string;
  email: string;
  tier: string;
  status: string;
  createdAt?: string;
}

export default function ManagementSubscriptionsPage() {
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (loading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.subscriptionsListPending();
        if (!cancelled) {
          setRequests(Array.isArray(data?.requests) ? data.requests : []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load pending subscriptions");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, isAdmin]);

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleApprove = async (requestId: string) => {
    try {
      await api.subscriptionsApprove(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      setError(err?.message || "Failed to approve subscription");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api.subscriptionsReject(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      setError(err?.message || "Failed to reject subscription");
    }
  };

  const tierLabel = (tier: string) => {
    switch (tier) {
      case "starter":
        return "Starter / Small Business";
      case "growth":
        return "Growth / Pro Tier";
      case "enterprise":
        return "Enterprise Tier";
      default:
        return tier || "Unknown";
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Pending Subscription Requests</h2>
          <p className="muted">
            View and manage subscription tier upgrade requests awaiting payment verification.
          </p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {fetching ? (
        <div className="empty">Loading pending subscription requests...</div>
      ) : requests.length === 0 ? (
        <div className="empty">
          <h3>No pending subscription requests</h3>
          <p>There are currently no pending subscription requests for this company.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Requested Tier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>{req.email}</td>
                  <td>{tierLabel(req.tier)}</td>
                  <td>
                    <span className={`badge badge-${req.status === "approved" ? "success" : req.status === "rejected" ? "danger" : "warning"}`}>
                      {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : "Pending"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="btn btn-sm btn-primary"
                        disabled={req.status !== "pending"}
                      >
                        Approve / Unlock Tier
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        className="btn btn-sm btn-secondary"
                        disabled={req.status !== "pending"}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
