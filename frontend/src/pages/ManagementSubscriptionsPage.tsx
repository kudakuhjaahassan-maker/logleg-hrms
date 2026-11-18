import { useEffect, useState, useRef } from "react";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";

interface PendingRequest {
  id: string;
  email: string;
  tier: string;
  status: string;
  createdAt?: string;
  companyName?: string;
  referenceId?: string | null;
  proofUrl?: string | null;
  refundAccountDetails?: string | null;
}

function tierLabel(tier?: string | null) {
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
}

function statusLabel(status?: string | null) {
  const value = (status ?? "pending").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderPaymentSlip(proofUrl?: string | null, onOpenModal?: () => void, setImageUrl?: (url: string) => void) {
  if (!proofUrl) return <span>—</span>;
  if (proofUrl.startsWith("data:image")) {
    // Render clickable thumbnail that opens light-box modal
    return (
      <img
        src={proofUrl}
        alt="Payment slip"
        style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "4px", cursor: "pointer" }}
        onClick={() => {
          onOpenModal?.();
          setImageUrl?.(proofUrl);
        }}
      />
    );
  }
  return (
    <a href="#" onClick={() => window.open(proofUrl, "_blank", "noopener,noreferrer")} style={{ cursor: "pointer" }}>
      View slip
    </a>
  );
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
  const [openPaymentSlipModal, setOpenPaymentSlipModal] = useState(false);
  const [paymentSlipImageUrl, setPaymentSlipImageUrl] = useState<string | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) return;
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
  }, [isSuperAdmin]);

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

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!isSuperAdmin) {
    return <AccessDenied />;
  }

  // Pending rows keep their own view; cancelled / refund rows are shown on demand.
  const filteredRequests = showCancelledRefund
    ? requests.filter((r) => {
        const status = (r.status ?? "").toLowerCase();
        return status !== "pending" && status !== "approved" && status !== "rejected";
      })
    : requests.filter((r) => (r.status ?? "pending").toLowerCase() === "pending");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Pending Subscription Requests</h2>
          <p className="muted">
            View and manage subscription tier upgrade requests awaiting payment verification.
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              className={showCancelledRefund ? "btn btn-sm" : "btn btn-sm btn-primary"}
              onClick={() => setShowCancelledRefund(false)}
            >
              Pending Requests
            </button>
            <button
              className={showCancelledRefund ? "btn btn-sm btn-primary" : "btn btn-sm"}
              onClick={() => setShowCancelledRefund(true)}
            >
              Cancelled / Pending Refund
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert error" style={{ margin: "1rem 0" }}>
          {error}
        </div>
      )}

      {fetching ? (
        <div className="empty">Loading subscription requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty">
          <h3>{showCancelledRefund ? "No cancelled/refund requests" : "No pending requests"}</h3>
          <p>
            {showCancelledRefund
              ? "There are currently no cancelled or pending refund requests."
              : "There are currently no pending subscription requests for this company."}
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
              {filteredRequests.map((req) => {
                const status = (req.status ?? "pending").toLowerCase();
                return (
                  <tr key={req.id}>
                    <td>{req.email}</td>
                    <td>{tierLabel(req.tier)}</td>
                    <td>
                      <span
                        className={`badge badge-${
                          status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"
                        }`}
                      >
                        {statusLabel(req.status)}
                      </span>
                    </td>
                    <td>{req.referenceId || "—"}</td>
                    <td>
                      {req.refundAccountDetails ? (
                        <span style={{ whiteSpace: "nowrap" }}>{req.refundAccountDetails}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td>{renderPaymentSlip(req.proofUrl, () => setOpenPaymentSlipModal(true), setPaymentSlipImageUrl)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="btn btn-sm btn-primary"
                            >
                              Approve / Unlock Tier
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              className="btn btn-sm btn-secondary"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {status === "cancelled" && (
                          <span className="muted" style={{ fontSize: "0.85rem" }}>
                            Awaiting refund payout
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
