"use client";

import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function AcessoInternoPage() {
  return (
    <AuthSplitLayout
      label="Acesso interno"
      tagline="Acompanhe cadastros, relatórios e times em um só lugar."
    >
      <h1 className="text-3xl font-semibold text-text">Entre no painel</h1>
      <p className="mt-2 text-sm text-text-muted">
        Utilize seu e-mail institucional para acompanhar cadastros, relatórios e times.
      </p>
      <div className="mt-6">
        <LoginForm showRememberMe />
      </div>
    </AuthSplitLayout>
  );
}
