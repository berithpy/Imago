import { describe, expect, it } from "vitest";
import { getPasswordInputClassName } from "../lib/passwordFieldClasses";

describe("getPasswordInputClassName", () => {
  it("returns neutral border when idle", () => {
    const className = getPasswordInputClassName(false);

    expect(className).toContain("border-neutral-800");
    expect(className).not.toContain("gm-animated-border");
    expect(className).not.toContain("border-amber-400");
  });

  it("returns animated amber border when loading", () => {
    const className = getPasswordInputClassName(true);

    expect(className).toContain("gm-animated-border");
    expect(className).toContain("border-amber-400");
  });
});
