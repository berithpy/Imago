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

export function getPostLoginRedirect(params: URLSearchParams): string | null {
  const returnTo = sanitizeAppRedirectTarget(params.get("returnTo"));
  if (returnTo) return returnTo;

  const next = sanitizeAppRedirectTarget(params.get("next"));
  if (next) return next;

  return null;
}
