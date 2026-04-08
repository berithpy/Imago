import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { Bindings } from "../index";
import * as schema from "./schema";
import { sendEmail, adminMagicLinkHtml, magicLinkHtml } from "./email";

/**
 * Creates a better-auth instance bound to the runtime D1 database.
 * Called per-request since CF Workers env is only available at runtime.
 */
export function auth(env: Bindings, origin?: string) {
  const db = drizzle(env.DB, { schema });
  const appUrl = env.APP_URL ?? "http://localhost:5173";
  const baseURL = `${appUrl}/api/auth`;
  const isProd = !appUrl.includes("localhost");
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) => {
          const adminRow = await db.select({ email: schema.user.email }).from(schema.user).limit(1);
          const isAdmin = adminRow.length > 0 && adminRow[0].email.toLowerCase() === email.toLowerCase();
          await sendEmail(env.RESEND_API_KEY, env.FROM_EMAIL, {
            to: email,
            subject: "Your sign-in link",
            html: isAdmin ? adminMagicLinkHtml(url) : magicLinkHtml("the gallery", url),
          });
        },
      }),
    ],
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
    trustedOrigins: [appUrl, "http://localhost:8787", "http://localhost:5173"],
  });
}
