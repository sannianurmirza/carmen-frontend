"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Filter,
  RotateCcw,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  PieChart,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { getManagementPunishmentApi, ManagementPunishmentResponse } from "@/lib/api";

export default function ManagementPunishmentPage() {
  const [data, setData] = useState<ManagementPunishmentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Draft filter state (user current selection)
  const [draftReportId, setDraftReportId] = useState<string>("LATEST");
  const [draftShift, setDraftShift] = useState<string>("ALL");
  const [draftCatering, setDraftCatering] = useState<string>("ALL");

  // Applied filter state (actual active filters fetching data)
  const [appliedReportId, setAppliedReportId] = useState<string>("LATEST");
  const [appliedShift, setAppliedShift] = useState<string>("ALL");
  const [appliedCatering, setAppliedCatering] = useState<string>("ALL");

  const fetchData = async (reportId?: number, shift?: string, cateringId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getManagementPunishmentApi({
        report_id: reportId,
        shift: shift !== "ALL" ? shift : undefined,
        catering_id: cateringId !== undefined && cateringId > 0 ? cateringId : undefined,
      });
      setData(res);
      if (res.periode?.id) {
        setDraftReportId(String(res.periode.id));
        setAppliedReportId(String(res.periode.id));
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data analitik punishment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilter = () => {
    setAppliedReportId(draftReportId);
    setAppliedShift(draftShift);
    setAppliedCatering(draftCatering);
    const rid = draftReportId !== "LATEST" ? parseInt(draftReportId, 10) : undefined;
    const cid = draftCatering !== "ALL" ? parseInt(draftCatering, 10) : undefined;
    fetchData(rid, draftShift, cid);
  };

  const handleResetFilter = () => {
    setDraftShift("ALL");
    setDraftCatering("ALL");
    setDraftReportId("LATEST");
    setAppliedShift("ALL");
    setAppliedCatering("ALL");
    setAppliedReportId("LATEST");
    fetchData(undefined, "ALL", undefined);
  };

  const kpi = data?.kpi;
  const charts = data?.charts;
  const rawTable = data?.table;
  const table = useMemo(() => rawTable || [], [rawTable]);
  const insights = data?.insights || [];
  const availableReports = data?.periode?.available_reports || [];

  // Unique caterings from table for dropdown
  const uniqueCaterings = useMemo(() => {
    const map = new Map<number, string>();
    table.forEach((row) => {
      if (row.catering_id && !map.has(row.catering_id)) {
        map.set(row.catering_id, row.catering_nama);
      }
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [table]);

  // Selected report title for tooltip
  const selectedReportObj = availableReports.find((r) => String(r.id) === draftReportId);
  const selectedReportTitle = selectedReportObj
    ? `${selectedReportObj.nama_periode} (${selectedReportObj.status})`
    : draftReportId === "LATEST"
    ? "Laporan Terkini"
    : `Laporan #${draftReportId}`;

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
          Dashboard Punishment
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
          Pemantauan akumulasi sanksi operasional katering berdasarkan 5 domain resmi: Keterlambatan, Menu/Kelayakan, Kalori, Komplain, dan Audit.
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
          {/* Filter 1: Laporan */}
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
              htmlFor="filter-laporan"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Laporan
            </label>
            <select
              id="filter-laporan"
              aria-label="Pilih Laporan Periode"
              title={selectedReportTitle}
              value={draftReportId}
              onChange={(e) => setDraftReportId(e.target.value)}
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
                  <option key={r.id} value={r.id}>
                    {r.nama_periode} ({r.status.toUpperCase()})
                  </option>
                ))
              ) : (
                <option value="LATEST">Laporan Terkini</option>
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
              htmlFor="filter-katering"
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
              id="filter-katering"
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
              htmlFor="filter-shift"
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
              id="filter-shift"
              aria-label="Pilih Shift"
              value={draftShift}
              onChange={(e) => setDraftShift(e.target.value)}
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
            Memuat data analitik punishment...
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
                Status Dokumen: {data?.status} {data?.is_final ? "(Laporan Resmi Terfinalisasi)" : "(Draft Operasional)"}
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
            {/* Card 1: Total Sanksi */}
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
                  Total Sanksi
                </span>
                <ShieldAlert size={16} style={{ color: "var(--red, #b3212f)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.total_sanksi ?? 0) > 0 ? "var(--red, #b3212f)" : "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.total_sanksi ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Akumulasi sanksi 5 domain
              </div>
            </div>

            {/* Card 2: Jumlah Katering Kena Sanksi */}
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
                  Katering Bersanksi
                </span>
                <Building2 size={16} style={{ color: "var(--amber, #b45309)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.jumlah_katering_sanksi ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Vendor dengan sanksi &gt; 0
              </div>
            </div>

            {/* Card 3: Domain Terbesar */}
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
                  Domain Terbesar
                </span>
                <PieChart size={16} style={{ color: "var(--red, #b3212f)" }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.2 }}>
                {kpi?.domain_terbesar || "-"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Penyumbang sanksi tertinggi
              </div>
            </div>

            {/* Card 4: Laporan Final */}
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
                  Laporan Final
                </span>
                <CheckCircle2 size={16} style={{ color: "var(--green, #15803d)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.jumlah_laporan_final ?? 0}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Dari total {availableReports.length} laporan
              </div>
            </div>
          </div>

          {/* 4. Charts Row: Komposisi 5 Domain & Perbandingan Katering */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Chart A: Komposisi 5 Domain Operasional */}
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
                  Komposisi 5 Domain Punishment
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Rincian distribusi sanksi per domain operasional
                </p>
              </div>

              {charts?.komposisi_domain && charts.komposisi_domain.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {charts.komposisi_domain.map((d) => (
                    <div key={d.domain}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "var(--text, #0f172a)" }}>{d.domain}</span>
                        <span style={{ color: d.total > 0 ? "var(--red, #b3212f)" : "var(--text-muted, #94a3b8)" }}>
                          {d.total} ({d.percentage}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          backgroundColor: "#f1f5f9",
                          borderRadius: 9999,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, d.percentage)}%`,
                            backgroundColor: d.total > 0 ? "#b3212f" : "#cbd5e1",
                            borderRadius: 9999,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: 13 }}>
                  Tidak ada sanksi yang tercatat pada periode ini.
                </div>
              )}
            </div>

            {/* Chart B: Perbandingan Sanksi Antar-Katering */}
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
                  Sanksi Antar-Katering
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Vendor dengan akumulasi sanksi tertinggi periode ini
                </p>
              </div>

              {charts?.perbandingan_katering && charts.perbandingan_katering.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {charts.perbandingan_katering.map((c) => (
                    <div key={c.catering_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: "var(--text, #0f172a)" }}>{c.catering_nama}</span>
                        <span style={{ color: c.total_sanksi > 0 ? "var(--red, #b3212f)" : "var(--green, #15803d)" }}>
                          {c.total_sanksi} sanksi
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          backgroundColor: "#f1f5f9",
                          borderRadius: 9999,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (c.total_sanksi / (kpi?.total_sanksi || 1)) * 100)}%`,
                            backgroundColor: c.total_sanksi > 0 ? "#b3212f" : "#15803d",
                            borderRadius: 9999,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: 13 }}>
                  Data perbandingan katering belum tersedia.
                </div>
              )}

              {/* Chart C: Tren Periode Laporan */}
              {charts?.tren_periode && charts.tren_periode.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary, #64748b)" }}>
                    Tren Total Sanksi Antarperiode
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 8,
                      height: 55,
                      marginTop: 8,
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    {charts.tren_periode.map((t, idx) => {
                      const maxSanksi = Math.max(...charts.tren_periode.map((x) => x.total_sanksi), 10);
                      const barH = Math.max(12, (t.total_sanksi / maxSanksi) * 100);
                      return (
                        <div
                          key={idx}
                          title={`${t.nama_periode}: ${t.total_sanksi} (${t.status})`}
                          style={{
                            flex: 1,
                            height: `${barH}%`,
                            backgroundColor: t.status === "FINAL" ? "#b3212f" : "#f59e0b",
                            borderRadius: "2px 2px 0 0",
                            textAlign: "center",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
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
                Rincian Sanksi per Vendor &amp; 5 Domain Operasional
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
                Data bersumber langsung dari snapshot punishment resmi periode terkait
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>KATERING</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155" }}>SHIFT</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>KETERLAMBATAN</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>KELAYAKAN</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>KALORI</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>KOMPLAIN</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "right" }}>AUDIT</th>
                    <th style={{ padding: "12px 16px", fontWeight: 800, color: "var(--red, #b3212f)", textAlign: "right" }}>TOTAL SANKSI</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#334155", textAlign: "center" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {table.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                        Tidak ada data punishment untuk katering yang dipilih.
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
                              backgroundColor: "#f1f5f9",
                              color: "#334155",
                            }}
                          >
                            {row.shift}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: row.keterlambatan > 0 ? "var(--red, #b3212f)" : "#64748b" }}>
                          {row.keterlambatan}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: row.kelayakan > 0 ? "var(--red, #b3212f)" : "#64748b" }}>
                          {row.kelayakan}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: row.kalori > 0 ? "var(--red, #b3212f)" : "#64748b" }}>
                          {row.kalori}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: row.komplain > 0 ? "var(--red, #b3212f)" : "#64748b" }}>
                          {row.komplain}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: row.audit > 0 ? "var(--red, #b3212f)" : "#64748b" }}>
                          {row.audit}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: row.total > 0 ? "var(--red, #b3212f)" : "var(--green, #15803d)" }}>
                          {row.total}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: row.status_laporan === "FINAL" ? "#f0fdf4" : "#fffbeb",
                              color: row.status_laporan === "FINAL" ? "#15803d" : "#b45309",
                              border: `1px solid ${row.status_laporan === "FINAL" ? "#bbf7d0" : "#fde68a"}`,
                            }}
                          >
                            {row.status_laporan}
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
