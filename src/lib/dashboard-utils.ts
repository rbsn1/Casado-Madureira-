
import { formatDateBR } from "@/lib/date";

export function formatDate(value: Date) {
    return formatDateBR(value);
}

export function getPeriodRange(period: string, customStart?: string, customEnd?: string) {
    const now = new Date();
    if (period === "Personalizado" && customStart && customEnd) {
        return {
            start: new Date(customStart),
            end: new Date(customEnd)
        };
    }
    if (period === "Hoje") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return { start, end };
    }
    if (period === "Semana") {
        const end = now;
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return { start, end };
    }
    if (period === "Mês") {
        const end = now;
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        return { start, end };
    }
    return { start: null, end: null };
}

export function formatDelta(delta: number, pct: number | null) {
    if (pct === null) return `${delta >= 0 ? "+" : ""}${delta}`;
    return `${delta >= 0 ? "+" : ""}${delta} (${delta >= 0 ? "+" : ""}${pct}%)`;
}

export function isMissingRpcSignature(message: string | undefined, fnName: string) {
    if (!message) return false;
    return (
        message.includes(`Could not find the function public.${fnName}`) ||
        message.includes(`function public.${fnName}`)
    );
}
