"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PublicCadastroPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/acesso-interno");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-emerald-700">Casados com a Madureira</p>
        <h1 className="text-2xl font-semibold text-emerald-900">Cadastro interno</h1>
        <p className="text-sm text-slate-600">Redirecionando para o acesso interno...</p>
      </div>
    </div>
  );
}
