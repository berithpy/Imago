import { describe, expect, it } from "vitest";
import { getAsyncPanelClassName } from "../lib/asyncPanel";

describe("getAsyncPanelClassName", () => {
  it("returns the neutral border when idle", () => {
    const className = getAsyncPanelClassName(false);

    expect(className).toContain("border-neutral-800");
    expect(className).not.toContain("gm-animated-border");
    expect(className).not.toContain("border-amber-400");
  });

  it("returns the animated amber border when loading", () => {
    const className = getAsyncPanelClassName(true);

    expect(className).toContain("gm-animated-border");
    expect(className).toContain("border-amber-400");
  });
});
