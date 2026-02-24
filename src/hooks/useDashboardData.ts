
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { getAuthScope } from "@/lib/authScope";
import {
    getPeriodRange,
    isMissingRpcSignature
} from "@/lib/dashboard-utils";
import {
    InsightEntry,
    GrowthEntry,
    MonthlyEntry,
    DiscipleshipCards,
    Congregation
} from "@/types/dashboard";

export function useDashboardData() {
    const router = useRouter();
    const currentYear = new Date().getFullYear();

    const [kpi, setKpi] = useState({
        totalCasados: 0,
        baseTotalCasados: 0,
        cultoManha: 0,
        cultoNoite: 0
    });

    const [origem, setOrigem] = useState<InsightEntry[]>([]);
    const [igrejas, setIgrejas] = useState<InsightEntry[]>([]);
    const [bairros, setBairros] = useState<InsightEntry[]>([]);
    const [crescimentoBairros, setCrescimentoBairros] = useState<GrowthEntry[]>([]);
    const [crescimentoIgrejas, setCrescimentoIgrejas] = useState<GrowthEntry[]>([]);
    const [statusMessage, setStatusMessage] = useState("");
    const [period, setPeriod] = useState("Mês");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
    const [anoSelecionado, setAnoSelecionado] = useState<number>(currentYear);
    const [mensal, setMensal] = useState<MonthlyEntry[]>([]);
    const [checkingRoles, setCheckingRoles] = useState(true);
    const [isCadastradorOnly, setIsCadastradorOnly] = useState(false);
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [isAdminMaster, setIsAdminMaster] = useState(false);
    const [congregationFilter, setCongregationFilter] = useState("");
    const [congregations, setCongregations] = useState<Congregation[]>([]);
    const [discipleshipCards, setDiscipleshipCards] = useState<DiscipleshipCards>({
        em_discipulado: 0,
        concluidos: 0,
        parados: 0,
        pendentes_criticos: 0,
        proximos_a_concluir: 0
    });

    useEffect(() => {
        let active = true;

        async function checkRoles() {
            if (!supabaseClient) {
                if (active) setCheckingRoles(false);
                return;
            }
            const scope = await getAuthScope();
            if (!active) return;

            const roles = scope.roles;
            const onlyCadastrador = roles.length === 1 && roles.includes("CADASTRADOR");
            const isGlobalAdmin = scope.isAdminMaster || roles.includes("SUPER_ADMIN") || roles.includes("ADMIN_MASTER");

            setIsCadastradorOnly(onlyCadastrador);
            setUserRoles(roles);
            setIsAdminMaster(isGlobalAdmin);

            if (isGlobalAdmin) {
                const { data } = await supabaseClient
                    .from("congregations")
                    .select("id, name")
                    .eq("is_active", true)
                    .order("name");
                if (!active) return;
                setCongregations((data ?? []) as Congregation[]);
            }

            setCheckingRoles(false);

            if (onlyCadastrador) {
                router.replace("/cadastro");
            }
        }

        checkRoles();

        return () => {
            active = false;
        };
    }, [router]);

    useEffect(() => {
        if (checkingRoles || isCadastradorOnly) return;

        async function loadDashboard() {
            if (!supabaseClient) {
                setStatusMessage("Supabase não configurado.");
                return;
            }

            const range = getPeriodRange(period, customStart, customEnd);
            const casadosParams = {
                start_ts: range.start ? range.start.toISOString() : null,
                end_ts: range.end ? range.end.toISOString() : null,
                year: anoSelecionado
            };

            const casadosWithCongregation = {
                ...casadosParams,
                target_congregation_id: isAdminMaster ? congregationFilter || null : null
            };

            const [casadosPrimary, discipleshipResult] = await Promise.all([
                supabaseClient.rpc("get_casados_dashboard", casadosWithCongregation),
                userRoles.includes("DISCIPULADOR")
                    ? supabaseClient.rpc("get_discipleship_dashboard", {
                        stale_days: 14,
                        target_congregation_id: null
                    })
                    : Promise.resolve({ data: null, error: null } as any)
            ]);

            const casadosResult =
                casadosPrimary.error && isMissingRpcSignature(casadosPrimary.error.message, "get_casados_dashboard")
                    ? await supabaseClient.rpc("get_casados_dashboard", casadosParams)
                    : casadosPrimary;

            const data = casadosResult.data;
            const error = casadosResult.error;

            if (error) {
                setStatusMessage(error.message);
                return;
            }

            // Preferimos o valor consolidado retornado pelo RPC (pessoas + histórico agregado mensal).
            let baseTotalCasados = 0;
            const hasBaseTotalFromRpc =
                data !== null &&
                typeof data === "object" &&
                Object.prototype.hasOwnProperty.call(data, "base_total");

            if (hasBaseTotalFromRpc) {
                baseTotalCasados = Number((data as any).base_total ?? 0);
            } else {
                // Compatibilidade com ambientes sem a migração de histórico mensal aplicada.
                let baseCountQuery = supabaseClient
                    .from("pessoas")
                    .select("id", { count: "exact", head: true })
                    .eq("cadastro_origem", "ccm");

                if (isAdminMaster && congregationFilter) {
                    baseCountQuery = baseCountQuery.eq("congregation_id", congregationFilter);
                }

                const baseCountResult = await baseCountQuery;
                if (!baseCountResult.error) {
                    baseTotalCasados = baseCountResult.count ?? 0;
                }
            }

            // Guarda de consistência visual: base total nunca deve ficar abaixo do total do período.
            baseTotalCasados = Math.max(baseTotalCasados, Number(data?.total ?? 0));

            const origemEntries = (data?.origem ?? []).map((item: any) => ({ label: item.label, count: item.count }));
            const manha = origemEntries.find((item: InsightEntry) => item.label === "Manhã")?.count ?? 0;
            const noite = origemEntries.find((item: InsightEntry) => item.label === "Noite")?.count ?? 0;

            setKpi({
                totalCasados: data?.total ?? 0,
                baseTotalCasados,
                cultoManha: manha,
                cultoNoite: noite
            });

            setOrigem(origemEntries);
            setIgrejas((data?.igrejas ?? []).map((item: any) => ({ label: item.label, count: item.count })));
            setBairros((data?.bairros ?? []).map((item: any) => ({ label: item.label, count: item.count })));
            setCrescimentoBairros((data?.crescimento_bairros ?? []) as GrowthEntry[]);
            setCrescimentoIgrejas((data?.crescimento_igrejas ?? []) as GrowthEntry[]);
            setAnosDisponiveis(data?.anos_disponiveis ?? []);

            // Se o ano selecionado nao existe nos dados, seleciona automaticamente o ano mais recente disponivel.
            const availableYears: number[] = Array.isArray(data?.anos_disponiveis) ? data.anos_disponiveis : [];
            if (availableYears.length && !availableYears.includes(anoSelecionado)) {
                setAnoSelecionado(availableYears[0]);
            }

            setMensal((data?.cadastros_mensais ?? []) as MonthlyEntry[]);

            if (!discipleshipResult?.error && discipleshipResult?.data?.cards) {
                setDiscipleshipCards(discipleshipResult.data.cards as DiscipleshipCards);
            }
        }

        loadDashboard();
    }, [
        period,
        customStart,
        customEnd,
        anoSelecionado,
        checkingRoles,
        isCadastradorOnly,
        congregationFilter,
        isAdminMaster,
        userRoles
    ]);

    return {
        kpi,
        origem,
        igrejas,
        bairros,
        crescimentoBairros,
        crescimentoIgrejas,
        statusMessage,
        period,
        setPeriod,
        customStart,
        setCustomStart,
        customEnd,
        setCustomEnd,
        anosDisponiveis,
        anoSelecionado,
        setAnoSelecionado,
        mensal,
        isAdminMaster,
        congregationFilter,
        setCongregationFilter,
        congregations,
        discipleshipCards,
        userRoles
    };
}
