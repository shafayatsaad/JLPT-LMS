import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.JLPT_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    if (process.env.LOCAL_DEMO_SUPABASE_PROXY !== "true") return [];

    const upstream = process.env.SUPABASE_PROXY_TARGET?.trim() || "http://host.docker.internal:54321";
    const target = new URL(upstream);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("SUPABASE_PROXY_TARGET must use HTTP or HTTPS.");
    }

    return [{
      source: "/supabase/:path*",
      destination: `${target.origin}/:path*`,
    }];
  },
};

export default nextConfig;
