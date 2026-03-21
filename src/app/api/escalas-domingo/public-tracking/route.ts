import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deriveUserDisplayName,
  sortSundayScaleAssignments,
  SundayScaleAssignmentView,
  SundayScaleItem,
  SundayScalePresenceStatus
} from "@/lib/sundayServiceScale";

export const runtime = "nodejs";

type ScaleAssignmentRow = {
  id: string;
  escala_id: string;
  usuario_id: string;
  status_presenca: SundayScalePresenceStatus;
  respondido_em: string | null;
};

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: scalesData, error: scalesError } = await (supabaseAdmin as any)
      .from("escalas_domingo")
      .select("id, culto, data, horario, created_at")
      .order("data", { ascending: true })
      .order("horario", { ascending: true });

    if (scalesError) {
      return NextResponse.json({ error: scalesError.message }, { status: 500 });
    }

    const scales = (scalesData ?? []) as SundayScaleItem[];
    if (!scales.length) {
      return NextResponse.json({ assignments: [] });
    }

    const scaleById = new Map(scales.map((item) => [item.id, item]));
    const scaleIds = scales.map((item) => item.id);

    const { data: assignmentRows, error: assignmentsError } = await (supabaseAdmin as any)
      .from("escalas_domingo_usuarios")
      .select("id, escala_id, usuario_id, status_presenca, respondido_em")
      .in("escala_id", scaleIds);

    if (assignmentsError) {
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
    }

    const normalizedRows = (assignmentRows ?? []) as ScaleAssignmentRow[];
    if (!normalizedRows.length) {
      return NextResponse.json({ assignments: [] });
    }

    const uniqueUserIds = Array.from(new Set(normalizedRows.map((item) => item.usuario_id).filter(Boolean)));
    const userEntries = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const result = await supabaseAdmin.auth.admin.getUserById(userId);
        const email = result.data.user?.email ?? null;
        const metadata = (result.data.user?.user_metadata ?? null) as Record<string, unknown> | null;
        return [userId, deriveUserDisplayName(email, metadata)] as const;
      })
    );

    const userLookup = new Map(userEntries);
    const assignments = sortSundayScaleAssignments(
      normalizedRows
        .map<SundayScaleAssignmentView | null>((row) => {
          const scale = scaleById.get(row.escala_id);
          if (!scale) return null;

          return {
            id: row.id,
            scaleId: row.escala_id,
            userId: row.usuario_id,
            userName: userLookup.get(row.usuario_id) ?? ("Usuário " + row.usuario_id.slice(0, 8)),
            userEmail: null,
            culto: scale.culto,
            data: scale.data,
            horario: scale.horario,
            status: row.status_presenca,
            respondidoEm: row.respondido_em
          };
        })
        .filter((item): item is SundayScaleAssignmentView => Boolean(item))
    );

    return NextResponse.json({ assignments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao consultar escalas públicas." },
      { status: 500 }
    );
  }
}
