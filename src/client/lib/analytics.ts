// Tiny typed wrapper around the global `gtag.js` snippet loaded in
// `index.html`. All functions are no-ops when `window.gtag` is unavailable
// (tests, ad-blockers, SSR). Do NOT pass PII (emails, gallery titles, photo
// IDs, etc.) to these helpers.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params ?? {});
}

export function setUserProperties(props: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", props);
}
