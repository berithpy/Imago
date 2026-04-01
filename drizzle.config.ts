import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/worker/lib/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
