import { describe, expect, it } from "vitest";
import {
  getAvailableGalleryViewModes,
  getDefaultGalleryViewMode,
  getSafeGalleryViewMode,
  shouldShowKeyboardHint,
} from "../lib/galleryManagementViewMode";

describe("gallery management view mode helpers", () => {
  it("returns list and small grid on mobile widths", () => {
    expect(getAvailableGalleryViewModes(375)).toEqual(["list", "small-grid"]);
    expect(getDefaultGalleryViewMode(375)).toBe("list");
  });

  it("returns grid and small grid on desktop widths", () => {
    expect(getAvailableGalleryViewModes(1200)).toEqual(["grid", "small-grid"]);
    expect(getDefaultGalleryViewMode(1200)).toBe("grid");
  });

  it("falls back to the default mode when current mode is unavailable", () => {
    expect(getSafeGalleryViewMode("grid", 375)).toBe("list");
    expect(getSafeGalleryViewMode("list", 1200)).toBe("grid");
    expect(getSafeGalleryViewMode("small-grid", 1200)).toBe("small-grid");
  });

  it("hides keyboard hints on mobile and keeps them on desktop", () => {
    expect(shouldShowKeyboardHint(375)).toBe(false);
    expect(shouldShowKeyboardHint(1200)).toBe(true);
  });
});
