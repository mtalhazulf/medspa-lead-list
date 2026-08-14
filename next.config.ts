import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    // Server Actions receive lead id arrays for bulk edits; keep the payload cap sane.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;

// Binds the Cloudflare env during `next dev` so local dev matches the Worker.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
