function safeDecodeParam(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function sanitizeAppRedirectTarget(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const decoded = safeDecodeParam(raw);
  if (!decoded) return null;

  const candidate = decoded.trim();
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.startsWith("/api/")) return null;
  return candidate;
}

export function buildAppReturnTo(
  pathname: string,
  search = "",
  hash = ""
): string {
  return sanitizeAppRedirectTarget(`${pathname}${search}${hash}`) ?? "/";
}

export function withReturnTo(
  loginPath: string,
  returnTo: string | null | undefined
): string {
  const safeReturnTo = sanitizeAppRedirectTarget(returnTo);
  if (!safeReturnTo) return loginPath;

  const url = new URL(loginPath, "https://imago.local");
  url.searchParams.set("returnTo", safeReturnTo);
  return `${url.pathname}${url.search}`;
}

export function getPostLoginRedirect(params: URLSearchParams): string | null {
  const returnTo = sanitizeAppRedirectTarget(params.get("returnTo"));
  if (returnTo) return returnTo;

  const next = sanitizeAppRedirectTarget(params.get("next"));
  if (next) return next;

  return null;
}
