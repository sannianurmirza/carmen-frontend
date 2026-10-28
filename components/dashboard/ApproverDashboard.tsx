"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileArchive,
  File as FileIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Utensils,
  AlertTriangle,
  Award,
  Scale,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  getApprovals,
  ApprovalItem,
  ApprovalListResponse,
  getManagementSummaryApi,
  ManagementSummaryResponse,
} from "@/lib/api";
import { AuthUser } from "@/lib/api";

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx !== -1 ? filename.slice(idx).toLowerCase() : "";
}

function getFileIcon(filename: string) {
  const ext = getFileExtension(filename);
  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    return <FileSpreadsheet size={16} style={{ color: "var(--green, #15803d)", flexShrink: 0 }} />;
  }
  if (ext === ".pdf" || ext === ".docx" || ext === ".doc") {
    return <FileText size={16} style={{ color: "var(--red, #b3212f)", flexShrink: 0 }} />;
  }
  if (ext === ".zip") {
    return <FileArchive size={16} style={{ color: "var(--amber, #b45309)", flexShrink: 0 }} />;
  }
  return <FileIcon size={16} style={{ color: "var(--text-secondary, #64748b)", flexShrink: 0 }} />;
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11.5,
            fontWeight: 700,
            backgroundColor: "var(--green-bg, #f0fdf4)",
            border: "1px solid #bbf7d0",
            color: "var(--green, #15803d)",
          }}
        >
          <CheckCircle2 size={12} />
          Disetujui
        </span>
      );
    case "REJECTED":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11.5,
            fontWeight: 700,
            backgroundColor: "var(--red-bg, #fef2f2)",
            border: "1px solid var(--red-light, #fee2e2)",
            color: "var(--red, #b3212f)",
          }}
        >
          <XCircle size={12} />
          Ditolak
        </span>
      );
    case "WAITING":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11.5,
            fontWeight: 600,
            backgroundColor: "var(--bg-subtle, #f1f5f9)",
            border: "1px solid var(--border, #cbd5e1)",
            color: "var(--text-muted, #64748b)",
          }}
        >
          <Clock size={12} />
          Menunggu Giliran
        </span>
      );
    case "PENDING":
    default:
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11.5,
            fontWeight: 700,
            backgroundColor: "var(--amber-bg, #fffbeb)",
            border: "1px solid var(--amber-light, #fde68a)",
            color: "var(--amber, #b45309)",
          }}
        >
          <Clock size={12} />
          Menunggu Review
        </span>
      );
  }
}

interface ApproverDashboardProps {
  user: AuthUser | null;
}

