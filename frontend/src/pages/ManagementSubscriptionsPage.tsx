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
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const lightboxRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const hasActiveSubscription = user?.company?.subscriptionPlan !== "FREE" && user?.company?.subscriptionPlan !== "TRIALING";

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

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // set initial
    setIsMobile(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // fallback for older browsers
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

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
          {/* Active tier badge for company admin with approved subscription */}
  {hasActiveSubscription && !isSuperAdmin && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "1rem",
                padding: "8px 12px",
                background: "#d1f2eb",
                border: "2px solid #059669",
                borderRadius: "20px",
                color: "#059669",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50",
                  background: "#059669",
                  boxShadow: "0 0 6px rgba(5, 150, 105, 0.4)",
                }}
              />
              <span style={{ fontWeight: 500, fontSize: "14px" }}>Active: {tierLabel(user?.company?.subscriptionPlan?.toLowerCase() ?? "unknown")}</span>
            </div>
          )}

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
      ) : isMobile ? (
        <div className="block md:hidden flex flex-col">
          {filteredRequests.map((req) => {
            const status = (req.status ?? "pending").toLowerCase();
            return (
              <div key={req.id} className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</div>
                  <div style={{ fontWeight: 500, wordBreak: "break-word" }}>{req.email}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Requested Tier</div>
                  <div>{tierLabel(req.tier)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</div>
                  <span
                    className={`badge badge-${status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}`}
                  >
                    {statusLabel(req.status)}
                  </span>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Reference ID</div>
                  <div style={{ wordBreak: "break-word" }}>{req.referenceId || "—"}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Refund Account Details</div>
                  <div style={{ wordBreak: "break-word" }}>{req.refundAccountDetails || "—"}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Payment Slip</div>
                  <div style={{ marginTop: "4px" }}>
                    {renderPaymentSlip(req.proofUrl, () => setOpenPaymentSlipModal(true), (url) => setPaymentSlipImageUrl(url))}
                  </div>
                </div>
                {(status === "pending" || status === "cancelled") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                    {status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="btn btn-sm btn-primary btn-block"
                          style={{ padding: "10px 14px", minHeight: "44px" }}
                        >
                          Approve / Unlock Tier
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="btn btn-sm btn-secondary btn-block"
                          style={{ padding: "10px 14px", minHeight: "44px" }}
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="hidden md:block w-full max-w-full overflow-x-auto" style={{ width: "100%", maxWidth: "100%", overflowX: "auto" }}>
          <table className="table min-w-[750px] w-full" style={{ tableLayout: "auto", minWidth: "750px", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Email</th>
                <th style={{ whiteSpace: "nowrap" }}>Requested Tier</th>
                <th style={{ whiteSpace: "nowrap" }}>Status</th>
                <th style={{ whiteSpace: "nowrap" }}>Reference ID</th>
                <th style={{ whiteSpace: "nowrap" }}>Refund Account Details</th>
                <th style={{ whiteSpace: "nowrap" }}>Payment Slip</th>
                <th style={{ whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => {
                const status = (req.status ?? "pending").toLowerCase();
                return (
                  <tr key={req.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{req.email}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{tierLabel(req.tier)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className={`badge badge-${status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}`}
                      >
                        {statusLabel(req.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{req.referenceId || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {req.refundAccountDetails ? (
                        <span>{req.refundAccountDetails}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{renderPaymentSlip(req.proofUrl, () => setOpenPaymentSlipModal(true), (url) => setPaymentSlipImageUrl(url))}</td>
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
