"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Utensils,
  Clock,
  MessageSquareWarning,
  ClipboardList,
  Sparkles,
  Send,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileArchive,
  File as FileIcon,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ActionCard from "@/components/ActionCard";
import { getApprovals, ApprovalItem, ApprovalListResponse, AuthUser } from "@/lib/api";

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

interface StaffDashboardProps {
  user: AuthUser | null;
}

export default function StaffDashboard({ user }: StaffDashboardProps) {
  const [myApprovals, setMyApprovals] = useState<ApprovalItem[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoadingApprovals(true);

    getApprovals({ tab: "mine" })
      .then((res) => {
        if (isMounted) {
          setMyApprovals(res.items || []);
          setLoadingApprovals(false);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat pengajuan staff:", err);
        if (isMounted) setLoadingApprovals(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const pendingCount = myApprovals.filter((a) => a.status === "PENDING").length;
  const rejectedCount = myApprovals.filter((a) => a.status === "REJECTED").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Top Header Row with Breadcrumbs & Meta Boxes */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">PT JAI / STAFF OPERASIONAL</span>
          <h1 className="page-title">Dashboard Operasional Catering</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary, #64748b)" }}>
            Selamat datang, <strong>{user?.nama}</strong>. Catat hasil inspeksi katering harian dan pantau persetujuan laporan Anda.
          </p>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Primary Shortcut & Status Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
      >
        {/* Send Report Shortcut Banner */}
        <div
          className="panel"
          style={{
            padding: "22px 24px",
            marginBottom: 0,
            background: "linear-gradient(135deg, #ffffff 0%, #fdf2f2 100%)",
            border: "1px solid #fecaca",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Send size={18} color="var(--red, #b3212f)" />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--red, #b3212f)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Kirim Laporan Bulanan
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text, #0f172a)", marginBottom: 4 }}>
              Ajukan Approval Laporan (Send Report)
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary, #475569)", lineHeight: 1.5 }}>
              Unggah file laporan kinerja katering dan tentukan approver (SPV / Manajemen) secara berjenjang.
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Link
              href="/send-report"
              className="btn btn-primary"
              style={{
                height: 36,
                padding: "0 18px",
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
              }}
            >
              <Plus size={14} />
              <span>Ajukan Laporan Baru</span>
            </Link>
          </div>
        </div>

        {/* Approval Status Tracker Card */}
        <div
          className="panel"
          style={{
            padding: "22px 24px",
            marginBottom: 0,
            backgroundColor: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-muted, #64748b)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Status Pengajuan Saya
              </span>
              <FileCheck2 size={18} color="var(--text-muted, #64748b)" />
            </div>

            <div style={{ display: "flex", gap: 24, alignItems: "baseline", marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: pendingCount > 0 ? "var(--amber, #b45309)" : "var(--text, #0f172a)" }}>
                  {loadingApprovals ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : pendingCount}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", fontWeight: 600 }}>Menunggu Review</div>
              </div>

              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: rejectedCount > 0 ? "var(--red, #b3212f)" : "var(--text, #0f172a)" }}>
                  {loadingApprovals ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : rejectedCount}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", fontWeight: 600 }}>Perlu Revisi</div>
              </div>

              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text, #0f172a)" }}>
                  {loadingApprovals ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : myApprovals.length}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", fontWeight: 600 }}>Total Pengajuan</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Link
              href="/approval"
              className="btn btn-outline"
              style={{
                height: 36,
                padding: "0 16px",
                fontSize: 12.5,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
              }}
            >
              <span>Lihat Rincian Pengajuan</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* MODUL OPERASIONAL STAFF */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            TUGAS &amp; INPUT OPERASIONAL
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted, #64748b)", margin: "4px 0 0 0" }}>
            Pilih form di bawah untuk mencatat data penilaian makanan, audit fisik, komplain, atau keterlambatan katering hari ini.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          <ActionCard
            href="/kelayakan"
            title="Kelayakan Menu"
            description="Penilaian 13 kriteria kelayakan menu nasi, lauk, sayur, sambal, buah, dan kondisi rantang."
            icon={ClipboardCheck}
            iconTone="red"
            buttonLabel="Input Kelayakan"
            buttonVariant="outline"
          />

          <ActionCard
            href="/kalori-harian"
            title="Kalori Harian"
            description="Pencatatan gramasi berat dan perhitungan otomatis kecukupan kalori makanan per shift."
            icon={Utensils}
            iconTone="green"
            buttonLabel="Input Kalori"
            buttonVariant="outline"
          />

          <ActionCard
            href="/keterlambatan"
            title="Keterlambatan"
            description="Pencatatan kedatangan katering dan kalkulasi denda otomatis bila melewati toleransi jam makan."
            icon={Clock}
            iconTone="amber"
            buttonLabel="Catat Keterlambatan"
            buttonVariant="outline"
          />

          <ActionCard
            href="/komplain"
            title="Komplain Makanan"
            description="Log keluhan rasa, benda asing, atau porsi kurang dari karyawan beserta status investigasi."
            icon={MessageSquareWarning}
            iconTone="red"
            buttonLabel="Catat Komplain"
            buttonVariant="outline"
          />

          <ActionCard
            href="/audit-dapur"
            title="Audit Dapur"
            description="Inspeksi langsung sanitasi dan higiene fasilitas persiapan makanan di lokasi vendor katering."
            icon={ClipboardList}
            iconTone="default"
            buttonLabel="Mulai Audit"
            buttonVariant="outline"
          />

          <ActionCard
            href="/kebersihan-kantin"
            title="Kebersihan Kantin"
            description="Pemeriksaan kebersihan area makan, meja, lantai, dan tempat cuci tangan PT JAI."
            icon={Sparkles}
            iconTone="green"
            buttonLabel="Inspeksi Kantin"
            buttonVariant="outline"
          />
        </div>
      </div>

      {/* DAFTAR PENGAJUAN SAYA TERBARU */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text, #0f172a)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              PENGAJUAN SAYA TERBARU
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
              Status persetujuan berjenjang atas dokumen yang Anda kirimkan.
            </p>
          </div>
          <Link
            href="/approval"
            style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red, #b3212f)", textDecoration: "none" }}
          >
            Lihat Semua &rarr;
          </Link>
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
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>TANGGAL PENGAJUAN</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>PROGRESS TAHAP</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>STATUS</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", textAlign: "right" }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loadingApprovals ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }} />
                      Memuat pengajuan saya...
                    </td>
                  </tr>
                ) : myApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      <div style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>Belum ada pengajuan laporan</div>
                      <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-muted, #64748b)" }}>
                        Gunakan tombol &apos;Ajukan Laporan Baru&apos; untuk mengirimkan dokumen ke approver.
                      </div>
                    </td>
                  </tr>
                ) : (
                  myApprovals.slice(0, 5).map((item) => (
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
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
                              {item.original_filename}
                            </div>
                            {item.note && (
                              <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)" }}>
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #475569)", fontSize: 12.5 }}>
                        {formatDate(item.requested_at)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {item.current_approver ? (
                          <div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                                backgroundColor: "var(--amber-bg, #fffbeb)",
                                color: "var(--amber, #b45309)",
                                border: "1px solid var(--amber-light, #fde68a)",
                              }}
                            >
                              Tahap {item.current_approver.sequence} dari {item.current_approver.total}
                            </span>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 3 }}>
                              {item.current_approver.name} ({item.current_approver.position})
                            </div>
                          </div>
                        ) : item.status === "APPROVED" ? (
                          <span style={{ fontSize: 12, color: "var(--green, #15803d)", fontWeight: 600 }}>
                            Selesai disetujui semua
                          </span>
                        ) : item.status === "REJECTED" ? (
                          <span style={{ fontSize: 12, color: "var(--red, #b3212f)", fontWeight: 600 }}>
                            Ditolak pada tahap review
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {getStatusBadge(item.status)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <Link
                          href="/approval"
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
                          Lihat Detail
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
    </div>
  );
}
