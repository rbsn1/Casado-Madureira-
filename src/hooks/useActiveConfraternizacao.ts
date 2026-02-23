"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfraternizacaoItem, loadActiveConfraternizacao } from "@/lib/confraternizacao";

export function useActiveConfraternizacao(targetCongregationId?: string | null) {
  const [confraternizacao, setConfraternizacao] = useState<ConfraternizacaoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, errorMessage: nextErrorMessage } = await loadActiveConfraternizacao(targetCongregationId);
    setConfraternizacao(data);
    setErrorMessage(nextErrorMessage);
    setLoading(false);
  }, [targetCongregationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    confraternizacao,
    loading,
    errorMessage,
    reload
  };
}
