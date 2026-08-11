"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatBrazilPhoneInput } from "@/lib/phone";
import { addFromGroup } from "@/lib/grupoQuickAdd";

type AdicionarDoGrupoModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function AdicionarDoGrupoModal({ open, onClose, onSaved }: AdicionarDoGrupoModalProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado.");
      return;
    }
    setStatus("loading");
    setMessage("");

    const result = await addFromGroup(supabaseClient, { phone, name });

    if (result.errorMessage) {
      setStatus("error");
      setMessage(result.errorMessage);
      return;
    }

    setStatus("idle");
    setPhone("");
    setName("");
    onSaved(
      result.duplicate
        ? "Esse telefone já estava cadastrado — nada duplicado."
        : "Contato adicionado. A mensagem de boas-vindas será enviada em instantes."
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-emerald-900">Adicionar do grupo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Só o telefone já é suficiente — o nome é opcional.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Telefone</span>
            <input
              required
              value={phone}
              onChange={(event) => setPhone(formatBrazilPhoneInput(event.target.value))}
              placeholder="(92) 99227-0057"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Nome (opcional)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Se você souber"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          {status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              {status === "loading" ? "Salvando..." : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-emerald-200"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
