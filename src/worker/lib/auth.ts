import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { Bindings } from "../index";
import * as schema from "./schema";

/**
 * Creates a better-auth instance bound to the runtime D1 database.
 * Called per-request since CF Workers env is only available at runtime.
 */
export function auth(env: Bindings, origin?: string) {
  const db = drizzle(env.DB, { schema });
  const baseURL = origin ? `${origin}/api/auth` : "http://localhost:8787/api/auth";
  const isProd = origin ? !origin.includes("localhost") : false;
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,       // roll the expiry once per day on activity
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24, // 24 hours — single-admin app, revocation lag is acceptable
      },
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      defaultCookieAttributes: {
        secure: isProd,
        sameSite: "lax",
      },
    },
    trustedOrigins: [origin ?? "http://localhost:8787", "http://localhost:5173"],
  });
}
