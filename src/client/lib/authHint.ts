import { sanitizeAppRedirectTarget } from "./authRedirect";

const AUTH_NAV_HINT_COOKIE = "imago_auth_nav_hint";
const AUTH_NAV_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type DashboardPathSource = {
  superAdmin: boolean;
  memberships: Array<{ tenantSlug: string }>;
};

export type AuthNavigationHint = {
  dashboardPath: string;
};

export function deriveDashboardPath(auth: DashboardPathSource): string | null {
  if (auth.superAdmin) return "/operator";
  if (auth.memberships[0]) return `/${auth.memberships[0].tenantSlug}/manage`;
  return null;
}

export function resolveLandingNavTarget(options: {
  auth: DashboardPathSource | null;
  loading: boolean;
  hint: AuthNavigationHint | null;
}): { href: string; dashboard: boolean } {
  const dashboardPath = options.auth ? deriveDashboardPath(options.auth) : null;
  if (dashboardPath) return { href: dashboardPath, dashboard: true };
  if (options.loading && options.hint?.dashboardPath) {
    return { href: options.hint.dashboardPath, dashboard: true };
  }
  return { href: "/login", dashboard: false };
}

export function deriveAuthNavigationHint(
  auth: DashboardPathSource | null
): AuthNavigationHint | null {
  if (!auth) return null;
  const dashboardPath = deriveDashboardPath(auth);
  if (!dashboardPath) return null;
  return { dashboardPath };
}

export function parseAuthNavigationHint(
  cookieValue: string | null | undefined
): AuthNavigationHint | null {
  if (!cookieValue) return null;

  try {
    const parsed = JSON.parse(cookieValue) as { dashboardPath?: unknown };
    const dashboardPath = sanitizeAppRedirectTarget(
      typeof parsed.dashboardPath === "string" ? parsed.dashboardPath : null
    );
    if (!dashboardPath) return null;
    return { dashboardPath };
  } catch {
    return null;
  }
}

export function readAuthNavigationHint(cookieSource: string): AuthNavigationHint | null {
  const cookie = cookieSource
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_NAV_HINT_COOKIE}=`));

  if (!cookie) return null;
  const rawValue = cookie.slice(AUTH_NAV_HINT_COOKIE.length + 1);
  try {
    return parseAuthNavigationHint(decodeURIComponent(rawValue));
  } catch {
    return null;
  }
}

export function writeAuthNavigationHint(
  hint: AuthNavigationHint | null
): void {
  if (typeof document === "undefined") return;

  if (!hint) {
    clearAuthNavigationHint();
    return;
  }

  const payload = encodeURIComponent(JSON.stringify(hint));
  document.cookie = `${AUTH_NAV_HINT_COOKIE}=${payload}; Max-Age=${AUTH_NAV_HINT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function clearAuthNavigationHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_NAV_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
