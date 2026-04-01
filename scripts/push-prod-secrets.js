#!/usr/bin/env node
// Reads .prod.vars and pushes each key as a Wrangler secret.
// Run with: npm run secrets:push
//
// Requires wrangler to be authenticated (npx wrangler login or CLOUDFLARE_API_TOKEN set).
// Skips any key whose value looks like a placeholder (contains "your_" or ends with "_here").

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const varsFile = resolve(process.cwd(), ".prod.vars");

if (!existsSync(varsFile)) {
  console.error(
    "Error: .prod.vars not found. Create it from .prod.vars.example first.",
  );
  process.exit(1);
}

const lines = readFileSync(varsFile, "utf8").split("\n");
const secrets = {};

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  secrets[key] = value;
}

let pushed = 0;
let skipped = 0;

for (const [key, value] of Object.entries(secrets)) {
  if (
    !value ||
    value.toLowerCase().includes("your_") ||
    value.toLowerCase().endsWith("_here")
  ) {
    console.log(
      `⏭  Skipping ${key} — placeholder value, set a real value in .prod.vars first.`,
    );
    skipped++;
    continue;
  }
  try {
    execSync(`npx wrangler secret put ${key}`, {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      encoding: "utf8",
    });
    pushed++;
  } catch {
    console.error(`✗ Failed to push ${key}`);
    process.exit(1);
  }
}

console.log(`\nDone. ${pushed} secret(s) pushed, ${skipped} skipped.`);
if (skipped > 0) {
  console.log(
    "Fill in the placeholder values in .prod.vars and re-run to push the remaining secrets.",
  );
}
