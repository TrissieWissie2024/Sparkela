import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads a saved Storefront response from tests/fixtures/shopify/ (docs/PLAN.md §16.8): the whole HTTP body, so a
 * test can hand it to a mocked fetch as it is or read its `data`. A fresh copy on every call, so a test may change it.
 */

const DIR = join(process.cwd(), "tests/fixtures/shopify");

/** The whole JSON body of `<name>.json`. */
export function shopifyFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as T;
}

/** The `data` object of `<name>.json`. */
export function shopifyData<T>(name: string): T {
  return shopifyFixture<{ data: T }>(name).data;
}

/** The raw text of `<name>.json` (webhook bodies are signed byte for byte). */
export function shopifyFixtureText(name: string): string {
  return readFileSync(join(DIR, `${name}.json`), "utf8");
}

/** A JSON Response, as fetch would return it. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
