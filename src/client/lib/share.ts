/**
 * Share a gallery URL via the Web Share API when available, falling back to
 * clipboard copy. Returns "shared" when the native share sheet was used (or
 * dismissed), "copied" when the URL was placed on the clipboard, or "failed"
 * when no method worked.
 */
export function buildAbsoluteGalleryUrl(routeBase: string, slug: string, origin?: string): string {
  const resolvedOrigin = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
  const normalizedBase = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
  return `${resolvedOrigin}${normalizedBase}/${slug}`;
}

export function buildGalleryShareAccessCopy(params: {
  galleryName: string;
  url: string;
  password: string;
}): string {
  return `Gallery access for ${params.galleryName}\n${params.url}\nPassword: ${params.password}`;
}

export async function shareUrl(title: string, url: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "shared";
      }
      // fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
