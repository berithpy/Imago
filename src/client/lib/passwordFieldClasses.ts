const inputBaseClass =
  "flex-1 min-w-0 px-3.5 py-2.5 bg-neutral-950 border rounded-lg text-neutral-100 text-sm outline-none transition-colors";

/**
 * Returns the shared password input class list for gallery settings.
 *
 * Keeps an idle neutral border by default and switches to the animated
 * amber loading border so password-reset UI uses input-level async feedback
 * without adding a container-level border around the whole control row.
 */
export function getPasswordInputClassName(loading: boolean, className?: string) {
  return [
    inputBaseClass,
    loading ? "gm-animated-border border-amber-400" : "border-neutral-800",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}