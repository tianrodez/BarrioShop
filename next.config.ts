import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted container output (docker-compose `app` service).
  // Vercel ignores this; the same code deploys unchanged there (§29).
  output: "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Development only. Next 16 blocks every dev resource (client chunks
  // included) requested from an origin it does not know, so opening the app
  // at 127.0.0.1 served HTML with no hydration: the search never filtered and
  // the forms submitted as plain GET. Production builds ignore this list.
  allowedDevOrigins: ["127.0.0.1"],
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
