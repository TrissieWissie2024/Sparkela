import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { clockLife, serverNow } from "@/lib/clock";

/**
 * Cached clock for server components (docs/PLAN.md §10.3): ClockProvider in ShopChrome and the (kaal) layout, and
 * the serverIndex of every TimeSwitch. Reading the time inside 'use cache' keeps every page static (○); the entry
 * refreshes within clockLife(now), which shortens towards the next time boundary, and through the tag "klok"
 * (POST /api/revalidate with {"tags":["klok"]}).
 */
export async function getServerNow(): Promise<number> {
  "use cache";
  const now = serverNow();
  cacheTag("klok");
  cacheLife(clockLife(now));
  return now;
}
