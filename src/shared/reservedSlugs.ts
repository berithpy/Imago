/**
 * Shared reserved-slug lists. Used by both worker validators and the
 * client-side drift test. Keep in sync with `src/client/App.tsx` —
 * a vitest in `src/client/__tests__/reservedSlugs.test.ts` enforces
 * this by parsing App.tsx and asserting every literal route segment
 * is reserved here.
 */

/**
 * Top-level path segments under `/` that cannot be used as a tenant slug
 * (they would shadow application routes).
 */
export const RESERVED_TENANT_SLUGS: readonly string[] = [
  "login",
  "operator",
  "gallery",
  "api",
];

/**
 * First path segments under `/:tenantSlug/` that cannot be used as a gallery
 * slug (they would shadow tenant-admin routes).
 */
export const RESERVED_GALLERY_SUBPATHS: readonly string[] = [
  "manage",
  "login",
  "setup",
  "settings",
  "admin",
];
