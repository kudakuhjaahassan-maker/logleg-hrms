import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock3,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../api/AuthContext";

// ============================================================================
// Manual Theme & Dynamic Brand Contrast Utilities (Light Mode + WCAG)
// ============================================================================

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface BrandTokens {
  primary: string;
  primaryInk: "#0f172a" | "#ffffff";
  primaryHover: string;
  primaryHoverInk: "#0f172a" | "#ffffff";
  primarySoft: string;
  primarySoftInk: string;
  ring: string;
  luminance: number;
  contrastVsSlate: number;
  contrastVsWhite: number;
}

export interface ManualThemeConfig {
  primaryColor?: string | null;
  surfaceColor?: string | null;
  headerColor?: string | null;
  menuBarColor?: string | null;
  textColor?: string | null;
  isBoldText?: boolean;
}

const SLATE_900_HEX = "#0f172a";
const WHITE_HEX = "#ffffff";
const DEFAULT_PRIMARY_HEX = "#a3e879";

export function normalizeHex(input?: string | null, fallback = DEFAULT_PRIMARY_HEX): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  const shortMatch = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const fullMatch = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }
  return fallback;
}

/**
 * Parses HEX (#a3e879, a3e879, #fff) or RGB ("rgb(163, 232, 121)" / "163, 232, 121")
 * into a normalized #rrggbb string, or returns null when invalid.
 */
export function parseColorInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const shortHex = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const fullHex = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullHex) {
    return `#${fullHex[1].toLowerCase()}`;
  }

  const rgbMatch =
    /^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/i.exec(trimmed);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      return rgbToHex({ r, g, b });
    }
  }

  return null;
}

