import path from "node:path";
import type { NextConfig } from "next";

// NEXT_OUTPUT=standalone        -> self-contained build for shared hosting (cPanel Node.js App). See docs/DEPLOY.md.
// NEXT_IMAGES_UNOPTIMIZED=1     -> serve images as-is (saves CPU/RAM on small hosting plans).
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  ...(standalone && {
    output: "standalone",
    // Monorepo: trace dependencies from the repository root.
    outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  }),
  images: {
    unoptimized: process.env.NEXT_IMAGES_UNOPTIMIZED === "1",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "cdn.brighton.co.id" }
    ]
  }
};

export default nextConfig;
