import { Hono } from "hono";
import { Bindings } from "../index";
import { requireViewer } from "../middleware/auth";
import { getDb } from "../lib/db";
import {
  exportGallery,
  getPhotoById,
  getPublicGallery,
  listPhotos,
  listPublicGalleries,
} from "../services/galleryService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";

export const galleryRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

function svc(c: { env: Bindings }) {
  return { env: c.env, db: getDb(c.env), actor: null };
}

function mapErr(c: any, err: unknown) {
  if (err instanceof ServiceError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ error: err.message }, err.status as any);
  }
  throw err;
}

// ------------------------------------------------------------------
// Public: list galleries (names + slugs only, no photos)
// ------------------------------------------------------------------
galleryRoutes.get("/", async (c) => {
  const galleries = await listPublicGalleries(svc(c), c.get("tenantId"));
  return c.json({ galleries });
});

// ------------------------------------------------------------------
// Public: get a single gallery's metadata (no photos, no password hash)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  try {
    const gallery = await getPublicGallery(svc(c), slug, c.get("tenantId"));
    return c.json({ gallery });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Protected: export gallery — pre-signed R2 URLs (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/export", requireViewer as any, async (c) => {
  const { slug } = c.req.param();
  try {
    const payload = await exportGallery(svc(c), slug, c.get("tenantId"));
    return c.json(payload);
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Protected: fetch a single photo by id (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/photos/:photoId", requireViewer as any, async (c) => {
  const { slug, photoId } = c.req.param();
  try {
    const photo = await getPhotoById(svc(c), slug, photoId, c.get("tenantId"));
    return c.json({ photo });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Protected: list photos in a gallery (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/photos", requireViewer as any, async (c) => {
  const { slug } = c.req.param();
  const cursor = c.req.query("cursor");
  const limit = Number(c.req.query("limit") ?? 50);

  try {
    const page = await listPhotos(svc(c), {
      slug,
      tenantId: c.get("tenantId"),
      cursor,
      limit,
    });
    // Surface auth method for client-side analytics (e.g. Google Analytics
    // custom dimension). Set by `requireViewer`; one of public | password |
    // magic_link | admin_bypass.
    const authMethod = (c.get as (k: string) => unknown)("viewerAuthMethod") as
      | string
      | undefined;
    return c.json({ ...page, authMethod });
  } catch (err) {
    return mapErr(c, err);
  }
});