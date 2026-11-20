import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "EzyProperty — Temukan Properti Impianmu", template: "%s | EzyProperty" },
  description: "Temukan rumah, tanah, apartemen, dan properti terbaik bersama EzyProperty.",
  applicationName: "EzyProperty",
  openGraph: {
    type: "website",
    siteName: "EzyProperty",
    title: "EzyProperty — Temukan Properti Impianmu",
    description: "Marketplace properti Indonesia."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
