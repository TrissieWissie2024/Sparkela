import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * /robots.txt (docs/PLAN.md §18.1, §2.4): everything may be crawled except the API routes, plus the sitemap. The
 * noindex pages (/zoeken, /checkout, /account, /nieuwsbrief/bevestigen) stay crawlable on purpose: a crawler only
 * sees their noindex when it may fetch them (D53.4). The proxy leaves this file alone, also during the prelaunch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
