import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { viewerRoutes } from "./routes/auth";
import { galleryRoutes } from "./routes/galleries";
import { imageRoutes } from "./routes/images";
import { adminRoutes } from "./routes/admin";
import { subscribeRoutes } from "./routes/subscribe";
import { interestRoutes } from "./routes/interest";
import { requireTenant, type TenantVariables } from "./middleware/tenant";
import { tenantsRoutes } from "./routes/tenants";
import { ogImageRoutes } from "./routes/ogImage";
import { ogPreviewRoutes } from "./routes/ogPreview";

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
  // Vars
  FROM_EMAIL: string;
  APP_URL: string;
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
app.route("/api/admin/tenants", tenantsRoutes);
app.route("/api/galleries", galleryRoutes);
app.route("/api/images", imageRoutes);
app.route("/api/subscribe", subscribeRoutes);
app.route("/api/interest", interestRoutes);
app.route("/api/og", ogImageRoutes);

// Tenant-scoped routes: /api/t/:tenantSlug/{admin,viewer,galleries,images,subscribe}
const tenantApp = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();
tenantApp.use("/*", requireTenant);
tenantApp.route("/admin", adminRoutes);
tenantApp.route("/viewer", viewerRoutes);
tenantApp.route("/galleries", galleryRoutes);
tenantApp.route("/images", imageRoutes);
tenantApp.route("/subscribe", subscribeRoutes);
app.route("/api/t/:tenantSlug", tenantApp);

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// SPA fallthrough: anything that did not match an /api route is served by
// the asset pipeline. For gallery URLs we proxy through HTMLRewriter to
// inject Open Graph / Twitter Card meta tags so shared links unfurl.
app.route("/", ogPreviewRoutes);

export default app;
