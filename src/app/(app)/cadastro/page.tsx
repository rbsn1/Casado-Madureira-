"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";

const origemOptions = ["Culto da Manhã", "Culto da Tarde", "Culto da Noite"];
const igrejaOptions = [
  "Sede",
  "Congregação Cidade Nova",
  "Congregação Japiim",
  "Congregação Alvorada",
  "Assembleia de Deus - Sede",
  "Igreja Batista da Lagoinha Manaus",
  "Igreja Batista do Amazonas",
  "Igreja Adventista Central de Manaus",
  "Igreja Universal - Alvorada",
  "Igreja Universal - Centro",
  "Igreja do Evangelho Quadrangular - Centro",
  "Igreja do Evangelho Quadrangular - Cidade Nova",
  "Igreja Presbiteriana de Manaus",
  "Igreja Metodista de Manaus",
  "Igreja Crista Maranata - Centro",
  "Igreja Crista Maranata - Cidade Nova",
  "Igreja de Deus no Brasil - Centro",
  "Igreja Batista do Parque Dez",
  "Igreja Batista de Adrianopolis",
  "Igreja Batista de Flores",
  "Igreja Batista de Compensa",
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

export default function CadastroInternoPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [origem, setOrigem] = useState("Culto da Manhã");
  const [igreja, setIgreja] = useState("Sede");
  const [igrejaOutra, setIgrejaOutra] = useState("");
  const [igrejaBusca, setIgrejaBusca] = useState("");
  const [bairro, setBairro] = useState("Adrianópolis");
  const [bairroOutro, setBairroOutro] = useState("");
  const [telefone, setTelefone] = useState("");

  const igrejaFilteredOptions = useMemo(() => {
    const term = igrejaBusca.trim().toLowerCase();
    if (!term) return igrejaOptions;
    return igrejaOptions.filter((option) => option.toLowerCase().includes(term));
  }, [igrejaBusca]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado. Verifique o arquivo .env.local.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const bairroInput = String(formData.get("bairro") ?? "");
    if (bairroInput && bairroInput.trim().length < 2) {
      setStatus("error");
      setMessage("O bairro precisa ter ao menos 2 caracteres.");
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
      origem,
      igreja_origem: igrejaOrigem || null,
      bairro: bairroFinal || null,
      data: formData.get("data") ? String(formData.get("data")) : null,
      observacoes: String(formData.get("observacoes") ?? ""),
      request_id: crypto.randomUUID()
    };

    const { error } = await supabaseClient.from("pessoas").insert(payload);

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

    form.reset();
    setStatus("success");
    setMessage("Cadastro enviado com sucesso. Aguarde o contato da equipe.");
    setOrigem("Culto da Manhã");
    setIgreja("Sede");
    setIgrejaOutra("");
    setIgrejaBusca("");
    setBairro("Adrianópolis");
    setBairroOutro("");
    setTelefone("");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Gestão de Pessoas</p>
        <h2 className="text-xl font-semibold text-emerald-900">Cadastro rápido</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre as pessoas na sala com agilidade e sem perder nenhum registro.
        </p>
      </div>

      <form className="card space-y-4 p-5" onSubmit={handleSubmit}>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Nome completo</span>
          <input
            required
            name="nome_completo"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            placeholder="Digite o nome"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Telefone (WhatsApp)</span>
          <input
            required
            name="telefone_whatsapp"
            value={telefone}
            onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            placeholder="(92) 99227-0057"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Origem</span>
          <select
            name="origem"
            value={origem}
            onChange={(event) => setOrigem(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {origemOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Igreja de origem / Congregação</span>
          <input
            value={igrejaBusca}
            onChange={(event) => setIgrejaBusca(event.target.value)}
            placeholder="Buscar igreja..."
            className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
          <select
            name="igreja_origem"
            value={igreja}
            onChange={(event) => setIgreja(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {igrejaFilteredOptions.map((option) => (
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
  );
}
