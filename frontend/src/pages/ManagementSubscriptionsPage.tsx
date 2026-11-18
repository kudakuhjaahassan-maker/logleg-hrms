import { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";

interface PendingRequest {
  id: string;
  email: string;
  tier: string;
  status: string;
  createdAt?: string;
  companyName?: string;
  referenceId?: string;
  proofUrl?: string;
  refundAccountDetails?: string | null;
}

// Access Denied component for non-SUPER_ADMIN users
function AccessDenied() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Access Denied</h2>
          <p>Only SUPER_ADMIN can view or manage pending subscription requests.</p>
        </div>
      </div>
      <div className="empty" style={{ textAlign: "center", padding: "2rem" }}>
        <button
          onClick={() => window.history.back()}
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function ManagementSubscriptionsPage() {
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelledRefund, setShowCancelledRefund] = useState(false);

  // Only SUPER_ADMIN can access this page; redirect all others gracefully
  if (!user || user.role !== "SUPER_ADMIN") {
    return <AccessDenied />;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.subscriptionsListPending();
        if (!cancelled) {
          setRequests(Array.isArray(data?.requests) ? data.requests : []);
        }
      } catch (err: any) {
        // Prevent API errors from crashing the page / AppErrorBoundary
        if (!cancelled) setError(err?.message || "Failed to load pending subscriptions");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  // Error state: show error message instead of crashing
  if (error) {
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
        <div className="alert error" style={{ margin: "1rem 0" }}>{error}</div>
        <div className="empty" style={{ textAlign: "center" }}>
          <p>Failed to load data. Please try again.</p>
        </div>
      </div>
    );
  }

  // Filter requests based on showCancelledRefund state
  const filteredRequests = showCancelledRefund
    ? requests.filter(
        (r) =>
          r.status === "cancelled" || r.status === "refund-pending" || r.refundAccountDetails !== undefined
      )
    : requests.filter((r) => r.status === "pending");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Pending Subscription Requests</h2>
          {/* Cancelled / Pending Refund filter */}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              variant="outline"
              onClick={() => setShowCancelledRefund(!showCancelledRefund)}
            >
              {showCancelledRefund ? "Show Active" : "Show Cancelled / Pending Refund"}
            </button>
          </div>

          <p className="muted">
            View and manage subscription tier upgrade requests awaiting payment verification.
          </p>
        </div>
      </div>

      {error && <div className="alert error" style={{ margin: "1rem 0" }}>{error}</div>}

      {fetching ? (
        <div className="empty">Loading pending subscription requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty">
          <h3>{showCancelledRefund ? "No cancelled/refund requests" : "No pending requests"}</h3>
          <p>
            {showCancelledRefund ? "There are currently no cancelled or pending refund requests." : "There are currently no pending subscription requests for this company."}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Requested Tier</th>
                <th>Status</th>
                <th>Reference ID</th>
                <th>Refund Account Details</th>
                <th>Payment Slip</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id}>
                  <td>{req.email}</td>
                  <td>{tierLabel(req.tier)}</td>
                  <td>
                    <span className={`badge badge-${req.status === "approved" ? "success" : req.status === "rejected" ? "danger" : "warning"}`}>
                      {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : "Pending"}
                    </span>
                  </td>
                  <td>{req.referenceId || "—"}</td>
                  <td>
                    {req.refundAccountDetails ? (
                      <span style={{ whiteSpace: "nowrap" }}>{req.refundAccountDetails}</span>
                    ) : (
                      <span>—</span>
                    )
                  </td>
                  <td>{renderPaymentSlip(req.proofUrl)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="btn btn-sm btn-primary"
                          disabled={req.status !== "pending"}
                        >
                          Approve / Unlock Tier
                        </button>
                      )}
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleReject(req.id)}
                          className="btn btn-sm btn-secondary"
                          disabled={req.status !== "pending"}
                        >
                          Reject
                        </button>
                      )}
                      {!req.status || req.status === "cancelled" && (
                        <button
                          onClick={() => handleRefundDetails(req.id)}
                          className="btn btn-sm btn-outline"
                        >
                          View Refund Details
                        </button>
                      )}
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

// Helper function to handle refund details viewing
function handleRefundDetails(requestId: string) {
  // Navigate to details or show modal
  window.location.href = `/subscriptions/request/${requestId}/refund`;
}

// Helper function to approve a subscription
function handleApprove = async (requestId: string) => {
  try {
    await api.subscriptionsApprove(requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  } catch (err: any) {
    setError(err?.message || "Failed to approve subscription");
  }
};

// Helper function to reject a subscription
function handleReject = async (requestId: string) => {
  try {
    await api.subscriptionsReject(requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  } catch (err: any) {
    setError(err?.message || "Failed to reject subscription");
  }
};

// Helper function to get tier label
function tierLabel = (tier?: string | null) => {
  // Tiers are stored as SubscriptionPlan enum values (STARTER/GROWTH/ENTERPRISE).
  switch ((tier ?? "").toLowerCase()) {
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