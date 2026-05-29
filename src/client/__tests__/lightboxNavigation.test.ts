import { describe, expect, it } from "vitest";
import {
  getActivePhotoIndex,
  getAdjacentPreloadPhotos,
  getNavigationTargetIndex,
} from "../lib/lightboxNavigation";

const photos = [
  { id: "p1", r2_key: "g/p1" },
  { id: "p2", r2_key: "g/p2" },
  { id: "p3", r2_key: "g/p3" },
];

describe("lightbox navigation helpers", () => {
  it("finds the active photo index", () => {
    expect(getActivePhotoIndex(photos, "p2")).toBe(1);
    expect(getActivePhotoIndex(photos, "missing")).toBe(-1);
    expect(getActivePhotoIndex(photos)).toBe(-1);
  });

  it("computes bounded navigation target indexes", () => {
    expect(getNavigationTargetIndex(1, photos.length, -1)).toBe(0);
    expect(getNavigationTargetIndex(1, photos.length, 1)).toBe(2);
    expect(getNavigationTargetIndex(0, photos.length, -1)).toBe(-1);
    expect(getNavigationTargetIndex(2, photos.length, 1)).toBe(-1);
  });

  it("returns only immediate preload neighbors", () => {
    expect(getAdjacentPreloadPhotos(photos, 1).map((photo) => photo.id)).toEqual(["p1", "p3"]);
    expect(getAdjacentPreloadPhotos(photos, 0).map((photo) => photo.id)).toEqual(["p2"]);
    expect(getAdjacentPreloadPhotos(photos, 2).map((photo) => photo.id)).toEqual(["p2"]);
    expect(getAdjacentPreloadPhotos(photos, -1)).toEqual([]);
  });
});
