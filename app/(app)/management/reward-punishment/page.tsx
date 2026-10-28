"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Award,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  PieChart,
} from "lucide-react";
import { getManagementRewardPunishmentApi, ManagementRewardPunishmentResponse } from "@/lib/api";

export default function ManagementRewardPunishmentPage() {
  const [data, setData] = useState<ManagementRewardPunishmentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Draft filter state (user current selection)
  const [draftPeriodId, setDraftPeriodId] = useState<string>("LATEST");
  const [draftGroup, setDraftGroup] = useState<string>("ALL");
  const [draftCatering, setDraftCatering] = useState<string>("ALL");
  const [draftShift, setDraftShift] = useState<string>("ALL");

  // Applied filter state (actual active filters)
  const [appliedPeriodId, setAppliedPeriodId] = useState<string>("LATEST");
  const [appliedGroup, setAppliedGroup] = useState<string>("ALL");
  const [appliedCatering, setAppliedCatering] = useState<string>("ALL");
  const [appliedShift, setAppliedShift] = useState<string>("ALL");

  const fetchData = async (periodId?: number, groupCode?: string, shift?: string, cateringId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getManagementRewardPunishmentApi({
        period_id: periodId,
        group_code: groupCode !== "ALL" ? groupCode : undefined,
        shift: shift !== "ALL" ? shift : undefined,
        catering_id: cateringId !== undefined && cateringId > 0 ? cateringId : undefined,
      });
      setData(res);
      if (res.periode?.id) {
        setDraftPeriodId(String(res.periode.id));
        setAppliedPeriodId(String(res.periode.id));
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data analitik reward & punishment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilter = () => {
    setAppliedPeriodId(draftPeriodId);
    setAppliedGroup(draftGroup);
    setAppliedCatering(draftCatering);
    setAppliedShift(draftShift);
    const pid = draftPeriodId !== "LATEST" ? parseInt(draftPeriodId, 10) : undefined;
    const cid = draftCatering !== "ALL" ? parseInt(draftCatering, 10) : undefined;
    fetchData(pid, draftGroup, draftShift, cid);
  };

  const handleResetFilter = () => {
    setDraftPeriodId("LATEST");
    setDraftGroup("ALL");
    setDraftCatering("ALL");
    setDraftShift("ALL");
    setAppliedPeriodId("LATEST");
    setAppliedGroup("ALL");
    setAppliedCatering("ALL");
    setAppliedShift("ALL");
    fetchData(undefined, "ALL", "ALL", undefined);
  };

  const kpi = data?.kpi;
  const charts = data?.charts;
  const rawTable = data?.table;
  const table = useMemo(() => rawTable || [], [rawTable]);
  const insights = data?.insights || [];
  const availablePeriods = data?.periode?.available_periods || [];

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

  // Selected period title for tooltip
  const selectedPeriodObj = availablePeriods.find((p) => String(p.id) === draftPeriodId);
  const selectedPeriodTitle = selectedPeriodObj
    ? `${selectedPeriodObj.nama_periode} (${selectedPeriodObj.status})`
    : draftPeriodId === "LATEST"
    ? "Periode Terkini"
    : `Periode #${draftPeriodId}`;

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
          Dashboard Reward &amp; Punishment
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
          Pemantauan penyesuaian porsi pesanan berdasarkan perbandingan Grup A &amp; Grup B, total sanksi, reward, dan proyeksi pesanan.
        </p>
      </div>

      {/* 2. Filter Bar Container — Standardized Design with Size Hierarchy */}
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
          {/* Filter 1: Periode (Widest priority) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: "2.5 1 240px",
              minWidth: 200,
              maxWidth: 360,
            }}
          >
            <label
              htmlFor="filter-rp-periode"
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
              id="filter-rp-periode"
              aria-label="Pilih Periode R&P"
              title={selectedPeriodTitle}
              value={draftPeriodId}
              onChange={(e) => setDraftPeriodId(e.target.value)}
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
                  <option key={p.id} value={p.id}>
                    {p.nama_periode} ({p.status.toUpperCase()})
                  </option>
                ))
              ) : (
                <option value="LATEST">Periode Terkini</option>
              )}
            </select>
          </div>

          {/* Filter 2: Grup (Medium priority) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: "1.2 1 150px",
              minWidth: 140,
            }}
          >
            <label
              htmlFor="filter-rp-grup"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Grup
            </label>
            <select
              id="filter-rp-grup"
              aria-label="Pilih Grup"
              value={draftGroup}
              onChange={(e) => setDraftGroup(e.target.value)}
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
              <option value="ALL">Semua Grup (A &amp; B)</option>
              <option value="A">Grup A</option>
              <option value="B">Grup B</option>
            </select>
          </div>

          {/* Filter 3: Katering (Medium priority) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: "1.5 1 170px",
              minWidth: 150,
            }}
          >
            <label
              htmlFor="filter-rp-katering"
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
              id="filter-rp-katering"
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

          {/* Filter 4: Shift (Smaller priority) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: "1 1 120px",
              minWidth: 110,
            }}
          >
            <label
              htmlFor="filter-rp-shift"
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
              id="filter-rp-shift"
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
            Memuat data analitik Reward &amp; Punishment...
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
                Status Dokumen: {data?.status} {data?.is_final ? "(Resmi Terfinalisasi)" : "(Draft Perhitungan)"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary, #64748b)" }}>
              Target Alokasi: <strong>{data?.periode?.target_bulan}</strong> ({data?.periode?.tanggal_mulai} s/d {data?.periode?.tanggal_selesai})
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
            {/* Card 1: Total Order Berjalan */}
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
                  Total Order Berjalan
                </span>
                <Clock size={16} style={{ color: "#3b82f6" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.total_order_berjalan?.toLocaleString("id-ID") ?? 0}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>porsi</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Baseline kuota pesanan aktif
              </div>
            </div>

            {/* Card 2: Total Sanksi */}
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
                <TrendingDown size={16} style={{ color: "var(--red, #b3212f)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.total_sanksi ?? 0) > 0 ? "var(--red, #b3212f)" : "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.total_sanksi?.toLocaleString("id-ID") ?? 0}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>porsi</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Pengurangan akibat pelanggaran
              </div>
            </div>

            {/* Card 3: Total Reward */}
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
                  Total Reward
                </span>
                <Award size={16} style={{ color: "var(--green, #15803d)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: (kpi?.total_reward ?? 0) > 0 ? "var(--green, #15803d)" : "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.total_reward?.toLocaleString("id-ID") ?? 0}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>porsi</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Alokasi insentif kinerja
              </div>
            </div>

            {/* Card 4: Total Hasil Perhitungan */}
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
                  Hasil Perhitungan
                </span>
                <TrendingUp size={16} style={{ color: "var(--red, #b3212f)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)", lineHeight: 1.1 }}>
                {kpi?.total_hasil_perhitungan?.toLocaleString("id-ID") ?? 0}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>porsi</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
                Order berjalan + sanksi + reward
              </div>
            </div>
          </div>

          {/* 4. Charts Row: Komparasi Grup A/B & Penyesuaian Katering */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Chart A: Komparasi Grup A vs Grup B */}
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
                  Perbandingan Grup A vs Grup B
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Distribusi pesanan, sanksi, reward, dan hasil akhir antargrup
                </p>
              </div>

              {charts?.perbandingan_grup ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {/* Grup A Card */}
                  <div
                    style={{
                      padding: 14,
                      backgroundColor: "#f8fafc",
                      borderRadius: 6,
                      border: "1px solid var(--border, #e2e8f0)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                        GRUP A
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 3 }}>
                      Order Berjalan: <strong>{charts.perbandingan_grup.grup_a.order_berjalan.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#b3212f", marginBottom: 3 }}>
                      Total Sanksi: <strong>{charts.perbandingan_grup.grup_a.sanksi.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#15803d", marginBottom: 6 }}>
                      Total Reward: <strong>{charts.perbandingan_grup.grup_a.reward.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                      Hasil: {charts.perbandingan_grup.grup_a.hasil.toLocaleString("id-ID")} porsi
                    </div>
                  </div>

                  {/* Grup B Card */}
                  <div
                    style={{
                      padding: 14,
                      backgroundColor: "#f8fafc",
                      borderRadius: 6,
                      border: "1px solid var(--border, #e2e8f0)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#8b5cf6" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                        GRUP B
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 3 }}>
                      Order Berjalan: <strong>{charts.perbandingan_grup.grup_b.order_berjalan.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#b3212f", marginBottom: 3 }}>
                      Total Sanksi: <strong>{charts.perbandingan_grup.grup_b.sanksi.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#15803d", marginBottom: 6 }}>
                      Total Reward: <strong>{charts.perbandingan_grup.grup_b.reward.toLocaleString("id-ID")}</strong>
                    </div>
                    <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                      Hasil: {charts.perbandingan_grup.grup_b.hasil.toLocaleString("id-ID")} porsi
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Chart B: Komposisi Penyesuaian Order */}
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
                  Penyesuaian Order per Vendor
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                  Net penyesuaian (sanksi &amp; reward) terhadap order berjalan
                </p>
              </div>

              {charts?.komposisi_penyesuaian && charts.komposisi_penyesuaian.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {charts.komposisi_penyesuaian.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: 4,
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                        {c.label}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: c.net_penyesuaian > 0 ? "#15803d" : c.net_penyesuaian < 0 ? "#b3212f" : "#64748b",
                          }}
                        >
                          {c.net_penyesuaian > 0 ? `+${c.net_penyesuaian}` : c.net_penyesuaian}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                          &rarr; {c.hasil_perhitungan}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: 13 }}>
                  Tidak ada penyesuaian porsi pada filter terpilih.
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
                Rincian Kalkulasi Reward &amp; Punishment per Katering
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
                Formula resmi: <code>hasil_perhitungan = jumlah_order_berjalan + total_sanksi + reward</code>
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155" }}>KATERING</th>
                    <th style={{ padding: "12px 12px", fontWeight: 700, color: "#334155", textAlign: "center" }}>GRUP</th>
                    <th style={{ padding: "12px 12px", fontWeight: 700, color: "#334155", textAlign: "center" }}>SHIFT</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155", textAlign: "right" }}>ORDER BERJALAN</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--red, #b3212f)", textAlign: "right" }}>TOTAL SANKSI</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--green, #15803d)", textAlign: "right" }}>REWARD</th>
                    <th style={{ padding: "12px 14px", fontWeight: 900, color: "var(--text, #0f172a)", textAlign: "right" }}>HASIL PERHITUNGAN</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155", textAlign: "right" }}>% TARGET</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155", textAlign: "right" }}>PROJECTED ORDER</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155", textAlign: "center" }}>AKTUAL ORDER</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#334155", textAlign: "center" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {table.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                        Tidak ada data kalkulasi R&amp;P untuk filter yang dipilih.
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
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>
                          {row.catering_nama}
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              fontWeight: 700,
                              backgroundColor: row.group.includes("A") ? "#eff6ff" : "#f5f3ff",
                              color: row.group.includes("A") ? "#1d4ed8" : "#6d28d9",
                              border: `1px solid ${row.group.includes("A") ? "#bfdbfe" : "#ddd6fe"}`,
                            }}
                          >
                            {row.group}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "center", color: "#475569" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              backgroundColor: row.shift.toLowerCase() === "pagi" ? "#fef3c7" : "#e0e7ff",
                              color: row.shift.toLowerCase() === "pagi" ? "#b45309" : "#4338ca",
                            }}
                          >
                            {row.shift}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#334155" }}>
                          {row.order_berjalan.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: row.total_sanksi > 0 ? "var(--red, #b3212f)" : "#64748b", fontWeight: row.total_sanksi > 0 ? 700 : 400 }}>
                          {row.total_sanksi > 0 ? `-${row.total_sanksi}` : row.total_sanksi}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: row.reward > 0 ? "var(--green, #15803d)" : "#64748b", fontWeight: row.reward > 0 ? 700 : 400 }}>
                          {row.reward > 0 ? `+${row.reward}` : row.reward}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 900, fontSize: 13.5, color: "#0f172a" }}>
                          {row.hasil_perhitungan.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569" }}>
                          {row.target_persen}%
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569" }}>
                          {row.projected_order.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#64748b", fontStyle: row.aktual_order === "-" ? "italic" : "normal" }}>
                          {row.aktual_order}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: row.status === "FINAL" ? "#f0fdf4" : "#fffbeb",
                              color: row.status === "FINAL" ? "#15803d" : "#b45309",
                              border: `1px solid ${row.status === "FINAL" ? "#bbf7d0" : "#fde68a"}`,
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
