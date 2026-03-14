"use client";

import { FormEvent, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  CULTO_ORIGEM_OPTIONS,
  CultoOrigemCode,
  cultoOrigemToLegacyOrigem,
  parseCultoOrigemCode
} from "@/lib/cultoOrigem";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function isMissingColumnError(message: string, code: string | undefined, column: string) {
  return code === "PGRST204" && message.includes(column);
}

export default function CadastroInternoPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataCadastro, setDataCadastro] = useState(currentLocalDateInputValue());
  const [cultoOrigem, setCultoOrigem] = useState<CultoOrigemCode>("DOMINGO_MANHA");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }

    const nomeFinal = nome.trim();
    if (nomeFinal.length < 3) {
      setStatus("error");
      setMessage("Informe o nome com pelo menos 3 caracteres.");
      return;
    }

    const telefoneParsed = parseBrazilPhone(telefone);
    if (!telefoneParsed) {
      setStatus("error");
      setMessage("Informe o contato com DDD. Ex: (92) 99227-0057.");
      return;
    }

    if (!dataCadastro) {
      setStatus("error");
      setMessage("A data do cadastro é obrigatória.");
      return;
    }

    const cultoSelecionado = parseCultoOrigemCode(cultoOrigem);
    if (!cultoSelecionado) {
      setStatus("error");
      setMessage("Selecione o culto.");
      return;
    }

    let insertPayload: Record<string, unknown> = {
      nome_completo: nomeFinal,
      telefone_whatsapp: telefoneParsed.formatted,
      data: dataCadastro,
      origem: cultoOrigemToLegacyOrigem(cultoSelecionado),
      culto_origem: cultoSelecionado,
      cadastro_completo_status: "pendente",
      request_id: crypto.randomUUID()
    };

    let { error } = await supabaseClient.from("pessoas").insert(insertPayload);

    if (error && isMissingColumnError(error.message, error.code, "request_id")) {
      const { request_id: _requestId, ...fallbackPayload } = insertPayload;
      insertPayload = fallbackPayload;
      ({ error } = await supabaseClient.from("pessoas").insert(insertPayload));
    }

    if (error && isMissingColumnError(error.message, error.code, "culto_origem")) {
      const { culto_origem: _cultoOrigem, ...fallbackPayload } = insertPayload;
      insertPayload = fallbackPayload;
      ({ error } = await supabaseClient.from("pessoas").insert(insertPayload));
    }

    if (error) {
      if (isMissingColumnError(error.message, error.code, "cadastro_completo_status")) {
        setStatus("error");
        setMessage("Aplique a migração 0020_member_profile_completion.sql para marcar o cadastro como pendente.");
        return;
      }
      if (error.code === "23505") {
        setStatus("success");
        setMessage("Cadastro já recebido anteriormente. A duplicidade foi evitada.");
        return;
      }
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Cadastro rápido salvo com sucesso. Os dados complementares serão preenchidos depois.");
    setNome("");
    setTelefone("");
    setDataCadastro(currentLocalDateInputValue());
    setCultoOrigem("DOMINGO_MANHA");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-slate-500">Gestão de Pessoas</p>
        <h2 className="text-xl font-semibold text-emerald-900 md:text-2xl">Cadastro rápido no culto</h2>
        <p className="mt-1 text-sm text-slate-600">
          Fluxo resumido do perfil <strong>CADASTRADOR</strong>: registre só o essencial agora e deixe a complementação para depois.
        </p>
      </div>

      <div className="grid gap-3 sm:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Operação</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">4 campos</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Depois</p>
            <p className="mt-1 text-sm font-semibold text-amber-950">Completar cadastro</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        <form className="card min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-5 md:p-6" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Formulário resumido exclusivo para o perfil <strong>CADASTRADOR</strong>: <strong>nome, contato, data e culto</strong>. Os demais dados serão completados depois.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-700">Nome</span>
              <input
                required
                name="nome_completo"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
                placeholder="Digite o nome da pessoa"
                autoComplete="name"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Contato</span>
              <input
                required
                name="telefone_whatsapp"
                value={telefone}
                onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
                placeholder="(92) 99227-0057"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Data</span>
              <input
                required
                name="data"
                type="date"
                value={dataCadastro}
                onChange={(event) => setDataCadastro(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-700">Culto</span>
              <select
                name="culto_origem"
                value={cultoOrigem}
                onChange={(event) => {
                  const parsed = parseCultoOrigemCode(event.target.value);
                  if (parsed) setCultoOrigem(parsed);
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
              >
                {CULTO_ORIGEM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Salvando..." : "Salvar rápido"}
            </button>
            <p className="text-xs leading-5 text-slate-500">Ideal para uso no celular durante o culto, sem filas e sem demora.</p>
          </div>

          {status === "success" ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          {status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message || "Não foi possível salvar o cadastro rápido."}
            </p>
          ) : null}
        </form>

        <aside className="order-last card space-y-4 p-4 sm:p-5 lg:order-none">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Fluxo</p>
            <h3 className="mt-2 text-lg font-semibold text-emerald-900">Depois do culto</h3>
          </div>

          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Este formato reduzido é o fluxo operacional do perfil <strong>CADASTRADOR</strong>.</li>
            <li>O registro entra como <strong>pendente de complementação</strong>.</li>
            <li>A equipe pode enviar o link de cadastro completo depois.</li>
            <li>A listagem do CCM passa a mostrar o status desse complemento.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
