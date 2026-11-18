import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import { api, type PendingSubscriptionInfo } from "../api/client";

type TierId = "starter" | "growth" | "enterprise";

interface TierDefinition {
  tier: TierId;
  title: string;
  description: string;
  price: string;
  employees: string;
}

const TIERS: TierDefinition[] = [
  {
    tier: "starter",
    title: "Starter / Small Business",
    description: "MVR 2,500 / month (Up to 15 Employees)",
    price: "MVR 2,500 / month",
    employees: "Up to 15 employees",
  },
  {
    tier: "growth",
    title: "Growth / Pro Tier",
    description: "MVR 6,500 / month (Up to 50 Employees)",
    price: "MVR 6,500 / month",
    employees: "Up to 50 employees",
  },
  {
    tier: "enterprise",
    title: "Enterprise Tier",
    description: "MVR 15,000+ / month (Unlimited Employees)",
    price: "MVR 15,000+ / month",
    employees: "Unlimited employees",
  },
];

const bgColors: Record<TierId, string> = {
  starter: "#ecfdf5",
  growth: "#d1fae5",
  enterprise: "#a3e635",
};

const textColors: Record<TierId, string> = {
  starter: "#059669",
  growth: "#059669",
  enterprise: "#16a34a",
};

const priceFor = (tier: TierId) => TIERS.find((t) => t.tier === tier)?.price ?? "";

const tierTitle = (tier?: string | null) => {
  const match = TIERS.find((t) => t.tier === String(tier ?? "").toLowerCase());
  return match?.title ?? (tier || "Selected plan");
};

interface TierCardProps {
  definition: TierDefinition;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function TierCard({ definition, selected, disabled = false, onSelect }: TierCardProps) {
  const { tier, title, description, price, employees } = definition;
  const handleSelect = () => {
    if (disabled) return;
    onSelect();
  };
  return (
    <div
      className={`tier-card${selected ? " tier-card-selected" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
      style={{
        border: selected ? `3px solid #16a34a` : `2px solid ${textColors[tier]}`,
        background: bgColors[tier],
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
        color: "#1f2937",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.2s ease",
        boxShadow: selected
          ? "0 0 0 3px rgba(22, 163, 74, 0.35), 0 10px 15px -3px rgba(0, 0, 0, 0.15)"
          : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        position: "relative",
      }}
    >
      {selected && (
        <span
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "#16a34a",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: "999px",
          }}
        >
          Selected
        </span>
      )}
      <h3 className="tier-title" style={{ color: textColors[tier], margin: "0 0 8px 0" }}>
        {title}
      </h3>
      <p className="tier-description" style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
        {description}
      </p>
      <p className="tier-price" style={{ margin: "0 0 16px 0", fontWeight: "bold", fontSize: "18px" }}>
        {price}
      </p>
      <p className="tier-employees" style={{ margin: "0", fontSize: "14px", opacity: 0.8 }}>
        {employees}
      </p>
    </div>
  );
}

