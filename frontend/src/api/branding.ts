export const DEFAULT_PRIMARY = "#2563eb";
export const DEFAULT_CARD_BG = "#ffffff";

/** Curated corporate palettes for one-click tenant theming. */
export const BRAND_PRESETS = [
  { name: "Corporate Blue", color: "#1e40af" },
  { name: "Slate", color: "#334155" },
  { name: "Forest", color: "#006e2a" },
  { name: "Executive Burgundy", color: "#991b1b" },
  { name: "Teal", color: "#0d9488" },
] as const;

export type BrandTokens = {
  primary: string;
  hover: string;
  lightBg: string;
  textOnPrimary: "#FFFFFF" | "#111827";
  contrastRatio: number;
};

function expandHex(hex: string): string {
  const v = hex.replace("#", "");
  if (v.length === 3) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  }
  return `#${v}`;
}

/** Accepts #rgb or #rrggbb and returns a normalized 6-digit lowercase hex. */
export function normalizeHexColor(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return null;
  return expandHex(raw).toLowerCase();
}

export function isValidHexColor(value: string): boolean {
  return normalizeHexColor(value) !== null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_PRIMARY;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function mix(hex: string, target: string, amountToTarget: number): string {
  const a = normalizeHexColor(hex) ?? DEFAULT_PRIMARY;
  const b = normalizeHexColor(target) ?? "#000000";
  const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const to = (x: number, y: number) =>
    Math.round(x + (y - x) * amountToTarget)
      .toString(16)
      .padStart(2, "0");
  return `#${to(ar, br)}${to(ag, bg)}${to(ab, bb)}`;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks white or near-black text, whichever has the stronger WCAG contrast. */
export function textColorFor(primaryColor: string): "#FFFFFF" | "#111827" {
  const primary = normalizeHexColor(primaryColor) ?? DEFAULT_PRIMARY;
  const white = contrastRatio(primary, "#ffffff");
  const dark = contrastRatio(primary, "#111827");
  return white >= dark ? "#FFFFFF" : "#111827";
}

export function brandTokens(primaryColor?: string | null): BrandTokens {
  const primary = normalizeHexColor(primaryColor ?? "") ?? DEFAULT_PRIMARY;
  const hover = mix(primary, "#000000", 0.12);
  const { r, g, b } = hexToRgb(primary);
  const textOnPrimary = textColorFor(primary);
  return {
    primary,
    hover,
    lightBg: `rgba(${r}, ${g}, ${b}, 0.10)`,
    textOnPrimary,
    contrastRatio: contrastRatio(primary, textOnPrimary),
  };
}

/** Applies a company's brand colour to the app's CSS custom properties.
 * Falls back to the default LOGLEG blue for missing/invalid values.
 * Also sets legacy aliases so existing components keep working.
 */
export function applyBranding(
  primaryColor?: string | null,
  cardBgColor?: string | null,
  sidebarTheme?: string | null,
  headingTextColor?: string | null,
  subTextColor?: string | null,
) {
  const tokens = brandTokens(primaryColor);
  const workspace = workspaceTokens(primaryColor, cardBgColor, sidebarTheme, headingTextColor, subTextColor);
  const root = document.documentElement.style;
  root.setProperty("--primary-color", tokens.primary);
  root.setProperty("--primary-hover", tokens.hover);
  root.setProperty("--primary-light-bg", tokens.lightBg);
  root.setProperty("--text-on-primary", tokens.textOnPrimary);
  // Legacy variable names used across the existing stylesheet.
  root.setProperty("--primary", tokens.primary);
  root.setProperty("--primary-dark", tokens.hover);
  root.setProperty("--primary-soft", tokens.lightBg);
  // Workspace surfaces, text colours and header palette.
  root.setProperty("--card-bg", workspace.cardBg);
  root.setProperty("--card-bg-color", workspace.cardBg);
  root.setProperty("--heading-text-color", workspace.headingTextColor);
  root.setProperty("--sub-text-color", workspace.subTextColor);
  root.setProperty("--header-bg", workspace.headerBg);
  root.setProperty("--header-text", workspace.headerText);
  root.setProperty("--header-muted", workspace.headerMuted);
  root.setProperty("--header-border", workspace.headerBorder);
  root.setProperty("--header-active-bg", workspace.headerActiveBg);
  root.setProperty("--header-active-text", workspace.headerActiveText);
  root.setProperty("--header-control-bg", workspace.headerControlBg);
  root.setProperty("--header-control-text", workspace.headerControlText);
  root.setProperty("--header-control-border", workspace.headerControlBorder);
  root.setProperty("--header-logo-bg", workspace.headerLogoBg);
}

/** Curated sidebar themes for the header. */
export const SIDEBAR_THEMES = [
  { value: "light", name: "Light", description: "Clean white header" },
  { value: "dark", name: "Dark", description: "Deep navy header" },
  { value: "brand", name: "Brand accent", description: "Header filled with your brand colour" },
] as const;

export type SidebarTheme = "light" | "dark" | "brand";

/** Surface tones offered for card backgrounds. */
export function cardSurfacePresets(primaryColor?: string | null) {
  const tokens = brandTokens(primaryColor);
  return [
    { name: "Pure white", color: "#ffffff" },
    { name: "Cool mist", color: "#f4f7f5" },
    { name: "Warm sand", color: "#faf8f3" },
    { name: "Brand tint", color: tokens.lightBg },
  ];
}

/** Normalizes a sidebar theme value to the default "light" if invalid. */
export function normalizeSidebarTheme(value?: string | null): SidebarTheme {
  return value === "dark" || value === "brand" ? value : "light";
}

/** Workspace tokens applied to the DOM root element. */
export function workspaceTokens(
  primaryColor?: string | null,
  cardBgColor?: string | null,
  sidebarTheme?: string | null,
  headingColor?: string | null,
  subColor?: string | null,
): WorkspaceTokens {
  const tokens = brandTokens(primaryColor);
  const cardBg = normalizeHexColor(cardBgColor ?? "") ?? DEFAULT_CARD_BG;
  const theme = normalizeSidebarTheme(sidebarTheme);
  const headingTextColor = normalizeHexColor(headingColor ?? "") ?? "#0f172a";
  const subTextColor = normalizeHexColor(subColor ?? "") ?? "#64748b";
  const headerBg = theme === "brand" ? tokens.primary : theme === "dark" ? "#1e293b" : "#f8f9fa";
  const headerText = "#ffffff";
  const headerMuted = theme === "brand" ? "rgba(255, 255, 255, 0.7)" : "#64748b";
  const headerBorder = theme === "brand" ? "rgba(255, 255, 255, 0.3)" : "#e2e8f0";
  const headerActiveBg = theme === "brand" ? tokens.hover : theme === "dark" ? "#2d3748" : "#f1f5f9";
  const headerActiveText = "#ffffff";
  const headerControlBg = "#ffffff";
  const headerControlText = "#1e293b";
  const headerControlBorder = "#e2e8f0";
  const headerLogoBg = tokens.primary;
  return {
    cardBg,
    sidebarTheme: theme,
    headingTextColor,
    subTextColor,
    headerBg,
    headerText,
    headerMuted,
    headerBorder,
    headerActiveBg,
    headerActiveText,
    headerControlBg,
    headerControlText,
    headerControlBorder,
    headerLogoBg,
  };
}

export type WorkspaceTokens = {
  cardBg: string;
  sidebarTheme: SidebarTheme;
  headingTextColor: string;
  subTextColor: string;
  headerBg: string;
  headerText: string;
  headerMuted: string;
  headerBorder: string;
  headerActiveBg: string;
  headerActiveText: string;
  headerControlBg: string;
  headerControlText: string;
  headerControlBorder: string;
  headerLogoBg: string;
};
