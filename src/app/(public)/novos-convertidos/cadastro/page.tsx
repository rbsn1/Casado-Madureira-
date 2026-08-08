"use client";

import { FormEvent, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

const igrejaOptions = [
  "Sede",
  "Congregação Cidade Nova",
  "Congregação Japiim",
  "Congregação Alvorada",
  "Outra"
];

const bairroOptions = [
  "Adrianópolis",
  "Aleixo",
  "Alvorada",
  "Centro",
  "Cidade Nova",
  "Compensa",
  "Dom Pedro",
  "Flores",
  "Japiim",
  "Jorge Teixeira",
  "Lago Azul",
  "Mauazinho",
  "Monte das Oliveiras",
  "Parque Dez",
  "Petrópolis",
  "Planalto",
  "Ponta Negra",
  "Praça 14",
  "Redenção",
  "Santa Etelvina",
  "São José",
  "Tancredo Neves",
  "Tarumã",
  "Zumbi",
  "Outro"
];

export default function NovoConvertidoCadastroPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [igreja, setIgreja] = useState(igrejaOptions[0]);
  const [telefone, setTelefone] = useState("");
  const [igrejaOutra, setIgrejaOutra] = useState("");
  const [bairro, setBairro] = useState(bairroOptions[0]);
  const [bairroOutro, setBairroOutro] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }

    if (igreja === "Outra" && !igrejaOutra.trim()) {
      setStatus("error");
      setMessage("Informe a igreja de origem.");
      return;
    }
    if (bairro === "Outro" && !bairroOutro.trim()) {
      setStatus("error");
      setMessage("Informe o bairro.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const telefoneRaw = String(formData.get("telefone_whatsapp") ?? "");
    const telefoneParsed = parseBrazilPhone(telefoneRaw);
    if (!telefoneParsed) {
      setStatus("error");
      setMessage("Informe o telefone com DDD. Ex: (92) 99227-0057.");
      return;
    }
    const igrejaOrigem = igreja === "Outra" ? igrejaOutra : igreja;
    const bairroFinal = bairro === "Outro" ? bairroOutro : bairro;

    const payload = {
      nome_completo: String(formData.get("nome_completo") ?? ""),
      telefone_whatsapp: telefoneParsed.formatted,
      origem: "Novos Convertidos",
      igreja_origem: igrejaOrigem || null,
      bairro: bairroFinal || null,
      data: formData.get("data") ? String(formData.get("data")) : null,
      observacoes: String(formData.get("observacoes") ?? ""),
      request_id: crypto.randomUUID()
    };

    let { error } = await supabaseClient.from("pessoas").insert(payload);
    // Ambientes legados podem não ter a coluna request_id ou o schema cache pode estar desatualizado.
    if (error && error.code === "PGRST204" && error.message.includes("request_id")) {
      const { request_id: _requestId, ...fallbackPayload } = payload;
      ({ error } = await supabaseClient.from("pessoas").insert(fallbackPayload));
    }

    if (error) {
      if (error.code === "23505") {
        setStatus("success");
        setMessage("Cadastro já recebido anteriormente. Evitamos duplicidade.");
        return;
      }
      setStatus("error");
      setMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    setIgreja(igrejaOptions[0]);
    setIgrejaOutra("");
    setBairro(bairroOptions[0]);
    setBairroOutro("");
    setTelefone("");
    setStatus("success");
    setMessage("Cadastro enviado com sucesso. Aguarde o contato da equipe.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-700">Casados com a Madureira</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-900">Cadastro de Novos Convertidos</h1>
          <p className="mt-2 text-sm text-text-muted">
            Preencha os dados para iniciar o acompanhamento da equipe.
          </p>
        </div>

        <form className="card space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="text-text">Nome completo</span>
            <input
              required
              name="nome_completo"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Digite seu nome"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Telefone (WhatsApp)</span>
            <input
              required
              name="telefone_whatsapp"
              value={telefone}
              onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="(92) 99227-0057"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Igreja de origem / Congregação</span>
            <select
              name="igreja_origem"
              value={igreja}
              onChange={(event) => setIgreja(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {igrejaOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {igreja === "Outra" ? (
            <label className="space-y-1 text-sm">
              <span className="text-text">Qual igreja?</span>
              <input
                name="igreja_origem_outra"
                value={igrejaOutra}
                onChange={(event) => setIgrejaOutra(event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                placeholder="Digite o nome da igreja"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-text">Bairro</span>
            <select
              name="bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {bairroOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {bairro === "Outro" ? (
            <label className="space-y-1 text-sm">
              <span className="text-text">Qual bairro?</span>
              <input
                name="bairro_outro"
                value={bairroOutro}
                onChange={(event) => setBairroOutro(event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                placeholder="Digite o bairro"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-text">Data</span>
            <input
              name="data"
              type="date"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text">Observações</span>
            <textarea
              name="observacoes"
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Compartilhe mais detalhes"
            />
          </label>
          <button
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Enviando..." : "Enviar cadastro"}
          </button>
          {status === "success" ? (
            <p className="rounded-lg border border-success-100 bg-success-100/60 px-3 py-2 text-xs text-success-600">
              {message}
            </p>
          ) : null}
          {status === "error" ? (
            <p className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-xs text-danger-600">
              {message || "Não foi possível enviar o cadastro. Tente novamente."}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