export default function ApproverDashboard({ user }: ApproverDashboardProps) {
  const [data, setData] = useState<ApprovalListResponse | null>(null);
  const [summary, setSummary] = useState<ManagementSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getApprovals({ tab: "assigned" })
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat data dashboard approver:", err);
        if (isMounted) setLoading(false);
      });

    getManagementSummaryApi()
      .then((res) => {
        if (isMounted) {
          setSummary(res);
          setSummaryLoading(false);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat summary management:", err);
        if (isMounted) setSummaryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const items = data?.items || [];
  // Reviewable: items that are currently pending for this approver
  const pendingReviewItems = items.filter((item) => item.can_review && (item.status === "PENDING" || item.status === "WAITING"));
  // Processed history: items where user has actually taken action or document has finalized
  const historyItems = items
    .filter((item) => {
      const myStepStatus = item.my_step?.status?.toUpperCase();
      if (myStepStatus && ["APPROVED", "REJECTED", "REVISION_REQUIRED", "REVISED"].includes(myStepStatus)) {
        return true;
      }
      if (["APPROVED", "REJECTED"].includes(item.status?.toUpperCase() || "")) {
        return true;
      }
      return false;
    })
    .slice(0, 15);

  const pendingCount = data?.pending_for_me_count ?? pendingReviewItems.length;

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", paddingBottom: 60 }}>
      {/* Top Header Row */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow" style={{ color: "var(--red, #b3212f)", fontWeight: 800 }}>
            CARMEN — MANAGEMENT
          </span>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Persetujuan &amp; Otorisasi Dokumen
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary, #64748b)" }}>
            Selamat datang, <strong>{user?.nama}</strong>. Tinjau ringkasan performa 4 pilar operasional katering dan putuskan pengajuan laporan yang memerlukan otorisasi Anda.
          </p>
        </div>
      </div>

      {/* Main Focus Metric Card - Approval Queue */}
      <div
        className="panel"
        style={{
          padding: "20px 24px",
          marginBottom: 28,
          backgroundColor: "var(--card, #ffffff)",
          borderRadius: "var(--radius, 6px)",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FileCheck2 size={18} color="var(--red, #b3212f)" />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-muted, #64748b)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Approval yang memerlukan tindakan Anda
            </span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: pendingCount > 0 ? "var(--red, #b3212f)" : "var(--text, #0f172a)", lineHeight: 1 }}>
            {loading ? <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} /> : pendingCount}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary, #64748b)", marginTop: 6 }}>
            {pendingCount > 0
              ? `${pendingCount} dokumen pengajuan laporan siap untuk Anda tinjau dan setujui.`
              : "Semua pengajuan yang ditugaskan kepada Anda telah selesai diproses."}
          </div>
        </div>

        <Link
          href="/approval?tab=todo"
          className="btn btn-primary"
          style={{
            height: 38,
            padding: "0 20px",
            fontSize: 13,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span>Buka Antrean Approval</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      {/* Executive Overview: 4 Pillar Dashboards */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Ringkasan Analisis Manajemen Katering
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
              Kondisi hasil pemantauan 4 pilar analitik sebelum Anda mengambil keputusan approval laporan.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {/* 1. Kalori */}
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 6px)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                  <Utensils size={15} style={{ color: "var(--red, #b3212f)" }} />
                  Kalori
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: summary?.kalori?.has_data ? "var(--green-bg, #f0fdf4)" : "var(--bg-subtle, #f1f5f9)",
                    color: summary?.kalori?.has_data ? "var(--green, #15803d)" : "var(--text-muted, #64748b)",
                    border: `1px solid ${summary?.kalori?.has_data ? "#bbf7d0" : "var(--border, #cbd5e1)"}`,
                  }}
                >
                  {summary?.kalori?.has_data ? `${summary.kalori.compliance_pct}% Standard` : "Belum Ada Data"}
                </span>
              </div>

              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text, #0f172a)", marginBottom: 4 }}>
                {summaryLoading ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : summary?.kalori?.has_data ? (
                  `${summary.kalori.avg_kalori.toLocaleString("id-ID")} kkal`
                ) : (
                  "—"
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", minHeight: 32 }}>
                {summary?.kalori?.has_data ? (
                  <>
                    <strong>{summary.kalori.compliant_count}</strong> dari {summary.kalori.total_count} pemeriksaan memenuhi &gt;=900 kkal.
                  </>
                ) : (
                  "Tidak ada pemeriksaan tercatat pada periode ini."
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
                Periode: {summary?.kalori?.bulan_nama ? `${summary.kalori.bulan_nama} ${summary.kalori.tahun}` : "Bulan Berjalan"}
              </div>
            </div>

            <Link
              href="/management/kalori"
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid var(--border-subtle, #f1f5f9)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--red, #b3212f)",
                textDecoration: "none",
              }}
            >
              <span>Buka Analisis Kalori</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 2. Punishment */}
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 6px)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                  <AlertTriangle size={15} style={{ color: "var(--amber, #b45309)" }} />
                  Punishment
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: summary?.punishment?.status === "FINAL" ? "var(--green-bg, #f0fdf4)" : "var(--amber-bg, #fffbeb)",
                    color: summary?.punishment?.status === "FINAL" ? "var(--green, #15803d)" : "var(--amber, #b45309)",
                    border: `1px solid ${summary?.punishment?.status === "FINAL" ? "#bbf7d0" : "var(--amber-light, #fde68a)"}`,
                  }}
                >
                  {summary?.punishment?.has_data ? summary.punishment.status : "Belum Ada Data"}
                </span>
              </div>

              <div style={{ fontSize: 24, fontWeight: 900, color: (summary?.punishment?.total_sanksi ?? 0) > 0 ? "var(--red, #b3212f)" : "var(--text, #0f172a)", marginBottom: 4 }}>
                {summaryLoading ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : summary?.punishment?.has_data ? (
                  `Rp ${summary.punishment.total_sanksi.toLocaleString("id-ID")}`
                ) : (
                  "—"
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", minHeight: 32 }}>
                {summary?.punishment?.has_data ? (
                  <>
                    <strong>{summary.punishment.caterings_with_sanksi}</strong> katering disanksi. Domain dominan: <strong>{summary.punishment.top_domain}</strong>.
                  </>
                ) : (
                  "Belum ada laporan sanksi operasional periode ini."
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
                Periode: {summary?.punishment?.periode_nama || "Bulan Berjalan"}
              </div>
            </div>

            <Link
              href="/management/punishment"
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid var(--border-subtle, #f1f5f9)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--red, #b3212f)",
                textDecoration: "none",
              }}
            >
              <span>Buka Analisis Punishment</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 3. Performance */}
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 6px)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                  <Award size={15} style={{ color: "#2563eb" }} />
                  Performance
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: summary?.performance?.status === "FINAL" ? "var(--green-bg, #f0fdf4)" : "var(--amber-bg, #fffbeb)",
                    color: summary?.performance?.status === "FINAL" ? "var(--green, #15803d)" : "var(--amber, #b45309)",
                    border: `1px solid ${summary?.performance?.status === "FINAL" ? "#bbf7d0" : "var(--amber-light, #fde68a)"}`,
                  }}
                >
                  {summary?.performance?.has_data ? summary.performance.status : "Belum Ada Data"}
                </span>
              </div>

              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text, #0f172a)", marginBottom: 4 }}>
                {summaryLoading ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : summary?.performance?.has_data ? (
                  `${summary.performance.avg_score.toFixed(1)} / 100`
                ) : (
                  "—"
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", minHeight: 32 }}>
                {summary?.performance?.has_data ? (
                  <>
                    Grade A: <strong>{summary.performance.grade_a_count}</strong> | Grade B: <strong>{summary.performance.grade_b_count}</strong> | Grade C/D: <strong>{summary.performance.grade_c_d_count}</strong>
                  </>
                ) : (
                  "Belum ada kalkulasi performance 6 komponen."
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
                Periode: {summary?.performance?.periode_nama || "Bulan Berjalan"}
              </div>
            </div>

            <Link
              href="/management/performance"
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid var(--border-subtle, #f1f5f9)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--red, #b3212f)",
                textDecoration: "none",
              }}
            >
              <span>Buka Analisis Performance</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 4. Reward & Punishment */}
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius, 6px)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--text, #0f172a)" }}>
                  <Scale size={15} style={{ color: "var(--red, #b3212f)" }} />
                  Reward &amp; Punishment
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    backgroundColor: summary?.reward_punishment?.status === "FINAL" ? "var(--green-bg, #f0fdf4)" : "var(--amber-bg, #fffbeb)",
                    color: summary?.reward_punishment?.status === "FINAL" ? "var(--green, #15803d)" : "var(--amber, #b45309)",
                    border: `1px solid ${summary?.reward_punishment?.status === "FINAL" ? "#bbf7d0" : "var(--amber-light, #fde68a)"}`,
                  }}
                >
                  {summary?.reward_punishment?.has_data ? summary.reward_punishment.status : "Belum Ada Data"}
                </span>
              </div>

              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text, #0f172a)", marginBottom: 4 }}>
                {summaryLoading ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : summary?.reward_punishment?.has_data ? (
                  `${summary.reward_punishment.total_hasil_perhitungan.toLocaleString("id-ID")} porsi`
                ) : (
                  "—"
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary, #64748b)", minHeight: 32 }}>
                {summary?.reward_punishment?.has_data ? (
                  <>
                    Order: {summary.reward_punishment.total_order_berjalan.toLocaleString("id-ID")} | Sanksi: {summary.reward_punishment.total_sanksi.toLocaleString("id-ID")} | Reward: +{summary.reward_punishment.total_reward.toLocaleString("id-ID")}
                  </>
                ) : (
                  "Belum ada penyesuaian porsi Grup A/B."
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
                Periode: {summary?.reward_punishment?.nama_periode || "Bulan Berjalan"}
              </div>
            </div>

            <Link
              href="/management/reward-punishment"
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: "1px solid var(--border-subtle, #f1f5f9)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--red, #b3212f)",
                textDecoration: "none",
              }}
            >
              <span>Buka Analisis R&amp;P</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 1: MENUNGGU REVIEW */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              MENUNGGU REVIEW
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
              Daftar pengajuan laporan yang saat ini aktif pada urutan approval Anda.
            </p>
          </div>
          {pendingReviewItems.length > 0 && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 12,
                backgroundColor: "var(--red-bg, #fef2f2)",
                color: "var(--red, #b3212f)",
                border: "1px solid var(--red-light, #fee2e2)",
              }}
            >
              {pendingReviewItems.length} Menunggu
            </span>
          )}
        </div>

        <div
          style={{
            backgroundColor: "var(--card, #ffffff)",
            borderRadius: "var(--radius, 6px)",
            border: "1px solid var(--border, #e2e8f0)",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>FILE</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>DIAJUKAN OLEH</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>TANGGAL</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>TAHAP</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", textAlign: "right" }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }} />
                      Memuat antrean review...
                    </td>
                  </tr>
                ) : pendingReviewItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      <CheckCircle2 size={24} color="#16a34a" style={{ margin: "0 auto 8px" }} />
                      <div style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>Tidak ada dokumen menunggu review</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Saat ini tidak ada laporan yang memerlukan tindakan otorisasi Anda.</div>
                    </td>
                  </tr>
                ) : (
                  pendingReviewItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border, #f1f5f9)",
                        backgroundColor: "var(--card, #ffffff)",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {getFileIcon(item.original_filename)}
                          <span style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
                            {item.original_filename}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #475569)" }}>
                        {item.requester?.nama || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #475569)", fontSize: 12.5 }}>
                        {formatDate(item.requested_at)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.current_approver ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              backgroundColor: "var(--amber-bg, #fffbeb)",
                              color: "var(--amber, #b45309)",
                              border: "1px solid var(--amber-light, #fde68a)",
                            }}
                          >
                            Tahap {item.current_approver.sequence} dari {item.current_approver.total}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <Link
                          href={`/approval?id=${item.id}&tab=todo`}
                          className="btn btn-primary"
                          style={{
                            height: 28,
                            padding: "0 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "none",
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: RIWAYAT TERBARU */}
      <div>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            RIWAYAT TERBARU
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary, #64748b)", margin: "2px 0 0 0" }}>
            Dokumen yang telah selesai Anda proses atau pengajuan sebelumnya.
          </p>
        </div>

        <div
          style={{
            backgroundColor: "var(--card, #ffffff)",
            borderRadius: "var(--radius, 6px)",
            border: "1px solid var(--border, #e2e8f0)",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>FILE</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>STATUS</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>TANGGAL DIPROSES</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", textAlign: "right" }}>RINCIAN</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }} />
                      Memuat riwayat...
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      Belum ada riwayat persetujuan dokumen.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((item) => {
                    // Temukan data step approver ini
                    const myStep = item.approvers?.find(
                      (a) => a.email.toLowerCase() === user?.email?.toLowerCase() || a.name.toLowerCase() === user?.nama?.toLowerCase()
                    );
                    const processedDate = myStep?.reviewed_at || item.requested_at;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid var(--border, #f1f5f9)",
                          backgroundColor: "var(--card, #ffffff)",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {getFileIcon(item.original_filename)}
                            <span style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
                              {item.original_filename}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {item.status === "PENDING" && (item.my_step?.status === "APPROVED" || myStep?.status === "APPROVED") ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 3,
                                fontSize: 11.5,
                                fontWeight: 700,
                                backgroundColor: "var(--green-bg, #f0fdf4)",
                                border: "1px solid #bbf7d0",
                                color: "var(--green, #15803d)",
                              }}
                            >
                              <CheckCircle2 size={12} />
                              Disetujui Anda
                            </span>
                          ) : (
                            getStatusBadge(item.status)
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #475569)", fontSize: 12.5 }}>
                          {formatDate(processedDate)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <Link
                            href={`/approval?id=${item.id}&tab=history`}
                            className="btn btn-outline"
                            style={{
                              height: 28,
                              padding: "0 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              textDecoration: "none",
                            }}
                          >
                            Lihat
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
