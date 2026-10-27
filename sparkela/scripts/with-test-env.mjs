#!/usr/bin/env node
// Runs a command with TEST_ENV from tests/test-env.mjs added to the environment (plan §19.3, decision 121).
//
//   node scripts/with-test-env.mjs next build
//   node scripts/with-test-env.mjs next start -p 3200
//
// TEST_ENV wins over the parent environment, so a stray COMMERCE_PROVIDER=shopify or a missing test clock can
// never leak into a test build. The exit code and termination signals are passed through, so Playwright can
// stop the server it started.

import { spawn } from "node:child_process";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_ENV } from "../tests/test-env.mjs";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-test-env.mjs <command> [...args]");
  process.exit(2);
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
// npm scripts already have node_modules/.bin on PATH; add it for direct calls too.
const binDir = join(projectRoot, "node_modules", ".bin");
const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
const currentPath = process.env[pathKey] ?? "";

const env = {
  ...process.env,
  [pathKey]: currentPath ? `${binDir}${delimiter}${currentPath}` : binDir,
  ...TEST_ENV,
};

const child = spawn(command, args, {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  // .cmd shims on Windows only resolve through a shell.
  shell: process.platform === "win32",
});

const forward = (signal) => {
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => forward(signal));
}

child.on("error", (error) => {
  console.error(`with-test-env: could not start "${command}": ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    // Re-raise the child's signal so callers see the same termination reason.
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
