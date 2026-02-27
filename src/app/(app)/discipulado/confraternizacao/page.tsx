"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveConfraternizacao } from "@/hooks/useActiveConfraternizacao";
import { getAuthScope } from "@/lib/authScope";
import {
  CultoOrigemKey,
  cultoOrigemLabel,
  loadConfraternizacoes,
  normalizeCultoOrigem
} from "@/lib/confraternizacao";
import { downloadCsv } from "@/lib/csv";
import { formatDateBR } from "@/lib/date";
import { supabaseClient } from "@/lib/supabaseClient";

type OriginFilter = "TODAS" | CultoOrigemKey;

type ConfraternizacaoRow = {
  id: string;
  titulo: string;
  data_evento: string;
  status: "ativa" | "futura" | "encerrada";
};

type TurmaIngressoKey = "MANHA" | "TARDE";

type ConfirmedCaseRow = {
  case_id: string;
  member_id: string;
  nome: string;
  origemKey: CultoOrigemKey;
  origemLabel: string;
  confirmadoEm: string | null;
  compareceu: boolean;
  compareceuEm: string | null;
  turmaIngresso: TurmaIngressoKey | null;
};

const ORIGIN_FILTER_OPTIONS: Array<{ key: OriginFilter; label: string }> = [
  { key: "TODAS", label: "Todas" },
  { key: "MANHA", label: "Manhã" },
  { key: "NOITE", label: "Noite" },
  { key: "EVENTO", label: "Evento" },
  { key: "NAO_INFORMADO", label: "Não informado" }
];
const TURMA_INGRESSO_OPTIONS: Array<{ key: TurmaIngressoKey; label: string }> = [
  { key: "MANHA", label: "Turma da manhã" },
  { key: "TARDE", label: "Turma da tarde" }
];

function confraternizacaoStatusLabel(status: ConfraternizacaoRow["status"]) {
  if (status === "ativa") return "Ativa";
  if (status === "futura") return "Futura";
  return "Encerrada";
}

function statusBadgeClass(status: ConfraternizacaoRow["status"]) {
  if (status === "ativa") return "bg-emerald-100 text-emerald-800";
  if (status === "futura") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

function turmaIngressoLabel(value: TurmaIngressoKey | null) {
  if (value === "MANHA") return "Turma da manhã";
  if (value === "TARDE") return "Turma da tarde";
  return "Não definida";
}

function toFileDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMissingCompareceuColumnsError(message: string, code?: string) {
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("confraternizacao_compareceu") ||
    message.includes("confraternizacao_compareceu_em") ||
    message.includes("confraternizacao_turma")
  );
}

