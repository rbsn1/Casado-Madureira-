"use client";

import { useState } from "react";
import { createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  CULTO_ORIGEM_CCM_FORM_OPTIONS,
  CultoOrigemCode,
  cultoOrigemToLegacyOrigem,
  parseCultoOrigemCode
} from "@/lib/cultoOrigem";
import { formatBrazilPhoneInput, parseBrazilPhone } from "@/lib/phone";
import type { PessoaItem } from "@/lib/cadastrosApi";

const fieldLabelClass = "text-text";
const fieldClass =
  "block min-w-0 w-full max-w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-brand-400 focus:outline-none sm:text-base";
const primaryButtonClass =
  "w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto";
const secondaryButtonClass =
  "w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text-muted hover:border-brand-200 hover:text-brand-900 sm:w-auto";
const feedbackClass = "rounded-xl px-4 py-3 text-sm";

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export type CadastroFormResult = {
  tone: "error" | "success";
  message: string;
  shouldClose: boolean;
};

type CadastroFormProps = {
  editingPessoa: PessoaItem | null;
  hasCultoColumn: boolean;
  onCancel: () => void;
  onResult: (result: CadastroFormResult) => void;
};

export function CadastroForm({
  editingPessoa,
  hasCultoColumn,
  onCancel,
  onResult
}: CadastroFormProps) {
  const [nome, setNome] = useState(editingPessoa?.nome_completo ?? "");
  const [telefone, setTelefone] = useState(formatBrazilPhoneInput(editingPessoa?.telefone_whatsapp ?? ""));
  const [dataCadastro, setDataCadastro] = useState(editingPessoa?.data ?? currentLocalDateInputValue());
  const [cultoOrigem, setCultoOrigem] = useState<CultoOrigemCode | "">(
    parseCultoOrigemCode(editingPessoa?.culto_origem ?? editingPessoa?.origem) ?? ""
  );
  const [validationMessage, setValidationMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) return;

    const nomeFinal = nome.trim();
    if (nomeFinal.length < 3) {
      setValidationMessage("Informe o nome com pelo menos 3 caracteres.");
      return;
    }

    const telefoneParsed = parseBrazilPhone(telefone);
    if (!telefoneParsed) {
      setValidationMessage("Informe o contato com DDD. Ex: (92) 99227-0057.");
      return;
    }

    if (!dataCadastro) {
      setValidationMessage("A data do cadastro é obrigatória.");
      return;
    }

    const cultoSelecionado = parseCultoOrigemCode(cultoOrigem);
    if (!cultoSelecionado) {
      setValidationMessage("Selecione o culto.");
      return;
    }

    setValidationMessage("");

    let payload: Record<string, unknown> = {
      nome_completo: nomeFinal,
      telefone_whatsapp: telefoneParsed.formatted,
      origem: cultoOrigemToLegacyOrigem(cultoSelecionado),
      data: dataCadastro
    };

    if (hasCultoColumn) {
      payload.culto_origem = cultoSelecionado;
    }

    if (editingPessoa) {
      const { error } = await supabaseClient.from("pessoas").update(payload).eq("id", editingPessoa.id);
      if (error) {
        onResult({ tone: "error", message: error.message, shouldClose: false });
        return;
      }
      onResult({ tone: "success", message: "Cadastro atualizado com sucesso.", shouldClose: true });
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
      onResult({ tone: "error", message: result.errorMessage, shouldClose: false });
      return;
    }

    if (result.duplicate) {
      onResult({
        tone: "success",
        message: "Cadastro já recebido anteriormente. A duplicidade foi evitada.",
        shouldClose: true
      });
      return;
    }

    onResult({ tone: "success", message: "Cadastro salvo com sucesso.", shouldClose: true });
  }

  return (
    <form className="card grid gap-4 p-4 md:grid-cols-2" onSubmit={handleSubmit}>
      {!hasCultoColumn ? (
        <p className={`${feedbackClass} border border-warning-100 bg-warning-100 text-warning-600 md:col-span-2`}>
          A coluna `culto_origem` ainda não existe neste ambiente. Aplique a migração `0067_ccm_culto_rapido.sql`.
        </p>
      ) : null}
      {validationMessage ? (
        <p className={`${feedbackClass} border border-danger-100 bg-danger-100 text-danger-600 md:col-span-2`}>
          {validationMessage}
        </p>
      ) : null}

      <label className="space-y-1 text-sm md:col-span-2">
        <span className={fieldLabelClass}>Nome completo</span>
        <input
          required
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          className={fieldClass}
          placeholder="Digite o nome da pessoa"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className={fieldLabelClass}>Telefone</span>
        <input
          required
          value={telefone}
          onChange={(event) => setTelefone(formatBrazilPhoneInput(event.target.value))}
          className={fieldClass}
          placeholder="(92) 99227-0057"
        />
      </label>

      <label className="min-w-0 space-y-1 text-sm">
        <span className={fieldLabelClass}>Data</span>
        <input
          required
          type="date"
          value={dataCadastro}
          onChange={(event) => setDataCadastro(event.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="space-y-1 text-sm md:col-span-2">
        <span className={fieldLabelClass}>Culto de origem</span>
        <select
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

      <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button className={primaryButtonClass}>
          {editingPessoa ? "Salvar alterações" : "Salvar cadastro"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
