import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, type AuthUser, type Company } from "./client";
import { applyBranding } from "./branding";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, companySlug: string) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isHrAdmin: boolean;
  isEmployee: boolean;
  company: AuthUser["company"] | null;
  updateCompany: (company: Company) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
export { AuthContext };
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("logleg_token"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    if (!localStorage.getItem("logleg_token")) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.me();
      setUser(res.user);
      setToken(localStorage.getItem("logleg_token"));
    } catch {
      localStorage.removeItem("logleg_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the app's accent colour, surfaces and header theme in sync with the tenant.
  useEffect(() => {
    applyBranding(
      user?.company?.primaryColor,
      user?.company?.cardBgColor,
      user?.company?.sidebarTheme,
      user?.company?.headingTextColor,
      user?.company?.subTextColor,
    );
  }, [
    user?.company?.primaryColor,
    user?.company?.cardBgColor,
    user?.company?.sidebarTheme,
    user?.company?.headingTextColor,
    user?.company?.subTextColor,
  ]);

  const login = async (email: string, password: string, companySlug: string) => {
    const res = await api.login({ email, password, companySlug });
    localStorage.setItem("logleg_token", res.accessToken);
    // Load the full profile (company/department context) BEFORE exposing the
    // token to the app. Otherwise route guards render the dashboard with a null
    // user mid-login and the first mount fails until the page is refreshed.
    const me = await api.me();
    setUser(me.user);
    setToken(res.accessToken);
    return me.user;
  };

  const logout = () => {
    localStorage.removeItem("logleg_token");
    setToken(null);
    setUser(null);
  };

  const updateCompany = (company: Company) => {
    setUser((current) =>
      current ? { ...current, company: { ...current.company, ...company } } : current,
    );
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      refreshMe,
      isHrAdmin: user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN",
      isEmployee: user?.role === "EMPLOYEE",
      company: user?.company ?? null,
      updateCompany,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
