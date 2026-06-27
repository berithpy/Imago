import { describe, expect, it } from "vitest";
import { buildAbsoluteGalleryUrl, buildGalleryShareAccessCopy } from "../lib/share";

describe("share helpers", () => {
  it("builds an absolute gallery URL without duplicate slashes", () => {
    expect(buildAbsoluteGalleryUrl("/acme/", "summer-2026", "https://photos.example.com/")).toBe(
      "https://photos.example.com/acme/summer-2026"
    );
  });

  it("builds the share-access clipboard payload", () => {
    expect(
      buildGalleryShareAccessCopy({
        galleryName: "Summer Wedding",
        url: "https://photos.example.com/acme/summer-2026",
        password: "secret-123",
      })
    ).toBe(
      "Gallery access for Summer Wedding\nhttps://photos.example.com/acme/summer-2026\nPassword: secret-123"
    );
  });
});
