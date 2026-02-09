"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalBackground } from "@/components/layout/PortalBackground";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatCpfInput, parseCpf } from "@/lib/cpf";

type LoadState = "loading" | "ready" | "invalid";
type SubmitState = "idle" | "saving" | "success" | "error";

type CompletionPayload = {
  member_id: string;
  nome_completo: string;
  telefone_whatsapp: string | null;
  igreja_origem: string | null;
  bairro: string | null;
  cadastro_completo_status: "pendente" | "link_enviado" | "concluido" | null;
  expires_at: string;
};

const cardClass =
  "w-full max-w-2xl rounded-2xl border border-black/5 bg-white/90 p-6 shadow-lg shadow-black/5 backdrop-blur";

export default function CadastroCompletoPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<CompletionPayload | null>(null);

  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCompletionPayload() {
      if (!active) return;
      if (!token) {
        setLoadState("invalid");
        setMessage("Link inválido. Solicite um novo link para a equipe.");
        return;
      }
      if (!supabaseClient) {
        setLoadState("invalid");
        setMessage("Supabase não configurado. Verifique as variáveis de ambiente.");
        return;
      }

      setLoadState("loading");
      setMessage("");

      const { data, error } = await supabaseClient.rpc("get_member_completion_payload", {
        token_text: token
      });

      if (!active) return;

      if (error || !data) {
        setLoadState("invalid");
        setMessage(error?.message ?? "Este link expirou ou já foi utilizado.");
        return;
      }

      const nextPayload = data as CompletionPayload;
      setPayload(nextPayload);
      setLoadState("ready");
    }

    loadCompletionPayload();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !token) return;

    const cpfParsed = parseCpf(cpf);
    if (!cpfParsed) {
      setSubmitState("error");
      setMessage("Informe um CPF válido.");
      return;
    }
    if (!rg.trim()) {
      setSubmitState("error");
      setMessage("Informe o RG.");
      return;
    }

    setSubmitState("saving");
    setMessage("");

    const { error } = await supabaseClient.rpc("complete_member_registration_by_token", {
      token_text: token,
      input_cpf: cpfParsed.digits,
      input_rg: rg.trim(),
      input_photo_url: fotoUrl.trim() || null,
      input_data_nascimento: dataNascimento || null,
      input_email: email.trim() || null,
      input_address: endereco.trim() || null,
      input_notes: observacoes.trim() || null
    });

    if (error) {
      setSubmitState("error");
      setMessage(error.message);
      return;
    }

    setSubmitState("success");
    setMessage("Cadastro completo enviado com sucesso. Obrigado!");
  }

  return (
    <PortalBackground heroImageSrc="/hero-community.jpg" heroHeight="420px">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16">
        <header className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600/90 text-xs font-semibold text-white">
              CCM
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Portal CCM</p>
              <p className="text-sm font-semibold text-emerald-900">Cadastro completo de membro</p>
            </div>
          </div>
          <Link href="/login" className="text-sm font-semibold text-emerald-800 transition hover:text-emerald-900">
            Voltar ao portal →
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className={cardClass}>
            {loadState === "loading" ? (
              <p className="text-sm text-slate-600">Validando link...</p>
            ) : null}

            {loadState === "invalid" ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {message || "Link inválido. Solicite um novo link."}
              </p>
            ) : null}

            {loadState === "ready" && payload ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Cadastro completo</p>
                <h1 className="mt-2 text-2xl font-semibold text-emerald-900">Finalize seus dados</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Confirme as informações abaixo e complete seu perfil de membro.
                </p>

                <div className="mt-4 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-800">Nome:</span> {payload.nome_completo}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Telefone:</span>{" "}
                    {payload.telefone_whatsapp ?? "Não informado"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Igreja:</span> {payload.igreja_origem ?? "Não informada"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Bairro:</span> {payload.bairro ?? "Não informado"}
                  </p>
                </div>

                <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">CPF *</span>
                    <input
                      required
                      name="cpf"
                      value={cpf}
                      onChange={(event) => setCpf(formatCpfInput(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="000.000.000-00"
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">RG *</span>
                    <input
                      required
                      name="rg"
                      value={rg}
                      onChange={(event) => setRg(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="Digite seu RG"
                    />
                  </label>

                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-slate-700">Foto (URL)</span>
                    <input
                      name="foto_url"
                      value={fotoUrl}
                      onChange={(event) => setFotoUrl(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">Data de nascimento</span>
                    <input
                      name="data_nascimento"
                      type="date"
                      value={dataNascimento}
                      onChange={(event) => setDataNascimento(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">E-mail</span>
                    <input
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="voce@email.com"
                    />
                  </label>

                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-slate-700">Endereço</span>
                    <input
                      name="endereco"
                      value={endereco}
                      onChange={(event) => setEndereco(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="Rua, número, complemento"
                    />
                  </label>

                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-slate-700">Observações adicionais</span>
                    <textarea
                      name="observacoes"
                      rows={3}
                      value={observacoes}
                      onChange={(event) => setObservacoes(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                      placeholder="Compartilhe informações relevantes para seu acompanhamento."
                    />
                  </label>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={submitState === "saving" || submitState === "success"}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitState === "saving" ? "Enviando..." : "Concluir cadastro completo"}
                    </button>
                  </div>
                </form>

                {message && submitState === "error" ? (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {message}
                  </p>
                ) : null}
                {message && submitState === "success" ? (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {message}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </PortalBackground>
  );
}
