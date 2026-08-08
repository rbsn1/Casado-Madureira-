import "@/app/globals.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata = {
  title: "Casados com a Madureira",
  description:
    "SaaS para gestão de integração, batismo e voluntariado da comunidade Casados com a Madureira."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface text-text">{children}</body>
    </html>
  );
}