export default function UpgradePage() {
  const { company, user } = useAuth();

  const [selectedTier, setSelectedTier] = React.useState<TierId | null>(null);
  const [proofUrl, setProofUrl] = React.useState<string>("");
  const [slipName, setSlipName] = React.useState<string>("");
  const [referenceId, setReferenceId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submittedTier, setSubmittedTier] = React.useState<TierId | null>(null);
  const [pendingRequest, setPendingRequest] = React.useState<PendingSubscriptionInfo | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [showCancelForm, setShowCancelForm] = React.useState(false);
  const [refundAccountDetails, setRefundAccountDetails] = React.useState<string>("");
  const [isCancelling, setIsCancelling] = React.useState(false);

  // Determine if the user is locked from making changes
  const isLocked = pendingRequest !== null;

  // Determine the current plan and if user is SUPER_ADMIN
  const currentPlan = (company?.subscriptionPlan ?? user?.company?.subscriptionPlan ?? "FREE").toUpperCase();
  const accountEmail = user?.email ?? "";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Per-tier feature gating: determine if a tier is accessible
  // Users can only select tiers at or above their current plan,
  // unless they are SUPER_ADMIN
  const maxAccessibleTier: TierId = isSuperAdmin
    ? ("enterprise" as TierId)
    : (TIERS.findIndex((t) => t.tier === currentPlan.toLowerCase()) >= 0
        ? (currentPlan.toLowerCase() as TierId)
        : "starter");

  const loadStatus = React.useCallback(async () => {
    try {
      const data = await api.subscriptionsMyStatus();
      setPendingRequest(data?.request ?? null);
    } catch {
      // A failed status lookup must not lock the page or crash it; the server
      // still rejects duplicate submissions with a 400.
      setPendingRequest(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSlipChange = (file: File | null) => {
    setSubmitError(null);
    setSlipName(file?.name ?? "");
    setProofUrl("");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError("Payment slip is too large. Please choose a file under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setProofUrl(reader.result);
    };
    reader.onerror = () => setSubmitError("Could not read the selected file. Try another slip.");
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTier || isLocked) return;
    if (!proofUrl && !referenceId.trim()) {
      setSubmitError("Attach a payment slip or enter the bank transaction reference.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.subscriptionsRequest({
        tier: selectedTier,
        ...(proofUrl ? { proofUrl } : {}),
        ...(referenceId.trim() ? { referenceId: referenceId.trim() } : {}),
      });
      setSubmittedTier(selectedTier);
      setSelectedTier(null);
      setProofUrl("");
      setSlipName("");
      setReferenceId("");
      await loadStatus();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCancelling(true);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.subscriptionsCancelPending({
        requestId: pendingRequest?.id,
        refundAccountDetails: refundAccountDetails.trim() || undefined,
      });
      setShowCancelForm(false);
      setPendingRequest(null);
      setSelectedTier(null);
      setRefundAccountDetails("");
      await loadStatus();
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to cancel request. Please try again.");
    } finally {
      setIsCancelling(false);
      setSubmitting(false);
    }
  };

  // Post-submission confirmation: no payment details, no crash-prone state reads.
  if (submittedTier) {
    return (
      <div className="upgrade-page">
        <div className="page-header">
          <div>
            <h2>Upgrade Your Subscription</h2>
            <p className="muted">Choose a subscription tier to get access to advanced LOGLEG HRMS features.</p>
          </div>
        </div>

        <div
          className="alert success"
          role="status"
          style={{
            marginTop: "24px",
            padding: "24px",
            background: "#ecfdf5",
            border: "2px solid #16a34a",
            borderRadius: "12px",
            color: "#065f46",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0" }}>Payment submitted!</h3>
          <p style={{ margin: "0 0 8px 0" }}>
            Your request for the <strong>{priceFor(submittedTier)}</strong> plan is pending SUPER_ADMIN review.
          </p>
          <p style={{ margin: "0", fontSize: "14px" }}>
            We will unlock the new tier once the payment has been verified.
          </p>
        </div>

        <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" to="/dashboard">
            Return to Dashboard
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setSubmittedTier(null)}>
            View request status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upgrade-page">
      <div className="page-header">
        <div>
          <h2>Upgrade Your Subscription</h2>
          <p className="muted">
            Choose a subscription tier to get access to advanced LOGLEG HRMS features.
          </p>
        </div>
      </div>

      <p className="muted" style={{ marginBottom: "16px" }}>
        Current plan: <strong>{currentPlan}</strong>
        {accountEmail ? ` · Billing contact: ${accountEmail}` : ""}
      </p>

      {statusLoading ? (
        <p className="muted">Checking your subscription request status...</p>
      ) : null}

      {/* Pending lock: one open request per company blocks any further plan change. */}{" "}
      {isLocked && (
        <div
          role="alert"
          style={{
            padding: "20px",
            marginBottom: "24px",
            background: "#fffbeb",
            border: "2px solid #f59e0b",
            borderRadius: "12px",
            color: "#78350f",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "8px",
            }}
          >
            <strong style={{ fontSize: "16px" }}>Subscription request pending</strong>
            <span
              style={{
                background: "#f59e0b",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: "999px",
              }}
            >
              Status: Awaiting Review
            </span>
          </div>
          <p style={{ margin: "0 0 8px 0" }}>
            Your subscription request for{" "}
            <strong>{tierTitle(pendingRequest?.tier)}</strong> is currently pending Super Admin approval.
          </p>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            You cannot submit another plan change until this request is reviewed. Submitted on{" "}
            {pendingRequest?.createdAt ? new Date(pendingRequest.createdAt).toLocaleString() : "record not dated"}.
          </p>
          {pendingRequest?.referenceId && (
            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
              <strong>Transaction reference:</strong> {pendingRequest.referenceId}
            </p>
          )}
          {pendingRequest?.proofUrl && (
            <div style={{ marginTop: "8px", fontSize: "14px" }}>
              <p style={{ margin: "0 0 6px 0" }}>
                <strong>Submitted payment slip:</strong>
              </p>
              {pendingRequest.proofUrl.startsWith("data:image") ? (
                <img
                  src={pendingRequest.proofUrl}
                  alt="Submitted payment slip"
                  style={{
                    maxWidth: "260px",
                    width: "100%",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    background: "#ffffff",
                  }}
                />
              ) : (
                <a
                  href={pendingRequest.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  View submitted slip
                </a>
              )}

            </div>
          )}

          {/* Self-service cancellation with optional refund account details */}
          {isLocked && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #fcd34d" }}>
              {!showCancelForm ? (
                <button
                  type="button"
                  onClick={() => setShowCancelForm(true)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "8px",
                    color: "#b91c1c",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel Request
                </button>
              ) : (
                <form
                  onSubmit={handleCancelRequest}
                  style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                >
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#78350f" }}>
                    Refund BML Account Details (Account Name &amp; Number)
                  </label>
                  <input
                    type="text"
                    placeholder="YourName: BML/MIB account number"
                    value={refundAccountDetails}
                    onChange={(e) => setRefundAccountDetails(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      background: "#ffffff",
                    }}
                  />
                  {submitError && (
                    <p style={{ margin: 0, fontSize: "13px", color: "#b91c1c" }}>{submitError}</p>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="submit"
                      disabled={isCancelling}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: isCancelling ? "not-allowed" : "pointer",
                        opacity: isCancelling ? 0.6 : 1,
                      }}
                    >
                      {isCancelling ? "Cancelling..." : "Submit Cancellation"}
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => setShowCancelForm(false)}
                      style={{
                        padding: "8px 12px",
                        background: "#e5e7eb",
                        color: "#374151",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <div className="tier-grid">
        {TIERS.map((definition) => {
          // Per-tier gating: disable tiers below the user's current access level
          // unless they are SUPER_ADMIN
          const tierDisabled =
            !isSuperAdmin &&
            TIERS.findIndex((t) => t.tier === definition.tier) <
              TIERS.findIndex((t) => t.tier === maxAccessibleTier);

          return (
            <TierCard
              key={definition.tier}
              definition={definition}
              selected={selectedTier === definition.tier}
              disabled={isLocked || tierDisabled}
              onSelect={() => {
                if (isLocked) return;
                if (tierDisabled) return;
                setSelectedTier(definition.tier);
                setSubmitError(null);
              }}
            />
          );
        })}
      </div>

      {isLocked ? (
        <p className="muted" style={{ marginTop: "24px" }}>
          Plan changes are locked while a request is awaiting review.{" "}
          <Link to="/dashboard">Return to Dashboard</Link>
        </p>
      ) : selectedTier ? (
        <>
          <div
            className="bml-details"
            style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}
          >
            <h3 style={{ margin: "0 0 12px 0", color: "#1f2937" }}>Payment Details</h3>
            <div className="bml-info" style={{ fontSize: "14px", lineHeight: 1.6 }}>
              <p>
                <strong>Bank:</strong> Bank of Maldives (BML)
              </p>
              <p>
                <strong>Account Number:</strong> 7723461830001
              </p>
              <p>
                <strong>Account Name:</strong> ALI THOHA
              </p>
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Amount:</strong> {priceFor(selectedTier)}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Instructions:</strong> Transfer the exact tier amount via BML, then upload your payment
                  slip or enter the transaction reference below.
                </p>
                <p style={{ fontSize: "12px", margin: "8px 0 0 0", color: "#6b7280" }}>
                  You can also send the slip to our Viber number at <strong>+9609652480</strong>. After verification,
                  your subscription tier will be unlocked.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmitPayment}
            style={{ marginTop: "24px", padding: "20px", background: "#f9fafb", borderRadius: "12px" }}
          >
            <h4 style={{ margin: "0 0 12px 0", color: "#1f2937" }}>Payment Proof</h4>

            {submitError && (
              <div className="alert error" style={{ marginBottom: "12px" }}>
                {submitError}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="payment-slip" style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
                Payment slip (image or PDF, optional if a reference is provided)
              </label>
              <input
                id="payment-slip"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleSlipChange(e.target.files?.[0] ?? null)}
              />
              {slipName && (
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
                  Attached: {slipName}
                  {proofUrl ? " (ready to submit)" : ""}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="payment-reference" style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
                Bank transaction reference
              </label>
              <input
                id="payment-reference"
                type="text"
                className="input"
                placeholder="e.g. BML-2026-000123"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                maxLength={120}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (!proofUrl && !referenceId.trim())}
            >
              {submitting ? "Submitting..." : "Submit Payment for Review"}
            </button>
          </form>
        </>
      ) : (
        <p className="muted" style={{ marginTop: "24px" }}>
          Select a tier above to view bank details and submit your payment.
        </p>
      )}
    </div>
  );
}