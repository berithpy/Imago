const RESEND_API_URL = "https://api.resend.com/emails";

const PLACEHOLDER_KEYS = new Set(["your-resend-api-key", "placeholder", "changeme", "test"]);

function isPlaceholder(apiKey: string): boolean {
  return !apiKey || PLACEHOLDER_KEYS.has(apiKey.toLowerCase());
}

export async function sendEmail(
  apiKey: string,
  fromEmail: string,
  opts: { to: string; subject: string; html: string }
): Promise<void> {
  if (isPlaceholder(apiKey)) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping send to ${opts.to}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    console.error(`[email] Resend API error ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export function subscriptionConfirmationHtml(galleryName: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Confirm your subscription</h2>
  <p style="margin-bottom:24px;">You requested to subscribe to updates for <strong>${escapeHtml(galleryName)}</strong>. Click the button below to confirm.</p>
  <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
    Confirm subscription
  </a>
  <p style="margin-top:24px;font-size:0.85rem;color:#666;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}

export function subscriptionConfirmedHtml(galleryName: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Subscribed!</h2>
  <p>You're now subscribed to updates for <strong>${escapeHtml(galleryName)}</strong>. You'll receive an email when new photos are added.</p>
</body>
</html>`;
}

export function unsubscribeConfirmedHtml(galleryName: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Unsubscribed</h2>
  <p>You've been unsubscribed from <strong>${escapeHtml(galleryName)}</strong>. You won't receive any more emails about this gallery.</p>
</body>
</html>`;
}

export function newPhotosHtml(galleryName: string, galleryUrl: string, count: number): string {
  const photoWord = count === 1 ? "photo" : "photos";
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">New ${photoWord} in ${escapeHtml(galleryName)}</h2>
  <p style="margin-bottom:24px;">${count} new ${photoWord} ${count === 1 ? "was" : "were"} added to <strong>${escapeHtml(galleryName)}</strong>.</p>
  <a href="${escapeHtml(galleryUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
    View gallery
  </a>
</body>
</html>`;
}

export function adminOtpHtml(otp: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Your sign-in code</h2>
  <p style="margin-bottom:16px;">Use the code below to sign in. It expires in 10 minutes.</p>
  <div style="font-size:2rem;font-weight:700;letter-spacing:0.25em;background:#f5f5f5;padding:16px 24px;border-radius:6px;display:inline-block;margin-bottom:16px;">
    ${escapeHtml(otp)}
  </div>
  <p style="font-size:0.85rem;color:#666;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}

export function galleryOtpHtml(galleryName: string, otp: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Your gallery access code</h2>
  <p style="margin-bottom:16px;">Use the code below to access <strong>${escapeHtml(galleryName)}</strong>. It expires in 10 minutes.</p>
  <div style="font-size:2rem;font-weight:700;letter-spacing:0.25em;background:#f5f5f5;padding:16px 24px;border-radius:6px;display:inline-block;margin-bottom:16px;">
    ${escapeHtml(otp)}
  </div>
  <p style="font-size:0.85rem;color:#666;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}

export function invitedUserHtml(appName: string, loginUrl: string, email: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">You've been invited to ${escapeHtml(appName)}</h2>
  <p style="margin-bottom:16px;">An admin has given <strong>${escapeHtml(email)}</strong> access. Enter your email on the sign-in page to receive a magic link.</p>
  <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
    Sign in
  </a>
</body>
</html>`;
}

export function magicLinkHtml(galleryName: string, magicLinkUrl: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Your sign-in link</h2>
  <p style="margin-bottom:24px;">Click the button below to access <strong>${escapeHtml(galleryName)}</strong>. This link expires in 10 minutes and can only be used once.</p>
  <a href="${escapeHtml(magicLinkUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
    View gallery
  </a>
  <p style="margin-top:24px;font-size:0.85rem;color:#666;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
