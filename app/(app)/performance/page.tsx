"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileBarChart2,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Info,
  History,
  X,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Trash2,
  Save,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import {
  PerformancePreviewResponse,
  PerformanceCateringItem,
  PerformanceReportListItem,
  getPerformancePreviewApi,
  createPerformanceDraftApi,
  exportPerformancePreviewExcelApi,
  listPerformanceReportsApi,
  getPerformanceReportDetailApi,
  deletePerformanceDraftApi,
  exportPerformanceReportExcelApi,
  finalizePerformanceReportApi,
} from "@/lib/api";
import AuditCompletenessWarning from "@/components/AuditCompletenessWarning";
import IndoDatePicker from "@/components/IndoDatePicker";

const BULAN_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

export default function PerformancePage() {
  const { showToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [tanggalDibuat, setTanggalDibuat] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [previewData, setPreviewData] = useState<PerformancePreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Modal Detail
  const [detailVendor, setDetailVendor] = useState<PerformanceCateringItem | null>(null);

  // History Drawer / Modal
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PerformanceReportListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showStatusDetail, setShowStatusDetail] = useState<boolean>(false);
  const [showAuditBlockedModal, setShowAuditBlockedModal] = useState<boolean>(false);
  const [auditBlockedMissingNames, setAuditBlockedMissingNames] = useState<string[]>([]);
  const [finalizingReport, setFinalizingReport] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Load preview data
  const fetchPreview = async (m: number, y: number, tgl?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPerformancePreviewApi(m, y, tgl);
      setPreviewData(data);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data preview performance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
  }, [selectedMonth, selectedYear, tanggalDibuat]);

  useEffect(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = `${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}`;
    setLastUpdated(`${dateStr}, ${timeStr}`);
  }, [previewData]);

  // Handler: Hitung Ulang
  const handleRecalculate = async () => {
    try {
      await fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
      showToast("Data performa berhasil diperbarui.", "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal menghitung ulang data performa.", "error");
    }
  };

  // Filtered Caterings
  const filteredCaterings = useMemo(() => {
    if (!previewData?.caterings) return [];
    if (!searchQuery.trim()) return previewData.caterings;
    const q = searchQuery.toLowerCase().trim();
    return previewData.caterings.filter((c) =>
      c.catering_nama.toLowerCase().includes(q)
    );
  }, [previewData, searchQuery]);

  // Handler: Finalisasi Laporan Performance
  const handleFinalizeReport = async (reportId: number) => {
    if (previewData?.audit_completeness && !previewData.audit_completeness.is_complete) {
      setAuditBlockedMissingNames(
        previewData.audit_completeness.missing_caterings.map((c) => c.nama)
      );
      setShowAuditBlockedModal(true);
      return;
    }

    if (previewData?.finalization_blocked || !previewData?.is_complete) {
      showToast(
        `Finalisasi diblokir: ${previewData?.finalization_block_reason || "Data penilaian Kebersihan Kantin belum dikonfirmasi."}`,
        "error"
      );
      return;
    }

    setFinalizingReport(true);
    try {
      const res = await finalizePerformanceReportApi(reportId);
      showToast(res.message || "Laporan performance berhasil difinalisasi.", "success");
      fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
      if (historyOpen) {
        handleOpenHistory();
      }
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("Data Audit Belum Lengkap")) {
        const missingNames =
          previewData?.audit_completeness?.missing_caterings.map((c) => c.nama) || [];
        setAuditBlockedMissingNames(missingNames);
        setShowAuditBlockedModal(true);
      } else {
        showToast(errMsg || "Gagal memfinalisasi laporan performance.", "error");
      }
    } finally {
      setFinalizingReport(false);
    }
  };

  const handleFinalizeClick = () => {
    if (previewData?.audit_completeness && !previewData.audit_completeness.is_complete) {
      setAuditBlockedMissingNames(
        previewData.audit_completeness.missing_caterings.map((c) => c.nama)
      );
      setShowAuditBlockedModal(true);
      return;
    }
    if (previewData?.finalization_blocked || !previewData?.is_complete) {
      showToast(
        `Finalisasi diblokir: ${previewData?.finalization_block_reason || "Data penilaian Kebersihan Kantin belum dikonfirmasi."}`,
        "error"
      );
      return;
    }
    if (previewData?.existing_report?.id) {
      handleFinalizeReport(previewData.existing_report.id);
    } else {
      showToast("Simpan draft laporan terlebih dahulu sebelum melakukan finalisasi.", "info");
    }
  };

  // Handler: Simpan Draft
  const handleSaveDraft = async () => {
    if (!previewData) return;
    setSavingDraft(true);
    try {
      const res = await createPerformanceDraftApi({
        bulan_laporan: selectedMonth,
        tahun_laporan: selectedYear,
        tanggal_dibuat: tanggalDibuat,
        notes: notes.trim() || undefined,
      });
      showToast(res.message || "Draft laporan performance berhasil disimpan.", "success");
      // Refresh preview to update existing_report status
      fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
    } catch (err: any) {
      showToast(err?.message || "Gagal menyimpan draft performance.", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  // Handler: Export Draft Excel
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const { blob, filename } = await exportPerformancePreviewExcelApi(
        selectedMonth,
        selectedYear,
        tanggalDibuat
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Workbook Excel berhasil diunduh (${filename}).`, "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal mengunduh file Excel.", "error");
    } finally {
      setExportingExcel(false);
    }
  };

  // Handler: Riwayat Laporan
  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const list = await listPerformanceReportsApi();
      setHistoryList(list);
    } catch (err: any) {
      showToast("Gagal memuat riwayat laporan.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    if (!confirm(`Hapus draft laporan #${id}?`)) return;
    try {
      await deletePerformanceDraftApi(id);
      showToast("Draft laporan berhasil dihapus.", "success");
      setHistoryList((prev) => prev.filter((item) => item.id !== id));
      fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus draft.", "error");
    }
  };

  const handleExportSavedReport = async (id: number) => {
    try {
      const { blob, filename } = await exportPerformanceReportExcelApi(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("File Excel berhasil diunduh.", "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal mengunduh file.", "error");
    }
  };

  return (
    <div className="perf-page-container">
      {/* 1. Header Halaman */}
      <header className="perf-header-wrapper">
        <div className="perf-header-left">
          <div className="perf-header-title-row">
            <FileBarChart2 size={28} className="perf-header-icon" aria-hidden="true" />
            <h1 className="perf-header-title">
              Performance Catering
            </h1>
          </div>
          <p className="perf-header-desc">
            Evaluasi performa bulanan supplier katering berdasarkan enam komponen penilaian PT JAI.
          </p>
        </div>

        <div className="perf-header-right">
          <Clock size={14} className="perf-meta-icon" aria-hidden="true" />
          <span>Terakhir diperbarui {lastUpdated || "28 September 2026, 11.58"}</span>
        </div>
      </header>

      {/* 2. Hierarki Tombol Aksi */}
      <div className="perf-action-bar" role="toolbar" aria-label="Aksi Laporan Performance">
        {/* 1. Riwayat Draft - secondary/ghost */}
        <button
          type="button"
          onClick={handleOpenHistory}
          className="perf-btn perf-btn-secondary"
          aria-label="Lihat riwayat draft laporan performance"
        >
          <History size={16} aria-hidden="true" />
          <span>Riwayat Draft</span>
        </button>

        {/* 2. Export Excel - secondary outline */}
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exportingExcel || loading}
          className="perf-btn perf-btn-export"
          aria-label="Export laporan ke Excel"
        >
          <Download size={16} aria-hidden="true" />
          <span>{exportingExcel ? "Mengunduh..." : "Export Excel"}</span>
        </button>

        {/* 3. Simpan Draft - primary merah PT JAI */}
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={savingDraft || loading}
          className="perf-btn perf-btn-primary"
          aria-label="Simpan perubahan sebagai draft laporan"
        >
          <Save size={16} aria-hidden="true" />
          <span>{savingDraft ? "Menyimpan..." : "Simpan Draft"}</span>
        </button>

        {/* 4. Finalisasi */}
        <button
          type="button"
          onClick={handleFinalizeClick}
          disabled={finalizingReport}
          className={`perf-btn ${
            (previewData?.audit_completeness && !previewData.audit_completeness.is_complete) ||
            previewData?.finalization_blocked ||
            !previewData?.is_complete
              ? "perf-btn-disabled"
              : "perf-btn-primary"
          }`}
          title={
            previewData?.audit_completeness && !previewData.audit_completeness.is_complete
              ? `Data Audit Belum Lengkap: ${previewData.audit_completeness.message}`
              : previewData?.finalization_blocked
              ? previewData?.finalization_block_reason
              : "Finalisasi Laporan Performance"
          }
          aria-label="Finalisasi Laporan Performance"
        >
          <ShieldAlert size={16} aria-hidden="true" />
          <span>{finalizingReport ? "Memproses..." : "Finalisasi"}</span>
        </button>
      </div>

      {/* Peringatan Kelengkapan Audit */}
      {previewData?.audit_completeness && !previewData.audit_completeness.is_complete && (
        <AuditCompletenessWarning
          missingCaterings={previewData.audit_completeness.missing_caterings}
        />
      )}

      {/* 3. Peringatan Status Laporan: Ringkas & Terstruktur */}
      <section
        role="status"
        aria-live="polite"
        className="perf-status-panel"
      >
        <div className="perf-status-top">
          {previewData?.is_complete ? (
            <CheckCircle2 size={18} className="perf-status-icon" style={{ color: "var(--success, #16a34a)" }} aria-hidden="true" />
          ) : (
            <AlertTriangle size={18} className="perf-status-icon" aria-hidden="true" />
          )}
          <div className="perf-status-body">
            <div className="perf-status-title-row">
              <h2 className="perf-status-title">
                {previewData?.is_complete ? "Laporan Lengkap & Siap Difinalisasi" : "Laporan Belum Lengkap"}
              </h2>
              <span
                className="perf-status-badge"
                style={previewData?.is_complete ? { background: "rgba(22, 163, 74, 0.12)", color: "#16a34a" } : undefined}
              >
                {previewData?.status === "final" ? "Final" : previewData?.is_complete ? "Siap Finalisasi" : "Draft"}
              </span>
            </div>
            <p className="perf-status-desc">
              {previewData?.is_complete
                ? "Seluruh 6 komponen penilaian (termasuk Kebersihan Kantin) telah lengkap dan terverifikasi. Laporan siap difinalisasi oleh Administrator."
                : (previewData?.finalization_block_reason || "Penilaian Kebersihan Kantin dan Kedisiplinan belum lengkap. Total skor dan grade resmi belum tersedia.")}
            </p>
            <button
              type="button"
              onClick={() => setShowStatusDetail(!showStatusDetail)}
              className="perf-status-detail-btn"
              aria-expanded={showStatusDetail}
            >
              {showStatusDetail ? "Sembunyikan detail" : "Lihat detail"}
            </button>

            {showStatusDetail && (
              <div className="perf-status-detail-content">
                {previewData?.is_complete
                  ? "Seluruh komponen evaluasi katering memenuhi standar integritas data (Terlambat, Menu & Kelayakan, Pencapaian Kalori, Komplain, Audit Dapur, serta Kebersihan Kantin & Kedisiplinan)."
                  : "Sesuai Keputusan Operasional PT JAI, nilai subtotal 5 komponen sementara (maks. 90) ditampilkan untuk pemantauan harian. Finalisasi resmi dan kalkulasi Grade (A/B/C/D) membutuhkan data Kebersihan Kantin berstatus final."}
              </div>
            )}

            {!previewData?.is_complete && previewData?.finalization_block_reason?.includes("Kebersihan") && (
              <div style={{ marginTop: 12 }}>
                <Link
                  href={`/kebersihan?bulan=${selectedMonth}&tahun=${selectedYear}&periode_mulai=${previewData?.periode_mulai || ""}&periode_selesai=${previewData?.periode_selesai || ""}`}
                  className="perf-status-detail-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    background: "rgba(180, 83, 9, 0.12)",
                    color: "#b45309",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: "13px",
                    textDecoration: "none",
                    border: "1px solid rgba(180, 83, 9, 0.3)",
                  }}
                  title="Buka modul Kebersihan Kantin untuk melengkapi penilaian"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Kelola Kebersihan Kantin</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Peringatan Duplikasi Kalori (jika ada) */}
      {previewData?.warnings && previewData.warnings.length > 0 && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "var(--radius, 8px)",
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
          role="alert"
        >
          <AlertTriangle size={18} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div style={{ fontSize: 13.5, color: "#991b1b", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: 4, fontWeight: 650 }}>
              Peringatan Duplikasi Data Kalori Terdeteksi ({previewData.warnings.length} kejadian)
            </strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {previewData.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.9 }}>
              Sistem secara otomatis menggunakan record terbaru berdasarkan tanggal update/ID dan mengabaikan entri duplikat lama.
            </span>
          </div>
        </div>
      )}

      {/* 4. Panel Periode Laporan */}
      <div className="perf-filter-panel">
        <div className="perf-filter-header">
          <h2 className="perf-filter-title">Periode laporan</h2>
          <p className="perf-filter-subtitle">
            Pilih bulan laporan dan tanggal pembuatan. Rentang transaksi ditentukan otomatis oleh sistem.
          </p>
        </div>

        <div className="perf-filter-grid">
          {/* Bulan */}
          <div className="perf-field-group">
            <label htmlFor="select-bulan" className="perf-field-label">
              Bulan laporan
            </label>
            <select
              id="select-bulan"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="perf-select"
            >
              {BULAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tahun */}
          <div className="perf-field-group">
            <label htmlFor="input-tahun" className="perf-field-label">
              Tahun
            </label>
            <input
              id="input-tahun"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              min={2020}
              max={2035}
              className="perf-input"
            />
          </div>

          {/* Tanggal Pembuatan */}
          <div className="perf-field-group">
            <label htmlFor="input-tanggal-dibuat" className="perf-field-label">
              Tanggal dibuat
            </label>
            <IndoDatePicker
              id="input-tanggal-dibuat"
              value={tanggalDibuat}
              onChange={(e) => setTanggalDibuat(e.target.value)}
              className="perf-input"
            />
          </div>

          {/* Periode Data Transaksi (Read-only) */}
          <div className="perf-field-group">
            <label className="perf-field-label">
              Periode transaksi
            </label>
            <div className="perf-periode-box" aria-readonly="true">
              <Calendar size={18} className="perf-periode-cal-icon" aria-hidden="true" />
              <div className="perf-periode-text-group">
                <span className="perf-periode-main">
                  {previewData ? previewData.nama_periode.replace(" - ", "–") : "Menghitung periode…"}
                </span>
                {previewData?.nama_periode_lalu && (
                  <span className="perf-periode-prev">
                    Periode sebelumnya: {previewData.nama_periode_lalu.replace(" - ", "–")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Hitung Ulang */}
          <div className="perf-field-group">
            <button
              type="button"
              onClick={() => {
                fetchPreview(selectedMonth, selectedYear, tanggalDibuat);
                showToast("Memperbarui data performa...", "info", { autoCloseMs: 2000 });
              }}
              disabled={loading}
              className="perf-btn-recalc"
              title="Hitung ulang data performa"
              aria-label="Hitung ulang data performa"
            >
              <RefreshCw
                size={15}
                className={`perf-recalc-icon ${loading ? "anim-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{loading ? "Menghitung…" : "Hitung Ulang"}</span>
            </button>
          </div>
        </div>

        {/* Existing Draft indicator */}
        {previewData?.existing_report && (
          <div className="perf-draft-notice">
            <Info size={15} aria-hidden="true" />
            <span>
              Draft tersimpan terdeteksi untuk periode ini (ID #{previewData.existing_report.id}, dibuat {previewData.existing_report.created_at?.split("T")[0]}).
            </span>
          </div>
        )}
      </div>

      {/* 4. Ringkasan Kartu Statistik */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 8px)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: 4 }}>
            KATERING DINILAI
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text, #0f172a)" }}>
            {previewData?.total_caterings ?? 0} Vendor
          </div>
          <div style={{ fontSize: 11.5, color: "#16a34a", marginTop: 4 }}>
            Seluruh katering aktif
          </div>
        </div>

        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 8px)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: 4 }}>
            {previewData?.summary?.rata_rata_total !== null && previewData?.summary?.rata_rata_total !== undefined
              ? "RATA-RATA TOTAL SKOR"
              : "RATA-RATA SUBTOTAL SEMENTARA"}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text, #0f172a)" }}>
            {previewData?.summary?.rata_rata_total !== null && previewData?.summary?.rata_rata_total !== undefined ? (
              <>
                {previewData.summary.rata_rata_total.toFixed(1)}
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted, #64748b)" }}> / 100</span>
              </>
            ) : (
              <>
                {previewData?.summary?.rata_rata_subtotal_5?.toFixed(1) ?? "-"}
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted, #64748b)" }}> / 90</span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: previewData?.summary?.rata_rata_total !== null && previewData?.summary?.rata_rata_total !== undefined ? "#16a34a" : "#ca8a04",
              marginTop: 4,
            }}
          >
            {previewData?.summary?.rata_rata_total !== null && previewData?.summary?.rata_rata_total !== undefined
              ? "6 Komponen Lengkap"
              : "5 Komponen (tanpa Kebersihan)"}
          </div>
        </div>

        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 8px)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: 4 }}>
            STATUS KEBERSIHAN
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: previewData?.is_complete ? "#16a34a" : "#d97706" }}>
            {previewData?.is_complete ? "Lengkap (Final)" : "Belum Lengkap"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 4 }}>
            {previewData?.is_complete ? "Skor terintegrasi ke Total" : "Menunggu finalisasi Kebersihan"}
          </div>
        </div>

        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 8px)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: 4 }}>
            FORMULA AUDIT (TERKUNCI)
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0284c7" }}>
            Nilai Audit (1160 Poin)
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 4 }}>
            Total Poin / 1160 &times; 100%
          </div>
        </div>
      </div>

      {/* 5. Tabel Utama Performance */}
      <div
        style={{
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 8px)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        {/* Table Top Bar: Search */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text, #0f172a)" }}>
            Daftar Evaluasi Katering ({filteredCaterings.length} Vendor)
          </div>

          <div style={{ position: "relative", minWidth: 240 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted, #94a3b8)",
              }}
            />
            <input
              type="text"
              placeholder="Cari katering..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 12px 6px 32px",
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: 13,
                background: "var(--card, #ffffff)",
                color: "var(--text, #0f172a)",
              }}
            />
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <div>Menghitung kalkulasi data performance...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
            <AlertTriangle size={24} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontWeight: 600 }}>{error}</div>
            <button
              onClick={() => fetchPreview(selectedMonth, selectedYear, tanggalDibuat)}
              style={{
                marginTop: 12,
                padding: "6px 14px",
                borderRadius: 4,
                border: "1px solid #dc2626",
                background: "transparent",
                color: "#dc2626",
                cursor: "pointer",
                fontSize: 12.5,
              }}
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredCaterings.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            Tidak ada data katering yang cocok.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.03)", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                  <th style={{ padding: "10px 12px", width: 45, textAlign: "center" }}>No</th>
                  <th style={{ padding: "10px 14px", minWidth: 150 }}>Catering</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }} title="Max 30">Terlambat (30)</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }} title="Max 20">Kelayakan (20)</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }} title="Max 15">Kalori (15)</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }} title="Max 15">Komplain (15)</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }} title="Max 10">Audit (10)</th>
                  <th style={{ padding: "10px 10px", textAlign: "center", color: previewData?.is_complete ? "inherit" : "#d97706" }} title="Max 10">
                    Kebersihan (10)
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, background: "rgba(245, 158, 11, 0.06)" }}>
                    Subtotal sementara (maks. 90)
                  </th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }}>Total Resmi</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }}>Grade</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }}>Total Lalu</th>
                  <th style={{ padding: "10px 10px", textAlign: "center" }}>Grade Lalu</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Action</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", width: 100 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaterings.map((c, idx) => (
                  <tr
                    key={c.catering_id}
                    style={{
                      borderBottom: "1px solid var(--border, #e2e8f0)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text, #0f172a)" }}>
                      {c.catering_nama}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.terlambat.score !== null ? c.terlambat.score : "-"}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.kelayakan.score !== null ? c.kelayakan.score : <span style={{ color: "#ca8a04" }}>-</span>}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.kalori.score !== null ? c.kalori.score : <span style={{ color: "#ca8a04" }}>-</span>}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.komplain.score !== null ? c.komplain.score : "-"}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.audit.score !== null ? c.audit.score : <span style={{ color: "#ca8a04" }}>-</span>}
                    </td>

                    {/* Kebersihan */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.kebersihan?.score !== null && c.kebersihan?.score !== undefined ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: c.kebersihan.score >= 8 ? "#16a34a" : c.kebersihan.score >= 6 ? "#ca8a04" : "#dc2626",
                          }}
                          title={`Kondisi: ${c.kebersihan.kondisi || c.kebersihan.kondisi_kebersihan}, Disiplin: ${c.kebersihan.melanggar_disiplin ? "Melanggar" : "Tertib"}`}
                        >
                          {c.kebersihan.score.toFixed(1)}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontStyle: "italic",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#b45309",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.kebersihan?.status === "draft" ? "Draft" : "Belum Dinilai"}
                        </span>
                      )}
                    </td>

                    {/* Subtotal Sementara 5 Komponen */}
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 700,
                        background: "rgba(245, 158, 11, 0.06)",
                        color: "var(--text, #0f172a)",
                      }}
                    >
                      {c.subtotal_5_komponen.toFixed(1)}
                    </td>

                    {/* Total Resmi */}
                    <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700 }}>
                      {c.total_score !== null && c.total_score !== undefined ? (
                        <span style={{ fontSize: 13, color: "var(--primary, #2563eb)" }}>
                          {c.total_score.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--text-muted, #94a3b8)", fontWeight: 400 }}>Belum lengkap</span>
                      )}
                    </td>

                    {/* Grade */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {c.grade ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: 12,
                            background:
                              c.grade === "A"
                                ? "rgba(22, 163, 74, 0.15)"
                                : c.grade === "B"
                                ? "rgba(37, 99, 235, 0.15)"
                                : c.grade === "C"
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              c.grade === "A"
                                ? "#16a34a"
                                : c.grade === "B"
                                ? "#2563eb"
                                : c.grade === "C"
                                ? "#ca8a04"
                                : "#dc2626",
                          }}
                        >
                          {c.grade}
                        </span>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--text-muted, #94a3b8)" }}>Belum lengkap</span>
                      )}
                    </td>

                    {/* Total Bulan Lalu */}
                    <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontStyle: "italic" }}>
                      {c.periode_lalu?.total_score !== null && c.periode_lalu?.total_score !== undefined
                        ? c.periode_lalu.total_score
                        : "Belum tersedia"}
                    </td>

                    {/* Grade Bulan Lalu */}
                    <td style={{ padding: "10px 10px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontStyle: "italic" }}>
                      {c.periode_lalu?.grade || "-"}
                    </td>

                    {/* Action */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {c.action ? (
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text, #0f172a)" }}>{c.action}</span>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--text-muted, #94a3b8)" }}>Belum lengkap</span>
                      )}
                    </td>

                    {/* Aksi Button */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setDetailVendor(c)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          borderRadius: "var(--radius-sm, 6px)",
                          background: "var(--card, #ffffff)",
                          border: "1px solid var(--border, #cbd5e1)",
                          color: "var(--text, #0f172a)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <Eye size={13} />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Modal Detail Vendor */}
      {detailVendor && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDetailVendor(null)}
        >
          <div
            style={{
              background: "var(--card, #ffffff)",
              borderRadius: "var(--radius, 8px)",
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text, #0f172a)" }}>
                  Detail Performance: {detailVendor.catering_nama}
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--text-muted, #64748b)" }}>
                  Periode: {previewData?.nama_periode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailVendor(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #64748b)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Rincian Komponen */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {/* 1. Terlambat */}
              <div style={{ padding: 12, background: "rgba(15, 23, 42, 0.02)", borderRadius: 6, border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>1. Terlambat Datang Saat Pengiriman</span>
                  <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    Skor: {detailVendor.terlambat.score} / 30
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Data mentah: {detailVendor.terlambat.raw_label} (0 kali: 30, 1 kali: 20, 2–3 kali: 10, &gt;3 kali: 0)
                </div>
              </div>

              {/* 2. Kelayakan */}
              <div style={{ padding: 12, background: "rgba(15, 23, 42, 0.02)", borderRadius: 6, border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>2. Menu &amp; Kelayakan</span>
                  <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    Skor: {detailVendor.kelayakan.score !== null ? detailVendor.kelayakan.score : "-"} / 20
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Kesesuaian: {detailVendor.kelayakan.raw_label} (&gt;80%: 20, 65–80%: 10, &lt;65%: 5)
                </div>
              </div>

              {/* 3. Kalori */}
              <div style={{ padding: 12, background: "rgba(15, 23, 42, 0.02)", borderRadius: 6, border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>3. Pencapaian Kalori (&ge; 900 kkal)</span>
                  <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    Skor: {detailVendor.kalori.score !== null ? detailVendor.kalori.score : "-"} / 15
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Per shift: {detailVendor.kalori.raw_label} (100%: 15, 80–99%: 12, 60–79%: 8, &lt;60%: 5)
                </div>
              </div>

              {/* 4. Komplain */}
              <div style={{ padding: 12, background: "rgba(15, 23, 42, 0.02)", borderRadius: 6, border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>4. Komplain</span>
                  <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    Skor: {detailVendor.komplain.score} / 15
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Total kejadian: {detailVendor.komplain.raw_label} (0: 15, 1–2: 12, 3–4: 8, &ge;5: 5)
                </div>
              </div>

              {/* 5. Audit */}
              <div style={{ padding: 12, background: "rgba(15, 23, 42, 0.02)", borderRadius: 6, border: "1px solid var(--border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>5. Hasil Audit Dapur Supplier Katering</span>
                  <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    Skor: {detailVendor.audit.score !== null ? detailVendor.audit.score : "-"} / 10
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Rata-rata: {detailVendor.audit.raw_label} (Formula Terkunci: combined points ratio, &ge;95%: 10, 81–94%: 8, 70–80%: 6, &lt;70%: 4)
                </div>
              </div>

              {/* 6. Kebersihan */}
              <div
                style={{
                  padding: 12,
                  background: detailVendor.kebersihan?.is_complete ? "rgba(22, 163, 74, 0.05)" : "rgba(245, 158, 11, 0.06)",
                  borderRadius: 6,
                  border: detailVendor.kebersihan?.is_complete ? "1px solid rgba(22, 163, 74, 0.2)" : "1px dashed rgba(245, 158, 11, 0.4)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: detailVendor.kebersihan?.is_complete ? "#16a34a" : "#b45309" }}>
                    6. Kebersihan Kantin &amp; Kedisiplinan
                  </span>
                  <span style={{ fontWeight: 700, color: detailVendor.kebersihan?.is_complete ? "#16a34a" : "#b45309" }}>
                    Skor: {detailVendor.kebersihan?.score !== null && detailVendor.kebersihan?.score !== undefined ? `${detailVendor.kebersihan.score} / 10` : "Belum Tersedia"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: detailVendor.kebersihan?.is_complete ? "var(--text, #0f172a)" : "#92400e" }}>
                  {detailVendor.kebersihan?.is_complete
                    ? `Kondisi Fisik: ${detailVendor.kebersihan.kondisi_kebersihan || detailVendor.kebersihan.kondisi} | Kedisiplinan: ${detailVendor.kebersihan.melanggar_disiplin ? "Melanggar (Skor 4.0)" : "Tertib"}`
                    : (detailVendor.kebersihan?.note || "Sumber penilaian Kebersihan Kantin belum berstatus final.")}
                </div>
              </div>
            </div>

            {/* Subtotal & Status */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.04)",
                padding: 14,
                borderRadius: 6,
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", fontWeight: 600 }}>
                  SUBTOTAL 5 KOMPONEN SEMENTARA
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                  {detailVendor.subtotal_5_komponen.toFixed(1)} / 90
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", fontWeight: 600 }}>
                  TOTAL RESMI &amp; GRADE
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#ca8a04", fontStyle: "italic" }}>
                  Belum lengkap (Finalisasi Diblokir)
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDetailVendor(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm, 6px)",
                  background: "var(--card, #ffffff)",
                  border: "1px solid var(--border, #cbd5e1)",
                  color: "var(--text, #0f172a)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Riwayat Laporan Drawer / Modal */}
      {historyOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            style={{
              background: "var(--card, #ffffff)",
              borderRadius: "var(--radius, 8px)",
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text, #0f172a)" }}>
                Riwayat Draft Laporan Performance
              </h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted, #64748b)" }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                Memuat riwayat...
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                Belum ada draft laporan yang tersimpan.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 14,
                      borderRadius: 6,
                      border: "1px solid var(--border, #e2e8f0)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text, #0f172a)" }}>
                        Periode: {item.nama_periode} (Bulan {item.bulan_laporan}/{item.tahun_laporan})
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                        Status: <span style={{ fontWeight: 600, color: "#d97706" }}>{item.status.toUpperCase()}</span> &bull; Dibuat: {item.created_at?.split("T")[0] || "-"} &bull; {item.total_caterings} Vendor
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                          Catatan: {item.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleExportSavedReport(item.id)}
                        title="Export Excel"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 4,
                          background: "var(--card, #ffffff)",
                          border: "1px solid #16a34a",
                          color: "#16a34a",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                        }}
                      >
                        <FileSpreadsheet size={14} />
                        Excel
                      </button>

                      {item.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(item.id)}
                          title="Hapus Draft"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 4,
                            background: "transparent",
                            border: "1px solid #dc2626",
                            color: "#dc2626",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          <Trash2 size={14} />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL: Data Audit Belum Lengkap */}
      {showAuditBlockedModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-blocked-modal-title"
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#d97706", marginBottom: 14 }}>
              <AlertTriangle size={24} aria-hidden="true" />
              <h2 id="audit-blocked-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                Data Audit Belum Lengkap
              </h2>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, margin: "0 0 14px" }}>
              Finalisasi belum dapat dilakukan karena masih ada katering yang belum memiliki Audit final pada periode ini:
            </p>

            <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 6, padding: "12px 16px", marginBottom: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, fontWeight: 650, color: "#92400e", lineHeight: 1.6 }}>
                {auditBlockedMissingNames.map((name, idx) => (
                  <li key={idx}>{name}</li>
                ))}
              </ul>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: "0 0 20px" }}>
              Sesuai keputusan bisnis resmi, katering yang wajib diaudit harus memiliki record Audit berstatus <strong>FINAL</strong> (baik Tanpa Temuan maupun Dengan Temuan). Laporan tidak dapat difinalisasi jika audit masih berstatus Draft atau belum diisi.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAuditBlockedModal(false)}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
              <a
                href="/audit/riwayat"
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 6,
                  background: "#d97706",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 13.5,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Buka Modul Audit
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
