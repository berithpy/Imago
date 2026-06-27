const asyncPanelBaseClass =
  "px-3 py-2.5 bg-neutral-950 border rounded-lg transition-colors";

export function getAsyncPanelClassName(loading: boolean, className?: string) {
  return [
    asyncPanelBaseClass,
    loading ? "gm-animated-border border-amber-400" : "border-neutral-800",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
