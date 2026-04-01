#!/usr/bin/env node
// Resets the admin account password by wiping the existing user and re-running setup.
// Works both locally and against a deployed instance.
//
// Usage:
//   npm run reset:admin
//   npm run reset:admin -- --url https://your-deployed-worker.dev
//   npm run reset:admin -- --url https://... --secret <ADMIN_RESET_SECRET>
//
// The ADMIN_RESET_SECRET is read automatically from .dev.vars for local use.
// For deployed instances, pass it via --secret or the ADMIN_RESET_SECRET env var.

import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] ?? null : null;
};

const baseURL = flag("--url") ?? "http://localhost:8787";

// ---------------------------------------------------------------------------
// Resolve ADMIN_RESET_SECRET
// ---------------------------------------------------------------------------
let resetSecret = flag("--secret") ?? process.env.ADMIN_RESET_SECRET ?? null;

if (!resetSecret) {
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (existsSync(devVars)) {
    const contents = readFileSync(devVars, "utf8");
    const match = contents.match(/^ADMIN_RESET_SECRET=(.+)$/m);
    if (match) resetSecret = match[1].trim();
  }
}

if (!resetSecret) {
  console.error(
    "Could not find ADMIN_RESET_SECRET.\n" +
    "  • Run from the project root where .dev.vars exists, or\n" +
    "  • Pass --secret <value>, or\n" +
    "  • Set the ADMIN_RESET_SECRET environment variable."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

console.log(`\nAdmin account recovery — target: ${baseURL}`);
console.log("The existing admin account will be deleted and recreated.\n");

const name     = (await ask("New admin name:     ")).trim();
const email    = (await ask("New admin email:    ")).trim();
const password = (await ask("New admin password: ")).trim();
rl.close();

if (!name || !email || !password) {
  console.error("\nAll fields are required.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1 — wipe existing admin (cascades sessions + accounts)
// ---------------------------------------------------------------------------
console.log("\nWiping existing admin account…");
let wipeRes;
try {
  wipeRes = await fetch(`${baseURL}/api/viewer/admin/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: resetSecret }),
  });
} catch (err) {
  console.error(`Could not reach ${baseURL}: ${err.message}`);
  process.exit(1);
}

if (!wipeRes.ok) {
  const body = await wipeRes.json().catch(() => ({}));
  console.error(`Recovery request failed (${wipeRes.status}): ${body.error ?? "unknown error"}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2 — create new admin account via /setup
// ---------------------------------------------------------------------------
console.log("Creating new admin account…");
const setupRes = await fetch(`${baseURL}/api/admin/setup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, password }),
});

if (!setupRes.ok) {
  const body = await setupRes.json().catch(() => ({}));
  console.error(`Setup failed (${setupRes.status}): ${body.error ?? "unknown error"}`);
  process.exit(1);
}

const loginURL = baseURL.includes("localhost")
  ? baseURL.replace("8787", "5173") + "/admin/login"
  : baseURL + "/admin/login";

console.log(`\n✓ Admin account reset successfully!`);
console.log(`  Email:    ${email}`);
console.log(`  Sign in:  ${loginURL}`);