export function hexToRgb(hex: string): RgbColor {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function formatRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatioBetweenHex(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastRatio(lumA: number, lumB: number): number {
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixRgb(a: RgbColor, b: RgbColor, weightB: number): RgbColor {
  const w = Math.max(0, Math.min(1, weightB));
  return {
    r: a.r * (1 - w) + b.r * w,
    g: a.g * (1 - w) + b.g * w,
    b: a.b * (1 - w) + b.b * w,
  };
}

function pickAccessibleInk(bgLum: number): "#0f172a" | "#ffffff" {
  const slateLum = relativeLuminance(hexToRgb(SLATE_900_HEX));
  const whiteLum = 1.0;
  return contrastRatio(bgLum, slateLum) >= contrastRatio(bgLum, whiteLum)
    ? SLATE_900_HEX
    : WHITE_HEX;
}

function deriveAccessibleLightSurfaceInk(rgb: RgbColor): string {
  for (let step = 0; step <= 20; step += 1) {
    const candidate = mixRgb(rgb, hexToRgb(SLATE_900_HEX), step * 0.05);
    const ratio = contrastRatio(relativeLuminance(candidate), 1.0);
    if (ratio >= 4.8) {
      return rgbToHex(candidate);
    }
  }
  return SLATE_900_HEX;
}

export function computeBrandTokens(rawColor?: string | null): BrandTokens {
  const primary = normalizeHex(rawColor, DEFAULT_PRIMARY_HEX);
  const rgb = hexToRgb(primary);
  const luminance = relativeLuminance(rgb);

  const slateLum = relativeLuminance(hexToRgb(SLATE_900_HEX));
  const contrastVsSlate = contrastRatio(luminance, slateLum);
  const contrastVsWhite = contrastRatio(luminance, 1.0);
  const primaryInk = pickAccessibleInk(luminance);

  const hoverRgb =
    luminance > 0.12
      ? mixRgb(rgb, hexToRgb(SLATE_900_HEX), 0.12)
      : mixRgb(rgb, { r: 51, g: 65, b: 85 }, 0.18);
  const primaryHover = rgbToHex(hoverRgb);
  const primaryHoverInk = pickAccessibleInk(relativeLuminance(hoverRgb));

  const softRgb = mixRgb({ r: 255, g: 255, b: 255 }, rgb, 0.18);
  const primarySoft = rgbToHex(softRgb);
  const primarySoftInk = deriveAccessibleLightSurfaceInk(rgb);

  const ring = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;

  return {
    primary,
    primaryInk,
    primaryHover,
    primaryHoverInk,
    primarySoft,
    primarySoftInk,
    ring,
    luminance,
    contrastVsSlate,
    contrastVsWhite,
  };
}

export function resolveSurfaceInk(textHex: string, bgHex: string): string {
  if (contrastRatioBetweenHex(textHex, bgHex) >= 4.5) {
    return textHex;
  }
  return pickAccessibleInk(relativeLuminance(hexToRgb(bgHex)));
}

function applyThemeTokensToRoot(tokens: BrandTokens, theme: ManualThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const surfaceCard = normalizeHex(theme.surfaceColor, WHITE_HEX);
  const headerBg = normalizeHex(theme.headerColor, WHITE_HEX);
  const menuBarBg = normalizeHex(theme.menuBarColor, WHITE_HEX);
  const textInk = normalizeHex(theme.textColor, SLATE_900_HEX);
  const isBold = Boolean(theme.isBoldText);

  const headerRgb = hexToRgb(headerBg);
  const headerInk = resolveSurfaceInk(textInk, headerBg);
  const headerMutedInk = headerInk === WHITE_HEX ? "#cbd5e1" : "#475569";

  const menuBarRgb = hexToRgb(menuBarBg);
  const menuBarLum = relativeLuminance(menuBarRgb);
  const menuBarInk = resolveSurfaceInk(textInk, menuBarBg);
  const isDarkMenuBar = menuBarLum < 0.22;
  const menuBarMutedInk = isDarkMenuBar ? "#cbd5e1" : "#475569";
  const menuBarIconInk = isDarkMenuBar ? "#e2e8f0" : "#334155";
  const menuBarHover = isDarkMenuBar ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.06)";
  const menuBarBorder = isDarkMenuBar ? "rgba(255, 255, 255, 0.14)" : "rgba(226, 232, 240, 0.85)";

  root.style.setProperty("--brand-primary", tokens.primary);
  root.style.setProperty("--brand-primary-ink", tokens.primaryInk);
  root.style.setProperty("--brand-on-primary", tokens.primaryInk);
  root.style.setProperty("--brand-primary-hover", tokens.primaryHover);
  root.style.setProperty("--brand-primary-hover-ink", tokens.primaryHoverInk);
  root.style.setProperty("--brand-primary-soft", tokens.primarySoft);
  root.style.setProperty("--brand-primary-soft-ink", tokens.primarySoftInk);
  root.style.setProperty("--brand-ring", tokens.ring);

  root.style.setProperty("--surface-card", surfaceCard);
  root.style.setProperty("--surface-header", headerBg);
  root.style.setProperty(
    "--surface-header-glass",
    `rgba(${headerRgb.r}, ${headerRgb.g}, ${headerRgb.b}, 0.78)`
  );
  root.style.setProperty("--surface-menubar", menuBarBg);
  root.style.setProperty(
    "--surface-menubar-glass",
    `rgba(${menuBarRgb.r}, ${menuBarRgb.g}, ${menuBarRgb.b}, 0.80)`
  );
  root.style.setProperty("--surface-menubar-hover", menuBarHover);
  root.style.setProperty("--surface-menubar-border", menuBarBorder);

  root.style.setProperty("--ink-primary", textInk);
  root.style.setProperty("--ink-header", headerInk);
  root.style.setProperty("--ink-header-muted", headerMutedInk);
  root.style.setProperty("--ink-menubar", menuBarInk);
  root.style.setProperty("--ink-menubar-muted", menuBarMutedInk);
  root.style.setProperty("--ink-menubar-icon", menuBarIconInk);

  root.style.setProperty("--font-weight-heading", isBold ? "700" : "500");
  root.style.setProperty("--font-weight-body", isBold ? "600" : "400");
  root.style.setProperty("--font-weight-nav", isBold ? "700" : "500");
}

// ============================================================================
// Navigation Layout Shell
// ============================================================================

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export default function Layout() {
  const { user, company, isHrAdmin, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const location = useLocation();

  const brandName = (!loading && company?.name) || "LOGLEG";
  const themeCompany = company as (typeof company & ManualThemeConfig) | null | undefined;
  const brandTokens = useMemo(
    () => computeBrandTokens(themeCompany?.primaryColor),
    [themeCompany?.primaryColor]
  );

  useEffect(() => {
    applyThemeTokensToRoot(brandTokens, {
      primaryColor: themeCompany?.primaryColor,
      surfaceColor: themeCompany?.surfaceColor,
      headerColor: themeCompany?.headerColor,
      menuBarColor: themeCompany?.menuBarColor,
      textColor: themeCompany?.textColor,
      isBoldText: themeCompany?.isBoldText,
    });
  }, [
    brandTokens,
    themeCompany?.headerColor,
    themeCompany?.isBoldText,
    themeCompany?.menuBarColor,
    themeCompany?.primaryColor,
    themeCompany?.surfaceColor,
    themeCompany?.textColor,
  ]);

  useEffect(() => {
    setLogoFailed(false);
  }, [company?.logoUrl]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const navItems: NavItem[] = useMemo(() => {
    if (loading) return [];
    const items: NavItem[] = [];

    if (user?.role === "EMPLOYEE") {
      items.push(
        { to: "/employee-dashboard", label: "My Portal", icon: <Home className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/leave", label: "Leave", icon: <CalendarDays className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/compensation", label: "Compensation", icon: <Wallet className="h-[18px] w-[18px] shrink-0" /> }
      );
    } else {
      items.push(
        { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/directory", label: "Directory", icon: <Users className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/org-chart", label: "Org Chart", icon: <Network className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/leave", label: "Leave", icon: <CalendarDays className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/compensation", label: "Compensation", icon: <Wallet className="h-[18px] w-[18px] shrink-0" /> },
        { to: "/upgrade", label: "Upgrade Plan", icon: <Sparkles className="h-[18px] w-[18px] shrink-0" /> }
      );

      if (user?.role === "MANAGER" || user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN") {
        items.push(
          { to: "/leave-approvals", label: "Approvals", icon: <BadgeCheck className="h-[18px] w-[18px] shrink-0" /> },
          { to: "/attendance", label: "Attendance", icon: <Clock3 className="h-[18px] w-[18px] shrink-0" /> },
          { to: "/payslips", label: "Payslips", icon: <FileText className="h-[18px] w-[18px] shrink-0" /> },
          {
            to: "/management/subscriptions",
            label: "Subscription Requests",
            icon: <CreditCard className="h-[18px] w-[18px] shrink-0" />,
          }
        );
      }
    }

    if (user) {
      items.push({
        to: `/employees/${user.id}`,
        label: "My Profile",
        icon: <User className="h-[18px] w-[18px] shrink-0" />,
      });
    }

    if (isHrAdmin) {
      items.push({
        to: "/settings",
        label: "Settings",
        icon: <Settings className="h-[18px] w-[18px] shrink-0" />,
      });
    }

    return items;
  }, [isHrAdmin, loading, user]);

  const brandInitials = useMemo(() => {
    const parts = brandName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return brandName.slice(0, 2).toUpperCase() || "LG";
  }, [brandName]);

  const renderDesktopLinks = () => {
    if (loading) {
      return <span className="loading">Loading...</span>;
    }
    return navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
      >
        {item.label}
      </NavLink>
    ));
  };

  const renderMobileLinks = () => {
    if (loading) {
      return <span className="loading">Loading navigation...</span>;
    }
    return navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setMenuOpen(false)}
        className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
      >
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </NavLink>
    ));
  };

  const drawerOverlayClass = menuOpen ? "drawer-overlay open" : "drawer-overlay";
  const mobileDrawerClass = menuOpen ? "mobile-drawer open" : "mobile-drawer";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          {company?.logoUrl && !logoFailed ? (
            <img
              className="brand-logo"
              src={company.logoUrl}
              alt={`${brandName} logo`}
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div
              className="brand-logo-fallback"
              aria-hidden="true"
              style={{
                backgroundColor: brandTokens.primary,
                color: brandTokens.primaryInk,
              }}
            >
              {brandInitials}
            </div>
          )}
          <div className="brand-text">
            <div className="brand-title">{brandName}</div>
            <div className="brand-sub">{company?.tagline || "HRMS & Internal Operations"}</div>
          </div>
        </div>

        <nav className="nav nav-desktop" aria-label="Primary">
          {renderDesktopLinks()}
        </nav>

        <div className="user-area user-area-desktop">
          {!loading && user && (
            <div className="user-meta">
              <div className="user-name">
                {user.firstName} {user.lastName}
              </div>
              <div className="user-role">{user.role}</div>
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <div
        className={drawerOverlayClass}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="mobile-nav-drawer"
        className={mobileDrawerClass}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-user min-w-0">
            {!loading && user ? (
              <>
                <div className="user-name">
                  {user.firstName} {user.lastName}
                </div>
                <div className="user-role flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
                  <span className="truncate">
                    {user.role}
                    {company?.name ? ` · ${company.name}` : ""}
                  </span>
                </div>
              </>
            ) : (
              <div className="user-name">{brandName}</div>
            )}
          </div>
          <button
            type="button"
            className="menu-toggle close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="nav nav-mobile" aria-label="Mobile primary">
          {renderMobileLinks()}
        </nav>

        <div className="mobile-drawer-actions">
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
          >
            <LogOut className="h-4 w-4 text-slate-700" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
