import { useContext } from "react";
import { AuthContext } from "../api/AuthContext";

export function useUser() {
  const result = useContext(AuthContext) || { user: null, loading: true };
  const { user: userResult } = result;
  if (!userResult) {
    throw new Error("useUser must be used within an AuthProvider with user loaded");
  }
  return { user: userResult };
}