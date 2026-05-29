import { describe, expect, it, vi } from "vitest";
import { buildSenderAddress, sendEmail, type EmailBinding } from "./email";

describe("sendEmail", () => {
  it("skips sending when EMAIL binding is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await sendEmail(undefined, "example.com", "notifications", {
      to: "viewer@example.com",
      subject: "Subject",
      html: "<p>Hello</p>",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email] EMAIL binding not configured — skipping send to viewer@example.com"
    );
    warnSpy.mockRestore();
  });

  it("sends with expected payload when EMAIL binding exists", async () => {
    const send = vi.fn<EmailBinding["send"]>(async () => ({ messageId: "mid_123" }));
    const email: EmailBinding = { send };

    await sendEmail(email, "example.com", "login", {
      to: "viewer@example.com",
      subject: "Welcome",
      html: "<h1>Welcome</h1>",
    });

    expect(send).toHaveBeenCalledWith({
      from: "login@example.com",
      to: "viewer@example.com",
      subject: "Welcome",
      html: "<h1>Welcome</h1>",
    });
  });

  it("builds sender addresses from a local part and domain", () => {
    expect(buildSenderAddress("berith.moe", "login")).toBe("login@berith.moe");
    expect(buildSenderAddress("berith.moe", "notifications")).toBe("notifications@berith.moe");
  });
});
