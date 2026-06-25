import { describe, expect, it } from "vitest";
import {
  resolveAuthCheck,
  resolveLoginResolveDecision,
  resolveSessionRedirect,
} from "../lib/authGate";

const superAdminAuth = {
  user: { id: "user-1", email: "op@example.com", name: "Operator" },
  superAdmin: true,
  memberships: [],
};

const tenantAuth = {
  user: { id: "user-2", email: "owner@example.com", name: "Owner" },
  superAdmin: false,
  memberships: [
    {
      tenantId: "tenant-1",
      tenantSlug: "acme",
      tenantName: "Acme",
      role: "tenant_operator",
      roleDisplay: "Account owner",
      parentTenantSlug: null,
    },
  ],
};

describe("resolveAuthCheck", () => {
  it("keeps operator routes neutral while the auth probe is unresolved", () => {
    expect(
      resolveAuthCheck(
        { auth: null, loading: true },
        {
          role: "super-admin",
          loginPath: "/login",
          returnTo: "/operator/users",
          unauthorizedTo: "/login?error=not-authorized",
        }
      )
    ).toEqual({ outcome: "unknown" });
  });

  it("redirects signed-out operator visitors with a validated return target", () => {
    expect(
      resolveAuthCheck(
        { auth: null, loading: false },
        {
          role: "super-admin",
          loginPath: "/login",
          returnTo: "/operator/users?tab=recent",
          unauthorizedTo: "/login?error=not-authorized",
        }
      )
    ).toEqual({
      outcome: "redirect",
      to: "/login?returnTo=%2Foperator%2Fusers%3Ftab%3Drecent",
    });
  });

  it("keeps tenant dashboard routes neutral while the auth probe is unresolved", () => {
    expect(
      resolveAuthCheck(
        { auth: null, loading: true },
        {
          role: "tenant-member",
          tenantSlug: "acme",
          loginPath: "/acme/login",
          returnTo: "/acme/manage",
          unauthorizedTo: "/acme",
        }
      )
    ).toEqual({ outcome: "unknown" });
  });

  it("allows tenant members and redirects authenticated non-members away from dashboard routes", () => {
    expect(
      resolveAuthCheck(
        { auth: tenantAuth, loading: false },
        {
          role: "tenant-member",
          tenantSlug: "acme",
          loginPath: "/acme/login",
          returnTo: "/acme/manage",
          unauthorizedTo: "/acme",
        }
      )
    ).toEqual({ outcome: "allowed" });

    expect(
      resolveAuthCheck(
        { auth: tenantAuth, loading: false },
        {
          role: "tenant-member",
          tenantSlug: "other",
          loginPath: "/other/login",
          returnTo: "/other/manage",
          unauthorizedTo: "/other",
        }
      )
    ).toEqual({ outcome: "redirect", to: "/other" });
  });
});

describe("resolveSessionRedirect", () => {
  it("keeps login checks neutral while the auth probe is unresolved", () => {
    expect(
      resolveSessionRedirect({
        auth: null,
        loading: true,
        redirectTo: "/login/resolve",
      })
    ).toEqual({ outcome: "unknown" });
  });

  it("redirects authenticated users away from login forms after the probe resolves", () => {
    expect(
      resolveSessionRedirect({
        auth: superAdminAuth,
        loading: false,
        redirectTo: "/login/resolve?returnTo=%2Foperator",
      })
    ).toEqual({
      outcome: "redirect",
      to: "/login/resolve?returnTo=%2Foperator",
    });
  });
});

describe("resolveLoginResolveDecision", () => {
  it("keeps dashboard resolution neutral while auth is still unknown", () => {
    expect(
      resolveLoginResolveDecision({
        auth: null,
        loading: true,
        redirectTarget: null,
      })
    ).toEqual({ outcome: "unknown" });
  });

  it("supports redirect-back and multi-tenant chooser outcomes explicitly", () => {
    expect(
      resolveLoginResolveDecision({
        auth: superAdminAuth,
        loading: false,
        redirectTarget: "/operator/users",
      })
    ).toEqual({ outcome: "redirect", to: "/operator/users" });

    expect(
      resolveLoginResolveDecision({
        auth: {
          ...tenantAuth,
          memberships: [
            tenantAuth.memberships[0],
            {
              ...tenantAuth.memberships[0],
              tenantId: "tenant-2",
              tenantSlug: "bravo",
              tenantName: "Bravo",
            },
          ],
        },
        loading: false,
        redirectTarget: null,
      })
    ).toEqual({ outcome: "allowed" });
  });
});
