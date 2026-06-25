import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SpinnerOverlay } from "../components/Spinner";
import { withReturnTo } from "./authRedirect";
import { useAuth, type AuthState } from "./authContext";

export type AuthCheckDecision<T = void> =
  | { outcome: "unknown" }
  | { outcome: "allowed"; data?: T }
  | { outcome: "redirect"; to: string }
  | { outcome: "blocked"; reason?: string; data?: T };

type AuthRequirement =
  | {
    role: "authenticated";
    loginPath: string;
    returnTo?: string;
    unauthorizedTo?: string;
  }
  | {
    role: "super-admin";
    loginPath: string;
    returnTo?: string;
    unauthorizedTo?: string;
  }
  | {
    role: "tenant-member";
    tenantSlug: string;
    loginPath: string;
    returnTo?: string;
    unauthorizedTo?: string;
  };

type SessionRedirectOptions = {
  loading: boolean;
  auth: AuthState | null;
  errorCode?: string | null;
  redirectTo: string;
};

type LoginResolveOptions = {
  loading: boolean;
  auth: AuthState | null;
  redirectTarget: string | null;
};

function redirectToLogin(path: string, returnTo?: string): string {
  return withReturnTo(path, returnTo);
}

export function resolveAuthCheck(
  options: { loading: boolean; auth: AuthState | null },
  requirement: AuthRequirement
): AuthCheckDecision {
  if (options.loading) return { outcome: "unknown" };

  if (!options.auth) {
    return {
      outcome: "redirect",
      to: redirectToLogin(requirement.loginPath, requirement.returnTo),
    };
  }

  if (requirement.role === "authenticated") {
    return { outcome: "allowed" };
  }

  if (requirement.role === "super-admin") {
    if (options.auth.superAdmin) return { outcome: "allowed" };
    return requirement.unauthorizedTo
      ? { outcome: "redirect", to: requirement.unauthorizedTo }
      : { outcome: "blocked" };
  }

  if (
    options.auth.superAdmin ||
    options.auth.memberships.some((membership) => membership.tenantSlug === requirement.tenantSlug)
  ) {
    return { outcome: "allowed" };
  }

  return requirement.unauthorizedTo
    ? { outcome: "redirect", to: requirement.unauthorizedTo }
    : { outcome: "blocked" };
}

export function resolveSessionRedirect(
  options: SessionRedirectOptions
): AuthCheckDecision {
  if (options.loading) return { outcome: "unknown" };
  if (options.errorCode) return { outcome: "allowed" };
  if (options.auth) return { outcome: "redirect", to: options.redirectTo };
  return { outcome: "allowed" };
}

export function resolveLoginResolveDecision(
  options: LoginResolveOptions
): AuthCheckDecision {
  if (options.loading) return { outcome: "unknown" };
  if (!options.auth) return { outcome: "redirect", to: "/login" };
  if (options.redirectTarget) return { outcome: "redirect", to: options.redirectTarget };
  if (options.auth.superAdmin) return { outcome: "redirect", to: "/operator" };
  if (options.auth.memberships.length === 1) {
    return {
      outcome: "redirect",
      to: `/${options.auth.memberships[0].tenantSlug}/manage`,
    };
  }
  if (options.auth.memberships.length === 0) {
    return { outcome: "redirect", to: "/login?error=not-authorized" };
  }
  return { outcome: "allowed" };
}

export function useAuthCheck(requirement: AuthRequirement): AuthCheckDecision {
  const { auth, loading } = useAuth();
  return resolveAuthCheck({ auth, loading }, requirement);
}

export function AuthCheckBoundary({
  decision,
  children,
  fallback,
  blocked,
}: {
  decision: AuthCheckDecision;
  children: ReactNode;
  fallback?: ReactNode;
  blocked?: ReactNode;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (decision.outcome === "redirect") {
      navigate(decision.to, { replace: true });
    }
  }, [decision, navigate]);

  if (decision.outcome === "allowed") return <>{children}</>;
  if (decision.outcome === "blocked") return <>{blocked ?? fallback ?? <AuthCheckPlaceholder />}</>;
  return <>{fallback ?? <AuthCheckPlaceholder />}</>;
}

export function AuthCheckPlaceholder({ label = "Checking access..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SpinnerOverlay label={label} />
    </div>
  );
}
