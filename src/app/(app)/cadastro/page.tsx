"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
import { getAuthScope } from "@/lib/authScope";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  CULTO_ORIGEM_CCM_FORM_OPTIONS,
  CultoOrigemCode,
  parseCultoOrigemCode
} from "@/lib/cultoOrigem";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

const fieldLabelClass = "text-text";
const fieldClass =
  "block min-w-0 w-full max-w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none sm:text-base";
const primaryButtonClass =
  "w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";
const feedbackClass = "rounded-xl px-4 py-3 text-sm";

export default function CadastroInternoPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataCadastro, setDataCadastro] = useState(currentLocalDateInputValue());
  const [cultoOrigem, setCultoOrigem] = useState<CultoOrigemCode | "">("");
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (!supabaseClient) {
        if (active) setCheckingAccess(false);
        return;
      }

      const scope = await getAuthScope();
      if (!active) return;

      const onlyCadastrador = scope.roles.length === 1 && scope.roles.includes("CADASTRADOR");
      if (!onlyCadastrador) {
        router.replace("/cadastros");
        return;
      }

      setCheckingAccess(false);
    }

    checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  if (checkingAccess) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="card p-4 text-sm text-text-muted">Validando perfil...</div>
      </div>
    );
  }

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

    const result = await createQuickCcmRegistration(supabaseClient, {
      fullName: nomeFinal,
      phoneWhatsapp: telefoneParsed.formatted,
      registeredOn: dataCadastro,
      cultoOrigem: cultoSelecionado,
      requestId: crypto.randomUUID()
    });

    if (result.errorMessage) {
      setStatus("error");
      setMessage(result.errorMessage);
      return;
    }

    if (result.duplicate) {
      setStatus("success");
      setMessage("Cadastro já recebido anteriormente. A duplicidade foi evitada.");
      return;
    }

    setStatus("success");
    setMessage("Cadastro rápido salvo com sucesso. Os dados complementares serão preenchidos depois.");
    setNome("");
    setTelefone("");
    setDataCadastro(currentLocalDateInputValue());
    setCultoOrigem("");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-text-muted">Gestão de Pessoas</p>
        <h2 className="text-xl font-semibold text-brand-900 md:text-2xl">Cadastro rápido no culto</h2>
        <p className="mt-1 text-sm text-text-muted">
          Fluxo resumido do perfil <strong>CADASTRADOR</strong>: registre só o essencial agora e deixe a complementação para depois.
        </p>
      </div>

      <div className="grid gap-3 sm:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">Operação</p>
            <p className="mt-1 text-sm font-semibold text-brand-950">4 campos</p>
          </div>
          <div className="rounded-2xl border border-warning-100 bg-warning-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning-600">Depois</p>
            <p className="mt-1 text-sm font-semibold text-warning-600">Completar cadastro</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        <form className="card min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-5 md:p-6" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-warning-100 bg-warning-100 px-4 py-3 text-sm text-warning-600">
            Formulário resumido exclusivo para o perfil <strong>CADASTRADOR</strong>: <strong>nome, contato, data e culto</strong>. Os demais dados serão completados depois.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
              <span className={fieldLabelClass}>Nome</span>
              <input
                required
                name="nome_completo"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className={fieldClass}
                placeholder="Digite o nome da pessoa"
                autoComplete="name"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className={fieldLabelClass}>Contato</span>
              <input
                required
                name="telefone_whatsapp"
                value={telefone}
                onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
                className={fieldClass}
                placeholder="(92) 99227-0057"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="min-w-0 space-y-1 text-sm">
              <span className={fieldLabelClass}>Data</span>
              <input
                required
                name="data"
                type="date"
                value={dataCadastro}
                onChange={(event) => setDataCadastro(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className={fieldLabelClass}>Culto</span>
              <select
                name="culto_origem"
                value={cultoOrigem}
                onChange={(event) => {
                  const rawValue = event.target.value;
                  setCultoOrigem(parseCultoOrigemCode(rawValue) ?? "");
                }}
                className={fieldClass}
                required
              >
                <option value="">Selecione o culto</option>
                {CULTO_ORIGEM_CCM_FORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              className={primaryButtonClass}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Salvando..." : "Salvar rápido"}
            </button>
            <p className="text-xs leading-5 text-text-muted">Ideal para uso no celular durante o culto, sem filas e sem demora.</p>
          </div>

          {status === "success" ? (
            <p className={`${feedbackClass} border border-brand-200 bg-brand-50 text-brand-700`}>
              {message}
            </p>
          ) : null}

          {status === "error" ? (
            <p className={`${feedbackClass} border border-danger-100 bg-danger-100 text-danger-600`}>
              {message || "Não foi possível salvar o cadastro rápido."}
            </p>
          ) : null}
        </form>

        <aside className="order-last card space-y-4 p-4 sm:p-5 lg:order-none">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Fluxo</p>
            <h3 className="mt-2 text-lg font-semibold text-brand-900">Depois do culto</h3>
          </div>

          <ul className="space-y-3 text-sm leading-6 text-text-muted">
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
