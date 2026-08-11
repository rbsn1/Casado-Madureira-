import "@/app/globals.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Casados com a Madureira",
  description:
    "SaaS para gestão de integração, batismo e voluntariado da comunidade Casados com a Madureira.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#35638C"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface text-text">{children}</body>
    </html>
  );
}
