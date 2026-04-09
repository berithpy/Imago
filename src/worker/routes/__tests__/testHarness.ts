import { readdirSync, readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import app, { type Bindings } from "../../index";
import { pbkdf2Hash } from "../../lib/crypto";

type Platform = Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>;

const MIGRATIONS_DIR = new URL("../../../../migrations/", import.meta.url);

const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort()
  .map((fileName) => new URL(fileName, MIGRATIONS_DIR));

export type GallerySeedOptions = {
  slug: string;
  isPublic: boolean;
  password?: string;
};

export type WorkerTestHarness = {
  env: Bindings;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  runSql: (sql: string, bindings?: unknown[]) => Promise<void>;
  resetDb: () => Promise<void>;
  seedGallery: (opts: GallerySeedOptions) => Promise<{ id: string; slug: string; password: string }>;
  dispose: () => Promise<void>;
};

async function runSqlOn(db: D1Database, sql: string, bindings: unknown[] = []) {
  await db.prepare(sql).bind(...bindings).run();
}

async function applyMigrations(db: D1Database) {
  for (const fileUrl of MIGRATION_FILES) {
    const sql = readFileSync(fileUrl, "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await runSqlOn(db, statement);
      } catch (err) {
        const message = String((err as Error).message || "");
        if (!/already exists|duplicate/i.test(message)) throw err;
      }
    }
  }
}

async function resetDb(db: D1Database) {
  const statements = [
    "DELETE FROM account",
    "DELETE FROM session",
    "DELETE FROM verification",
    "DELETE FROM admin_log",
    "DELETE FROM gallery_allowed_emails",
    "DELETE FROM photos",
    "DELETE FROM gallery_subscribers",
    "DELETE FROM galleries",
    "DELETE FROM app_config",
    "DELETE FROM user",
  ];

  for (const statement of statements) {
    await runSqlOn(db, statement);
  }
}

export async function createWorkerTestHarness(): Promise<WorkerTestHarness> {
  // Use ephemeral local binding state so parallel test workers don't contend
  // for the same persisted D1 sqlite files.
  const platform: Platform = await getPlatformProxy<Bindings>({
    persist: false,
  });
  const env: Bindings = {
    ...platform.env,
    JWT_SECRET: "test-jwt-secret",
    BETTER_AUTH_SECRET: "test-better-auth-secret",
    ADMIN_RESET_SECRET: "test-admin-reset-secret",
    RESEND_API_KEY: "test-resend-key",
    FROM_EMAIL: "noreply@example.com",
    APP_URL: "http://localhost:5173",
  };

  await applyMigrations(env.DB);

  const runSql = async (sql: string, bindings: unknown[] = []) => {
    await runSqlOn(env.DB, sql, bindings);
  };

  const request = async (path: string, init?: RequestInit) => {
    const req = new Request(`http://localhost${path}`, init);
    return app.fetch(req, env);
  };

  const seedGallery = async (opts: GallerySeedOptions) => {
    const password = opts.password ?? "test-pass";
    const passwordHash = await pbkdf2Hash(password);
    const id = crypto.randomUUID();

    await runSql(
      "INSERT INTO galleries (id, name, slug, password_hash, is_public, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
      [id, `Gallery ${opts.slug}`, opts.slug, passwordHash, opts.isPublic ? 1 : 0]
    );

    return { id, slug: opts.slug, password };
  };

  return {
    env,
    request,
    runSql,
    resetDb: async () => resetDb(env.DB),
    seedGallery,
    dispose: async () => {
      await platform.dispose();
    },
  };
}
