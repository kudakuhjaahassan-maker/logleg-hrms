// @tsx
import React from "react";
// @tsx
import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";
import {
  BRAND_PRESETS,
  DEFAULT_CARD_BG,
  DEFAULT_PRIMARY,
  SIDEBAR_THEMES,
  brandTokens,
  cardSurfacePresets,
  normalizeHexColor,
  normalizeSidebarTheme,
  textColorFor,
  workspaceTokens,
  type SidebarTheme,
} from "../api/branding";

/** Empty input clears the coordinate (null); otherwise parse it. */
function toCoordinate(value: string | number): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export default function SettingsPage() {
  const { company, isHrAdmin, updateCompany } = useAuth();

  const [companyName, setCompanyName] = useState(company?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(company?.primaryColor ?? DEFAULT_PRIMARY);
  const [cardBgColor, setCardBgColor] = useState(company?.cardBgColor ?? DEFAULT_CARD_BG);
  const [sidebarTheme, setSidebarTheme] = useState<SidebarTheme>(
    normalizeSidebarTheme(company?.sidebarTheme),
  );
  const [headingTextColor, setHeadingTextColor] = useState(company?.headingTextColor ?? "#0f172a");
  const [subTextColor, setSubTextColor] = useState(company?.subTextColor ?? "#64748b");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompanyName(company?.name ?? "");
    setLogoUrl(company?.logoUrl ?? "");
    setPrimaryColor(company?.primaryColor ?? DEFAULT_PRIMARY);
    setCardBgColor(company?.cardBgColor ?? DEFAULT_CARD_BG);
    setSidebarTheme(normalizeSidebarTheme(company?.sidebarTheme));
    setHeadingTextColor(company?.headingTextColor ?? "#0f172a");
    setSubTextColor(company?.subTextColor ?? "#64748b");
  }, [
    company?.name,
    company?.logoUrl,
    company?.primaryColor,
    company?.cardBgColor,
    company?.sidebarTheme,
    company?.headingTextColor,
    company?.subTextColor,
  ]);

  if (!isHrAdmin) return <Navigate to="/dashboard" replace />;

  const normalizedColor = normalizeHexColor(primaryColor);
  const colorValid = normalizedColor !== null;
  const tokens = brandTokens(normalizedColor ?? DEFAULT_PRIMARY);

  const normalizedCard = normalizeHexColor(cardBgColor);
  const cardValid = normalizedCard !== null;
  const cardPresets = cardSurfacePresets(tokens.primary);
  const workspace = workspaceTokens(
    tokens.primary,
    normalizedCard ?? DEFAULT_CARD_BG,
    sidebarTheme,
  );
  const themeName = SIDEBAR_THEMES.find((theme) => theme.value === sidebarTheme)?.name ?? "Light";

  const previewStyle = {
    "--primary": tokens.primary,
    "--primary-color": tokens.primary,
    "--primary-dark": tokens.hover,
    "--primary-hover": tokens.hover,
    "--primary-soft": tokens.lightBg,
    "--primary-light-bg": tokens.lightBg,
    "--text-on-primary": tokens.textOnPrimary,
    "--card-bg": workspace.cardBg,
    "--heading-text-color": headingTextColor,
    "--sub-text-color": subTextColor,
    "--header-bg": workspace.headerBg,
    "--header-text": workspace.headerText,
    "--header-muted": workspace.headerMuted,
    "--header-border": workspace.headerBorder,
    "--header-active-bg": workspace.headerActiveBg,
    "--header-active-text": workspace.headerActiveText,
    "--header-control-bg": workspace.headerControlBg,
    "--header-control-text": workspace.headerControlText,
    "--header-control-border": workspace.headerControlBorder,
    "--header-logo-bg": workspace.headerLogoBg,
  } as CSSProperties;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!normalizedColor) {
      setError("Brand colour must be a hex value such as #006e2a");
      return;
    }
    if (!normalizedCard) {
      setError("Card background must be a hex value such as #faf8f3");
      return;
    }

    setLoading(true);
    try {
      const res = await api.updateCompanySettings({
        name: companyName.trim(),
        logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
        primaryColor: normalizedColor ?? DEFAULT_PRIMARY,
        cardBgColor: normalizedCard ?? DEFAULT_CARD_BG,
        sidebarTheme,
        headingTextColor: normalizeHexColor(headingTextColor) ?? "#0f172a",
        subTextColor: normalizeHexColor(subTextColor) ?? "#64748b",
      });
      updateCompany(res.company);
      setSuccess("Workspace branding saved and applied.");
    } catch (err: any) {
      setError(err?.message || "Could not save settings");
    } finally {
      setLoading(false);
    }
  };

  const resetLogo = () => setLogoUrl("");
  const resetColor = () => setPrimaryColor(DEFAULT_PRIMARY);
  const resetCard = () => setCardBgColor(DEFAULT_CARD_BG);
  const resetTheme = () => setSidebarTheme("light");
  const resetHeading = () => setHeadingTextColor("#0f172a");
  const resetSub = () => setSubTextColor("#64748b");

  const [payrollDefaultCurrency, setPayrollDefaultCurrency] = useState(company?.defaultCurrency ?? "USD");
  const [payrollStandardWorkHours, setPayrollStandardWorkHours] = useState(Number(company?.standardWorkHours ?? 8));
  const [payrollOvertimeMultiplier, setPayrollOvertimeMultiplier] = useState(Number(company?.overtimeMultiplier ?? 1.5));
  const [officeLatitude, setOfficeLatitude] = useState<string | number>(company?.officeLatitude ?? "");
  const [officeLongitude, setOfficeLongitude] = useState<string | number>(company?.officeLongitude ?? "");
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(company?.allowedRadiusMeters ?? 20);

  const onSubmitPayroll = async () => {
    setError(null);
    setSuccess(null);
    try {
      await api.updatePayrollConfig({
        defaultCurrency: payrollDefaultCurrency,
        standardWorkHours: payrollStandardWorkHours,
        overtimeMultiplier: payrollOvertimeMultiplier,
      });
      setSuccess("Payroll configuration saved.");
      // Refresh settings
      const refreshed = await api.getPayrollConfig();
      setPayrollDefaultCurrency(refreshed.defaultCurrency);
      setPayrollStandardWorkHours(refreshed.standardWorkHours);
      setPayrollOvertimeMultiplier(refreshed.overtimeMultiplier);
    } catch (err: any) {
      setError(err?.message || "Could not save payroll settings");
    }
  };

  const onSubmitOfficeSettings = async () => {
    setError(null);
    setSuccess(null);
    try {
      await api.updateCompanySettings({
        name: companyName.trim(),
        logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
        primaryColor: normalizedColor ?? DEFAULT_PRIMARY,
        cardBgColor: normalizedCard ?? DEFAULT_CARD_BG,
        sidebarTheme,
        headingTextColor: normalizeHexColor(headingTextColor) ?? "#0f172a",
        subTextColor: normalizeHexColor(subTextColor) ?? "#64748b",
        officeLatitude: toCoordinate(officeLatitude),
        officeLongitude: toCoordinate(officeLongitude),
        allowedRadiusMeters,
      });
      setSuccess("Office settings and payroll configuration saved.");
      // Refresh settings
      const refreshed = await api.getPayrollConfig();
      setPayrollDefaultCurrency(refreshed.defaultCurrency);
      setPayrollStandardWorkHours(refreshed.standardWorkHours);
      setPayrollOvertimeMultiplier(refreshed.overtimeMultiplier);
      setOfficeLatitude(refreshed.officeLatitude ?? "");
      setOfficeLongitude(refreshed.officeLongitude ?? "");
      setAllowedRadiusMeters(refreshed.allowedRadiusMeters ?? 20);
    } catch (err: any) {
      setError(err?.message || "Could not save office settings");
    }
  };

  useEffect(() => {
    setPayrollDefaultCurrency(company?.defaultCurrency ?? "USD");
    setPayrollStandardWorkHours(Number(company?.standardWorkHours ?? 8));
    setPayrollOvertimeMultiplier(Number(company?.overtimeMultiplier ?? 1.5));
    setOfficeLatitude(company?.officeLatitude ?? "");
    setOfficeLongitude(company?.officeLongitude ?? "");
    setAllowedRadiusMeters(company?.allowedRadiusMeters ?? 20);
  }, [company?.defaultCurrency, company?.standardWorkHours, company?.overtimeMultiplier, company?.officeLatitude, company?.officeLongitude, company?.allowedRadiusMeters]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Company Settings</h1>
          <p className="muted">Personalise how your workspace looks for everyone at {company?.name}.</p>
        </div>
      </div>

      <div className="grid-settings">
        <section className="card">
          <div className="card-header-row">
            <h3>Branding</h3>
            <span className="subtle">Visible to all employees</span>
          </div>
          <form className="form" onSubmit={onSubmit}>
            <label>
              Company name
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </label>

            <label>
              Logo URL
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://cdn.example.com/logo.png"
              />
            </label>
            <div className="field-hint">
              Square or wide PNG/SVG works best. Leave empty to use the LOGLEG logo.
              {logoUrl && (
                <button type="button" className="link-btn" onClick={resetLogo}>
                  Clear logo
                </button>
              )}
            </div>

            <label>
              Primary brand colour
              <div className="color-row">
                <input
                  type="color"
                  className="color-input"
                  value={tokens.primary}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  aria-label="Brand colour picker"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#006e2a"
                  aria-label="Brand colour hex value"
                />
              </div>
            </label>

            <div>
              <div className="subtle preset-label">Preset business colours</div>
              <div className="color-presets" role="group" aria-label="Preset business colours">
                {BRAND_PRESETS.map((preset) => {
                  const selected = normalizedColor === preset.color;
                  return (
                    <button
                      type="button"
                      key={preset.color}
                      className={`preset-swatch${selected ? " selected" : ""}`}
                      onClick={() => setPrimaryColor(preset.color)}
                      aria-pressed={selected}
                      title={`${preset.name} — ${preset.color.toUpperCase()}`}
                      style={{ "--swatch": preset.color } as CSSProperties}
                    >
                      <span
                        className="preset-dot"
                        style={{
                          background: preset.color,
                          color: textColorFor(preset.color),
                          "--swatch": preset.color,
                        } as CSSProperties}
                      >
                        {selected ? <CheckIcon /> : null}
                      </span>
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-hint">
              Used for buttons, active navigation and highlights. Active tabs, badges and table rows
              receive a 10% tint automatically.
              <button type="button" className="link-btn" onClick={resetColor}>
                Reset to default
              </button>
            </div>

            <section className="card">
              <div className="card-header-row">
                <h3>Payroll Configuration</h3>
                <span className="subtle">Company-wide payroll settings</span>
              </div>
              <form className="form" onSubmit={onSubmitPayroll}>
                <div>
                  <label>Default Currency</label>
                  <select
                    value={payrollDefaultCurrency}
                    onChange={(e) => setPayrollDefaultCurrency(e.target.value)}
                    className="input"
                  >
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="CAD">CAD — Canadian Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                  </select>
                </div>
                <div>
                  <label>Standard Work Hours per Day</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={payrollStandardWorkHours}
                    onChange={(e) => setPayrollStandardWorkHours(Number(e.target.value))}
                    className="input"
                  />
                  <span className="subtle">Default working hours per day (used for overtime calculation)</span>
                </div>
                <div>
                  <label>Overtime Multiplier</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={payrollOvertimeMultiplier}
                    onChange={(e) => setPayrollOvertimeMultiplier(Number(e.target.value))}
                    className="input"
                  />
                  <span className="subtle">Multiplier for overtime pay (e.g., 1.5 = 50% extra)</span>
                </div>
                <div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Saving..." : "Save Payroll Config"}
                  </button>
                </div>
              </form>
              {error && <div className="alert error">{error}</div>}
              {success && <div className="alert success">{success}</div>}
            </section>

            <div className="form-section">
              <div className="form-section-title">Workspace surfaces</div>

              <label>
                Card &amp; container background
                <div className="color-row">
                  <input
                    type="color"
                    className="color-input"
                    value={normalizedCard ?? DEFAULT_CARD_BG}
                    onChange={(e) => setCardBgColor(e.target.value)}
                    aria-label="Card background colour picker"
                  />
                  <input
                    value={cardBgColor}
                    onChange={(e) => setCardBgColor(e.target.value)}
                    placeholder="#faf8f3"
                    aria-label="Card background hex value"
                  />
                </div>
              </label>

              <div>
                <div className="subtle preset-label">Surface tones</div>
                <div
                  className="color-presets surface-presets"
                  role="group"
                  aria-label="Card background presets"
                >
                  {cardPresets.map((preset) => {
                    const selected = normalizedCard === preset.color;
                    return (
                      <button
                        type="button"
                        key={preset.name}
                        className={`preset-swatch${selected ? " selected" : ""}`}
                        onClick={() => setCardBgColor(preset.color)}
                        aria-pressed={selected}
                        title={`${preset.name} — ${preset.color.toUpperCase()}`}
                        style={{ "--swatch": tokens.primary } as CSSProperties}
                      >
                        <span
                          className="preset-dot"
                          style={{
                            background: preset.color,
                            color: tokens.primary,
                          }}
                        >
                          {selected ? <CheckIcon /> : null}
                        </span>
                        <span className="preset-name">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-hint">
                Applied to cards, tables, modals and other container surfaces across the dashboard.
                Light off-white tones keep text readable.
                <button type="button" className="link-btn" onClick={resetCard}>
                  Reset to white
                </button>
              </div>

              <div>
                <div className="subtle preset-label">Header &amp; sidebar theme</div>
                <div className="theme-options" role="radiogroup" aria-label="Header and sidebar theme">
                  {SIDEBAR_THEMES.map((theme) => {
                    const option = workspaceTokens(
                      tokens.primary,
                      normalizedCard ?? DEFAULT_CARD_BG,
                      theme.value,
                    );
                    const selected = sidebarTheme === theme.value;
                    return (
                      <button
                        type="button"
                        key={theme.value}
                        role="radio"
                        aria-checked={selected}
                        className={`theme-option${selected ? " selected" : ""}`}
                        onClick={() => setSidebarTheme(theme.value)}
                        title={theme.description}
                      >
                        <span
                          className="theme-thumb"
                          style={{ background: option.cardBg, borderColor: option.headerBorder }}
                        >
                          <span
                            className="theme-thumb-bar"
                            style={{
                              background: option.headerBg,
                              borderBottomColor: option.headerBorder,
                            }}
                          >
                            <span
                              className="theme-thumb-pill"
                              style={{ background: option.headerActiveBg }}
                            />
                          </span>
                          <span className="theme-thumb-body">
                            <span className="theme-thumb-line" />
                            <span className="theme-thumb-line short" />
                          </span>
                        </span>
                        <span className="theme-option-name">{theme.name}</span>
                        <span className="theme-option-desc">{theme.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-hint">
                The header and mobile menu use this theme. Brand accent automatically picks
                readable text for your primary colour.
                <button type="button" className="link-btn" onClick={resetTheme}>
                  Reset to light
                </button>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Text colours</div>

              <label>
                Heading text colour
                <div className="color-row">
                  <input
                    type="color"
                    className="color-input"
                    value={headingTextColor}
                    onChange={(e) => setHeadingTextColor(e.target.value)}
                    aria-label="Heading text colour picker"
                  />
                  <input
                    value={headingTextColor}
                    onChange={(e) => setHeadingTextColor(e.target.value)}
                    placeholder="#0f172a"
                    aria-label="Heading text colour hex value"
                  />
                </div>
              </label>

              <label>
                Secondary description text colour
                <div className="color-row">
                  <input
                    type="color"
                    className="color-input"
                    value={subTextColor}
                    onChange={(e) => setSubTextColor(e.target.value)}
                    aria-label="Sub description text colour picker"
                  />
                  <input
                    value={subTextColor}
                    onChange={(e) => setSubTextColor(e.target.value)}
                    placeholder="#64748b"
                    aria-label="Sub description text colour hex value"
                  />
                </div>
              </label>

              <div className="field-hint">
                Applied to page headings, section titles, and description text across the dashboard.
                <button type="button" className="link-btn" onClick={resetHeading}>Reset to default</button>
                <button type="button" className="link-btn" onClick={resetSub}>Reset to muted</button>
              </div>
            </div>

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <div className="modal-actions">
              <button className="btn btn-primary" type="submit" disabled={loading || !colorValid || !cardValid}>
                {loading ? "Saving..." : "Save branding"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header-row">
            <h3>Office Location & Check-In Zone</h3>
            <span className="subtle">Set the company office location and default geofence radius for check-ins</span>
          </div>
          <form className="form" onSubmit={onSubmitOfficeSettings}>
            <div>
              <label>Office Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={officeLatitude}
                onChange={(e) => setOfficeLatitude(e.target.value)}
                className="input"
                placeholder="e.g. 37.7749"
                aria-label="Company office latitude"
              />
            </div>
            <div>
              <label>Office Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={officeLongitude}
                onChange={(e) => setOfficeLongitude(e.target.value)}
                className="input"
                placeholder="e.g. -122.4194"
                aria-label="Company office longitude"
              />
            </div>
            <div>
              <label>Default Check-In Radius (meters)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={allowedRadiusMeters}
                onChange={(e) => setAllowedRadiusMeters(Number(e.target.value))}
                className="input"
                aria-label="Default geofence radius in meters"
              />
              <span className="subtle">Used when employee customRadiusMeters is not set</span>
            </div>
            <div className="form-section">
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Office Settings"}</button>
            </div>
          </form>
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}
        </section>

        <section className="card">
          <div className="card-header-row">
            <h3>Preview</h3>
            <span className="subtle">Live</span>
          </div>
          <div className="brand-preview" style={previewStyle}>
            <div className="brand-preview-topbar">
              {logoUrl.trim() ? (
                <img className="brand-logo" src={logoUrl.trim()} alt="Logo preview" />
              ) : (
                <div
                  className="brand-mark"
                  style={{
                    background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.hover})`,
                    color: tokens.textOnPrimary,
                  }}
                >
                  {(companyName.trim().charAt(0) || "L").toUpperCase()}
                </div>
              )}
              <div className="brand-text">
                <div className="brand-title">{companyName || "Your company"}</div>
                <div className="brand-sub">HRMS &amp; Internal Operations</div>
              </div>
              <span className="brand-preview-chip">Dashboard</span>
            </div>

            <div className="brand-preview-surface">
              <div className="brand-preview-nav">
                <span
                  className="nav-link active"
                  style={{ background: tokens.lightBg, color: tokens.hover }}
                >
                  Dashboard
                </span>
                <span className="nav-link">Directory</span>
                <span className="nav-link">Leave</span>
              </div>

              <div className="brand-preview-table">
                <div
                  className="brand-preview-row"
                  style={{ background: tokens.lightBg }}
                  title="Table row hover uses the 10% brand tint"
                >
                  <span>Table row hover</span>
                  <span className="badge" style={{ background: tokens.lightBg, color: tokens.hover }}>
                    ACTIVE
                  </span>
                </div>
              </div>

              <div className="brand-preview-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{
                    background: tokens.primary,
                    borderColor: tokens.primary,
                    color: tokens.textOnPrimary,
                  }}
                >
                  Primary action
                </button>
                <div className="contrast-note">
                  <span
                    className="contrast-chip"
                    style={{ background: tokens.primary, color: tokens.textOnPrimary }}
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  Auto text: {tokens.textOnPrimary === "#FFFFFF" ? "white" : "dark"} ·{" "}
                  {tokens.contrastRatio.toFixed(2)}:1
                </div>
              </div>
            </div>

            <div className="preview-caption">
              Header: {themeName} · Cards: {workspace.cardBg.toUpperCase()}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
