import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthNavigationHint,
  deriveAuthNavigationHint,
  readAuthNavigationHint,
  type AuthNavigationHint,
  writeAuthNavigationHint,
} from "./authHint";

/**
 * Shape of a single membership returned by GET /api/me. Mirrors the worker
 * response in `src/worker/routes/me.ts`.
 */
export type AuthMembership = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** Stored role value, e.g. "tenant_operator" */
  role: string;
  /** Neutral display label, e.g. "Account owner" */
  roleDisplay: string;
  /** Slug of the parent tenant when this is a sub-tenant; null for top-level. */
  parentTenantSlug: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthState = {
  user: AuthUser;
  superAdmin: boolean;
  memberships: AuthMembership[];
};

export type AuthContextValue = {
  /** Null when unauthenticated or before the first /api/me probe completes. */
  auth: AuthState | null;
  /** True until the first /api/me probe resolves. */
  loading: boolean;
  /** Non-authoritative dashboard hint for first-paint public navigation. */
  hint: AuthNavigationHint | null;
  /** Re-fetch /api/me; call after login/logout. */
  refresh: () => Promise<void>;
  /** Clear the cached dashboard hint immediately. */
  clearHint: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  auth: null,
  loading: true,
  hint: null,
  refresh: async () => { },
  clearHint: () => { },
});

/**
 * Hook to access the current auth state. Returns `{ auth, loading, refresh }`.
 * `auth` is null when unauthenticated.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Wrap the app once near the root. Fetches GET /api/me on mount and exposes
 * the result via React context. Pages can call `refresh()` after sign-in or
 * sign-out to update the cached state without a full reload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<AuthNavigationHint | null>(() => {
    if (typeof document === "undefined") return null;
    return readAuthNavigationHint(document.cookie);
  });

  const clearHint = useCallback(() => {
    clearAuthNavigationHint();
    setHint(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) {
        setAuth(null);
        clearHint();
        return;
      }
      if (!res.ok) {
        setAuth(null);
        clearHint();
        return;
      }
      const data = (await res.json()) as AuthState;
      setAuth(data);
      const nextHint = deriveAuthNavigationHint(data);
      writeAuthNavigationHint(nextHint);
      setHint(nextHint);
    } catch {
      setAuth(null);
      clearHint();
    } finally {
      setLoading(false);
    }
  }, [clearHint]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, loading, hint, refresh, clearHint }),
    [auth, loading, hint, refresh, clearHint]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
