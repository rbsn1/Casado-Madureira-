"use client";

import { UsersSection } from "@/components/admin/UsersSection";
import { LoginBackgroundSection } from "@/components/admin/LoginBackgroundSection";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted">Administração</p>
        <h2 className="text-xl font-semibold text-brand-900">Usuários e Permissões</h2>
      </div>

      <UsersSection />
      <LoginBackgroundSection />
    </div>
  );
}
