"use client";

import { useState } from "react";
import { formatCpfInput, parseCpf } from "@/lib/cpf";
import { createFullCcmRegistration, createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
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
  isCadastradorOnly: boolean;
  canManageCadastrosDirectly: boolean;
  hasCultoColumn: boolean;
  hasCompletionStatusColumn: boolean;
  onCancel: () => void;
  onResult: (result: CadastroFormResult) => void;
};

export function CadastroForm({
  editingPessoa,
  isCadastradorOnly,
  canManageCadastrosDirectly,
  hasCultoColumn,
  hasCompletionStatusColumn,
  onCancel,
  onResult
}: CadastroFormProps) {
  const [nome, setNome] = useState(editingPessoa?.nome_completo ?? "");
  const [telefone, setTelefone] = useState(formatBrazilPhoneInput(editingPessoa?.telefone_whatsapp ?? ""));
  const [dataCadastro, setDataCadastro] = useState(editingPessoa?.data ?? currentLocalDateInputValue());
  const [cultoOrigem, setCultoOrigem] = useState<CultoOrigemCode | "">(
    parseCultoOrigemCode(editingPessoa?.culto_origem ?? editingPessoa?.origem) ?? ""
  );
  const [igrejaOrigem, setIgrejaOrigem] = useState("");
  const [bairro, setBairro] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");
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

    if (!editingPessoa && hasCompletionStatusColumn) {
      payload.cadastro_completo_status = "pendente";
    }

    if (editingPessoa) {
      const { error } = await supabaseClient.from("pessoas").update(payload).eq("id", editingPessoa.id);
      if (error) {
        onResult({ tone: "error", message: error.message, shouldClose: false });
        return;
      }
      onResult({ tone: "success", message: "Cadastro rápido atualizado com sucesso.", shouldClose: true });
      return;
    }

    if (isCadastradorOnly) {
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

      onResult({
        tone: "success",
        message: "Cadastro rápido salvo. Os dados complementares ficam pendentes para depois.",
        shouldClose: true
      });
      return;
    }

    const cpfParsed = parseCpf(cpf);
    if (!cpfParsed) {
      setValidationMessage("Informe um CPF válido para o cadastro completo.");
      return;
    }

    if (!rg.trim()) {
      setValidationMessage("Informe o RG para o cadastro completo.");
      return;
    }

    const result = await createFullCcmRegistration(supabaseClient, {
      fullName: nomeFinal,
      phoneWhatsapp: telefoneParsed.formatted,
      registeredOn: dataCadastro,
      cultoOrigem: cultoSelecionado,
      cpfDigits: cpfParsed.digits,
      rg,
      originChurch: igrejaOrigem,
      neighborhood: bairro,
      photoUrl: fotoUrl,
      birthDate: dataNascimento,
      email,
      address: endereco,
      notes: observacoes,
      requestId: crypto.randomUUID(),
      allowDirectInsertFallback: canManageCadastrosDirectly
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

    onResult({ tone: "success", message: "Cadastro completo salvo com sucesso.", shouldClose: true });
  }

  return (
    <form className="card grid gap-4 p-4 md:grid-cols-2" onSubmit={handleSubmit}>
      {!hasCultoColumn ? (
        <p className={`${feedbackClass} border border-warning-100 bg-warning-100 text-warning-600 md:col-span-2`}>
          A coluna `culto_origem` ainda não existe neste ambiente. Aplique a migração `0067_ccm_culto_rapido.sql`.
        </p>
      ) : null}
      {!hasCompletionStatusColumn ? (
        <p className={`${feedbackClass} border border-warning-100 bg-warning-100 text-warning-600 md:col-span-2`}>
          O status de complementação ainda não existe neste ambiente. Aplique a migração `0020_member_profile_completion.sql`.
        </p>
      ) : null}
      {validationMessage ? (
        <p className={`${feedbackClass} border border-danger-100 bg-danger-100 text-danger-600 md:col-span-2`}>
          {validationMessage}
        </p>
      ) : null}

      <label className="space-y-1 text-sm md:col-span-2">
        <span className={fieldLabelClass}>Nome</span>
        <input
          required
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          className={fieldClass}
          placeholder="Digite o nome da pessoa"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className={fieldLabelClass}>Contato</span>
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
        <span className={fieldLabelClass}>Culto</span>
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

      {isCadastradorOnly ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted md:col-span-2">
          Este cadastro resumido é o fluxo do perfil <strong>CADASTRADOR</strong>. Os demais dados serão
          preenchidos posteriormente pela equipe ou pelo link de complementação.
        </div>
      ) : !editingPessoa ? (
        <>
          <div className="rounded-xl border border-info-100 bg-info-100 px-4 py-3 text-sm text-info-600 md:col-span-2">
            Este é o <strong>formulário completo</strong> para perfis administrativos. Cadastros criados aqui já
            entram com os dados complementares preenchidos.
          </div>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>CPF</span>
            <input
              required
              value={cpf}
              onChange={(event) => setCpf(formatCpfInput(event.target.value))}
              className={fieldClass}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>RG</span>
            <input
              required
              value={rg}
              onChange={(event) => setRg(event.target.value)}
              className={fieldClass}
              placeholder="Digite o RG"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>Igreja de origem</span>
            <input
              value={igrejaOrigem}
              onChange={(event) => setIgrejaOrigem(event.target.value)}
              className={fieldClass}
              placeholder="Opcional"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>Bairro</span>
            <input
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
              className={fieldClass}
              placeholder="Opcional"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>Data de nascimento</span>
            <input
              type="date"
              value={dataNascimento}
              onChange={(event) => setDataNascimento(event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className={fieldLabelClass}>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
              placeholder="voce@email.com"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={fieldLabelClass}>Endereço</span>
            <input
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
              className={fieldClass}
              placeholder="Rua, número, complemento"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={fieldLabelClass}>Foto (URL)</span>
            <input
              value={fotoUrl}
              onChange={(event) => setFotoUrl(event.target.value)}
              className={fieldClass}
              placeholder="https://..."
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className={fieldLabelClass}>Observações</span>
            <textarea
              rows={4}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              className={fieldClass}
              placeholder="Informações relevantes para o cadastro."
            />
          </label>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted md:col-span-2">
          A edição continua focada nos dados iniciais do cadastro. A complementação segue pelo fluxo de cadastro
          completo.
        </div>
      )}

      <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button className={primaryButtonClass}>
          {editingPessoa
            ? "Salvar alterações"
            : isCadastradorOnly
              ? "Salvar rápido"
              : "Salvar cadastro completo"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
