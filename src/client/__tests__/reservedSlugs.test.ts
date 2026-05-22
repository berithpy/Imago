import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RESERVED_TENANT_SLUGS,
  RESERVED_GALLERY_SUBPATHS,
} from "../../shared/reservedSlugs";

/**
 * Drift protection: ensures that every literal route segment defined in
 * App.tsx is present in the corresponding reserved-slug list.
 *
 * If you add a new tenant-scoped admin route (e.g. `/{tenant}/billing`),
 * this test fails until you add `billing` to RESERVED_GALLERY_SUBPATHS.
 * Likewise for new top-level routes vs RESERVED_TENANT_SLUGS.
 */

const APP_TSX = resolve(__dirname, "../App.tsx");
const source = readFileSync(APP_TSX, "utf8");

// Match <Route path="..."> literals. Captures the path string.
const ROUTE_RE = /<Route\s+path=["']([^"']+)["']/g;

// All path attributes in App.tsx
const allPaths: string[] = [];
let match: RegExpExecArray | null;
while ((match = ROUTE_RE.exec(source)) !== null) {
  allPaths.push(match[1]);
}

// First segment of a path (strip leading slash, take up to next /)
function firstSegment(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return trimmed.split("/")[0] ?? "";
}

// Top-level routes are those whose path attribute starts with "/"
const topLevelLiterals = allPaths
  .filter((p) => p.startsWith("/"))
  .map((p) => firstSegment(p))
  .filter((seg) => seg.length > 0 && !seg.startsWith(":") && seg !== "*");

// Tenant-scoped routes are those whose path is relative (no leading slash).
// We classify by the first segment of the relative path; ignore param segments.
const tenantScopedLiterals = allPaths
  .filter((p) => !p.startsWith("/"))
  .map((p) => firstSegment(p))
  .filter((seg) => seg.length > 0 && !seg.startsWith(":") && seg !== "*");

describe("reserved slugs are in sync with App.tsx", () => {
  it("extracted at least one route from App.tsx", () => {
    expect(allPaths.length).toBeGreaterThan(0);
  });

  it("every top-level literal segment is in RESERVED_TENANT_SLUGS", () => {
    const missing = topLevelLiterals.filter(
      (seg) => !RESERVED_TENANT_SLUGS.includes(seg)
    );
    expect(missing).toEqual([]);
  });

  it("every tenant-scoped literal segment is in RESERVED_GALLERY_SUBPATHS", () => {
    const missing = tenantScopedLiterals.filter(
      (seg) => !RESERVED_GALLERY_SUBPATHS.includes(seg)
    );
    expect(missing).toEqual([]);
  });
});
