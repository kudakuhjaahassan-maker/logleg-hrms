import { useContext } from "react";
import { AuthContext } from "../api/AuthContext";
import type { AuthUser } from "../api/client";

/**
 * Reads the authenticated user without ever throwing during hydration.
 * Right after sign-in the profile request may still be in flight, so consumers
 * must treat `user` as nullable (and `loading` as true) instead of crashing into
 * the root error boundary.
 */
export function useUser(): { user: AuthUser | null; loading: boolean } {
  const ctx = useContext(AuthContext);
  return { user: ctx?.user ?? null, loading: ctx?.loading ?? true };
}
