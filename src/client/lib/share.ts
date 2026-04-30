/**
 * Share a gallery URL via the Web Share API when available, falling back to
 * clipboard copy. Returns "shared" when the native share sheet was used (or
 * dismissed), "copied" when the URL was placed on the clipboard, or "failed"
 * when no method worked.
 */
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
