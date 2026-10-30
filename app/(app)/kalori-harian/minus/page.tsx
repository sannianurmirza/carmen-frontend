"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import ProtectedImage from "@/components/ProtectedImage";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  TrendingDown,
  Maximize2,
  Utensils,
  Edit3,
  Pencil,
  Loader,
  CheckCircle2,
  AlertCircle,
  Upload,
  Clock,
  Building2,
  Filter,
  RotateCcw,
  FileText,
} from "lucide-react";
import {
  Catering,
  getCatering,
  MinusEntry,
  getMinusEntries,
  deleteMinusEntry,
  updateMinusEntry,
  uploadFotoMinus,
  exportMinusExcelApi,
  exportMinusExcelPostApi,
  getBaseUrl,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";
import { formatNumberID } from "@/lib/formatters";

const ITEMS_PER_PAGE = 10;

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
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

export default function KaloriMinusPage() {
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [entries, setEntries] = useState<MinusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCatering, setFilterCatering] = useState<string>("");
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");
  const [filterShift, setFilterShift] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Focus management
  const triggerRef = useRef<HTMLElement | null>(null);
  const [previewDetailEntry, setPreviewDetailEntry] = useState<MinusEntry | null>(null);
  const [editTarget, setEditTarget] = useState<MinusEntry | null>(null);
  const [editProblem, setEditProblem] = useState("");
  const [editPerbaikan, setEditPerbaikan] = useState("");
  const [editFotoUrl, setEditFotoUrl] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MinusEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Selections for Export
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [downloadingRowId, setDownloadingRowId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editProblemInputRef = useRef<HTMLTextAreaElement>(null);
  const editPerbaikanInputRef = useRef<HTMLTextAreaElement>(null);

  // Helper auto-grow textarea: tinggi awal 130px (5-6 baris), auto-grow hingga 260px, lalu aktifkan scroll vertikal
  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const minHeight = 130;
    const maxHeight = 260;
    const scrollH = el.scrollHeight;
    if (scrollH <= minHeight) {
      el.style.height = `${minHeight}px`;
      el.style.overflowY = "hidden";
    } else if (scrollH > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = "auto";
    } else {
      el.style.height = `${scrollH}px`;
      el.style.overflowY = "hidden";
    }
  };

  const { showToast } = useToast();
  const API_BASE = getBaseUrl();

  // Check if any filter is active
  const hasActiveFilter = Boolean(
    filterCatering || filterStart || filterEnd || filterShift || filterStatus
  );

  async function loadData() {
    setLoading(true);
    try {
      const [catData, entryData] = await Promise.all([
        getCatering(),
        getMinusEntries(
          filterCatering ? Number(filterCatering) : undefined,
          filterStart || undefined,
          filterEnd || undefined,
          filterShift || undefined,
          filterStatus || undefined
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
  }, [filterCatering, filterStart, filterEnd, filterShift, filterStatus]);

  useEffect(() => {
    if (editTarget) {
      requestAnimationFrame(() => {
        adjustTextareaHeight(editProblemInputRef.current);
        adjustTextareaHeight(editPerbaikanInputRef.current);
      });
    }
  }, [editTarget]);

  const handleResetFilter = () => {
    setFilterCatering("");
    setFilterStart("");
    setFilterEnd("");
    setFilterShift("");
    setFilterStatus("");
  };

  const getFullFotoUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Keyboard accessibility: Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewFotoUrl) {
          setPreviewFotoUrl(null);
        } else if (previewDetailEntry) {
          closeDetailModal();
        } else if (editTarget && !savingEdit) {
          closeEditModal();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFotoUrl, previewDetailEntry, editTarget, savingEdit]);

  // Checkbox indeterminate sync
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

      showToast({
        type: "success",
        title: "Ekspor Berhasil",
        message: `Berhasil mengunduh ${targetIds.length} laporan Kalori Minus.`,
      });

      if (!singleEntryId) {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Ekspor Gagal",
        message: err?.message || "Terjadi kesalahan saat mengekspor Excel.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadSingleRow = async (entry: MinusEntry) => {
    if (downloadingRowId !== null || isExportingExcel) return;

    const isFilled =
      entry.status_pengisian === "sudah_dilengkapi" ||
      Boolean(entry.problem && entry.problem.trim() && entry.perbaikan && entry.perbaikan.trim());

    if (!isFilled) {
      showToast({
        type: "error",
        title: "Laporan Belum Lengkap",
        message: "Lengkapi laporan sebelum diunduh.",
      });
      return;
    }

    setDownloadingRowId(entry.id);
    try {
      const { blob, filename } = await exportMinusExcelApi(
        undefined,
        undefined,
        undefined,
        undefined,
        entry.id
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        type: "success",
        title: "Download Berhasil",
        message: `Laporan "${filename}" berhasil diunduh.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Download Gagal",
        message: err?.message || "Terjadi kesalahan saat mengunduh file Excel.",
      });
    } finally {
      setDownloadingRowId(null);
    }
  };

  const handleExportAllFiltered = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const { blob, filename } = await exportMinusExcelApi(
        filterCatering ? Number(filterCatering) : undefined,
        filterStart || undefined,
        filterEnd || undefined,
        filterShift || undefined
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        type: "success",
        title: "Ekspor Berhasil",
        message: "Seluruh laporan Kalori Minus sesuai filter berhasil diekspor.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Ekspor Gagal",
        message: err?.message || "Terjadi kesalahan saat mengekspor Excel.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Open & Close Edit Modal with focus management
  const handleOpenEdit = (entry: MinusEntry, e?: React.MouseEvent) => {
    if (e) triggerRef.current = e.currentTarget as HTMLElement;
    setEditTarget(entry);
    setEditProblem(entry.problem || "");
    setEditPerbaikan(entry.perbaikan || "");
    setEditFotoUrl(entry.foto_url || null);
    setTimeout(() => {
      editProblemInputRef.current?.focus();
      adjustTextareaHeight(editProblemInputRef.current);
      adjustTextareaHeight(editPerbaikanInputRef.current);
    }, 50);
  };

  const closeEditModal = () => {
    setEditTarget(null);
    triggerRef.current?.focus();
  };

  // Open & Close Detail Modal with focus management
  const handleOpenDetail = (entry: MinusEntry, e?: React.MouseEvent) => {
    if (e) triggerRef.current = e.currentTarget as HTMLElement;
    setPreviewDetailEntry(entry);
  };

  const closeDetailModal = () => {
    setPreviewDetailEntry(null);
    triggerRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast({
        type: "error",
        title: "Format Tidak Didukung",
        message: "Harap unggah file gambar (.jpg, .jpeg, .png, .webp).",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast({
        type: "error",
        title: "Ukuran Terlalu Besar",
        message: "Ukuran gambar maksimal 5MB.",
      });
      return;
    }

    setUploadingFoto(true);
    try {
      const res = await uploadFotoMinus(file);
      setEditFotoUrl(res.url);
      showToast({
        type: "success",
        title: "Foto Terunggah",
        message: "Foto keterangan berhasil diunggah.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Unggah Foto",
        message: err?.message || "Terjadi kesalahan saat mengunggah foto.",
      });
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const updated = await updateMinusEntry(editTarget.id, {
        problem: editProblem.trim(),
        perbaikan: editPerbaikan.trim(),
        foto_url: editFotoUrl,
      });

      setEntries((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );

      if (previewDetailEntry?.id === updated.id) {
        setPreviewDetailEntry(updated);
      }

      showToast({
        type: "success",
        title: "Keterangan Disimpan",
        message: "Data Problem dan Perbaikan berhasil diperbarui.",
      });

      closeEditModal();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Menyimpan",
        message: err?.message || "Terjadi kesalahan saat menyimpan keterangan.",
      });
    } finally {
      setSavingEdit(false);
    }
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
        message: "Catatan kalori minus berhasil dihapus.",
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus entri minus.");
    } finally {
      setDeleting(false);
    }
  };

  // KPI Stats based on current filtered entries
  const totalMinus = entries.length;
  const sudahDilengkapi = useMemo(
    () => entries.filter((e) => e.status_pengisian === "sudah_dilengkapi").length,
    [entries]
  );
  const belumDilengkapi = totalMinus - sudahDilengkapi;

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));
  const paginatedEntries = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return entries.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [entries, currentPage]);

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* ===================== TOP HEADER & BREADCRUMB ===================== */}
      <div className="page-head-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          {/* Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              marginBottom: 10,
              color: "var(--muted)",
            }}
          >
            <Link
              href="/kalori-harian"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              <Utensils size={13} />
              <span>Kalori</span>
            </Link>
            <ChevronRight size={13} style={{ color: "var(--muted)" }} />
            <span style={{ fontWeight: 600, color: "var(--text)" }}>Kalori Minus</span>
          </nav>

          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--red-light, #fee2e2)",
                color: "var(--red)",
                flexShrink: 0,
              }}
            >
              <TrendingDown size={22} />
            </span>
            Kalori Minus
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            Daftar laporan kalori harian di bawah standar (minus) yang memerlukan keterangan problem dan perbaikan.
          </p>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* ===================== KPI STATUS SUMMARY CARDS ===================== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <div
          className="panel"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid var(--red)",
            borderRadius: 8,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>
            Total Kalori Minus
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "var(--red)", margin: "4px 0 2px" }}>
            {formatNumberID(totalMinus)}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
            Semua laporan aktif &lt; 900 kkal
          </p>
        </div>

        <div
          className="panel"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid #d97706",
            borderRadius: 8,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>
            Belum Dilengkapi
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#d97706", margin: "4px 0 2px" }}>
            {formatNumberID(belumDilengkapi)}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
            Memerlukan Problem &amp; Perbaikan
          </p>
        </div>

        <div
          className="panel"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid #059669",
            borderRadius: 8,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>
            Sudah Dilengkapi
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#059669", margin: "4px 0 2px" }}>
            {formatNumberID(sudahDilengkapi)}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
            Problem &amp; Perbaikan telah terisi
          </p>
        </div>
      </div>

      {/* ===================== FILTER & EXPORT BAR ===================== */}
      <div
        className="panel"
        style={{
          padding: 16,
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Filter Inputs Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          {/* Catering */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              Katering
            </label>
            <select
              className="input-field"
              value={filterCatering}
              onChange={(e) => setFilterCatering(e.target.value)}
              style={{ width: "100%", fontSize: 13, height: 38 }}
            >
              <option value="">Semua Katering</option>
              {caterings.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Shift */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              Shift
            </label>
            <select
              className="input-field"
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              style={{ width: "100%", fontSize: 13, height: 38 }}
            >
              <option value="">Semua Shift</option>
              <option value="Pagi">Pagi</option>
              <option value="Malam">Malam</option>
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              Tanggal Mulai
            </label>
            <IndoDatePicker
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
          </div>

          {/* Tanggal Selesai */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              Tanggal Selesai
            </label>
            <IndoDatePicker
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
          </div>

          {/* Status Pengisian */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              Status Pengisian
            </label>
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "100%", fontSize: 13, height: 38 }}
            >
              <option value="">Semua Status</option>
              <option value="belum_dilengkapi">Belum Dilengkapi</option>
              <option value="sudah_dilengkapi">Sudah Dilengkapi</option>
            </select>
          </div>
        </div>

        {/* Filter Toolbar: Reset Filter & Export Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--border-subtle, #f1f5f9)",
          }}
        >
          <div>
            {/* Tombol Reset Filter hanya muncul jika ada filter aktif */}
            {hasActiveFilter && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetFilter}
                style={{
                  fontSize: 12.5,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--text-secondary)",
                }}
                title="Hapus semua filter pencarian"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}
          </div>

          {/* Export Action Controls */}
          <div className="km-export-controls" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            {isSelectionMode ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelSelection}
                  style={{
                    fontSize: 13,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Batal Pilih
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleExportSelected()}
                  disabled={isExportingExcel || selectedIds.size === 0}
                  style={{
                    fontSize: 13,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: "var(--red)",
                  }}
                >
                  <FileSpreadsheet size={16} />
                  {isExportingExcel ? "Mengekspor..." : `Ekspor Terpilih (${selectedIds.size})`}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportButtonClick}
                  style={{
                    fontSize: 13,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  title="Pilih beberapa laporan tertentu untuk diekspor ke Excel"
                >
                  <FileSpreadsheet size={16} color="var(--red)" />
                  Pilih Ekspor
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExportAllFiltered}
                  disabled={isExportingExcel || entries.length === 0}
                  style={{
                    fontSize: 13,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: "var(--red)",
                  }}
                  title="Export"
                >
                  <Download size={16} />
                  {isExportingExcel ? "Mengekspor..." : "Export"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===================== MAIN CONTENT: DESKTOP TABLE & MOBILE CARDS ===================== */}
      <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 30 }}>
        {/* SKELETON LOADING STATE */}
        {loading ? (
          <div style={{ padding: 20 }}>
            {/* Desktop Table Skeleton */}
            <div className="km-desktop-view">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={`skel-${i}`} style={{ display: "grid", gridTemplateColumns: "5% 18% 9% 18% 16% 14% 20%", gap: 14, alignItems: "center", height: 86, padding: "0 16px" }}>
                    <div className="km-skeleton" style={{ height: 24, width: 30, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 26, width: 140, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 24, width: 60, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 24, width: 120, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 30, width: 105, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 28, width: 70, justifySelf: "center" }} />
                    <div className="km-skeleton" style={{ height: 34, width: 160, justifySelf: "center" }} />
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Card Skeleton */}
            <div className="km-mobile-view">
              {[1, 2, 3].map((i) => (
                <div key={`skel-m-${i}`} className="km-mobile-card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="km-skeleton" style={{ height: 20, width: 140 }} />
                    <div className="km-skeleton" style={{ height: 24, width: 80 }} />
                  </div>
                  <div className="km-skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
                  <div className="km-skeleton" style={{ height: 40, width: "100%" }} />
                </div>
              ))}
            </div>
          </div>
        ) : paginatedEntries.length === 0 ? (
          /* EMPTY STATE */
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: hasActiveFilter ? "var(--surface-hover, #f1f5f9)" : "var(--green-bg, #f0fdf4)",
                color: hasActiveFilter ? "var(--muted)" : "#059669",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {hasActiveFilter ? <Filter size={28} /> : <CheckCircle2 size={32} />}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px", color: "var(--text)" }}>
              {hasActiveFilter ? "Tidak Ada Laporan Sesuai Filter" : "Tidak Ada Kalori Minus"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px", maxWidth: 460, display: "inline-block" }}>
              {hasActiveFilter
                ? "Tidak ditemukan data kalori minus yang cocok dengan kriteria filter yang dipilih. Silakan atur ulang filter."
                : "Semua laporan Kalori Harian telah memenuhi standar kalori (minimal 900 kkal)."}
            </p>
            {hasActiveFilter && (
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetFilter}
                  style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 1. DESKTOP VIEW TABLE */}
            <div className="km-desktop-view">
              <table className="km-table">
                <colgroup>
                  {isSelectionMode && <col style={{ width: 44 }} />}
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "20%", minWidth: 190 }} />
                </colgroup>
                <thead>
                  <tr>
                    {isSelectionMode && (
                      <th style={{ width: 44, padding: "16px 8px" }}>
                        <input
                          type="checkbox"
                          ref={headerCheckboxRef}
                          checked={entries.length > 0 && entries.every((e) => selectedIds.has(e.id))}
                          onChange={handleSelectAllToggle}
                          style={{ cursor: "pointer", width: 16, height: 16, verticalAlign: "middle" }}
                          aria-label="Pilih semua laporan"
                        />
                      </th>
                    )}
                    <th style={{ width: "5%", padding: "16px 8px" }}>NO</th>
                    <th style={{ width: "18%", padding: "16px 14px" }}>TANGGAL</th>
                    <th style={{ width: "9%", padding: "16px 10px" }}>SHIFT</th>
                    <th style={{ width: "18%", padding: "16px 14px" }}>KATERING</th>
                    <th style={{ width: "16%", padding: "16px 14px" }}>HASIL KALORI</th>
                    <th style={{ width: "14%", padding: "16px 14px" }}>STATUS</th>
                    <th style={{ width: "20%", minWidth: 190, padding: "16px 14px" }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((e, idx) => {
                    const rowNumber = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                    const isSelected = selectedIds.has(e.id);
                    const isFilled = e.status_pengisian === "sudah_dilengkapi";
                    const isDownloadingThisRow = downloadingRowId === e.id;

                    return (
                      <tr
                        key={e.id}
                        className={isSelected ? "km-row-selected" : undefined}
                        style={{
                          background: isSelected ? "var(--red-light, #fee2e2)" : "var(--card)",
                          height: 86,
                          minHeight: 86,
                        }}
                      >
                        {isSelectionMode && (
                          <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 8px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleRowSelectToggle(e.id)}
                              style={{ cursor: "pointer", width: 16, height: 16, verticalAlign: "middle" }}
                              aria-label={`Pilih laporan ${e.catering_nama || `Catering #${e.catering_id}`}`}
                            />
                          </td>
                        )}
                        {/* 1. NO */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 8px", color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
                          {rowNumber}
                        </td>

                        {/* 2. TANGGAL */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 14px" }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                            {formatDateDisplay(e.tanggal)}
                          </div>
                        </td>

                        {/* 3. SHIFT */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 10px" }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: "var(--text-secondary)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              lineHeight: 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Clock size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span>{e.shift || "Pagi"}</span>
                          </div>
                        </td>

                        {/* 4. KATERING */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 14px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.2px", whiteSpace: "nowrap" }}>
                            {e.catering_nama || `Catering #${e.catering_id}`}
                          </div>
                        </td>

                        {/* 5. HASIL KALORI */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 14px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 105,
                              height: 30,
                              padding: "0 12px",
                              borderRadius: 6,
                              background: "var(--red-light, #fee2e2)",
                              color: "var(--red)",
                              fontWeight: 700,
                              fontSize: 12.5,
                              whiteSpace: "nowrap",
                              boxSizing: "border-box",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatNumberID(e.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kkal
                          </span>
                        </td>

                        {/* 6. STATUS */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 14px" }}>
                          {isFilled ? (
                            <span
                              className="status-badge-filled"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                                height: 28,
                                padding: "0 10px",
                                borderRadius: 9999,
                                background: "#ecfdf5",
                                color: "#047857",
                                fontSize: 12,
                                fontWeight: 600,
                                border: "1px solid #a7f3d0",
                                whiteSpace: "nowrap",
                                boxSizing: "border-box",
                              }}
                            >
                              <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                              <span>Lengkap</span>
                            </span>
                          ) : (
                            <span
                              className="status-badge-unfilled"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                                height: 28,
                                padding: "0 10px",
                                borderRadius: 9999,
                                background: "#fffbeb",
                                color: "#b45309",
                                fontSize: 12,
                                fontWeight: 600,
                                border: "1px solid #fde68a",
                                whiteSpace: "nowrap",
                                boxSizing: "border-box",
                              }}
                            >
                              <AlertCircle size={13} style={{ flexShrink: 0 }} />
                              <span>Belum</span>
                            </span>
                          )}
                        </td>

                        {/* 7. AKSI */}
                        <td style={{ textAlign: "center", verticalAlign: "middle", padding: "18px 14px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
                            {/* Action 1: Pensil — Edit / Lengkapi (Icon only) */}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(event) => handleOpenEdit(e, event)}
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                flexShrink: 0,
                              }}
                              title={isFilled ? "Edit laporan" : "Lengkapi laporan"}
                              aria-label={isFilled ? "Edit laporan" : "Lengkapi laporan"}
                            >
                              <Pencil size={15} />
                            </button>

                            {/* Action 2: Mata — Lihat Detail */}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={(event) => handleOpenDetail(e, event)}
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                flexShrink: 0,
                              }}
                              title="Lihat Detail Laporan"
                              aria-label="Lihat Detail Laporan"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Action 3: Download Excel Satu Laporan */}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleDownloadSingleRow(e)}
                              disabled={!isFilled || isDownloadingThisRow}
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                flexShrink: 0,
                                cursor: !isFilled ? "not-allowed" : undefined,
                                opacity: !isFilled ? 0.5 : undefined,
                              }}
                              title={
                                !isFilled
                                  ? "Lengkapi laporan sebelum diunduh"
                                  : isDownloadingThisRow
                                  ? "Mengunduh Excel..."
                                  : "Export"
                              }
                              aria-label="Export"
                            >
                              {isDownloadingThisRow ? (
                                <RefreshCw size={14} className="btn-export-excel-spin" />
                              ) : (
                                <Download size={15} />
                              )}
                            </button>

                            {/* Action 4: Tempat Sampah — Hapus Catatan */}
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setDeleteTarget(e)}
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                color: "var(--red)",
                                flexShrink: 0,
                              }}
                              title="Hapus Entri Kalori Minus"
                              aria-label="Hapus Entri Kalori Minus"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. MOBILE CARDS VIEW */}
            <div className="km-mobile-view" style={{ padding: 12 }}>
              {paginatedEntries.map((e, idx) => {
                const isSelected = selectedIds.has(e.id);
                const isFilled = e.status_pengisian === "sudah_dilengkapi";
                const isDownloadingThisRow = downloadingRowId === e.id;

                return (
                  <div
                    key={`mob-${e.id}`}
                    className="km-mobile-card"
                    style={{
                      background: isSelected ? "var(--red-light, #fee2e2)" : "var(--card)",
                    }}
                  >
                    {/* Top Row: Tanggal, Shift, Status */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Tanggal: </span>
                          <span style={{ fontWeight: 600 }}>{formatDateDisplay(e.tanggal)}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Shift: </span>
                          <Clock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{e.shift || "Pagi"}</span>
                        </div>
                      </div>

                      {isFilled ? (
                        <span
                          className="status-badge-filled"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 9999,
                            background: "#ecfdf5",
                            color: "#047857",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "1px solid #a7f3d0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Lengkap
                        </span>
                      ) : (
                        <span
                          className="status-badge-unfilled"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 9999,
                            background: "#fffbeb",
                            color: "#b45309",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "1px solid #fde68a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <AlertCircle size={12} />
                          Belum
                        </span>
                      )}
                    </div>

                    {/* Middle: Katering & Hasil Kalori */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                          {e.catering_nama || `Catering #${e.catering_id}`}
                        </h4>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "var(--red-light, #fee2e2)",
                            color: "var(--red)",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {formatNumberID(e.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kkal
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Mobile Actions Bar (Min touch target 42px) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={(event) => handleOpenEdit(e, event)}
                        style={{
                          flex: 1,
                          minHeight: 42,
                          fontSize: 13,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                        title={isFilled ? "Edit laporan" : "Lengkapi laporan"}
                        aria-label={isFilled ? "Edit laporan" : "Lengkapi laporan"}
                      >
                        <Pencil size={15} />
                        <span>{isFilled ? "Edit" : "Lengkapi"}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={(event) => handleOpenDetail(e, event)}
                        style={{
                          minWidth: 42,
                          minHeight: 42,
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Lihat Detail Laporan"
                        aria-label="Lihat Detail Laporan"
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownloadSingleRow(e)}
                        disabled={!isFilled || isDownloadingThisRow}
                        style={{
                          minWidth: 42,
                          minHeight: 42,
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: !isFilled ? "not-allowed" : undefined,
                          opacity: !isFilled ? 0.5 : undefined,
                        }}
                        title={
                          !isFilled
                            ? "Lengkapi laporan sebelum diunduh"
                            : isDownloadingThisRow
                            ? "Mengunduh Excel..."
                            : "Export"
                        }
                        aria-label="Export"
                      >
                        {isDownloadingThisRow ? (
                          <RefreshCw size={17} className="btn-export-excel-spin" />
                        ) : (
                          <Download size={17} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDeleteTarget(e)}
                        style={{
                          minWidth: 42,
                          minHeight: 42,
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--red)",
                        }}
                        title="Hapus Entri Kalori Minus"
                        aria-label="Hapus Entri Kalori Minus"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ===================== PAGINATION FOOTER ===================== */}
        {entries.length > 0 && (
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              background: "var(--surface-hover, #f8fafc)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Menampilkan{" "}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {entries.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </span>{" "}
              -{" "}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {Math.min(currentPage * ITEMS_PER_PAGE, entries.length)}
              </span>{" "}
              dari <span style={{ fontWeight: 600, color: "var(--text)" }}>{formatNumberID(entries.length)}</span> entri
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    padding: 0,
                    margin: 0,
                    lineHeight: 1,
                    borderRadius: 6,
                    boxSizing: "border-box",
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft size={16} style={{ display: "block", flexShrink: 0 }} />
                </button>

                {getPaginationRange(currentPage, totalPages).map((pageNum, i) =>
                  pageNum === "..." ? (
                    <span
                      key={`ellipsis-${i}`}
                      style={{
                        width: 24,
                        height: 34,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: 0,
                        color: "var(--muted)",
                        fontSize: 13,
                        userSelect: "none",
                        flexShrink: 0,
                      }}
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      className={`btn ${currentPage === pageNum ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setCurrentPage(pageNum as number)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        minWidth: 34,
                        minHeight: 34,
                        padding: 0,
                        margin: 0,
                        lineHeight: 1,
                        fontSize: 13,
                        fontWeight: currentPage === pageNum ? 700 : 500,
                        letterSpacing: "normal",
                        textAlign: "center",
                        borderRadius: 6,
                        boxSizing: "border-box",
                        background: currentPage === pageNum ? "var(--red)" : undefined,
                        borderColor: currentPage === pageNum ? "var(--red)" : undefined,
                        color: currentPage === pageNum ? "#ffffff" : "var(--text-secondary)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      aria-label={`Halaman ${pageNum}`}
                      aria-current={currentPage === pageNum ? "page" : undefined}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                          textAlign: "center",
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                        }}
                      >
                        {pageNum}
                      </span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    padding: 0,
                    margin: 0,
                    lineHeight: 1,
                    borderRadius: 6,
                    boxSizing: "border-box",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                  aria-label="Halaman Berikutnya"
                >
                  <ChevronRight size={16} style={{ display: "block", flexShrink: 0 }} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================== MODAL LENGKAPI / EDIT KETERANGAN ===================== */}
      {editTarget && (
        <div
          className="km-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) closeEditModal();
          }}
        >
          <div className="km-modal-container">
            {/* Modal Header (Sticky) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px",
                borderBottom: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <div>
                <p className="eyebrow" style={{ color: "var(--red)", marginBottom: 2 }}>
                  FORM KETERANGAN MINUS
                </p>
                <h2 id="modal-edit-title" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                  Lengkapi Keterangan Kalori Minus
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                style={{
                  minWidth: 38,
                  minHeight: 38,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              {/* Header Informasi Laporan Kalori */}
              <div className="km-info-card" role="region" aria-label="Informasi Laporan Kalori" style={{ marginBottom: 24 }}>
                {/* Judul Section Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingBottom: 10,
                    marginBottom: 14,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <FileText size={15} style={{ color: "var(--red)", flexShrink: 0 }} aria-hidden="true" />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--text)",
                    }}
                  >
                    INFORMASI LAPORAN KALORI
                  </h3>
                </div>

                {/* 4 Informasi Utama Baris Pertama */}
                <dl
                  className="km-info-grid-top"
                  style={{
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {/* 1. Katering */}
                  <div style={{ margin: 0 }}>
                    <dt
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      Katering
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "var(--text)",
                        textTransform: "uppercase",
                        letterSpacing: "0.2px",
                        wordBreak: "break-word",
                      }}
                    >
                      {editTarget.catering_nama || `Catering #${editTarget.catering_id}`}
                    </dd>
                  </div>

                  {/* 2. Tanggal */}
                  <div style={{ margin: 0 }}>
                    <dt
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      Tanggal
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDateDisplay(editTarget.tanggal)}
                    </dd>
                  </div>

                  {/* 3. Shift */}
                  <div style={{ margin: 0 }}>
                    <dt
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      Shift
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Clock size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden="true" />
                      <span>{editTarget.shift || "Pagi"}</span>
                    </dd>
                  </div>

                  {/* 4. Hasil Kalori */}
                  <div style={{ margin: 0 }}>
                    <dt
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      Hasil Kalori
                    </dt>
                    <dd style={{ margin: 0, display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--red-light, #fee2e2)",
                          color: "var(--red)",
                          fontWeight: 700,
                          fontSize: 12.5,
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: 1.2,
                        }}
                        aria-label={`Hasil kalori ${formatNumberID(editTarget.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kkal, di bawah standar minimum`}
                      >
                        {formatNumberID(editTarget.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kkal
                      </span>
                      <span className="sr-only"> (di bawah standar kalori)</span>
                    </dd>
                  </div>
                </dl>

                {/* Baris Kedua: Menu Masakan (Lebar Penuh) */}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 12,
                    marginTop: 14,
                  }}
                >
                  <dt
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 5,
                      display: "block",
                    }}
                  >
                    Menu Masakan
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {editTarget.menu || "-"}
                  </dd>
                </div>
              </div>

              {/* Form Inputs: Problem & Perbaikan */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label htmlFor="input-problem" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Problem (Kendala / Masalah) <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <textarea
                    id="input-problem"
                    ref={editProblemInputRef}
                    className="input-field"
                    value={editProblem}
                    onChange={(e) => {
                      setEditProblem(e.target.value);
                      adjustTextareaHeight(e.target);
                    }}
                    placeholder="Jelaskan penyebab atau kendala yang membuat kalori masakan tidak mencapai standar..."
                    wrap="soft"
                    style={{
                      width: "100%",
                      minHeight: 130,
                      maxHeight: 260,
                      height: 130,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                      background: "var(--input-bg, #ffffff)",
                      color: "var(--text, #0f172a)",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      resize: "vertical",
                      overflowY: "hidden",
                      display: "block",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="input-perbaikan" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Perbaikan (Tindakan Koreksi) <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <textarea
                    id="input-perbaikan"
                    ref={editPerbaikanInputRef}
                    className="input-field"
                    value={editPerbaikan}
                    onChange={(e) => {
                      setEditPerbaikan(e.target.value);
                      adjustTextareaHeight(e.target);
                    }}
                    placeholder="Jelaskan tindakan perbaikan atau tindak lanjut yang telah/akan dilakukan bersama pihak katering..."
                    wrap="soft"
                    style={{
                      width: "100%",
                      minHeight: 130,
                      maxHeight: 260,
                      height: 130,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                      background: "var(--input-bg, #ffffff)",
                      color: "var(--text, #0f172a)",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      resize: "vertical",
                      overflowY: "hidden",
                      display: "block",
                    }}
                  />
                </div>

                {/* Upload Foto Keterangan (Opsional) */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Foto Bukti / Keterangan (Opsional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: "none" }}
                  />

                  {editFotoUrl ? (
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        maxWidth: 260,
                        maxHeight: 180,
                      }}
                    >
                      <img
                        src={getFullFotoUrl(editFotoUrl)}
                        alt="Foto Keterangan"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditFotoUrl(null)}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                        title="Hapus foto"
                        aria-label="Hapus foto"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFoto}
                      style={{
                        minHeight: 38,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        padding: "0 14px",
                      }}
                    >
                      {uploadingFoto ? (
                        <RefreshCw size={15} className="spin" />
                      ) : (
                        <Upload size={15} />
                      )}
                      <span>{uploadingFoto ? "Mengunggah..." : "Pilih Foto Bukti"}</span>
                    </button>
                  )}
                  <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    Format: JPG, PNG, atau WebP (maks. 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Sticky) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 22px",
                borderTop: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEditModal}
                disabled={savingEdit}
                style={{ fontSize: 13, minHeight: 38, padding: "0 16px" }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{
                  fontSize: 13,
                  minHeight: 38,
                  padding: "0 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--red)",
                }}
              >
                {savingEdit ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={16} />}
                <span>{savingEdit ? "Menyimpan..." : "Simpan Keterangan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL DETAIL PREVIEW ===================== */}
      {previewDetailEntry && (
        <div
          className="km-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetailModal();
          }}
        >
          <div className="km-modal-container" style={{ maxWidth: 580 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px",
                borderBottom: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <div>
                <p className="eyebrow" style={{ color: "var(--red)", marginBottom: 2 }}>
                  DETAIL LAPORAN MINUS
                </p>
                <h2 id="modal-detail-title" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                  {previewDetailEntry.catering_nama || `Catering #${previewDetailEntry.catering_id}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                style={{
                  minWidth: 38,
                  minHeight: 38,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
                aria-label="Tutup modal detail"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Tanggal:</span>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", marginTop: 2 }}>
                    {formatDateDisplay(previewDetailEntry.tanggal)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Shift:</span>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", marginTop: 2 }}>
                    {previewDetailEntry.shift || "Pagi"}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Menu Masakan:</span>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", marginTop: 2 }}>
                  {previewDetailEntry.menu || "-"}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Hasil Kalori:</span>
                <div style={{ marginTop: 2 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "var(--red-light, #fee2e2)",
                      color: "var(--red)",
                      fontWeight: 800,
                      fontSize: 13.5,
                    }}
                  >
                    {formatNumberID(previewDetailEntry.hasil_kalori, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kkal
                  </span>
                </div>
              </div>

              {/* Problem */}
              <div
                style={{
                  background: "var(--surface-hover, #f8fafc)",
                  borderRadius: 8,
                  padding: 14,
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", display: "block", marginBottom: 4 }}>
                  Problem (Masalah):
                </span>
                <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>
                  {previewDetailEntry.problem || <em style={{ color: "var(--muted)" }}>Belum dilengkapi</em>}
                </p>
              </div>

              {/* Perbaikan */}
              <div
                style={{
                  background: "var(--surface-hover, #f8fafc)",
                  borderRadius: 8,
                  padding: 14,
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", display: "block", marginBottom: 4 }}>
                  Perbaikan (Tindakan):
                </span>
                <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>
                  {previewDetailEntry.perbaikan || <em style={{ color: "var(--muted)" }}>Belum dilengkapi</em>}
                </p>
              </div>

              {/* Foto */}
              {previewDetailEntry.foto_url && (
                <div>
                  <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                    Foto Bukti / Keterangan:
                  </span>
                  <div
                    style={{
                      position: "relative",
                      maxWidth: 280,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                    onClick={() => setPreviewFotoUrl(getFullFotoUrl(previewDetailEntry.foto_url))}
                  >
                    <ProtectedImage
                      src={getFullFotoUrl(previewDetailEntry.foto_url)}
                      alt="Bukti Minus"
                      style={{ width: "100%", height: "auto", display: "block" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 6,
                        right: 6,
                        background: "rgba(0,0,0,0.65)",
                        color: "#fff",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Maximize2 size={12} />
                      <span>Perbesar</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "14px 22px",
                borderTop: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleExportSelected(previewDetailEntry.id)}
                style={{ fontSize: 13, minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FileSpreadsheet size={15} color="var(--red)" />
                <span>Export</span>
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeDetailModal}
                  style={{ fontSize: 13, minHeight: 38, padding: "0 16px" }}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    const entry = previewDetailEntry;
                    closeDetailModal();
                    handleOpenEdit(entry, e);
                  }}
                  style={{
                    fontSize: 13,
                    minHeight: 38,
                    padding: "0 16px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--red)",
                  }}
                >
                  <Edit3 size={15} />
                  <span>Edit Keterangan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== LIGHTBOX FOTO ===================== */}
      {previewFotoUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 24,
          }}
          onClick={() => setPreviewFotoUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <ProtectedImage
              src={previewFotoUrl}
              alt="Foto Detail"
              style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
            />
            <button
              type="button"
              onClick={() => setPreviewFotoUrl(null)}
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              aria-label="Tutup foto"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ===================== CONFIRM DELETE MODAL ===================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Entri Kalori Minus?"
        itemName={
          deleteTarget
            ? `${deleteTarget.catering_nama || `Catering #${deleteTarget.catering_id}`} — ${formatDateDisplay(deleteTarget.tanggal)}`
            : undefined
        }
        description="Apakah Anda yakin ingin menghapus data kalori minus ini? Bukti foto dan rincian problem/perbaikan akan dihapus."
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
