import React from "react";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";

interface TierCardProps {
  title: string;
  description: string;
  price: string;
  employees: string;
  tier: "starter" | "growth" | "enterprise";
  onSelect: () => void;
}

function TierCard({ title, description, price, employees, tier, onSelect }: TierCardProps) {
  const bgColors = {
    starter: "#ecfdf5",
    growth: "#d1fae5",
    enterprise: "#a3e635",
  };

  const textColors = {
    starter: "#059669",
    growth: "#059669",
    enterprise: "#16a34a",
  };

  return (
    <div
      className="tier-card"
      style={{
        border: `2px solid ${textColors[tier]}`,
        background: bgColors[tier],
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
        color: "#1f2937",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
      onClick={onSelect}
    >
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

  const [selectedTier, setSelectedTier] = React.useState<"starter" | "growth" | "enterprise" | null>(null);
  const [selectedEmail, setSelectedEmail] = React.useState<string>("");

  const handleTierSelect = async (tier: "starter" | "growth" | "enterprise") => {
    setSelectedTier(tier);

    // Get the user's registered email from the auth context
    // We'll use the email from the user profile
    if (user?.email) {
      setSelectedEmail(user.email);
      // Create pending subscription request
      try {
        await api.subscriptionsCreatePending({
          userId: user!.id,
          email: user!.email,
          tier,
        });
      } catch (err: any) {
        console.error("Failed to create pending subscription:", err);
      }
    }
  };

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

      <div className="tier-grid">
        {/* Starter / Small Business Tier */}
        <TierCard
          title="Starter / Small Business"
          description="MVR 2,500 / month (Up to 15 Employees)"
          price="MVR 2,500 / month"
          employees="Up to 15 employees"
          tier="starter"
          onSelect={() => handleTierSelect("starter")}
        />

        {/* Growth / Pro Tier */}
        <TierCard
          title="Growth / Pro Tier"
          description="MVR 6,500 / month (Up to 50 Employees)"
          price="MVR 6,500 / month"
          employees="Up to 50 employees"
          tier="growth"
          onSelect={() => handleTierSelect("growth")}
        />

        {/* Enterprise Tier */}
        <TierCard
          title="Enterprise Tier"
          description="MVR 15,000+ / month (Unlimited Employees)"
          price="MVR 15,000+ / month"
          employees="Unlimited employees"
          tier="enterprise"
          onSelect={() => handleTierSelect("enterprise")}
        />
      </div>

      {/* BML Account Details Section */}
      <div className="bml-details" style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
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
              <strong>Instructions:</strong> Transfer the exact tier amount via BML, then send a screenshot of your payment slip and your registered email address to our Viber number at <strong style={{ color: "#059669" }}>+9609652480</strong>
            </p>
            <p style={{ fontSize: "12px", margin: "8px 0 0 0", color: "#6b7280" }}>
              After verification, your subscription tier will be unlocked.
            </p>
          </div>
        </div>
      </div>

      {/* Selected tier summary */}
      {selectedTier && (
        <div className "selected-tier-summary" style={{ marginTop: "24px", padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#1f2937" }}>Selected Tier</h4>
          <p style={{ margin: "4px 0" }}>
            <strong>{selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}</strong> - 
            {selectedTier === "starter" ? "MVR 2,500 / month" : selectedTier === "growth" ? "MVR 6,500 / month" : "MVR 15,000+ / month"}
          </p>
          <p style={{ margin: "4px 0", fontSize: "14px" }}>
            Payment instructions have been shown above. Please complete the BML transfer and send the payment slip and email to Viber +9609652480.
          </p>
        </div>
      )}
    </div>
  );
}