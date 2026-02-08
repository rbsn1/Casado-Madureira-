import { ReactNode } from "react";

export default function DiscipuladoLayout({ children }: { children: ReactNode }) {
  return (
    <section className="discipulado-theme rounded-3xl border border-sky-100/80 bg-white p-5 shadow-sm md:p-6">
      {children}
    </section>
  );
}
