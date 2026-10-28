"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Sparkles,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { getManagementPerformanceApi, ManagementPerformanceResponse } from "@/lib/api";

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

export default function ManagementPerformancePage() {
  const [data, setData] = useState<ManagementPerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Draft filter state
  const [draftMonth, setDraftMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [draftYear, setDraftYear] = useState<number>(() => new Date().getFullYear());
  const [draftCatering, setDraftCatering] = useState<string>("ALL");

  // Applied filter state
  const [appliedMonth, setAppliedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [appliedYear, setAppliedYear] = useState<number>(() => new Date().getFullYear());
  const [appliedCatering, setAppliedCatering] = useState<string>("ALL");

  const fetchData = async (bulan?: number, tahun?: number, cateringId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getManagementPerformanceApi({
        bulan: bulan || draftMonth,
        tahun: tahun || draftYear,
        catering_id: cateringId !== undefined && cateringId > 0 ? cateringId : undefined,
      });
      setData(res);
      if (res.periode) {
        setDraftMonth(res.periode.bulan);
        setDraftYear(res.periode.tahun);
        setAppliedMonth(res.periode.bulan);
        setAppliedYear(res.periode.tahun);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data analitik performance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilter = () => {
    setAppliedMonth(draftMonth);
    setAppliedYear(draftYear);
    setAppliedCatering(draftCatering);
    const cid = draftCatering !== "ALL" ? parseInt(draftCatering, 10) : undefined;
    fetchData(draftMonth, draftYear, cid);
  };

  const handleResetFilter = () => {
    setDraftCatering("ALL");
    setAppliedCatering("ALL");
    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();
    setDraftMonth(curM);
    setDraftYear(curY);
    setAppliedMonth(curM);
    setAppliedYear(curY);
    fetchData(curM, curY, undefined);
  };

  const kpi = data?.kpi;
  const charts = data?.charts;
  const rawTable = data?.table;
  const table = useMemo(() => rawTable || [], [rawTable]);
  const insights = data?.insights || [];
  const availableReports = data?.periode?.available_reports || [];
  const weights = data?.component_weights || {
    keterlambatan: 30,
    kelayakan: 20,
    kalori: 15,
    komplain: 15,
    audit: 10,
    kebersihan: 10,
  };

  // Unique caterings for dropdown
  const uniqueCaterings = useMemo(() => {
    const map = new Map<number, string>();
    table.forEach((row) => {
      if (row.catering_id && !map.has(row.catering_id)) {
        map.set(row.catering_id, row.catering_nama);
      }
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [table]);

  const getGradeBadge = (grade: string) => {
    const g = (grade || "D").toUpperCase();
    if (g === "A") {
      return { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" };
    }
    if (g === "B") {
      return { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };
    }
    if (g === "C") {
      return { bg: "#fffbeb", border: "#fde68a", text: "#b45309" };
    }
    return { bg: "#fef2f2", border: "#fee2e2", text: "#b3212f" };
  };

  const selectedPeriodObj = availableReports.find((r) => r.bulan === draftMonth && r.tahun === draftYear);
  const selectedPeriodTitle = selectedPeriodObj
    ? `${selectedPeriodObj.nama_periode} (${selectedPeriodObj.status})`
    : `${BULAN_NAMES[draftMonth] || `Bulan ${draftMonth}`} ${draftYear}`;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* 1. Header Bar — Standardized CARMEN Executive Hierarchy */}
      <div style={{ marginBottom: 24 }}>
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
          Dashboard Performance
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
          Evaluasi skor kinerja komprehensif 6 komponen, peringkat katering, klasifikasi grade (A–D), dan tren antarperiode.
        </p>
      </div>

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
              flex: "2 1 240px",
              minWidth: 200,
              maxWidth: 380,
            }}
          >
            <label
              htmlFor="filter-perf-periode"
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
              id="filter-perf-periode"
              aria-label="Pilih Periode"
              title={selectedPeriodTitle}
              value={`${draftMonth}-${draftYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split("-").map(Number);
                setDraftMonth(m);
                setDraftYear(y);
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
              {availableReports.length > 0 ? (
                availableReports.map((r) => (
                  <option key={r.id} value={`${r.bulan}-${r.tahun}`}>
                    {r.nama_periode} ({r.status.toUpperCase()})
                  </option>
                ))
              ) : (
                <option value={`${draftMonth}-${draftYear}`}>
                  {BULAN_NAMES[draftMonth] || `Bulan ${draftMonth}`} {draftYear}
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
              htmlFor="filter-perf-katering"
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
              id="filter-perf-katering"
              aria-label="Pilih Katering"
              value={draftCatering}
              onChange={(e) => setDraftCatering(e.target.value)}
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
              onClick={handleApplyFilter}
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
              onClick={handleResetFilter}
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

      {loading ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            backgroundColor: "var(--card, #ffffff)",
            borderRadius: 6,
            border: "1px solid var(--border, #e2e8f0)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #cbd5e1",
              borderTopColor: "var(--red, #b3212f)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary, #64748b)" }}>
            Memuat data analitik performance...
          </span>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--red-bg, #fef2f2)",
            border: "1px solid var(--red-light, #fee2e2)",
            borderRadius: 6,
            color: "var(--red, #b3212f)",
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* Status Label Banner */}
          <div
            style={{
              padding: "10px 16px",
              marginBottom: 20,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: data?.is_final ? "var(--green-bg, #f0fdf4)" : "var(--amber-bg, #fffbeb)",
              border: `1px solid ${data?.is_final ? "#bbf7d0" : "var(--amber-light, #fde68a)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {data?.is_final ? (
                <CheckCircle2 size={16} style={{ color: "var(--green, #15803d)" }} />
              ) : (
                <AlertTriangle size={16} style={{ color: "var(--amber, #b45309)" }} />
              )}
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: data?.is_final ? "var(--green, #15803d)" : "var(--amber, #b45309)",
                }}
              >
                Status Dokumen: {data?.status} {data?.is_final ? "(Resmi Terfinalisasi)" : "(Draft / Kalkulasi Berjalan)"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary, #64748b)" }}>
              Periode: <strong>{data?.periode?.nama_periode}</strong>
            </span>
          </div>

          {/* 3. KPI Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Card 1: Rata-rata Skor */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
                  Rata-rata Skor
                </span>
                <TrendingUp size={16} style={{ color: "var(--red, #b3212f)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.rata_rata_skor ?? 0}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>/ 100</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Dari {kpi?.total_katering ?? 0} katering aktif
              </div>
            </div>

            {/* Card 2: Jumlah Katering Grade A */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
                  Grade A (95–100)
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 4, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
                  A
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#15803d", lineHeight: 1.1 }}>
                {kpi?.jumlah_grade_a ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Kinerja sangat memuaskan
              </div>
            </div>

            {/* Card 3: Jumlah Katering Grade B */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
                  Grade B (81–94)
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 4, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                  B
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1d4ed8", lineHeight: 1.1 }}>
                {kpi?.jumlah_grade_b ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Kinerja memenuhi standar
              </div>
            </div>

            {/* Card 4: Jumlah Katering Grade C/D */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
                  Grade C / D (&le; 80)
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 4, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                  C/D
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.jumlah_grade_c_d ?? 0) > 0 ? "var(--amber, #b45309)" : "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.jumlah_grade_c_d ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Perlu pembinaan / evaluasi
              </div>
            </div>
          </div>

          {/* 4. Charts Row: Ranking & Kontribusi 6 Komponen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Chart A: Peringkat Katering */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0 }}>
                  Peringkat Performance Katering
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Urutan skor akhir, grade evaluasi, dan perubahan skor
                </p>
              </div>

              {charts?.ranking_katering && charts.ranking_katering.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {charts.ranking_katering.map((r, idx) => {
                    const badge = getGradeBadge(r.grade);
                    return (
                      <div
                        key={r.catering_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 6,
                          backgroundColor: idx === 0 ? "#fffbf0" : "#f8fafc",
                          border: `1px solid ${idx === 0 ? "#fef08a" : "#e2e8f0"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              backgroundColor: idx === 0 ? "#eab308" : "#cbd5e1",
                              color: idx === 0 ? "#ffffff" : "#334155",
                              fontSize: 11.5,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                              {r.catering_nama}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary, #64748b)", display: "flex", alignItems: "center", gap: 6 }}>
                              {r.delta_from_prev !== null && r.delta_from_prev !== undefined ? (
                                r.delta_from_prev > 0 ? (
                                  <span style={{ color: "#15803d", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 700 }}>
                                    <ArrowUpRight size={12} /> +{r.delta_from_prev} poin
                                  </span>
                                ) : r.delta_from_prev < 0 ? (
                                  <span style={{ color: "#b3212f", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 700 }}>
                                    <ArrowDownRight size={12} /> {r.delta_from_prev} poin
                                  </span>
                                ) : (
                                  <span style={{ color: "#64748b" }}>Tetap</span>
                                )
                              ) : (
                                <span>Periode Baru</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 17, fontWeight: 900, color: "var(--text, #0f172a)" }}>
                            {r.score}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              fontWeight: 800,
                              backgroundColor: badge.bg,
                              border: `1px solid ${badge.border}`,
                              color: badge.text,
                            }}
                          >
                            Grade {r.grade}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: 13 }}>
                  Data peringkat belum tersedia.
                </div>
              )}
            </div>

            {/* Chart B: Kontribusi 6 Komponen */}
            <div
              style={{
                backgroundColor: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0 }}>
                  Bobot 6 Komponen Performance
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Maksimal 100 poin: Keterlambatan ({weights.keterlambatan}), Kelayakan ({weights.kelayakan}), Kalori ({weights.kalori}), Komplain ({weights.komplain}), Audit ({weights.audit}), Kebersihan ({weights.kebersihan})
                </p>
              </div>

              {charts?.kontribusi_komponen && charts.kontribusi_komponen.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {charts.kontribusi_komponen.map((k) => (
                    <div key={k.catering_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "var(--text, #0f172a)" }}>{k.catering_nama}</span>
                        <span style={{ color: "var(--text-secondary, #475569)" }}>
                          Total: <strong>{k.total_score}</strong> / 100
                        </span>
                      </div>
                      {/* Stacked Component Bars */}
                      <div
                        style={{
                          height: 10,
                          backgroundColor: "#f1f5f9",
                          borderRadius: 9999,
                          display: "flex",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ width: `${k.terlambat}%`, backgroundColor: "#3b82f6" }} title={`Keterlambatan: ${k.terlambat}`} />
                        <div style={{ width: `${k.kelayakan}%`, backgroundColor: "#10b981" }} title={`Menu/Kelayakan: ${k.kelayakan}`} />
                        <div style={{ width: `${k.kalori}%`, backgroundColor: "#f59e0b" }} title={`Kalori: ${k.kalori}`} />
                        <div style={{ width: `${k.komplain}%`, backgroundColor: "#8b5cf6" }} title={`Komplain: ${k.komplain}`} />
                        <div style={{ width: `${k.audit}%`, backgroundColor: "#ec4899" }} title={`Audit Dapur: ${k.audit}`} />
                        <div style={{ width: `${k.kebersihan}%`, backgroundColor: "#06b6d4" }} title={`Kebersihan: ${k.kebersihan}`} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10.5, color: "var(--text-muted, #64748b)", marginTop: 4 }}>
                        <span>L: {k.terlambat}</span>
                        <span>M: {k.kelayakan}</span>
                        <span>K: {k.kalori}</span>
                        <span>C: {k.komplain}</span>
                        <span>A: {k.audit}</span>
                        <span>B: {k.kebersihan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Legend 6 Komponen */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: "1px solid #f1f5f9",
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                  <span>Keterlambatan (30)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981" }} />
                  <span>Kelayakan (20)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                  <span>Kalori (15)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#8b5cf6" }} />
                  <span>Komplain (15)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ec4899" }} />
                  <span>Audit (10)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#06b6d4" }} />
                  <span>Kebersihan (10)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Detail Table */}
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 6,
              overflow: "hidden",
              marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0 }}>
                Rincian Skor Performance per Vendor
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
                Komparasi performa dan riwayat perubahan dari periode sebelumnya
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>KATERING</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>GRADE</th>
                    <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--text, #0f172a)", textAlign: "right" }}>SKOR</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>PERUBAHAN</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>TERLAMBAT (30)</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>KELAYAKAN (20)</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>KALORI (15)</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>KOMPLAIN (15)</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>AUDIT (10)</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600, color: "#64748b", textAlign: "right" }}>KEBERSIHAN (10)</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {table.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                        Tidak ada data kalkulasi performance untuk periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    table.map((row, idx) => {
                      const badge = getGradeBadge(row.grade);
                      return (
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
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11.5,
                                fontWeight: 800,
                                backgroundColor: badge.bg,
                                border: `1px solid ${badge.border}`,
                                color: badge.text,
                              }}
                            >
                              Grade {row.grade}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, fontSize: 14 }}>
                            {row.score}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            {row.perubahan !== null && row.perubahan !== undefined ? (
                              row.perubahan > 0 ? (
                                <span style={{ color: "#15803d", fontWeight: 700, fontSize: 12 }}>
                                  +{row.perubahan}
                                </span>
                              ) : row.perubahan < 0 ? (
                                <span style={{ color: "#b3212f", fontWeight: 700, fontSize: 12 }}>
                                  {row.perubahan}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>0</span>
                              )
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.terlambat}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.kelayakan}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.kalori}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.komplain}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.audit}</td>
                          <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>{row.kebersihan}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: row.status_data === "FINAL" ? "#f0fdf4" : "#fffbeb",
                                color: row.status_data === "FINAL" ? "#15803d" : "#b45309",
                                border: `1px solid ${row.status_data === "FINAL" ? "#bbf7d0" : "#fde68a"}`,
                              }}
                            >
                              {row.status_data}
                            </span>
                          </td>
                        </tr>
                      );
                    })
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
                borderRadius: 6,
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Sparkles size={16} style={{ color: "var(--red, #b3212f)" }} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text, #0f172a)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Ringkasan Eksekutif &amp; Fakta Data
                </h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary, #475569)", lineHeight: 1.6 }}>
                {insights.map((ins, i) => (
                  <li key={i}>{ins}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
