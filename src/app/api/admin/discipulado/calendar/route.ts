import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDiscipuladoAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

type CalendarRequestBody = {
  congregationId?: string;
  confraternizationAt?: string;
  recalculate?: boolean;
  recalculateOnly?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireDiscipuladoAdmin(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as CalendarRequestBody;
  const requestedCongregationId = String(body.congregationId ?? "").trim() || null;

  if (
    !auth.isGlobalAdmin &&
    requestedCongregationId &&
    requestedCongregationId !== auth.congregationId
  ) {
    return NextResponse.json(
      { error: "Você só pode gerenciar dados da sua congregação." },
      { status: 403 }
    );
  }

  const targetCongregationId = auth.isGlobalAdmin ? requestedCongregationId : auth.congregationId;
  if (!targetCongregationId) {
    return NextResponse.json(
      { error: "Selecione uma congregação para salvar a data da confraternização." },
      { status: 400 }
    );
  }

  const recalculate = body.recalculate !== false;
  const recalculateOnly = body.recalculateOnly === true;
  const supabaseAdmin = getSupabaseAdmin();

  if (!recalculateOnly) {
    const confraternizationAt = String(body.confraternizationAt ?? "").trim();
    if (!confraternizationAt) {
      return NextResponse.json(
        { error: "confraternizationAt é obrigatório para salvar a data da confra." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(confraternizationAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Data da confraternização inválida." }, { status: 400 });
    }

    const { error: upsertError } = await (supabaseAdmin as any).from("discipleship_calendar").upsert(
      {
        congregation_id: targetCongregationId,
        confraternization_at: parsedDate.toISOString()
      },
      { onConflict: "congregation_id" }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  let warning: string | null = null;
  if (recalculate) {
    const { error: refreshError } = await (supabaseAdmin as any).rpc("refresh_discipleship_case_criticality", {
      target_congregation_id: targetCongregationId,
      target_case_id: null
    });

    if (refreshError) {
      warning = `Data salva, mas não foi possível recalcular a criticidade: ${refreshError.message}`;
    }
  }

  return NextResponse.json({
    ok: true,
    congregationId: targetCongregationId,
    warning
  });
}
