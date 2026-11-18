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
      <button
        type="button"
        onClick={() => {
          setImageUrl?.(proofUrl);
          onOpenModal?.();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          setImageUrl?.(proofUrl);
          onOpenModal?.();
        }}
        style={{
          width: "48px",
          height: "48px",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <img
          src={proofUrl}
          alt="Payment slip"
          style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "4px", pointerEvents: "none" }}
        />
      </button>
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

      {openPaymentSlipModal && paymentSlipImageUrl && (
        <div
          ref={lightboxRef}
          onClick={() => setOpenPaymentSlipModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenPaymentSlipModal(false);
            }}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "rgba(255, 255, 255, 0.9)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              fontSize: "24px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <img
            src={paymentSlipImageUrl}
            alt="Payment slip"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            style={{
              maxWidth: "100%",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
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
        <div className="w-full max-w-full overflow-x-auto">
          <table className="table min-w-[750px] w-full" style={{ tableLayout: "auto" }}>
            <thead>
              <tr>
                <th className="whitespace-nowrap">Email</th>
                <th className="whitespace-nowrap">Requested Tier</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Reference ID</th>
                <th className="whitespace-nowrap">Refund Account Details</th>
                <th className="whitespace-nowrap">Payment Slip</th>
                <th className="whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => {
                const status = (req.status ?? "pending").toLowerCase();
                return (
                  <tr key={req.id}>
                    <td className="whitespace-nowrap">{req.email}</td>
                    <td className="whitespace-nowrap">{tierLabel(req.tier)}</td>
                    <td className="whitespace-nowrap">
                      <span
                        className={`badge badge-${
                          status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"
                        }`}
                      >
                        {statusLabel(req.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{req.referenceId || "—"}</td>
                    <td className="whitespace-nowrap">
                      {req.refundAccountDetails ? (
                        <span>{req.refundAccountDetails}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{renderPaymentSlip(req.proofUrl, () => setOpenPaymentSlipModal(true), setPaymentSlipImageUrl)}</td>
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
