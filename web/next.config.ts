import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin dev-resource fetches by default; allow both
  // localhost spellings so HMR works whichever the browser uses.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
