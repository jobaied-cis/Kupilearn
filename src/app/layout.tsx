import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Baloo_Da_2, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const anekBangla = Anek_Bangla({
  variable: "--font-anek-bangla",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const balooDa = Baloo_Da_2({
  variable: "--font-baloo-da",
  subsets: ["bengali", "latin"],
  weight: ["500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "কুপি — বুঝলে আলো জ্বলে।",
  description:
    "কুপি ষষ্ঠ থেকে দশম শ্রেণির শিক্ষার্থীদের সব বিষয়ের AI শিক্ষক — NCTB বইয়ের প্রতিটি অধ্যায়, মুখস্থ নয়, তোমার মতো করে বোঝানো, যতক্ষণ না বোঝা হয়।",
  icons: { icon: "/app-icon/kupi-favicon-256.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#16163a" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" data-scroll-behavior="smooth" className={`${anekBangla.variable} ${balooDa.variable} ${plexMono.variable}`}>
      <body className="relative min-h-dvh antialiased">{children}</body>
    </html>
  );
}
