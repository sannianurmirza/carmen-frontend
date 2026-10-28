"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  TrendingDown,
  Maximize2,
  Calendar,
  Utensils,
} from "lucide-react";
import {
  Catering,
  getCatering,
  MinusEntry,
  getMinusEntries,
  deleteMinusEntry,
  exportMinusExcelApi,
  exportMinusExcelPostApi,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useToast } from "@/context/ToastContext";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { formatNumberID } from "@/lib/formatters";
import ProtectedImage from "@/components/ProtectedImage";

const ITEMS_PER_PAGE = 10;

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const monthIdx = parseInt(m, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${parseInt(d, 10)} ${months[monthIdx]} ${y}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function MinusRiwayatPage() {
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [entries, setEntries] = useState<MinusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCatering, setFilterCatering] = useState<string>("");
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [previewDetailEntry, setPreviewDetailEntry] = useState<MinusEntry | null>(null);
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MinusEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { showToast } = useToast();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/catering-ir/api";

  async function loadData() {
    setLoading(true);
    try {
      const [catData, entryData] = await Promise.all([
        getCatering(),
        getMinusEntries(
          filterCatering ? Number(filterCatering) : undefined,
          filterStart || undefined,
          filterEnd || undefined
        ),
      ]);
      setCaterings(catData);
      setEntries(entryData);
    } catch {
      showToast({
        type: "error",
        title: "Gagal Memuat Data",
        message: "Tidak dapat terhubung ke server backend.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [filterCatering, filterStart, filterEnd]);

  const handleResetFilter = () => {
    setFilterCatering("");
    setFilterStart("");
    setFilterEnd("");
  };

  const getFullFotoUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const handleDeleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMinusEntry(deleteTarget.id);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      if (previewDetailEntry?.id === deleteTarget.id) {
        setPreviewDetailEntry(null);
      }
      showToast({
        type: "success",
        title: "Entri Dihapus",
        message: "Entri kalori minus berhasil dihapus.",
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus entri minus.");
    } finally {
      setDeleting(false);
    }
  };

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      const displayedCount = entries.length;
      const selectedCount = entries.filter((e) => selectedIds.has(e.id)).length;
      if (selectedCount > 0 && selectedCount < displayedCount) {
        headerCheckboxRef.current.indeterminate = true;
      } else {
        headerCheckboxRef.current.indeterminate = false;
      }
    }
  }, [selectedIds, entries]);

  const handleExportButtonClick = () => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set());
    } else {
      handleExportSelected();
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllToggle = () => {
    const currentIds = entries.map((e) => e.id);
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleRowSelectToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportSelected = async (singleEntryId?: number) => {
    if (isExportingExcel) return;

    const targetIds = singleEntryId !== undefined ? [singleEntryId] : Array.from(selectedIds);

    if (targetIds.length === 0) {
      showToast({
        type: "error",
        title: "Pilih Laporan",
        message: "Pilih minimal satu laporan untuk diekspor.",
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const { blob, filename } = await exportMinusExcelPostApi(targetIds);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (singleEntryId === undefined) {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
      }

      showToast({
        type: "success",
        title: "Export Berhasil",
        message: `File Excel "${filename}" telah diunduh.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Export Excel",
        message: err.message || "Terjadi kesalahan saat mengunduh file Excel.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Pagination computations
  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return entries.slice(start, start + ITEMS_PER_PAGE);
  }, [entries, currentPage]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Page Header with Breadcrumb Back Link */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link
              href="/minus"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--red)",
                textDecoration: "none",
                letterSpacing: "0.06em",
              }}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
              MANAGEMENT MINUS
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              EXPORT &amp; RIWAYAT
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Riwayat Keterangan Kalori Minus</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Filter Panel */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div
          className="panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
            <TrendingDown size={18} color="var(--red)" />
            <span>Filter Riwayat Minus</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isSelectionMode ? (
              <>
                <ExportExcelButton
                  onClick={() => handleExportSelected()}
                  disabled={selectedIds.size === 0}
                  isLoading={isExportingExcel}
                  selectedCount={selectedIds.size}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCancelSelection}
                  disabled={isExportingExcel}
                  style={{
                    height: 38,
                    fontSize: 13,
                    padding: "0 16px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  Batal
                </button>
              </>
            ) : (
              <ExportExcelButton
                onClick={handleExportButtonClick}
                isLoading={isExportingExcel}
              />
            )}
            <Link
              href="/minus/input"
              className="btn btn-solid"
              style={{
                height: 34,
                fontSize: 12,
                padding: "0 14px",
                gap: 6,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Plus size={15} />
              Input Minus Baru
            </Link>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              alignItems: "end",
            }}
          >
            {/* Filter Catering */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.5px" }}>
                KATERING
              </label>
              <select
                className="input-field"
                value={filterCatering}
                onChange={(e) => setFilterCatering(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13 }}
              >
                <option value="">Semua Katering</option>
                {caterings.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tanggal Mulai */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.5px" }}>
                TANGGAL MULAI
              </label>
              <input
                type="date"
                className="input-field"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, textAlign: "center" }}
              />
            </div>

            {/* Filter Tanggal Selesai */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.5px" }}>
                TANGGAL SELESAI
              </label>
              <input
                type="date"
                className="input-field"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, textAlign: "center" }}
              />
            </div>

            {(filterCatering || filterStart || filterEnd) && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleResetFilter}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--red)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    height: 36,
                  }}
                >
                  <RefreshCw size={14} /> Reset Filter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Matching Screenshot Layout Exactly */}
      <div className="panel">
        <div className="panel-header" style={{ justifyContent: "space-between" }}>
          <span>Daftar Entri Kalori Minus ({entries.length} Laporan)</span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                {isSelectionMode && (
                  <th style={{ width: "4%", textAlign: "center" }}>
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      disabled={isExportingExcel}
                      checked={entries.length > 0 && entries.every((e) => selectedIds.has(e.id))}
                      onChange={handleSelectAllToggle}
                      title="Pilih Semua Laporan"
                      aria-label="Pilih Semua Laporan"
                      style={{ cursor: isExportingExcel ? "not-allowed" : "pointer", width: 16, height: 16 }}
                    />
                  </th>
                )}
                <th style={{ width: "8%", textAlign: "center" }}>NO</th>
                <th style={{ width: isSelectionMode ? "30%" : "32%" }}>KATERING</th>
                <th style={{ width: isSelectionMode ? "20%" : "22%" }}>TANGGAL</th>
                <th style={{ width: "18%" }}>HASIL KALORI</th>
                <th style={{ width: "20%", textAlign: "center" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSelectionMode ? 6 : 5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                    <span className="spinner-border spinner-border-sm mr-2" /> Memuat riwayat minus...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 6 : 5} style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>
                    <TrendingDown size={36} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Belum Ada Data Kalori Minus</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                      Silakan klik tombol &quot;Input Minus Baru&quot; di atas untuk menambahkan catatan.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((row, index) => {
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const cateringNama = row.catering_nama || `Catering #${row.catering_id}`;

                  return (
                    <tr key={row.id}>
                      {isSelectionMode && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            disabled={isExportingExcel}
                            checked={selectedIds.has(row.id)}
                            onChange={() => handleRowSelectToggle(row.id)}
                            aria-label={`Pilih Laporan ${row.id}`}
                            style={{ cursor: isExportingExcel ? "not-allowed" : "pointer", width: 16, height: 16 }}
                          />
                        </td>
                      )}
                      {/* NO */}
                      <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)" }}>
                        {globalIndex}
                      </td>

                      {/* KATERING */}
                      <td style={{ fontWeight: 700, color: "var(--text)" }}>
                        {cateringNama}
                      </td>

                      {/* TANGGAL */}
                      <td style={{ fontWeight: 500 }}>
                        {formatDateDisplay(row.tanggal)}
                      </td>

                      {/* HASIL KALORI */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 6,
                            background: "var(--red-light, #fee2e2)",
                            color: "var(--red)",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {formatNumberID(row.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kkal
                        </span>
                      </td>

                      {/* ACTION (Matches screenshot 3-btn icons) */}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {/* Eye / Detail Preview Modal */}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ height: 32, width: 32, flexShrink: 0 }}
                            onClick={() => setPreviewDetailEntry(row)}
                            title="See Report / Detail Minus"
                            aria-label="See Report"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Export / Download single item to Excel */}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ height: 32, width: 32, flexShrink: 0, opacity: isExportingExcel ? 0.6 : 1 }}
                            disabled={isExportingExcel}
                            onClick={() => handleExportSelected(row.id)}
                            title="Export Harian ke Excel (.xlsx)"
                            aria-label="Export Harian ke Excel (.xlsx)"
                          >
                            <Download size={14} />
                          </button>

                          {/* Delete Entry */}
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            style={{ height: 32, width: 32, flexShrink: 0 }}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                            title="Hapus Catatan Minus"
                            aria-label="Hapus Catatan Minus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {!loading && entries.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <div>
                Showing <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{" "}
                <strong>{Math.min(currentPage * ITEMS_PER_PAGE, entries.length)}</strong> of{" "}
                <strong>{entries.length}</strong> entries
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>

                {getPaginationRange(currentPage, totalPages).map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`dots-${idx}`} style={{ padding: "0 4px", fontSize: 12 }}>
                        ...
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        height: 32,
                        minWidth: 32,
                        padding: "0 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: "var(--radius-sm, 4px)",
                        border: isActive ? "1px solid var(--red)" : "1px solid var(--border)",
                        background: isActive ? "var(--red)" : "var(--card, #ffffff)",
                        color: isActive ? "#ffffff" : "var(--text)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL PREVIEW MODAL (Triggered when Eye Icon is clicked) */}
      {previewDetailEntry && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 720, width: "92%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", marginBottom: 4 }}>
                  Detail Keterangan Kalori Minus
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Katering: <strong style={{ color: "var(--text)" }}>{previewDetailEntry.catering_nama || `Catering #${previewDetailEntry.catering_id}`}</strong> &nbsp;|&nbsp; Tanggal: <strong style={{ color: "var(--text)" }}>{formatDateDisplay(previewDetailEntry.tanggal)}</strong>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                onClick={() => setPreviewDetailEntry(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Hasil Kalori Banner */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: "var(--red-light, #fee2e2)",
                  border: "1px solid #fca5a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--red)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    HASIL KALORI
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--red)" }}>
                    {formatNumberID(previewDetailEntry.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kkal
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red)" }}>
                  Di bawah standar 900 kkal
                </span>
              </div>

              {/* Menu */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  MENU LENGKAP
                </label>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle, #f8fafc)",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-line",
                    color: "var(--text)",
                  }}
                >
                  {previewDetailEntry.menu}
                </div>
              </div>

              {/* Foto Catering */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  FOTO CATERING
                </label>
                {previewDetailEntry.foto_url ? (
                  <div
                    style={{
                      display: "inline-block",
                      position: "relative",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                    onClick={() => setPreviewFotoUrl(getFullFotoUrl(previewDetailEntry.foto_url))}
                  >
                    <ProtectedImage
                      src={getFullFotoUrl(previewDetailEntry.foto_url)}
                      alt="Foto Catering"
                      style={{ maxWidth: "100%", maxHeight: 240, objectFit: "cover", display: "block" }}
                    />
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "rgba(0,0,0,0.7)",
                        color: "#ffffff",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Maximize2 size={13} /> Klik untuk memperbesar foto
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: 8,
                      border: "1px dashed var(--border)",
                      background: "var(--bg-subtle, #f8fafc)",
                      fontSize: 13,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    Tidak ada foto catering yang diunggah.
                  </div>
                )}
              </div>

              {/* Problem */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  PROBLEM / KEKURANGAN
                </label>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle, #f8fafc)",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-line",
                    color: "var(--text)",
                  }}
                >
                  {previewDetailEntry.problem}
                </div>
              </div>

              {/* Perbaikan */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  PERBAIKAN / TINDAKAN
                </label>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle, #f8fafc)",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre-line",
                    color: "var(--text)",
                  }}
                >
                  {previewDetailEntry.perbaikan}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPreviewDetailEntry(null)}
              >
                Tutup
              </button>
              <ExportExcelButton
                onClick={() => handleExportSelected(previewDetailEntry.id)}
                isLoading={isExportingExcel}
              />
            </div>
          </div>
        </div>
      )}

      {/* FULL PHOTO LIGHTBOX MODAL */}
      {previewFotoUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewFotoUrl(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: 900,
              maxHeight: "90vh",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewFotoUrl(null)}
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <X size={28} />
            </button>
            <ProtectedImage
              src={previewFotoUrl}
              alt="Foto Size Penuh"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}

      {/* Unified ConfirmDeleteModal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Hapus Catatan Kalori Minus?"
        itemName={
          deleteTarget
            ? `${deleteTarget.catering_nama || "Katering"} — ${deleteTarget.tanggal} — Menu: ${deleteTarget.menu} (${formatNumberID(deleteTarget.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kkal)`
            : undefined
        }
        description="Apakah Anda yakin ingin menghapus catatan kalori minus ini? Bukti foto dan rincian selisih kalori akan dihapus secara permanen."
        confirmText="Hapus Catatan"
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteEntry}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
