import { describe, expect, it } from "vitest";
import {
  deriveAuthNavigationHint,
  parseAuthNavigationHint,
  readAuthNavigationHint,
  resolveLandingNavTarget,
} from "../lib/authHint";

describe("resolveLandingNavTarget", () => {
  it("keeps landing on the neutral login target while auth is unresolved without a hint", () => {
    expect(
      resolveLandingNavTarget({
        auth: null,
        loading: true,
        hint: null,
      })
    ).toEqual({ href: "/login", dashboard: false });
  });

  it("uses a validated dashboard hint during a delayed auth probe", () => {
    expect(
      resolveLandingNavTarget({
        auth: null,
        loading: true,
        hint: { dashboardPath: "/operator" },
      })
    ).toEqual({ href: "/operator", dashboard: true });
  });

  it("prefers resolved auth over the hint once the probe completes", () => {
    expect(
      resolveLandingNavTarget({
        auth: {
          superAdmin: false,
          memberships: [{ tenantSlug: "acme" }],
        },
        loading: false,
        hint: { dashboardPath: "/operator" },
      })
    ).toEqual({ href: "/acme/manage", dashboard: true });
  });
});

describe("auth navigation hints", () => {
  it("derives a dashboard hint only for users with a dashboard target", () => {
    expect(
      deriveAuthNavigationHint({
        superAdmin: true,
        memberships: [],
      })
    ).toEqual({ dashboardPath: "/operator" });

    expect(
      deriveAuthNavigationHint({
        superAdmin: false,
        memberships: [],
      })
    ).toBeNull();
  });

  it("schema-validates hint payloads", () => {
    expect(parseAuthNavigationHint('{"dashboardPath":"/acme/manage"}')).toEqual({
      dashboardPath: "/acme/manage",
    });
    expect(parseAuthNavigationHint('{"dashboardPath":"https://evil.example"}')).toBeNull();
    expect(parseAuthNavigationHint('{"dashboardPath":"/api/me"}')).toBeNull();
  });

  it("reads only the expected cookie", () => {
    const cookie = [
      "theme=dark",
      "imago_auth_nav_hint=%7B%22dashboardPath%22%3A%22%2Facme%2Fmanage%22%7D",
    ].join("; ");

    expect(readAuthNavigationHint(cookie)).toEqual({
      dashboardPath: "/acme/manage",
    });
  });
});
