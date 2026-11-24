import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.JLPT_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
