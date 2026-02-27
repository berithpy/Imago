import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { viewerRoutes } from "./routes/auth";
import { galleryRoutes } from "./routes/galleries";
import { imageRoutes } from "./routes/images";
import { adminRoutes } from "./routes/admin";
import { subscribeRoutes } from "./routes/subscribe";

export type Bindings = {
  IMAGES_BUCKET: R2Bucket;
  DB: D1Database;
  IMAGES: ImagesBinding;
  ASSETS: Fetcher;
  // Secrets (set via wrangler secret put or .dev.vars)
  JWT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  ADMIN_RESET_SECRET: string;
  RESEND_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for local dev (Vite proxy handles prod)
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Mount routes
// Better-auth exclusively owns /api/auth/* — no subrouter conflict
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const origin = new URL(c.req.raw.url).origin;
  return auth(c.env, origin).handler(c.req.raw);
});
app.route("/api/viewer", viewerRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/galleries", galleryRoutes);
app.route("/api/images", imageRoutes);
app.route("/api/subscribe", subscribeRoutes);

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
