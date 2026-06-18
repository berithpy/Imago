import { describe, expect, it } from "vitest";
import {
  SITE_META_DEFAULTS,
  buildGalleryLoginMetadata,
  buildGalleryViewMetadata,
  createDefaultPageMetadata,
} from "../lib/pageMetadata";

describe("pageMetadata", () => {
  it("returns default metadata when gallery name is unavailable", () => {
    const meta = buildGalleryViewMetadata({
      galleryName: "",
      gallerySlug: "summer-2026",
      routeBase: "/acme",
      origin: "https://photos.example.com",
    });

    expect(meta.title).toBe(SITE_META_DEFAULTS.siteName);
    expect(meta.ogTitle).toBe(SITE_META_DEFAULTS.siteName);
    expect(meta.twitterTitle).toBe(SITE_META_DEFAULTS.siteName);
  });

  it("builds gallery view metadata with canonical and banner image", () => {
    const meta = buildGalleryViewMetadata({
      galleryName: "Summer Wedding",
      gallerySlug: "summer-2026",
      tenantName: "Acme Studio",
      routeBase: "/acme",
      origin: "https://photos.example.com/",
      bannerKey: "gallery-1/banner",
    });

    expect(meta.title).toBe("Summer Wedding - Acme Studio");
    expect(meta.canonicalUrl).toBe("https://photos.example.com/acme/summer-2026");
    expect(meta.ogUrl).toBe("https://photos.example.com/acme/summer-2026");
    expect(meta.ogImage).toBe("https://photos.example.com/api/images/gallery-1/banner?variant=banner");
    expect(meta.twitterCard).toBe("summary_large_image");
  });

  it("builds gallery login metadata with sign-in title", () => {
    const meta = buildGalleryLoginMetadata({
      galleryName: "Summer Wedding",
      gallerySlug: "summer-2026",
      tenantName: "Acme Studio",
      routeBase: "/acme",
      origin: "https://photos.example.com",
    });

    expect(meta.title).toBe("Summer Wedding - Sign in");
    expect(meta.description).toBe("Sign in to access the Summer Wedding gallery on Acme Studio.");
    expect(meta.canonicalUrl).toBe("https://photos.example.com/acme/summer-2026");
  });

  it("creates default metadata with absolute og image when origin is provided", () => {
    const meta = createDefaultPageMetadata("https://photos.example.com/");
    expect(meta.ogImage).toBe("https://photos.example.com/og-default.png");
    expect(meta.twitterImage).toBe("https://photos.example.com/og-default.png");
    expect(meta.twitterCard).toBe("summary_large_image");
  });
});