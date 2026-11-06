import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted container output (docker-compose `app` service).
  // Vercel ignores this; the same code deploys unchanged there (§29).
  output: "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
