import "@/app/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Casados com a Madureira",
  description:
    "SaaS para gestão de integração, batismo e voluntariado da comunidade Casados com a Madureira."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