export default function DiscipuladoConfraternizacaoPage() {
  const { confraternizacao: activeConfraternizacao } = useActiveConfraternizacao();
  const [hasAccess, setHasAccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingConfraternizacoes, setLoadingConfraternizacoes] = useState(true);
  const [loadingConfirmed, setLoadingConfirmed] = useState(false);
  const [confraternizacoes, setConfraternizacoes] = useState<ConfraternizacaoRow[]>([]);
  const [selectedConfraternizacaoId, setSelectedConfraternizacaoId] = useState("");
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedCaseRow[]>([]);
  const [supportsTurmaSelection, setSupportsTurmaSelection] = useState(true);
  const [turmaDraftByCaseId, setTurmaDraftByCaseId] = useState<Record<string, TurmaIngressoKey | "">>({});
  const [originFilter, setOriginFilter] = useState<OriginFilter>("TODAS");
  const [search, setSearch] = useState("");
  const [updatingCompareceuCaseId, setUpdatingCompareceuCaseId] = useState<string | null>(null);
  const [savingTurmaCaseId, setSavingTurmaCaseId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const scope = await getAuthScope();
      if (!active) return;

      const allowed =
        scope.roles.includes("ADMIN_DISCIPULADO") ||
        scope.roles.includes("DISCIPULADOR") ||
        scope.roles.includes("SM_DISCIPULADO") ||
        scope.roles.includes("SECRETARIA_DISCIPULADO");

      setHasAccess(allowed);
      if (!allowed) {
        setLoadingConfraternizacoes(false);
        return;
      }

      const { data, errorMessage } = await loadConfraternizacoes();
      if (!active) return;
      if (errorMessage) {
        setStatusMessage(errorMessage);
        setLoadingConfraternizacoes(false);
        return;
      }

      const normalized = data.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        data_evento: item.data_evento,
        status: item.status
      }));

      setConfraternizacoes(normalized);
      setLoadingConfraternizacoes(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!confraternizacoes.length) return;
    if (selectedConfraternizacaoId) return;

    const activeId = activeConfraternizacao?.id;
    if (activeId && confraternizacoes.some((item) => item.id === activeId)) {
      setSelectedConfraternizacaoId(activeId);
      return;
    }

    const sorted = [...confraternizacoes].sort(
      (a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime()
    );
    const upcoming = sorted.find((item) => new Date(item.data_evento).getTime() >= Date.now());
    setSelectedConfraternizacaoId(upcoming?.id ?? sorted[0]?.id ?? "");
  }, [activeConfraternizacao?.id, confraternizacoes, selectedConfraternizacaoId]);

  useEffect(() => {
    let active = true;

    async function loadConfirmedRows() {
      if (!supabaseClient || !selectedConfraternizacaoId) {
        setConfirmedRows([]);
        setTurmaDraftByCaseId({});
        return;
      }

      setLoadingConfirmed(true);
      setStatusMessage("");

      const withCompareceu = await supabaseClient
        .from("discipleship_cases")
        .select(
          "id, member_id, confraternizacao_confirmada_em, confraternizacao_compareceu, confraternizacao_compareceu_em, confraternizacao_turma"
        )
        .eq("confraternizacao_id", selectedConfraternizacaoId)
        .eq("confraternizacao_confirmada", true)
        .order("confraternizacao_confirmada_em", { ascending: false });

      let hasTurmaColumn = true;
      let casesData: Array<{
        id: string;
        member_id: string;
        confraternizacao_confirmada_em: string | null;
        confraternizacao_compareceu?: boolean | null;
        confraternizacao_compareceu_em?: string | null;
        confraternizacao_turma?: string | null;
      }> | null = (withCompareceu.data ?? null) as Array<{
        id: string;
        member_id: string;
        confraternizacao_confirmada_em: string | null;
        confraternizacao_compareceu?: boolean | null;
        confraternizacao_compareceu_em?: string | null;
        confraternizacao_turma?: string | null;
      }> | null;
      let casesError = withCompareceu.error;

      if (!active) return;

      if (casesError && isMissingCompareceuColumnsError(casesError.message, casesError.code)) {
        hasTurmaColumn = false;
        const fallback = await supabaseClient
          .from("discipleship_cases")
          .select("id, member_id, confraternizacao_confirmada_em")
          .eq("confraternizacao_id", selectedConfraternizacaoId)
          .eq("confraternizacao_confirmada", true)
          .order("confraternizacao_confirmada_em", { ascending: false });
        casesData = (fallback.data ?? null) as Array<{
          id: string;
          member_id: string;
          confraternizacao_confirmada_em: string | null;
        }> | null;
        casesError = fallback.error;
      }

      if (casesError) {
        setStatusMessage(casesError.message);
        setConfirmedRows([]);
        setTurmaDraftByCaseId({});
        setLoadingConfirmed(false);
        return;
      }

      setSupportsTurmaSelection(hasTurmaColumn);

      const confirmedCases = (casesData ?? []) as Array<{
        id: string;
        member_id: string;
        confraternizacao_confirmada_em: string | null;
        confraternizacao_compareceu?: boolean | null;
        confraternizacao_compareceu_em?: string | null;
        confraternizacao_turma?: string | null;
      }>;

      if (!confirmedCases.length) {
        setConfirmedRows([]);
        setTurmaDraftByCaseId({});
        setLoadingConfirmed(false);
        return;
      }

      const memberIds = [...new Set(confirmedCases.map((item) => item.member_id))];
      const { data: peopleData, error: peopleError } = await supabaseClient
        .from("pessoas")
        .select("id, nome_completo, origem")
        .in("id", memberIds);

      if (!active) return;

      if (peopleError) {
        setStatusMessage(peopleError.message);
        setConfirmedRows([]);
        setLoadingConfirmed(false);
        return;
      }

      const peopleMap = new Map(
        (peopleData ?? []).map((person) => [
          String(person.id),
          {
            nome: String(person.nome_completo ?? "Membro"),
            origem: person.origem as string | null
          }
        ])
      );

      const rows = confirmedCases.map((item) => {
        const person = peopleMap.get(item.member_id);
        const origemKey = normalizeCultoOrigem(person?.origem);
        const turmaRaw = String(item.confraternizacao_turma ?? "")
          .trim()
          .toUpperCase();
        const turmaIngresso: TurmaIngressoKey | null =
          turmaRaw === "MANHA" || turmaRaw === "TARDE" ? (turmaRaw as TurmaIngressoKey) : null;

        return {
          case_id: item.id,
          member_id: item.member_id,
          nome: person?.nome ?? "Membro",
          origemKey,
          origemLabel: cultoOrigemLabel(origemKey),
          confirmadoEm: item.confraternizacao_confirmada_em,
          compareceu: Boolean(item.confraternizacao_compareceu),
          compareceuEm: item.confraternizacao_compareceu_em ?? null,
          turmaIngresso
        } satisfies ConfirmedCaseRow;
      });

      setConfirmedRows(rows);
      setTurmaDraftByCaseId(
        rows.reduce<Record<string, TurmaIngressoKey | "">>((acc, row) => {
          acc[row.case_id] = row.turmaIngresso ?? "";
          return acc;
        }, {})
      );
      setLoadingConfirmed(false);
    }

    void loadConfirmedRows();
    return () => {
      active = false;
    };
  }, [selectedConfraternizacaoId]);

  const selectedConfraternizacao = useMemo(
    () => confraternizacoes.find((item) => item.id === selectedConfraternizacaoId) ?? null,
    [confraternizacoes, selectedConfraternizacaoId]
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return confirmedRows.filter((item) => {
      const byOrigin = originFilter === "TODAS" || item.origemKey === originFilter;
      const bySearch = !term || item.nome.toLowerCase().includes(term);
      return byOrigin && bySearch;
    });
  }, [confirmedRows, originFilter, search]);

  const totalsByOrigin = useMemo(() => {
    return confirmedRows.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.origemKey === "MANHA") acc.manha += 1;
        if (item.origemKey === "NOITE") acc.noite += 1;
        if (item.origemKey === "EVENTO") acc.evento += 1;
        if (item.origemKey === "NAO_INFORMADO") acc.naoInformado += 1;
        return acc;
      },
      {
        total: 0,
        manha: 0,
        noite: 0,
        evento: 0,
        naoInformado: 0
      }
    );
  }, [confirmedRows]);

  const totalsByTurma = useMemo(() => {
    return confirmedRows.reduce(
      (acc, item) => {
        if (!item.compareceu) {
          acc.naoCompareceram += 1;
          return acc;
        }
        if (item.turmaIngresso === "MANHA") acc.manha += 1;
        else if (item.turmaIngresso === "TARDE") acc.tarde += 1;
        else acc.semTurma += 1;
        return acc;
      },
      {
        manha: 0,
        tarde: 0,
        semTurma: 0,
        naoCompareceram: 0
      }
    );
  }, [confirmedRows]);

  function handleExportCsv() {
    if (!selectedConfraternizacao || !filteredRows.length) {
      setStatusMessage("Não há confirmados para exportar com os filtros atuais.");
      return;
    }

    const fileDate = toFileDate(selectedConfraternizacao.data_evento);
    const filename = `confirmados_confraternizacao_${fileDate}.csv`;
    const confraLabel = `${selectedConfraternizacao.titulo} (${formatDateBR(selectedConfraternizacao.data_evento)})`;

    const rows = filteredRows.map((item) => [
      item.nome,
      item.origemLabel,
      confraLabel,
      item.compareceu ? "Sim" : "Não",
      turmaIngressoLabel(item.turmaIngresso)
    ]);
    downloadCsv(
      filename,
      ["Nome", "Origem de cadastro", "Confraternização", "Compareceu", "Turma de ingresso"],
      rows,
      { withBom: true }
    );
  }

  async function handleSaveTurma(item: ConfirmedCaseRow) {
    if (!supabaseClient || !supportsTurmaSelection || savingTurmaCaseId || updatingCompareceuCaseId) return;
    if (!item.compareceu) {
      setStatusMessage("Confirme o comparecimento antes de salvar a turma.");
      return;
    }

    const draft = turmaDraftByCaseId[item.case_id] ?? "";
    if (draft !== "MANHA" && draft !== "TARDE") {
      setStatusMessage("Selecione a turma da manhã ou da tarde para salvar.");
      return;
    }

    setSavingTurmaCaseId(item.case_id);
    setStatusMessage("");

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update({
        confraternizacao_turma: draft
      })
      .eq("id", item.case_id);

    if (error) {
      setStatusMessage(error.message);
      setSavingTurmaCaseId(null);
      return;
    }

    setConfirmedRows((prev) =>
      prev.map((row) =>
        row.case_id === item.case_id
          ? {
              ...row,
              turmaIngresso: draft
            }
          : row
      )
    );
    setSavingTurmaCaseId(null);
  }

  async function handleToggleCompareceu(item: ConfirmedCaseRow) {
    if (!supabaseClient || updatingCompareceuCaseId || savingTurmaCaseId) return;

    const nextValue = !item.compareceu;
    const nowIso = new Date().toISOString();
    const draftTurma = turmaDraftByCaseId[item.case_id] ?? "";

    if (nextValue && supportsTurmaSelection && draftTurma !== "MANHA" && draftTurma !== "TARDE") {
      setStatusMessage("Selecione a turma da manhã ou da tarde antes de confirmar comparecimento.");
      return;
    }

    setUpdatingCompareceuCaseId(item.case_id);
    setStatusMessage("");

    const payload: {
      confraternizacao_compareceu: boolean;
      confraternizacao_compareceu_em: string | null;
      confraternizacao_turma?: TurmaIngressoKey | null;
    } = {
      confraternizacao_compareceu: nextValue,
      confraternizacao_compareceu_em: nextValue ? nowIso : null
    };
    if (supportsTurmaSelection) {
      payload.confraternizacao_turma = nextValue ? (draftTurma as TurmaIngressoKey) : null;
    }

    const { error } = await supabaseClient
      .from("discipleship_cases")
      .update(payload)
      .eq("id", item.case_id);

    if (error) {
      setStatusMessage(error.message);
      setUpdatingCompareceuCaseId(null);
      return;
    }

    setConfirmedRows((prev) =>
      prev.map((row) =>
        row.case_id === item.case_id
          ? {
              ...row,
              compareceu: nextValue,
              compareceuEm: nextValue ? nowIso : null,
              turmaIngresso: nextValue ? (draftTurma as TurmaIngressoKey) : null
            }
          : row
      )
    );
    setUpdatingCompareceuCaseId(null);
  }

  if (!hasAccess) {
    return <div className="discipulado-panel p-6 text-sm text-slate-700">Acesso restrito aos perfis do Discipulado.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700">Discipulado</p>
          <h2 className="text-xl font-semibold text-sky-950">Confraternização</h2>
          <p className="mt-1 text-xs text-slate-600">Confirmados da confraternização ativa (ou futura mais próxima).</p>
        </div>

        <div className="-mx-1 w-full overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="flex min-w-max items-center gap-2">
            <select
              value={selectedConfraternizacaoId}
              onChange={(event) => setSelectedConfraternizacaoId(event.target.value)}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 focus:border-sky-400 focus:outline-none"
            >
              {!confraternizacoes.length ? <option value="">Sem confraternização</option> : null}
              {confraternizacoes.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateBR(item.data_evento)} • {item.titulo}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusMessage}</p>
      ) : null}
      {!supportsTurmaSelection ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Seleção de turma indisponível neste ambiente. Aplique a migration `0056_discipulado_confraternizacao_turma_ingresso.sql`.
        </p>
      ) : null}

      {loadingConfraternizacoes ? (
        <div className="discipulado-panel p-4 text-sm text-slate-600">Carregando confraternizações...</div>
      ) : null}

      {selectedConfraternizacao ? (
        <section className="discipulado-panel p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-sky-950">{selectedConfraternizacao.titulo}</p>
            <span className="text-xs text-slate-600">{formatDateBR(selectedConfraternizacao.data_evento)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(selectedConfraternizacao.status)}`}>
              {confraternizacaoStatusLabel(selectedConfraternizacao.status)}
            </span>
          </div>

          <div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                Total confirmados: {totalsByOrigin.total}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Manhã: {totalsByOrigin.manha}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                Noite: {totalsByOrigin.noite}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Evento: {totalsByOrigin.evento}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Não informado: {totalsByOrigin.naoInformado}
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                Turma manhã: {totalsByTurma.manha}
              </span>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                Turma tarde: {totalsByTurma.tarde}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Sem turma: {totalsByTurma.semTurma}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Não compareceram: {totalsByTurma.naoCompareceram}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(240px,1fr)_minmax(220px,auto)]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            />

            <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
              <div className="flex min-w-max items-center gap-2">
                {ORIGIN_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setOriginFilter(option.key)}
                    className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      originFilter === option.key
                        ? "border-sky-700 bg-sky-700 text-white"
                        : "border-sky-200 bg-white text-sky-900 hover:bg-sky-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {loadingConfirmed ? <div className="discipulado-panel p-4 text-sm text-slate-600">Carregando confirmados...</div> : null}

      {!loadingConfirmed && selectedConfraternizacao ? (
        <section className="space-y-3">
          <p className="text-xs text-slate-600">Exibindo {filteredRows.length} confirmado(s) com os filtros atuais.</p>

          <div className="space-y-2 md:hidden">
            {!filteredRows.length ? (
              <div className="discipulado-panel p-4 text-sm text-slate-600">Nenhum confirmado encontrado.</div>
            ) : null}
            {filteredRows.map((item) => (
              <article key={item.case_id} className="discipulado-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.origemLabel}</p>
                  </div>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-100 px-2 text-sm font-bold text-emerald-700">
                    ✓
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      item.compareceu ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.compareceu ? "Compareceu" : "Não confirmado no evento"}
                  </span>
                  <div className="flex flex-col items-end gap-2">
                    {supportsTurmaSelection ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={turmaDraftByCaseId[item.case_id] ?? ""}
                          onChange={(event) =>
                            setTurmaDraftByCaseId((prev) => ({
                              ...prev,
                              [item.case_id]: event.target.value as TurmaIngressoKey | ""
                            }))
                          }
                          className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
                        >
                          <option value="">Selecionar turma</option>
                          {TURMA_INGRESSO_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            !item.compareceu ||
                            savingTurmaCaseId === item.case_id ||
                            updatingCompareceuCaseId === item.case_id
                          }
                          onClick={() => {
                            void handleSaveTurma(item);
                          }}
                          className="min-h-11 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingTurmaCaseId === item.case_id ? "Salvando turma..." : "Salvar turma"}
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={updatingCompareceuCaseId === item.case_id || savingTurmaCaseId === item.case_id}
                      onClick={() => {
                        void handleToggleCompareceu(item);
                      }}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        item.compareceu
                          ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                          : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {updatingCompareceuCaseId === item.case_id
                        ? "Salvando..."
                        : item.compareceu
                          ? "Desfazer comparecimento"
                          : "Confirmar comparecimento"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Origem de cadastro</th>
                  <th className="px-3 py-2">Turma de ingresso</th>
                  <th className="px-3 py-2">Compareceu</th>
                </tr>
              </thead>
              <tbody>
                {!filteredRows.length ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={4}>
                      Nenhum confirmado encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item) => (
                    <tr key={item.case_id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{item.nome}</td>
                      <td className="px-3 py-2 text-slate-700">{item.origemLabel}</td>
                      <td className="px-3 py-2">
                        {supportsTurmaSelection ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={turmaDraftByCaseId[item.case_id] ?? ""}
                              onChange={(event) =>
                                setTurmaDraftByCaseId((prev) => ({
                                  ...prev,
                                  [item.case_id]: event.target.value as TurmaIngressoKey | ""
                                }))
                              }
                              className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
                            >
                              <option value="">Selecionar turma</option>
                              {TURMA_INGRESSO_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !item.compareceu ||
                                savingTurmaCaseId === item.case_id ||
                                updatingCompareceuCaseId === item.case_id
                              }
                              onClick={() => {
                                void handleSaveTurma(item);
                              }}
                              className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingTurmaCaseId === item.case_id ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">{turmaIngressoLabel(item.turmaIngresso)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              item.compareceu ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.compareceu ? "Compareceu" : "Pendente"}
                          </span>
                          <button
                            type="button"
                            disabled={updatingCompareceuCaseId === item.case_id || savingTurmaCaseId === item.case_id}
                            onClick={() => {
                              void handleToggleCompareceu(item);
                            }}
                            className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingCompareceuCaseId === item.case_id
                              ? "Salvando..."
                              : item.compareceu
                                ? "Desmarcar"
                                : "Confirmar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
