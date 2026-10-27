import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // All metadata is static; bots get the static shell too (CORVANE D54.2). Remove if a route ever streams metadata.
  htmlLimitedBots: /[^\s\S]/,
  // Every <Image> (server components included) goes through this loader: Shopify's CDN scales, Vercel does not (plan §17.1).
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts" },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};

export default nextConfig;
