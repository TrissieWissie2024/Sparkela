import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // All metadata is static; bots get the static shell too (CORVANE D54.2). Remove if a route ever streams metadata.
  htmlLimitedBots: /[^\s\S]/,
  // Every <Image> (server components included) goes through this loader: Shopify's CDN scales, Vercel does not (plan §17.1).
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts" },
  experimental: {
    /*
     * Fewer, larger client chunks (wave 10-11, E1; CORVANE phase 8). The 7-9 build loads about 20 scripts on the home
     * page, most of them 10 to 50 KB; every extra request costs a round trip on a slow phone (Lighthouse mobile
     * simulates 150 ms). With these limits CORVANE, on the same stack, went from 13 to 15 scripts to 7 or 8 with the
     * same bytes. The islands that load later (cart drawer, mobile menu, popup, search) stay separate chunk groups.
     * Sizes are uncompressed, unminified bytes. Measure the script count and Lighthouse before and after; drop this
     * block if it does not help.
     */
    turbopackChunking: {
      minChunkSize: 200_000,
      maxChunkCountPerGroup: 6,
    },
  },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};

export default nextConfig;
