"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/adminApi";

export function LoginBackgroundSection() {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgStatus, setBgStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [bgMessage, setBgMessage] = useState("");

  async function loadBackground() {
    try {
      const data = await apiFetch("/api/settings?key=login_background_url");
      setBgUrl(data.value ?? null);
    } catch {
      setBgUrl(null);
    }
  }

  useEffect(() => {
    loadBackground();
  }, []);

  async function handleUploadBackground(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBgStatus("loading");
    setBgMessage("");
    const formData = new FormData(form);
    const file = formData.get("background");
    const hasFile = file && typeof file === "object" && "name" in file && "size" in file;
    if (!hasFile || (file as File).size === 0) {
      setBgStatus("error");
      setBgMessage("Selecione uma imagem.");
      return;
    }
    if (!(file as File).type.startsWith("image/")) {
      setBgStatus("error");
      setBgMessage("Envie um arquivo de imagem válido.");
      return;
    }
    try {
      if (!supabaseClient) throw new Error("Supabase não configurado.");
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sem sessão ativa.");
      const response = await fetch("/api/admin/login-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao enviar imagem.");
      setBgUrl(payload.url ?? null);
      setBgStatus("success");
      setBgMessage("Imagem atualizada com sucesso.");
      form.reset();
    } catch (error) {
      setBgStatus("error");
      setBgMessage((error as Error).message);
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={handleUploadBackground}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-900">Papel de parede do login</p>
          <p className="text-xs text-text-muted">Recomendado: imagem horizontal em alta resolução.</p>
        </div>
        {bgUrl ? (
          <a
            href={bgUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-brand-800 hover:text-brand-900"
          >
            Ver imagem atual
          </a>
        ) : null}
      </div>
      <input
        name="background"
        type="file"
        accept="image/*"
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <button
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        disabled={bgStatus === "loading"}
      >
        {bgStatus === "loading" ? "Enviando..." : "Atualizar imagem"}
      </button>
      {bgStatus === "error" ? (
        <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
          {bgMessage || "Não foi possível atualizar a imagem."}
        </p>
      ) : null}
      {bgStatus === "success" ? (
        <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
          {bgMessage}
        </p>
      ) : null}
    </form>
  );
}
