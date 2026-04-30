import { Hono } from "hono";
import { Bindings } from "../index";

export const interestRoutes = new Hono<{ Bindings: Bindings }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

// ------------------------------------------------------------------
// POST /api/interest
// Public landing-page waitlist capture. Idempotent on duplicate email.
// ------------------------------------------------------------------
interestRoutes.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const raw = (body as { email?: unknown })?.email;
  if (typeof raw !== "string") {
    return c.json({ error: "Email required" }, 400);
  }

  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM interest_signups WHERE email = ?"
  ).bind(email).first<{ id: string }>();

  if (existing) {
    return c.json({ ok: true, alreadyRegistered: true });
  }

  await c.env.DB.prepare(
    "INSERT INTO interest_signups (id, email, source, created_at) VALUES (?, ?, ?, unixepoch())"
  ).bind(crypto.randomUUID(), email, "landing").run();

  return c.json({ ok: true });
});
