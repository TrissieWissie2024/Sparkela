#!/usr/bin/env node
// Prints the early-access link of a drop for the Club mail (docs/PLAN.md §11.5, §16.9 point 13):
//
//   npm run early-access-link -- holiday-sparkle
//   npm run early-access-link -- --all
//
// Reads EARLY_ACCESS_SECRET (at least 32 characters) and NEXT_PUBLIC_SITE_URL from the environment, plus .env.local and
// .env like Next does. The token comes from lib/early-access.ts itself (Node 24 strips the TypeScript types), so the
// link always matches what proxy.ts accepts. Prints nothing secret besides the link; never commit its output.

import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// Node warns that the .ts files have no "type" in package.json; that is expected here and not actionable.
const printWarnings = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  for (const listener of printWarnings) listener(warning);
});

async function loadDotEnv() {
  try {
    const nextEnv = await import("@next/env");
    const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
    if (typeof loadEnvConfig === "function") loadEnvConfig(root, false, { info() {}, error: console.error });
  } catch {
    // Without @next/env only the shell environment counts.
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

await loadDotEnv();

const [{ drops }, { getEnv, readSecret, MIN_SECRET_LENGTH }, { earlyAccessLink }] = await Promise.all([
  import(new URL("../content/drops.ts", import.meta.url).href),
  import(new URL("../lib/env.ts", import.meta.url).href),
  import(new URL("../lib/early-access.ts", import.meta.url).href),
]);

const slugs = drops.map((drop) => drop.slug);
const args = process.argv.slice(2).filter((arg) => arg !== "--");

if (args.length === 0) {
  fail(`Usage: npm run early-access-link -- <slug> | --all\nDrops: ${slugs.join(", ")}`);
}

const wanted = args.includes("--all") ? slugs : args;
const unknown = wanted.filter((slug) => !slugs.includes(slug));
if (unknown.length > 0) fail(`Unknown drop: ${unknown.join(", ")}\nDrops: ${slugs.join(", ")}`);

const secret = readSecret("EARLY_ACCESS_SECRET");
if (secret === null) {
  fail(
    `EARLY_ACCESS_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
      "Create one with: openssl rand -base64 32 (and set the same value on Vercel).",
  );
}

const { siteUrl } = getEnv();
for (const slug of wanted) {
  const link = await earlyAccessLink(slug, secret, siteUrl);
  console.log(wanted.length > 1 ? `${slug}: ${link}` : link);
}
