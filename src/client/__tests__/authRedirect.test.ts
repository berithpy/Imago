import { describe, expect, it } from "vitest";
import {
  buildAppReturnTo,
  getPostLoginRedirect,
  sanitizeAppRedirectTarget,
  withReturnTo,
} from "../lib/authRedirect";

describe("sanitizeAppRedirectTarget", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeAppRedirectTarget("/operator/users")).toBe("/operator/users");
    expect(sanitizeAppRedirectTarget("/acme/wedding/edit?tab=photos")).toBe("/acme/wedding/edit?tab=photos");
  });

  it("rejects protocol-relative and non-relative values", () => {
    expect(sanitizeAppRedirectTarget("//evil.example/path")).toBeNull();
    expect(sanitizeAppRedirectTarget("https://evil.example/path")).toBeNull();
  });

  it("rejects API paths", () => {
    expect(sanitizeAppRedirectTarget("/api/tenant/users")).toBeNull();
  });

  it("treats malformed escapes as absent", () => {
    expect(sanitizeAppRedirectTarget("%ZZ")).toBeNull();
  });
});

describe("getPostLoginRedirect", () => {
  it("prefers returnTo over next", () => {
    const params = new URLSearchParams({
      returnTo: "/operator",
      next: "/acme/manage",
    });
    expect(getPostLoginRedirect(params)).toBe("/operator");
  });

  it("falls back to next when returnTo is missing", () => {
    const params = new URLSearchParams({ next: "/acme/wedding/edit" });
    expect(getPostLoginRedirect(params)).toBe("/acme/wedding/edit");
  });

  it("returns null when all redirect params are invalid", () => {
    const params = new URLSearchParams({
      returnTo: "https://evil.example",
      next: "//evil.example",
    });
    expect(getPostLoginRedirect(params)).toBeNull();
  });
});

describe("buildAppReturnTo", () => {
  it("keeps same-origin relative deep links", () => {
    expect(buildAppReturnTo("/acme/wedding/photo/123", "?download=1", "#picked")).toBe(
      "/acme/wedding/photo/123?download=1#picked"
    );
  });

  it("falls back to root when the path is invalid", () => {
    expect(buildAppReturnTo("//evil.example", "?x=1")).toBe("/");
  });
});

describe("withReturnTo", () => {
  it("appends a validated returnTo parameter", () => {
    expect(withReturnTo("/login", "/operator/users")).toBe(
      "/login?returnTo=%2Foperator%2Fusers"
    );
  });

  it("drops invalid return targets", () => {
    expect(withReturnTo("/acme/login", "https://evil.example")).toBe("/acme/login");
  });
});
