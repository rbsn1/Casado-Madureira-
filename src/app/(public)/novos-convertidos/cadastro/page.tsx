"use client";

import { FormEvent, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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
    const igrejaOrigem = igreja === "Outra" ? igrejaOutra : igreja;
    const bairroFinal = bairro === "Outro" ? bairroOutro : bairro;

    const payload = {
      nome_completo: String(formData.get("nome_completo") ?? ""),
      telefone_whatsapp: String(formData.get("telefone_whatsapp") ?? ""),
      origem: "Novos Convertidos",
      igreja_origem: igrejaOrigem || null,
      bairro: bairroFinal || null,
      data: formData.get("data") ? String(formData.get("data")) : null,
      observacoes: String(formData.get("observacoes") ?? "")
    };

    const { error } = await supabaseClient.from("pessoas").insert(payload);

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    setIgreja(igrejaOptions[0]);
    setIgrejaOutra("");
    setBairro(bairroOptions[0]);
    setBairroOutro("");
    setStatus("success");
    setMessage("Cadastro enviado com sucesso. Aguarde o contato da equipe.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-700">Casados com a Madureira</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-900">Cadastro de Novos Convertidos</h1>
          <p className="mt-2 text-sm text-slate-600">
            Preencha os dados para iniciar o acompanhamento da equipe.
          </p>
        </div>

        <form className="card space-y-4 p-5" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nome completo</span>
            <input
              required
              name="nome_completo"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="Digite seu nome"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Telefone (WhatsApp)</span>
            <input
              required
              name="telefone_whatsapp"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="(92) 9xxxx-xxxx"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Igreja de origem / Congregação</span>
            <select
              name="igreja_origem"
              value={igreja}
              onChange={(event) => setIgreja(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
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
              <span className="text-slate-700">Qual igreja?</span>
              <input
                name="igreja_origem_outra"
                value={igrejaOutra}
                onChange={(event) => setIgrejaOutra(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Digite o nome da igreja"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Bairro</span>
            <select
              name="bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
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
              <span className="text-slate-700">Qual bairro?</span>
              <input
                name="bairro_outro"
                value={bairroOutro}
                onChange={(event) => setBairroOutro(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Digite o bairro"
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Data</span>
            <input
              name="data"
              type="date"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Observações</span>
            <textarea
              name="observacoes"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="Compartilhe mais detalhes"
            />
          </label>
          <button
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Enviando..." : "Enviar cadastro"}
          </button>
          {status === "success" ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {message}
            </p>
          ) : null}
          {status === "error" ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {message || "Não foi possível enviar o cadastro. Tente novamente."}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
