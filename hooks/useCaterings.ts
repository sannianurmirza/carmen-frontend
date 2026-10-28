"use client";

import { useState, useEffect, useCallback } from "react";
import { Catering, getCatering } from "@/lib/api";
export type { Catering };

interface UseCateringsOptions {
  activeOnly?: boolean;
  autoFetch?: boolean;
}

export function useCaterings(options: UseCateringsOptions = {}) {
  const { activeOnly = false, autoFetch = true } = options;
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchCaterings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatering({ activeOnly });
      setCaterings(data);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data katering.");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (autoFetch) {
      fetchCaterings();
    }
  }, [autoFetch, fetchCaterings]);

  return {
    caterings,
    loading,
    error,
    refetch: fetchCaterings,
    setCaterings,
  };
}
