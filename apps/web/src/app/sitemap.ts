import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properti`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.3 }
  ];
}
