import { Hono } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import { requestAdminMagicLink } from "../services/adminAuthService";
import { ServiceError } from "../services/types";

export const loginRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Universal login: magic-link request
// Sends a link only when the email is an Imago operator OR has at least
// one active tenant membership. Always returns { ok: true } (no
// enumeration). Callback lands the user on /login/resolve which routes
// them to the highest-privilege dashboard available.
// ------------------------------------------------------------------
loginRoutes.post("/magic-link", async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({} as { email?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await requestAdminMagicLink(ctx, {
      rawEmail: body.email,
      appOrigin: new URL(c.req.raw.url).origin,
      requestHeaders: c.req.raw.headers,
    });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});