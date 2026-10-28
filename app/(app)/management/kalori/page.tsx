"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Utensils,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Search,
  Scale,
  Package,
} from "lucide-react";
import {
  getManagementKaloriApi,
  getManagementKaloriDailyApi,
  ManagementKaloriResponse,
  ManagementKaloriDailyResponse,
} from "@/lib/api";

const BULAN_NAMES = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Helper: Format date into Indonesia representation (e.g., "15 Oktober 2026")
function formatDateIndo(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const bln = BULAN_NAMES[m] || `Bulan ${m}`;
  return `${d} ${bln} ${y}`;
}

export default function ManagementKaloriPage() {
  // View mode: "PERIOD" (Ringkasan Periode) vs "DAILY" (Kalori Harian)
  const [activeTab, setActiveTab] = useState<"PERIOD" | "DAILY">("PERIOD");

  // === PERIOD TAB STATE ===
  const [periodData, setPeriodData] = useState<ManagementKaloriResponse | null>(null);
  const [periodLoading, setPeriodLoading] = useState<boolean>(true);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Period Draft filters
  const [draftBulan, setDraftBulan] = useState<number>(() => new Date().getMonth() + 1);
  const [draftTahun, setDraftTahun] = useState<number>(() => new Date().getFullYear());
  const [draftPeriodShift, setDraftPeriodShift] = useState<string>("ALL");
  const [draftPeriodCatering, setDraftPeriodCatering] = useState<string>("ALL");

  // Period Applied filters
  const [appliedBulan, setAppliedBulan] = useState<number>(() => new Date().getMonth() + 1);
  const [appliedTahun, setAppliedTahun] = useState<number>(() => new Date().getFullYear());
  const [appliedPeriodShift, setAppliedPeriodShift] = useState<string>("ALL");
  const [appliedPeriodCatering, setAppliedPeriodCatering] = useState<string>("ALL");

  // === DAILY TAB STATE ===
  const [dailyData, setDailyData] = useState<ManagementKaloriDailyResponse | null>(null);
  const [dailyLoading, setDailyLoading] = useState<boolean>(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Today in Asia/Jakarta date string YYYY-MM-DD
  const todayWib = useMemo(() => {
    const now = new Date();
    // Offset for WIB (UTC+7)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 3600000 * 7);
    const y = wib.getFullYear();
    const m = String(wib.getMonth() + 1).padStart(2, "0");
    const d = String(wib.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Daily Draft filters
  const [draftDailyDate, setDraftDailyDate] = useState<string>("2026-10-15"); // Default sample with proven data or fallback todayWib
  const [draftDailyCatering, setDraftDailyCatering] = useState<string>("ALL");
  const [draftDailyShift, setDraftDailyShift] = useState<string>("ALL");

  // Daily Applied filters
  const [appliedDailyDate, setAppliedDailyDate] = useState<string>("2026-10-15");
  const [appliedDailyCatering, setAppliedDailyCatering] = useState<string>("ALL");
  const [appliedDailyShift, setAppliedDailyShift] = useState<string>("ALL");

  // Expanded row ID set for viewing ingredient details in Daily view
  const [expandedDailyRows, setExpandedDailyRows] = useState<Set<number>>(new Set());

  const toggleRowExpanded = (id: number) => {
    setExpandedDailyRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Data Fetchers ---
  const fetchPeriodData = async (bulan?: number, tahun?: number, shift?: string, cateringId?: number) => {
    setPeriodLoading(true);
    setPeriodError(null);
    try {
      const res = await getManagementKaloriApi({
        bulan: bulan || draftBulan,
        tahun: tahun || draftTahun,
        shift: shift !== "ALL" ? shift : undefined,
        catering_id: cateringId !== undefined && cateringId > 0 ? cateringId : undefined,
      });
      setPeriodData(res);
      if (res.periode) {
        setDraftBulan(res.periode.bulan);
        setDraftTahun(res.periode.tahun);
        setAppliedBulan(res.periode.bulan);
        setAppliedTahun(res.periode.tahun);
      }
    } catch (err: any) {
      setPeriodError(err?.message || "Gagal memuat data analitik kalori.");
    } finally {
      setPeriodLoading(false);
    }
  };

  const fetchDailyData = async (tanggal: string, shift?: string, cateringId?: number) => {
    setDailyLoading(true);
    setDailyError(null);
    try {
      const res = await getManagementKaloriDailyApi({
        tanggal,
        shift: shift !== "ALL" ? shift : undefined,
        catering_id: cateringId !== undefined && cateringId > 0 ? cateringId : undefined,
      });
      setDailyData(res);
    } catch (err: any) {
      setDailyError(err?.message || "Gagal memuat data kalori harian.");
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodData();
  }, []);

  // When switching to Daily tab for first time, fetch data if not loaded
  useEffect(() => {
    if (activeTab === "DAILY" && !dailyData && !dailyLoading) {
      fetchDailyData(draftDailyDate, draftDailyShift, draftDailyCatering !== "ALL" ? parseInt(draftDailyCatering, 10) : undefined);
    }
  }, [activeTab]);

  // --- Handlers: Period Filter ---
  const handleApplyPeriodFilter = () => {
    setAppliedBulan(draftBulan);
    setAppliedTahun(draftTahun);
    setAppliedPeriodShift(draftPeriodShift);
    setAppliedPeriodCatering(draftPeriodCatering);
    const cid = draftPeriodCatering !== "ALL" ? parseInt(draftPeriodCatering, 10) : undefined;
    fetchPeriodData(draftBulan, draftTahun, draftPeriodShift, cid);
  };

  const handleResetPeriodFilter = () => {
    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();
    setDraftBulan(curM);
    setDraftTahun(curY);
    setDraftPeriodShift("ALL");
    setDraftPeriodCatering("ALL");
    setAppliedBulan(curM);
    setAppliedTahun(curY);
    setAppliedPeriodShift("ALL");
    setAppliedPeriodCatering("ALL");
    fetchPeriodData(curM, curY, "ALL", undefined);
  };

  // --- Handlers: Daily Filter ---
  const handleApplyDailyFilter = () => {
    setAppliedDailyDate(draftDailyDate);
    setAppliedDailyShift(draftDailyShift);
    setAppliedDailyCatering(draftDailyCatering);
    const cid = draftDailyCatering !== "ALL" ? parseInt(draftDailyCatering, 10) : undefined;
    fetchDailyData(draftDailyDate, draftDailyShift, cid);
  };

  const handleResetDailyFilter = () => {
    const defaultDate = "2026-10-15"; // Reliable date or fallback todayWib
    setDraftDailyDate(defaultDate);
    setDraftDailyShift("ALL");
    setDraftDailyCatering("ALL");
    setAppliedDailyDate(defaultDate);
    setAppliedDailyShift("ALL");
    setAppliedDailyCatering("ALL");
    fetchDailyData(defaultDate, "ALL", undefined);
  };

  const kpi = periodData?.kpi;
  const charts = periodData?.charts;
  const rawTable = periodData?.table;
  const table = useMemo(() => rawTable || [], [rawTable]);
  const insights = periodData?.insights || [];
  const availablePeriods = periodData?.periode?.available_periods || [];

  // Unique caterings from period table for filter dropdown
  const uniqueCaterings = useMemo(() => {
    const map = new Map<number, string>();
    table.forEach((row) => {
      if (row.catering_id && !map.has(row.catering_id)) {
        map.set(row.catering_id, row.catering_nama);
      }
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [table]);

  const selectedPeriodObj = availablePeriods.find(
    (p) => p.bulan === draftBulan && p.tahun === draftTahun
  );
  const selectedPeriodTitle = selectedPeriodObj
    ? `${selectedPeriodObj.bulan_nama} ${selectedPeriodObj.tahun}`
    : `${BULAN_NAMES[draftBulan] || `Bulan ${draftBulan}`} ${draftTahun}`;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* 1. Header Bar — Standardized CARMEN Executive Hierarchy */}
      <div style={{ marginBottom: 20 }}>
        <span
          style={{
            color: "#b3212f",
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            display: "inline-block",
            marginBottom: 4,
          }}
        >
          CARMEN — MANAGEMENT ANALYTICS
        </span>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#0f172a",
            margin: "0 0 6px 0",
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
          }}
        >
          Dashboard Kalori
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: "#64748b",
            lineHeight: 1.5,
            maxWidth: 820,
          }}
        >
          Pemantauan pemenuhan standar gizi (ambang batas &ge; 900 kkal), tren harian, dan evaluasi kepatuhan katering per shift.
        </p>
      </div>

      {/* Segmented Control / Tab Switcher */}
      <div
        style={{
          display: "inline-flex",
          backgroundColor: "#f1f5f9",
          borderRadius: 8,
          padding: 4,
          marginBottom: 20,
          border: "1px solid #e2e8f0",
        }}
        role="tablist"
      >
        <button
          id="btn-tab-period"
          type="button"
          role="tab"
          aria-selected={activeTab === "PERIOD"}
          onClick={() => setActiveTab("PERIOD")}
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 6,
            border: "none",
            backgroundColor: activeTab === "PERIOD" ? "#ffffff" : "transparent",
            color: activeTab === "PERIOD" ? "#0f172a" : "#64748b",
            boxShadow: activeTab === "PERIOD" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Calendar size={15} style={{ color: activeTab === "PERIOD" ? "#b3212f" : "#94a3b8" }} />
          <span>Ringkasan Periode</span>
        </button>
        <button
          id="btn-tab-daily"
          type="button"
          role="tab"
          aria-selected={activeTab === "DAILY"}
          onClick={() => setActiveTab("DAILY")}
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 6,
            border: "none",
            backgroundColor: activeTab === "DAILY" ? "#ffffff" : "transparent",
            color: activeTab === "DAILY" ? "#0f172a" : "#64748b",
            boxShadow: activeTab === "DAILY" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={15} style={{ color: activeTab === "DAILY" ? "#b3212f" : "#94a3b8" }} />
          <span>Kalori Harian</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB A: RINGKASAN PERIODE                                                  */}
      {/* ========================================================================= */}
      {activeTab === "PERIOD" && (
        <>
          {/* 2. Filter Bar Container — Standardized Design */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "16px 18px",
              }}
            >
              {/* Filter 1: Periode */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "2 1 220px",
                  minWidth: 180,
                  maxWidth: 340,
                }}
              >
                <label
                  htmlFor="filter-kalori-periode"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Periode
                </label>
                <select
                  id="filter-kalori-periode"
                  aria-label="Pilih Periode Kalori"
                  title={selectedPeriodTitle}
                  value={`${draftBulan}-${draftTahun}`}
                  onChange={(e) => {
                    const [m, y] = e.target.value.split("-").map(Number);
                    setDraftBulan(m);
                    setDraftTahun(y);
                  }}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    width: "100%",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    boxSizing: "border-box",
                  }}
                >
                  {availablePeriods.length > 0 ? (
                    availablePeriods.map((p) => (
                      <option key={`${p.bulan}-${p.tahun}`} value={`${p.bulan}-${p.tahun}`}>
                        {p.bulan_nama} {p.tahun}
                      </option>
                    ))
                  ) : (
                    <option value={`${draftBulan}-${draftTahun}`}>
                      {BULAN_NAMES[draftBulan] || `Bulan ${draftBulan}`} {draftTahun}
                    </option>
                  )}
                </select>
              </div>

              {/* Filter 2: Katering */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "1.5 1 180px",
                  minWidth: 160,
                }}
              >
                <label
                  htmlFor="filter-kalori-katering"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Katering
                </label>
                <select
                  id="filter-kalori-katering"
                  aria-label="Pilih Katering"
                  value={draftPeriodCatering}
                  onChange={(e) => setDraftPeriodCatering(e.target.value)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="ALL">Semua Katering</option>
                  {uniqueCaterings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Shift */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "1 1 130px",
                  minWidth: 120,
                }}
              >
                <label
                  htmlFor="filter-kalori-shift"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Shift
                </label>
                <select
                  id="filter-kalori-shift"
                  aria-label="Pilih Shift"
                  value={draftPeriodShift}
                  onChange={(e) => setDraftPeriodShift(e.target.value)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="ALL">Semua Shift</option>
                  <option value="PAGI">Pagi</option>
                  <option value="MALAM">Malam</option>
                </select>
              </div>

              {/* Action Buttons — Aligned with Inputs */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={handleApplyPeriodFilter}
                  style={{
                    height: 44,
                    padding: "0 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "#b3212f",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <Filter size={15} />
                  <span>Terapkan</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetPeriodFilter}
                  style={{
                    height: 44,
                    padding: "0 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {periodLoading ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                backgroundColor: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid #cbd5e1",
                  borderTopColor: "#b3212f",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                Memuat data analitik kalori...
              </span>
            </div>
          ) : periodError ? (
            <div
              style={{
                padding: "24px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: 8,
                color: "#b3212f",
                fontSize: 13.5,
              }}
            >
              {periodError}
            </div>
          ) : (
            <>
              {/* 3. KPI Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* Card 1: Rata-rata Kalori */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Rata-rata Kalori
                    </span>
                    <Utensils size={16} style={{ color: "#b3212f" }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                    {kpi?.rata_rata_kalori ?? 0}{" "}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>kkal</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Standar acuan: &ge; 900 kkal / porsi
                  </div>
                </div>

                {/* Card 2: Persentase Memenuhi Standar */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Pemenuhan Standar
                    </span>
                    <CheckCircle2 size={16} style={{ color: "#15803d" }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.persentase_memenuhi ?? 0) >= 80 ? "#15803d" : "#b45309", lineHeight: 1.1 }}>
                    {kpi?.persentase_memenuhi ?? 0}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    {kpi?.jumlah_memenuhi ?? 0} dari {kpi?.total_pemeriksaan ?? 0} pemeriksaan
                  </div>
                </div>

                {/* Card 3: Pemeriksaan Memenuhi */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Memenuhi Standar
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#15803d", backgroundColor: "#f0fdf4", padding: "2px 6px", borderRadius: 4 }}>
                      &ge; 900 kkal
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#15803d", lineHeight: 1.1 }}>
                    {kpi?.jumlah_memenuhi ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Entri pemeriksaan kalori compliant
                  </div>
                </div>

                {/* Card 4: Pemeriksaan Di Bawah Standar */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Di Bawah Standar
                    </span>
                    <AlertTriangle size={16} style={{ color: "#b3212f" }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.jumlah_tidak_memenuhi ?? 0) > 0 ? "#b3212f" : "#15803d", lineHeight: 1.1 }}>
                    {kpi?.jumlah_tidak_memenuhi ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Mendapat sanksi/pengurangan kalori
                  </div>
                </div>
              </div>

              {/* 4. Charts / Analytics Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* Chart A: Perbandingan Katering */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "18px 20px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
                    Pemenuhan Standar per Katering
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px 0" }}>
                    Persentase sampel &ge; 900 kkal dari total pemeriksaan
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {charts?.perbandingan_katering && charts.perbandingan_katering.length > 0 ? (
                      charts.perbandingan_katering.map((c) => (
                        <div key={c.catering_id}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                            <span style={{ color: "#0f172a" }}>{c.catering_nama}</span>
                            <span style={{ color: c.persen_memenuhi >= 80 ? "#15803d" : "#b45309" }}>
                              {c.persen_memenuhi}% ({c.rata_rata_kalori} kkal)
                            </span>
                          </div>
                          <div style={{ height: 8, width: "100%", backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${c.persen_memenuhi}%`,
                                backgroundColor: c.persen_memenuhi >= 80 ? "#15803d" : c.persen_memenuhi >= 60 ? "#d97706" : "#b3212f",
                                borderRadius: 4,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", fontSize: 12.5 }}>
                        Belum ada data katering
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart B: Shift Analysis */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "18px 20px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>
                    Distribusi Kepatuhan Shift
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px 0" }}>
                    Perbandingan pemenuhan gizi Shift Pagi vs Shift Malam
                  </p>
                  {charts?.perbandingan_shift ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div
                        style={{
                          padding: 14,
                          backgroundColor: "#f8fafc",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <Clock size={14} style={{ color: "#d97706" }} />
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                            SHIFT PAGI
                          </span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                          {charts.perbandingan_shift.pagi.persen}%
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                          Rata-rata: <strong>{charts.perbandingan_shift.pagi.rata_rata} kkal</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          {charts.perbandingan_shift.pagi.memenuhi} dari {charts.perbandingan_shift.pagi.total} sampel
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 14,
                          backgroundColor: "#f8fafc",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <Clock size={14} style={{ color: "#4f46e5" }} />
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                            SHIFT MALAM
                          </span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                          {charts.perbandingan_shift.malam.persen}%
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                          Rata-rata: <strong>{charts.perbandingan_shift.malam.rata_rata} kkal</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          {charts.perbandingan_shift.malam.memenuhi} dari {charts.perbandingan_shift.malam.total} sampel
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Trend Harian Mini Bar */}
                  <div style={{ marginTop: 20 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
                      Tren Kalori Harian (Garis Ambang 900 kkal)
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 3,
                        height: 60,
                        marginTop: 8,
                        paddingTop: 8,
                        borderBottom: "1px solid #cbd5e1",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "35%",
                          borderTop: "1px dashed #ef4444",
                          zIndex: 1,
                        }}
                        title="Standar 900 kkal"
                      />
                      {charts?.trend_harian && charts.trend_harian.length > 0 ? (
                        charts.trend_harian.map((t, idx) => {
                          const heightPct = Math.min(100, Math.max(15, (t.rata_rata / 1500) * 100));
                          const isOk = t.rata_rata >= 900;
                          return (
                            <div
                              key={idx}
                              title={`${t.tanggal_label}: ${t.rata_rata} kkal (${t.memenuhi} memenuhi)`}
                              style={{
                                flex: 1,
                                height: `${heightPct}%`,
                                backgroundColor: isOk ? "#15803d" : "#ef4444",
                                borderRadius: "2px 2px 0 0",
                                zIndex: 2,
                              }}
                            />
                          );
                        })
                      ) : (
                        <div style={{ width: "100%", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                          Data tren belum tersedia
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Detail Table */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 24,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Rincian Pemeriksaan Kalori Katering
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                    Rekapitulasi pemenuhan per katering dan shift operasional
                  </p>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>NAMA KATERING</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>SHIFT</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>TOTAL PEMERIKSAAN</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>MEMENUHI (&ge; 900)</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>TIDAK MEMENUHI</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>KEPATUHAN</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>RATA-RATA</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                            Tidak ada data pemeriksaan kalori pada filter yang dipilih.
                          </td>
                        </tr>
                      ) : (
                        table.map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fafafa",
                            }}
                          >
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                              {row.catering_nama}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#475569" }}>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  backgroundColor: row.shift.toLowerCase() === "pagi" ? "#fef3c7" : "#e0e7ff",
                                  color: row.shift.toLowerCase() === "pagi" ? "#b45309" : "#4338ca",
                                }}
                              >
                                {row.shift}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>
                              {row.total_pemeriksaan}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700, color: "#15803d" }}>
                              {row.memenuhi}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700, color: row.tidak_memenuhi > 0 ? "#b3212f" : "#64748b" }}>
                              {row.tidak_memenuhi}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800 }}>
                              <span style={{ color: row.persentase_memenuhi >= 80 ? "#15803d" : "#b45309" }}>
                                {row.persentase_memenuhi}%
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#334155" }}>
                              {row.rata_rata_kalori} kkal
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  backgroundColor: row.status === "Baik" ? "#f0fdf4" : row.status === "Perlu Perhatian" ? "#fffbeb" : "#fef2f2",
                                  color: row.status === "Baik" ? "#15803d" : row.status === "Perlu Perhatian" ? "#b45309" : "#b3212f",
                                  border: `1px solid ${row.status === "Baik" ? "#bbf7d0" : row.status === "Perlu Perhatian" ? "#fde68a" : "#fee2e2"}`,
                                }}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. Factual Insights Panel */}
              {insights.length > 0 && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Sparkles size={16} style={{ color: "#b3212f" }} />
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Ringkasan Eksekutif &amp; Fakta Data
                    </h4>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                    {insights.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB B: KALORI HARIAN (DAILY CALENDAR & INSPECTION TABLE FOR APPROVER)     */}
      {/* ========================================================================= */}
      {activeTab === "DAILY" && (
        <>
          {/* 6A. Filter Kalori Harian */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "16px 18px",
              }}
            >
              {/* Filter 1: Tanggal (Native Date Picker with Calendar Trigger) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "1.8 1 200px",
                  minWidth: 180,
                  maxWidth: 300,
                }}
              >
                <label
                  htmlFor="filter-daily-tanggal"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Tanggal
                </label>
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    id="filter-daily-tanggal"
                    type="date"
                    aria-label="Pilih Tanggal Kalori"
                    value={draftDailyDate}
                    onChange={(e) => setDraftDailyDate(e.target.value)}
                    style={{
                      height: 44,
                      padding: "0 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      color: "#0f172a",
                      width: "100%",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Filter 2: Katering */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "1.5 1 180px",
                  minWidth: 160,
                }}
              >
                <label
                  htmlFor="filter-daily-katering"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Katering
                </label>
                <select
                  id="filter-daily-katering"
                  aria-label="Pilih Katering"
                  value={draftDailyCatering}
                  onChange={(e) => setDraftDailyCatering(e.target.value)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="ALL">Semua Katering</option>
                  {uniqueCaterings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Shift */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: "1 1 130px",
                  minWidth: 120,
                }}
              >
                <label
                  htmlFor="filter-daily-shift"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Shift
                </label>
                <select
                  id="filter-daily-shift"
                  aria-label="Pilih Shift"
                  value={draftDailyShift}
                  onChange={(e) => setDraftDailyShift(e.target.value)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="ALL">Semua Shift</option>
                  <option value="PAGI">Pagi</option>
                  <option value="MALAM">Malam</option>
                </select>
              </div>

              {/* Action Buttons — Aligned with Inputs */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={handleApplyDailyFilter}
                  style={{
                    height: 44,
                    padding: "0 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "#b3212f",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <Filter size={15} />
                  <span>Terapkan</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDailyFilter}
                  style={{
                    height: 44,
                    padding: "0 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {dailyLoading ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                backgroundColor: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid #cbd5e1",
                  borderTopColor: "#b3212f",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                Memuat data pemeriksaan kalori harian...
              </span>
            </div>
          ) : dailyError ? (
            <div
              style={{
                padding: "24px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: 8,
                color: "#b3212f",
                fontSize: 13.5,
              }}
            >
              {dailyError}
            </div>
          ) : !dailyData || !dailyData.has_data || dailyData.items.length === 0 ? (
            /* 6A. Empty State: Tanggal tanpa data */
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                backgroundColor: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <Calendar size={40} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
                Tidak ada data Kalori pada tanggal yang dipilih.
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, maxWidth: 480, marginInline: "auto" }}>
                Pemeriksaan kalori belum dilakukan atau data belum diinput untuk tanggal{" "}
                <strong>{formatDateIndo(appliedDailyDate)}</strong>. Data kosong tidak disamakan dengan 0 kkal.
              </p>
            </div>
          ) : (
            <>
              {/* 6C. Tampilan Hasil Harian: Ringkasan Sederhana */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* Ringkasan 1: Total Pengukuran */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Total Pengukuran
                    </span>
                    <Utensils size={16} style={{ color: "#475569" }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                    {dailyData.summary.total_pengukuran}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Tanggal {formatDateIndo(dailyData.tanggal)}
                  </div>
                </div>

                {/* Ringkasan 2: Memenuhi Standar */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Memenuhi Standar
                    </span>
                    <CheckCircle2 size={16} style={{ color: "#15803d" }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#15803d", lineHeight: 1.1 }}>
                    {dailyData.summary.memenuhi}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Hasil kalori &ge; 900 kkal
                  </div>
                </div>

                {/* Ringkasan 3: Di Bawah Standar */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Di Bawah Standar
                    </span>
                    <AlertTriangle size={16} style={{ color: "#b3212f" }} />
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      color: dailyData.summary.tidak_memenuhi > 0 ? "#b3212f" : "#15803d",
                      lineHeight: 1.1,
                    }}
                  >
                    {dailyData.summary.tidak_memenuhi}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Hasil kalori &lt; 900 kkal
                  </div>
                </div>

                {/* Ringkasan 4: Persentase Kepatuhan */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Kepatuhan Harian
                    </span>
                    <Sparkles size={16} style={{ color: "#b45309" }} />
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      color: dailyData.summary.persen_kepatuhan >= 80 ? "#15803d" : "#b45309",
                      lineHeight: 1.1,
                    }}
                  >
                    {dailyData.summary.persen_kepatuhan}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6 }}>
                    Target kualifikasi standar 100%
                  </div>
                </div>
              </div>

              {/* 6C. Tabel Hasil Kalori Harian: KATERING | SHIFT | MENU | KALORI | STATUS | DETAIL */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 24,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Tabel Pengukuran Kalori Harian
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                      Tanggal: <strong>{formatDateIndo(dailyData.tanggal)}</strong> — Hak akses Approver bersifat Read-Only
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#475569",
                      backgroundColor: "#f1f5f9",
                      padding: "4px 10px",
                      borderRadius: 4,
                    }}
                  >
                    Standar Minimal: &ge; 900 kkal
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>KATERING</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>SHIFT</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>MENU</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>ORDER HARIAN</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>TOTAL KALORI</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>STATUS</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>DETAIL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.items.map((item) => {
                        const isExpanded = expandedDailyRows.has(item.id);
                        return (
                          <>
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                backgroundColor: isExpanded ? "#f8fafc" : "#ffffff",
                              }}
                            >
                              <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                                {item.catering_nama}
                              </td>
                              <td style={{ padding: "12px 16px", color: "#475569" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    backgroundColor: item.shift.toLowerCase() === "pagi" ? "#fef3c7" : "#e0e7ff",
                                    color: item.shift.toLowerCase() === "pagi" ? "#b45309" : "#4338ca",
                                  }}
                                >
                                  {item.shift}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#334155", maxWidth: 280 }}>
                                <div style={{ fontWeight: 600 }}>{item.nama_menu}</div>
                                {item.jenis_masakan && (
                                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                    Kategori: {item.jenis_masakan}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>
                                {item.jumlah_order !== undefined && item.jumlah_order !== null ? (
                                  <span style={{ color: "#0f172a" }}>
                                    {item.jumlah_order.toLocaleString("id-ID")} porsi
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800 }}>
                                <span style={{ color: item.is_memenuhi ? "#15803d" : "#b3212f", fontSize: 14 }}>
                                  {item.total_kalori}
                                </span>{" "}
                                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>kkal</span>
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "3px 10px",
                                    borderRadius: 4,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    backgroundColor: item.is_memenuhi ? "#f0fdf4" : "#fef2f2",
                                    color: item.is_memenuhi ? "#15803d" : "#b3212f",
                                    border: `1px solid ${item.is_memenuhi ? "#bbf7d0" : "#fee2e2"}`,
                                  }}
                                >
                                  {item.is_memenuhi ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                  <span>{item.status_standar}</span>
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpanded(item.id)}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    borderRadius: 4,
                                    border: "1px solid #cbd5e1",
                                    backgroundColor: isExpanded ? "#e2e8f0" : "#ffffff",
                                    color: "#334155",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <span>{isExpanded ? "Tutup" : "Rincian Bahan"}</span>
                                  <ChevronDown
                                    size={13}
                                    style={{
                                      transform: isExpanded ? "rotate(180deg)" : "none",
                                      transition: "transform 0.2s ease",
                                    }}
                                  />
                                </button>
                              </td>
                            </tr>
                            {/* Expandable ingredient composition sub-row */}
                            {isExpanded && (
                              <tr key={`${item.id}-detail`} style={{ backgroundColor: "#f8fafc" }}>
                                <td colSpan={7} style={{ padding: "14px 20px 18px 20px", borderBottom: "1px solid #e2e8f0" }}>
                                  <div
                                    style={{
                                      backgroundColor: "#ffffff",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 6,
                                      padding: "12px 16px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 800,
                                        color: "#475569",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        marginBottom: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                    >
                                      <Scale size={14} style={{ color: "#b3212f" }} />
                                      <span>Rincian Komposisi Bahan &amp; Berat Aktual ({item.catering_nama} — {item.shift})</span>
                                    </div>
                                    {item.bahan && item.bahan.length > 0 ? (
                                      <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                          <thead>
                                            <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                                              <th style={{ padding: "6px 10px", fontWeight: 700, color: "#475569" }}>Kategori</th>
                                              <th style={{ padding: "6px 10px", fontWeight: 700, color: "#475569" }}>Nama Bahan</th>
                                              <th style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Standar Kalori</th>
                                              <th style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Standar Berat (g)</th>
                                              <th style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Berat Aktual (g)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {item.bahan.map((b, bIdx) => (
                                              <tr key={b.id || bIdx} style={{ borderBottom: "1px solid #f8fafc" }}>
                                                <td style={{ padding: "6px 10px", color: "#64748b" }}>{b.kategori}</td>
                                                <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0f172a" }}>{b.nama_bahan}</td>
                                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#475569" }}>
                                                  {b.standar_kalori} kkal / 100g
                                                </td>
                                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#475569" }}>
                                                  {b.standar_berat !== null && b.standar_berat !== undefined ? `${b.standar_berat} g` : "-"}
                                                </td>
                                                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                                                  {b.berat_aktual} g
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>
                                        Tidak ada detail bahan untuk entri ini.
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
