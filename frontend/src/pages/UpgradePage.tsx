import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";

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

interface TierCardProps {
  definition: TierDefinition;
  selected: boolean;
  onSelect: () => void;
}

function TierCard({ definition, selected, onSelect }: TierCardProps) {
  const { tier, title, description, price, employees } = definition;
  return (
    <div
      className={`tier-card${selected ? " tier-card-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      style={{
        border: selected ? `3px solid #16a34a` : `2px solid ${textColors[tier]}`,
        background: bgColors[tier],
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
        color: "#1f2937",
        cursor: "pointer",
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

  const currentPlan = (company?.subscriptionPlan ?? user?.company?.subscriptionPlan ?? "FREE").toUpperCase();
  const accountEmail = user?.email ?? "";

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
    if (!selectedTier) return;
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
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit payment. Please try again.");
    } finally {
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
            Submit another request
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

      <div className="tier-grid">
        {TIERS.map((definition) => (
          <TierCard
            key={definition.tier}
            definition={definition}
            selected={selectedTier === definition.tier}
            onSelect={() => {
              setSelectedTier(definition.tier);
              setSubmitError(null);
            }}
          />
        ))}
      </div>

      {/* Progressive disclosure: payment details and the proof form stay hidden
          until a tier has been explicitly selected. */}
      {selectedTier ? (
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
