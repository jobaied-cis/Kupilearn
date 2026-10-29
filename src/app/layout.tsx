import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Baloo_Da_2, IBM_Plex_Mono } from "next/font/google";
import { LanguageProvider } from "../lib/i18n";
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
  title: "Kupi — When you understand, the light turns on.",
  description:
    "Kupi is your AI teacher for every subject — every NCTB chapter explained your way, not memorised, until it truly clicks.",
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
    <html lang="en" data-scroll-behavior="smooth" className={`${anekBangla.variable} ${balooDa.variable} ${plexMono.variable}`}>
      <body className="relative min-h-dvh antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
