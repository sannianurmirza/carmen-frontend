"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  PlusCircle,
  History,
  Search,
  RotateCcw,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Check,
} from "lucide-react";
import {
  Catering,
  getCatering,
  KeterlambatanRecord,
  KeterlambatanPayload,
  getKeterlambatan,
  createKeterlambatan,
  updateKeterlambatan,
  deleteKeterlambatan,
  hitungKategoriKeterlambatan,
  exportKeterlambatanExcelApi,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";


function formatIndoDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch {}
  return dateStr;
}

interface CenteredSelectProps {
  id?: string;
  value: string | number;
  placeholder: string;
  options: { value: string | number; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

function CenteredSelect({ id, value, placeholder, options, onChange, disabled, style }: CenteredSelectProps) {
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const isSelected = Boolean(selectedOption && String(selectedOption.value) !== "");
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 38,
        border: "1px solid var(--border-strong, #cbd5e1)",
        borderRadius: "var(--radius-sm, 4px)",
        background: "var(--card, #ffffff)",
        padding: "0 28px",
        fontSize: 13.5,
        fontWeight: isSelected ? 500 : 400,
        color: isSelected ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
        textAlign: "center",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <span
        style={{
          width: "100%",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
      >
        {displayLabel}
      </span>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 12,
          color: "var(--text-muted, #94a3b8)",
          pointerEvents: "none",
        }}
      />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function KeterlambatanPage() {
  const { showSuccess, showError, showWarning } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"input" | "riwayat">("input");

  // Master Caterings
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [activeCaterings, setActiveCaterings] = useState<Catering[]>([]);

  // Form State (Tab 1)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [formCateringId, setFormCateringId] = useState<number | "">("");
  const [formTanggal, setFormTanggal] = useState<string>(todayStr);
  const [formShift, setFormShift] = useState<"pagi" | "malam">("pagi");
  const [formIsTerlambat, setFormIsTerlambat] = useState<boolean | null>(null);
  const [formStatusPengiriman, setFormStatusPengiriman] = useState<"tepat_waktu" | "terlambat" | "tidak_dikirim" | null>(null);
  const [formMenit, setFormMenit] = useState<string>("");
  const [formKomentar, setFormKomentar] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form validity check for disabling submit button
  const isFormValid = useMemo(() => {
    if (formCateringId === "" || formCateringId === null || Number(formCateringId) <= 0) {
      return false;
    }
    if (!formTanggal || formTanggal.trim() === "") {
      return false;
    }
    if (formIsTerlambat === null) {
      return false;
    }
    if (formIsTerlambat === true) {
      if (formStatusPengiriman === "terlambat") {
        const m = parseInt(formMenit, 10);
        if (isNaN(m) || m < 1) return false;
      }
    }
    return true;
  }, [formCateringId, formTanggal, formIsTerlambat, formStatusPengiriman, formMenit]);

  // Computed category for Tab 1
  const formComputedKategori = useMemo(() => {
    if (formIsTerlambat !== true || !formStatusPengiriman || formStatusPengiriman === "tepat_waktu") return null;
    if (formStatusPengiriman === "tidak_dikirim") return "Tidak Dikirim";
    const m = parseInt(formMenit, 10);
    return hitungKategoriKeterlambatan("terlambat", isNaN(m) ? null : m);
  }, [formIsTerlambat, formStatusPengiriman, formMenit]);

  // Riwayat State (Tab 2)
  const [records, setRecords] = useState<KeterlambatanRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterShift, setFilterShift] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const { blob, filename } = await exportKeterlambatanExcelApi({
        start: filterStartDate || undefined,
        end: filterEndDate || undefined,
        shift: filterShift || undefined,
        status_pengiriman: filterStatus || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess("Laporan Keterlambatan berhasil diunduh.");
    } catch (err: any) {
      showError(err?.message || "Gagal mengunduh laporan Keterlambatan.");
    } finally {
      setIsExportingExcel(false);
    }
  };


  // Modals state
  const [viewingRecord, setViewingRecord] = useState<KeterlambatanRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<KeterlambatanRecord | null>(null);
  const [editCateringId, setEditCateringId] = useState<number | "">("");
  const [editTanggal, setEditTanggal] = useState<string>("");
  const [editShift, setEditShift] = useState<"pagi" | "malam">("pagi");
  const [editIsTerlambat, setEditIsTerlambat] = useState<boolean>(false);
  const [editStatusPengiriman, setEditStatusPengiriman] = useState<"tepat_waktu" | "terlambat" | "tidak_dikirim">("tepat_waktu");
  const [editMenit, setEditMenit] = useState<string>("");
  const [editKomentar, setEditKomentar] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Computed category for Edit Modal
  const editComputedKategori = useMemo(() => {
    if (!editIsTerlambat || editStatusPengiriman === "tepat_waktu") return null;
    if (editStatusPengiriman === "tidak_dikirim") return "Tidak Dikirim";
    const m = parseInt(editMenit, 10);
    return hitungKategoriKeterlambatan("terlambat", isNaN(m) ? null : m);
  }, [editIsTerlambat, editStatusPengiriman, editMenit]);

  // Delete modal state
  const [deletingRecord, setDeletingRecord] = useState<KeterlambatanRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch Caterings
  const loadCaterings = useCallback(async () => {
    try {
      const all = await getCatering();
      setCaterings(all);
      const active = all.filter((c) => c.is_active);
      setActiveCaterings(active);
    } catch {
      showError("Gagal memuat daftar katering");
    }
  }, [showError]);

  // Fetch History Records
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getKeterlambatan({
        start: filterStartDate || undefined,
        end: filterEndDate || undefined,
        shift: filterShift || undefined,
        status_pengiriman: filterStatus || undefined,
      });
      setRecords(data);
    } catch (err: any) {
      showError(err?.message || "Gagal memuat riwayat keterlambatan");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filterStartDate, filterEndDate, filterShift, filterStatus, showError]);

  useEffect(() => {
    loadCaterings();
  }, [loadCaterings]);

  useEffect(() => {
    if (activeTab === "riwayat") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Reset Tab 1 Form
  const resetForm = useCallback(() => {
    setFormCateringId("");
    setFormTanggal(todayStr);
    setFormShift("pagi");
    setFormIsTerlambat(null);
    setFormStatusPengiriman(null);
    setFormMenit("");
    setFormKomentar("");
  }, [todayStr]);

  // Toggle IsTerlambat handler
  const handleToggleIsTerlambat = (isLate: boolean) => {
    setFormIsTerlambat(isLate);
    if (!isLate) {
      setFormStatusPengiriman("tepat_waktu");
      setFormMenit("");
      setFormKomentar("");
    } else {
      setFormStatusPengiriman("terlambat");
    }
  };

  // Submit Form Handler
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCateringId === "" || formCateringId === null || Number(formCateringId) <= 0) {
      showWarning("Silakan pilih katering terlebih dahulu.");
      return;
    }
    if (!formTanggal) {
      showWarning("Silakan tentukan tanggal keterlambatan.");
      return;
    }
    if (formIsTerlambat === null) {
      showWarning("Silakan pilih status pengiriman terlebih dahulu.");
      return;
    }

    if (formIsTerlambat && formStatusPengiriman === "terlambat") {
      const m = parseInt(formMenit, 10);
      if (isNaN(m) || m < 1) {
        showWarning("Jumlah keterlambatan harus berupa angka positif minimal 1 menit.");
        return;
      }
    }

    const payload: KeterlambatanPayload = {
      catering_id: Number(formCateringId),
      tanggal: formTanggal,
      shift: formShift,
      is_terlambat: Boolean(formIsTerlambat),
      status_pengiriman: formIsTerlambat ? (formStatusPengiriman || "terlambat") : "tepat_waktu",
      menit_terlambat:
        formIsTerlambat && formStatusPengiriman === "terlambat"
          ? parseInt(formMenit, 10)
          : null,
      komentar: formIsTerlambat && formKomentar.trim() ? formKomentar.trim() : null,
    };

    setIsSubmitting(true);
    try {
      await createKeterlambatan(payload);
      showSuccess("Data keterlambatan berhasil disimpan.");
      resetForm();
    } catch (err: any) {
      const msg = err?.message || err?.detail || "Gagal menyimpan data keterlambatan";
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered History
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (r.catering_nama || "").toLowerCase();
        const kom = (r.komentar || "").toLowerCase();
        if (!nama.includes(q) && !kom.includes(q)) return false;
      }
      return true;
    });
  }, [records, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIdx, startIdx + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Open Edit Modal
  const handleOpenEdit = (rec: KeterlambatanRecord) => {
    setEditingRecord(rec);
    setEditCateringId(rec.catering_id);
    setEditTanggal(rec.tanggal);
    setEditShift(rec.shift.toLowerCase() === "malam" ? "malam" : "pagi");
    setEditIsTerlambat(rec.is_terlambat);
    setEditStatusPengiriman(rec.status_pengiriman);
    setEditMenit(rec.menit_terlambat !== null ? String(rec.menit_terlambat) : "");
    setEditKomentar(rec.komentar || "");
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editCateringId) {
      showWarning("Silakan pilih katering.");
      return;
    }
    if (editIsTerlambat && editStatusPengiriman === "terlambat") {
      const m = parseInt(editMenit, 10);
      if (isNaN(m) || m < 1) {
        showWarning("Jumlah keterlambatan harus berupa angka positif minimal 1 menit.");
        return;
      }
    }

    const payload: KeterlambatanPayload = {
      catering_id: Number(editCateringId),
      tanggal: editTanggal,
      shift: editShift,
      is_terlambat: editIsTerlambat,
      status_pengiriman: editIsTerlambat ? editStatusPengiriman : "tepat_waktu",
      menit_terlambat:
        editIsTerlambat && editStatusPengiriman === "terlambat"
          ? parseInt(editMenit, 10)
          : null,
      komentar: editIsTerlambat && editKomentar.trim() ? editKomentar.trim() : null,
    };

    setIsUpdating(true);
    try {
      await updateKeterlambatan(editingRecord.id, payload);
      showSuccess("Data keterlambatan berhasil diperbarui.");
      setEditingRecord(null);
      loadHistory();
    } catch (err: any) {
      const msg = err?.message || err?.detail || "Gagal memperbarui data keterlambatan";
      showError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      await deleteKeterlambatan(deletingRecord.id);
      showSuccess("Data keterlambatan berhasil dihapus.");
      setDeletingRecord(null);
      loadHistory();
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus data keterlambatan");
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterShift("");
    setFilterStatus("");
    setCurrentPage(1);
    loadHistory();
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`
        /* Tab Nav Container: Desktop visible both axes, mobile horizontal scroll without vertical scrollbar */
        .kt-tablist-nav {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--border, #e2e8f0);
          margin-bottom: 24px;
          overflow-x: visible;
          overflow-y: visible;
        }

        /* Dropdown Single Chevron Pattern with native arrow disabled */
        .select-custom-wrap {
          position: relative;
          width: 100%;
        }
        .select-custom-wrap select {
          width: 100%;
          height: 38px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: var(--radius-sm, 4px);
          padding: 0 42px 0 12px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          background-color: var(--card, #ffffff);
          color: var(--text, #0f172a);
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .select-custom-wrap select::-ms-expand {
          display: none;
        }
        .select-custom-wrap select:focus {
          border-color: var(--red);
          box-shadow: 0 0 0 3px var(--red-bg);
        }
        .select-custom-wrap .select-custom-arrow {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Filter Grid */
        .filters-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr 1.2fr auto;
          gap: 12px;
          align-items: flex-end;
        }
        .filters-grid > div {
          min-width: 0;
        }

        .late-fields-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 1024px) {
          .filters-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 860px) {
          .cols-3-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .kt-tablist-nav {
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .kt-tablist-nav::-webkit-scrollbar {
            display: none;
          }
          .filters-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .cols-3-grid {
            grid-template-columns: 1fr !important;
          }
          .late-fields-row {
            grid-template-columns: 1fr !important;
          }
          .status-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* 1. Header Halaman */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            PENILAIAN &amp; AUDIT
          </p>
          <h1 className="page-title" style={{ margin: 0 }}>
            Keterlambatan Katering
          </h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* 2. Tab Navigasi */}
      <div
        role="tablist"
        aria-label="Menu Keterlambatan"
        className="kt-tablist-nav"
      >
        <button
          type="button"
          role="tab"
          id="tab-input-keterlambatan"
          aria-controls="panel-input-keterlambatan"
          aria-selected={activeTab === "input"}
          onClick={() => setActiveTab("input")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: activeTab === "input" ? 700 : 600,
            color: activeTab === "input" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
            backgroundColor: activeTab === "input" ? "rgba(143, 26, 37, 0.05)" : "transparent",
            border: "none",
            borderBottom:
              activeTab === "input"
                ? "2.5px solid var(--red-dark, #8f1a25)"
                : "2.5px solid transparent",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            transition: "all 140ms ease",
            marginBottom: -1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <PlusCircle size={16} strokeWidth={activeTab === "input" ? 2.3 : 1.8} />
          <span>Input Keterlambatan</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-riwayat-keterlambatan"
          aria-controls="panel-riwayat-keterlambatan"
          aria-selected={activeTab === "riwayat"}
          onClick={() => {
            setActiveTab("riwayat");
            loadHistory();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: activeTab === "riwayat" ? 700 : 600,
            color: activeTab === "riwayat" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
            backgroundColor: activeTab === "riwayat" ? "rgba(143, 26, 37, 0.05)" : "transparent",
            border: "none",
            borderBottom:
              activeTab === "riwayat"
                ? "2.5px solid var(--red-dark, #8f1a25)"
                : "2.5px solid transparent",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            transition: "all 140ms ease",
            marginBottom: -1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <History size={16} strokeWidth={activeTab === "riwayat" ? 2.3 : 1.8} />
          <span>Riwayat Keterlambatan</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INPUT KETERLAMBATAN */}
      {/* ========================================================================= */}
      {activeTab === "input" && (
        <div
          id="panel-input-keterlambatan"
          role="tabpanel"
          aria-labelledby="tab-input-keterlambatan"
        >
          <form onSubmit={handleSubmitForm}>
            <div className="panel">
              <div className="panel-header">
                <Clock size={16} />
                <span>Informasi Pengiriman</span>
              </div>

              <div className="panel-body">
                {/* 3 Field Utama: Katering, Tanggal, Shift */}
                <div
                  className="cols-3-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {/* 1. Nama Katering */}
                  <div>
                    <label htmlFor="select-katering">
                      Nama Katering <span style={{ color: "var(--red)" }}>*</span>
                    </label>
                    <CenteredSelect
                      id="select-katering"
                      value={formCateringId}
                      placeholder="Pilih katering"
                      options={activeCaterings.map((cat) => ({
                        value: cat.id,
                        label: cat.nama,
                      }))}
                      onChange={(val) => setFormCateringId(val === "" ? "" : Number(val))}
                    />
                  </div>

                  {/* 2. Tanggal */}
                  <div>
                    <label htmlFor="input-tanggal">
                      Tanggal <span style={{ color: "var(--red)" }}>*</span>
                    </label>
                    <IndoDatePicker
                      id="input-tanggal"
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      required
                    />
                  </div>

                  {/* 3. Shift Pengiriman */}
                  <div>
                    <label>
                      Shift Pengiriman <span style={{ color: "var(--red)" }}>*</span>
                    </label>
                    <div className="shift-toggle">
                      <button
                        type="button"
                        className={formShift === "pagi" ? "active-pagi" : ""}
                        onClick={() => setFormShift("pagi")}
                      >
                        Pagi
                      </button>
                      <button
                        type="button"
                        className={formShift === "malam" ? "active-malam" : ""}
                        onClick={() => setFormShift("malam")}
                      >
                        Malam
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Pengiriman */}
                <div style={{ marginBottom: formIsTerlambat ? 20 : 24 }}>
                  <label>
                    Status Pengiriman <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Status Pengiriman"
                    className="status-grid"
                  >
                    {/* Pilihan 1: Tepat Waktu */}
                    <button
                      type="button"
                      id="status-opt-tepat"
                      role="radio"
                      aria-checked={formIsTerlambat === false}
                      onClick={() => handleToggleIsTerlambat(false)}
                      style={{
                        height: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "0 16px",
                        borderRadius: "var(--radius-sm, 4px)",
                        border:
                          formIsTerlambat === false
                            ? "1.5px solid var(--green)"
                            : "1px solid var(--border-strong)",
                        backgroundColor:
                          formIsTerlambat === false ? "var(--green-bg)" : "var(--card)",
                        color:
                          formIsTerlambat === false ? "var(--green)" : "var(--text-secondary)",
                        fontWeight: formIsTerlambat === false ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                      }}
                    >
                      <CheckCircle2
                        size={15}
                        strokeWidth={formIsTerlambat === false ? 2.3 : 1.8}
                      />
                      <span>Tepat Waktu</span>
                    </button>

                    {/* Pilihan 2: Terlambat / Tidak Dikirim */}
                    <button
                      type="button"
                      id="status-opt-terlambat"
                      role="radio"
                      aria-checked={formIsTerlambat === true}
                      onClick={() => handleToggleIsTerlambat(true)}
                      style={{
                        height: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "0 16px",
                        borderRadius: "var(--radius-sm, 4px)",
                        border:
                          formIsTerlambat === true
                            ? "1.5px solid var(--amber, #b45309)"
                            : "1px solid var(--border-strong)",
                        backgroundColor:
                          formIsTerlambat === true ? "var(--amber-bg)" : "var(--card)",
                        color:
                          formIsTerlambat === true
                            ? "var(--amber, #b45309)"
                            : "var(--text-secondary)",
                        fontWeight: formIsTerlambat === true ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                      }}
                    >
                      <Clock
                        size={15}
                        strokeWidth={formIsTerlambat === true ? 2.3 : 1.8}
                      />
                      <span>Terlambat / Tidak Dikirim</span>
                    </button>
                  </div>
                </div>

                {/* Rincian Keterlambatan (Hanya Muncul Jika Terlambat / Tidak Dikirim Dipilih) */}
                {formIsTerlambat === true && (
                  <div
                    style={{
                      borderTop: "1px dashed var(--border)",
                      paddingTop: 18,
                      marginBottom: 20,
                    }}
                  >
                    <div className="late-fields-row" style={{ marginBottom: 16 }}>
                      {/* Kondisi Pengiriman */}
                      <div>
                        <label>
                          Kondisi Pengiriman <span style={{ color: "var(--red)" }}>*</span>
                        </label>
                        <div className="shift-toggle" style={{ height: 38 }}>
                          <button
                            id="sub-opt-terlambat"
                            type="button"
                            className={formStatusPengiriman === "terlambat" ? "active-pagi" : ""}
                            onClick={() => setFormStatusPengiriman("terlambat")}
                          >
                            Dikirim Terlambat
                          </button>
                          <button
                            id="sub-opt-tidak-dikirim"
                            type="button"
                            className={formStatusPengiriman === "tidak_dikirim" ? "active-pagi" : ""}
                            onClick={() => {
                              setFormStatusPengiriman("tidak_dikirim");
                              setFormMenit("");
                            }}
                          >
                            Tidak Dikirim
                          </button>
                        </div>
                      </div>

                      {/* Jumlah Keterlambatan & Kategori Otomatis */}
                      {formStatusPengiriman === "terlambat" ? (
                        <div>
                          <label htmlFor="input-menit">
                            Jumlah Keterlambatan <span style={{ color: "var(--red)" }}>*</span>
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ position: "relative", width: 130 }}>
                              <input
                                id="input-menit"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={formMenit}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^0-9]/g, "");
                                  setFormMenit(v);
                                }}
                                required
                                style={{ textAlign: "center", height: 38, paddingRight: 48 }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  right: 12,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  pointerEvents: "none",
                                }}
                              >
                                menit
                              </span>
                            </div>

                            {/* Badge Kategori Otomatis */}
                            {formComputedKategori ? (
                              <span
                                className="pill"
                                style={{
                                  height: 38,
                                  padding: "0 12px",
                                  fontSize: 12,
                                  borderRadius: "var(--radius-sm)",
                                  gap: 6,
                                  backgroundColor:
                                    formComputedKategori === "Lebih dari 60 Menit"
                                      ? "var(--red-bg)"
                                      : "var(--amber-bg)",
                                  color:
                                    formComputedKategori === "Lebih dari 60 Menit"
                                      ? "var(--red)"
                                      : "var(--amber)",
                                  border:
                                    formComputedKategori === "Lebih dari 60 Menit"
                                      ? "1px solid var(--red-light)"
                                      : "1px solid #fde68a",
                                }}
                              >
                                <Clock size={13} />
                                <span>{formComputedKategori}</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                  lineHeight: "38px",
                                }}
                              >
                                (Masukkan durasi menit)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label>Kategori Keterlambatan</label>
                          <div style={{ display: "flex", alignItems: "center", height: 38 }}>
                            <span
                              className="pill"
                              style={{
                                height: 38,
                                padding: "0 14px",
                                fontSize: 12,
                                borderRadius: "var(--radius-sm)",
                                gap: 6,
                                backgroundColor: "var(--red-bg)",
                                color: "var(--red)",
                                border: "1px solid var(--red-light)",
                              }}
                            >
                              <AlertCircle size={13} />
                              <span>Tidak Dikirim</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Komentar */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <label htmlFor="input-komentar" style={{ margin: 0 }}>
                          Komentar / Alasan Keterlambatan (Opsional)
                        </label>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {formKomentar.length} / 500
                        </span>
                      </div>
                      <textarea
                        id="input-komentar"
                        rows={3}
                        maxLength={500}
                        placeholder="Tuliskan alasan atau keterangan keterlambatan jika diperlukan."
                        value={formKomentar}
                        onChange={(e) => setFormKomentar(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Footer Tombol Aksi Form */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <button
                    id="btn-reset"
                    type="button"
                    className="btn btn-outline"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>
                  <button
                    id="btn-simpan"
                    type="submit"
                    className="btn btn-solid"
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} strokeWidth={2.2} />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT KETERLAMBATAN */}
      {/* ========================================================================= */}
      {activeTab === "riwayat" && (
        <div
          id="panel-riwayat-keterlambatan"
          role="tabpanel"
          aria-labelledby="tab-riwayat-keterlambatan"
        >
          {/* Panel Filter */}
          <div className="panel" style={{ padding: "16px 20px", marginBottom: 16 }}>
            <div className="filters-grid">
              {/* Search */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Cari Katering / Alasan
                </label>
                <div className="icon-input">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Ketik katering..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ height: 38 }}
                  />
                </div>
              </div>

              {/* Tanggal Mulai */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Tanggal Mulai
                </label>
                <IndoDatePicker
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>

              {/* Tanggal Selesai */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Tanggal Selesai
                </label>
                <IndoDatePicker
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>

              {/* Shift */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Shift
                </label>
                <div className="select-custom-wrap">
                  <select
                    value={filterShift}
                    onChange={(e) => setFilterShift(e.target.value)}
                    aria-label="Filter Shift"
                  >
                    <option value="">Semua Shift</option>
                    <option value="pagi">Pagi</option>
                    <option value="malam">Malam</option>
                  </select>
                  <div className="select-custom-arrow">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Status Pengiriman
                </label>
                <div className="select-custom-wrap">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    aria-label="Filter Status Pengiriman"
                  >
                    <option value="">Semua Status</option>
                    <option value="tepat_waktu">Tepat Waktu</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="tidak_dikirim">Tidak Dikirim</option>
                  </select>
                  <div className="select-custom-arrow">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Reset Filter Button */}
              <div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetFilters}
                  style={{ width: "100%", justifyContent: "center", height: 38, gap: 6, whiteSpace: "nowrap", padding: "0 14px" }}
                >
                  <RotateCcw size={13} />
                  <span>Reset Filter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table Container Panel */}
          <div className="panel">
            <div
              className="panel-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <History size={16} />
                <span>Daftar Riwayat Keterlambatan</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                  Total: {filteredRecords.length} data
                </span>
                <ExportExcelButton
                  onClick={handleExportExcel}
                  isLoading={isExportingExcel}
                  title="Export Excel"
                />
              </div>
            </div>


            {isLoadingHistory ? (
              <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 10px auto" }} />
                <p style={{ margin: 0, fontSize: 13 }}>Memuat riwayat keterlambatan...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                <Clock size={32} style={{ margin: "0 auto 10px auto", color: "var(--text-muted)" }} />
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                  Belum ada data keterlambatan
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  {records.length === 0
                    ? "Gunakan tab Input Keterlambatan untuk mulai mencatat histori kedatangan makanan."
                    : "Tidak ada data yang sesuai dengan filter pencarian."}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: "center" }}>No</th>
                      <th style={{ width: 120, textAlign: "center" }}>Tanggal</th>
                      <th style={{ width: 90, textAlign: "center" }}>Shift</th>
                      <th style={{ textAlign: "center" }}>Katering</th>
                      <th style={{ width: 140, textAlign: "center" }}>Status</th>
                      <th style={{ width: 100, textAlign: "center" }}>Durasi</th>
                      <th style={{ width: 160, textAlign: "center" }}>Kategori</th>
                      <th style={{ textAlign: "left" }}>Komentar</th>
                      <th style={{ width: 110, textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.map((r, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr key={r.id}>
                          <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                            {rowNum}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {formatIndoDate(r.tanggal)}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              className={`pill ${
                                r.shift.toLowerCase() === "pagi" ? "pill-pagi" : "pill-malam"
                              }`}
                            >
                              {r.shift.toLowerCase() === "pagi" ? "Pagi" : "Malam"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>
                            {r.catering_nama}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            {r.status_pengiriman === "tepat_waktu" && (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: "var(--green-bg)",
                                  color: "var(--green)",
                                  border: "1px solid rgba(21, 128, 61, 0.2)",
                                }}
                              >
                                Tepat Waktu
                              </span>
                            )}
                            {r.status_pengiriman === "terlambat" && (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: "var(--amber-bg)",
                                  color: "var(--amber)",
                                  border: "1px solid rgba(180, 83, 9, 0.2)",
                                }}
                              >
                                Terlambat
                              </span>
                            )}
                            {r.status_pengiriman === "tidak_dikirim" && (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: "var(--red-bg)",
                                  color: "var(--red)",
                                  border: "1px solid var(--red-light)",
                                }}
                              >
                                Tidak Dikirim
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            {r.status_pengiriman === "terlambat" && r.menit_terlambat !== null
                              ? `${r.menit_terlambat} menit`
                              : "—"}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            {r.kategori ? (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: "var(--border-subtle)",
                                  color: "var(--text)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                {r.kategori}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td
                            style={{
                              textAlign: "left",
                              color: "var(--text-secondary)",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={r.komentar || ""}
                          >
                            {r.komentar || "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setViewingRecord(r)}
                                aria-label="Lihat detail keterlambatan"
                                title="Lihat detail"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  justifyContent: "center",
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleOpenEdit(r)}
                                aria-label="Edit data keterlambatan"
                                title="Edit data"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  justifyContent: "center",
                                  color: "var(--text)",
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setDeletingRecord(r)}
                                aria-label="Hapus data keterlambatan"
                                title="Hapus data"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  justifyContent: "center",
                                  color: "var(--red)",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredRecords.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "var(--sidebar-bg)",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>
                  Menampilkan{" "}
                  <strong>
                    {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredRecords.length)}
                  </strong>{" "}
                  dari <strong>{filteredRecords.length}</strong> data
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ height: 30, padding: "0 8px", fontSize: 12 }}
                  >
                    <ChevronLeft size={13} />
                    <span>Prev</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && (
                            <span style={{ padding: "0 4px", color: "var(--text-muted)" }}>...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            style={{
                              height: 30,
                              minWidth: 30,
                              padding: "0 6px",
                              borderRadius: "var(--radius-sm)",
                              border:
                                p === currentPage
                                  ? "1px solid var(--red-dark, #8f1a25)"
                                  : "1px solid var(--border-strong)",
                              backgroundColor:
                                p === currentPage ? "var(--red-dark, #8f1a25)" : "var(--card)",
                              color: p === currentPage ? "#ffffff" : "var(--text)",
                              fontSize: 12,
                              fontWeight: p === currentPage ? 700 : 500,
                              cursor: "pointer",
                            }}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ height: 30, padding: "0 8px", fontSize: 12 }}
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL LIHAT DETAIL (READ-ONLY) */}
      {/* ========================================================================= */}
      {viewingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-view-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            padding: 16,
          }}
          onClick={() => setViewingRecord(null)}
        >
          <div
            className="panel"
            style={{
              maxWidth: 480,
              width: "100%",
              marginBottom: 0,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="panel-header"
              style={{ justifyContent: "space-between" }}
            >
              <div>
                <span className="eyebrow" style={{ marginBottom: 2 }}>
                  DETAIL KETERLAMBATAN
                </span>
                <h3
                  id="modal-view-title"
                  style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}
                >
                  {viewingRecord.catering_nama}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                aria-label="Tutup popup"
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Tanggal</label>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                    {formatIndoDate(viewingRecord.tanggal)}
                  </p>
                </div>
                <div>
                  <label>Shift</label>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                    {viewingRecord.shift.toLowerCase() === "pagi" ? "Pagi" : "Malam"}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Status Pengiriman</label>
                  <div style={{ marginTop: 2 }}>
                    {viewingRecord.status_pengiriman === "tepat_waktu" && (
                      <span className="status-approved">Tepat Waktu</span>
                    )}
                    {viewingRecord.status_pengiriman === "terlambat" && (
                      <span style={{ color: "var(--amber)", fontWeight: 700, fontSize: 12 }}>
                        Terlambat
                      </span>
                    )}
                    {viewingRecord.status_pengiriman === "tidak_dikirim" && (
                      <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 12 }}>
                        Tidak Dikirim
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label>Durasi</label>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                    {viewingRecord.status_pengiriman === "terlambat" && viewingRecord.menit_terlambat !== null
                      ? `${viewingRecord.menit_terlambat} menit`
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <label>Kategori</label>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--red)" }}>
                  {viewingRecord.kategori || "—"}
                </p>
              </div>

              <div>
                <label>Komentar / Alasan</label>
                <div
                  style={{
                    marginTop: 4,
                    padding: "10px 12px",
                    backgroundColor: "var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    color: "var(--text)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {viewingRecord.komentar || "Tidak ada keterangan tambahan."}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border)",
                backgroundColor: "var(--sidebar-bg)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setViewingRecord(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL EDIT KETERLAMBATAN */}
      {/* ========================================================================= */}
      {editingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: 500,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              marginBottom: 0,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
          >
            <form onSubmit={handleSubmitEdit}>
              <div
                className="panel-header"
                style={{ justifyContent: "space-between" }}
              >
                <div>
                  <span className="eyebrow" style={{ marginBottom: 2 }}>
                    PERBARUI DATA
                  </span>
                  <h3
                    id="modal-edit-title"
                    style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}
                  >
                    Edit Keterlambatan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  disabled={isUpdating}
                  aria-label="Tutup form edit"
                  style={{
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Katering */}
                <div>
                  <label>Nama Katering</label>
                  <div className="select-custom-wrap">
                    <select
                      value={editCateringId}
                      onChange={(e) => setEditCateringId(Number(e.target.value))}
                      required
                    >
                      {caterings.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nama} {c.is_active ? "" : "(Nonaktif)"}
                        </option>
                      ))}
                    </select>
                    <div className="select-custom-arrow">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Tanggal & Shift */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label>Tanggal</label>
                    <IndoDatePicker
                      value={editTanggal}
                      onChange={(e) => setEditTanggal(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label>Shift</label>
                    <div className="shift-toggle">
                      <button
                        type="button"
                        className={editShift === "pagi" ? "active-pagi" : ""}
                        onClick={() => setEditShift("pagi")}
                      >
                        Pagi
                      </button>
                      <button
                        type="button"
                        className={editShift === "malam" ? "active-malam" : ""}
                        onClick={() => setEditShift("malam")}
                      >
                        Malam
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Keterlambatan */}
                <div>
                  <label>Status Pengiriman</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsTerlambat(false);
                        setEditStatusPengiriman("tepat_waktu");
                        setEditMenit("");
                        setEditKomentar("");
                      }}
                      style={{
                        height: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: "var(--radius-sm)",
                        border: !editIsTerlambat
                          ? "1.5px solid var(--green)"
                          : "1px solid var(--border-strong)",
                        backgroundColor: !editIsTerlambat ? "var(--green-bg)" : "var(--card)",
                        color: !editIsTerlambat ? "var(--green)" : "var(--text-secondary)",
                        fontWeight: !editIsTerlambat ? 700 : 500,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Tepat Waktu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditIsTerlambat(true);
                        setEditStatusPengiriman("terlambat");
                      }}
                      style={{
                        height: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: "var(--radius-sm)",
                        border: editIsTerlambat
                          ? "1.5px solid var(--amber, #b45309)"
                          : "1px solid var(--border-strong)",
                        backgroundColor: editIsTerlambat ? "var(--amber-bg)" : "var(--card)",
                        color: editIsTerlambat ? "var(--amber, #b45309)" : "var(--text-secondary)",
                        fontWeight: editIsTerlambat ? 700 : 500,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <Clock size={14} />
                      <span>Terlambat / Tidak Dikirim</span>
                    </button>
                  </div>
                </div>

                {/* Rincian jika terlambat */}
                {editIsTerlambat && (
                  <div
                    style={{
                      borderTop: "1px dashed var(--border)",
                      paddingTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label>Kondisi Pengiriman</label>
                      <div className="shift-toggle" style={{ height: 38 }}>
                        <button
                          type="button"
                          className={editStatusPengiriman === "terlambat" ? "active-pagi" : ""}
                          onClick={() => setEditStatusPengiriman("terlambat")}
                        >
                          Dikirim Terlambat
                        </button>
                        <button
                          type="button"
                          className={editStatusPengiriman === "tidak_dikirim" ? "active-pagi" : ""}
                          onClick={() => {
                            setEditStatusPengiriman("tidak_dikirim");
                            setEditMenit("");
                          }}
                        >
                          Tidak Dikirim
                        </button>
                      </div>
                    </div>

                    {editStatusPengiriman === "terlambat" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label>Menit Terlambat</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editMenit}
                            onChange={(e) => setEditMenit(e.target.value.replace(/[^0-9]/g, ""))}
                            required
                            placeholder="Menit"
                            style={{ textAlign: "center" }}
                          />
                        </div>

                        <div>
                          <label>Kategori Otomatis</label>
                          <div
                            style={{
                              height: 38,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0 10px",
                              backgroundColor: "var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: "var(--red)",
                            }}
                          >
                            {editComputedKategori || "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <label style={{ margin: 0 }}>Komentar / Alasan</label>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {editKomentar.length} / 500
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={editKomentar}
                        onChange={(e) => setEditKomentar(e.target.value)}
                        placeholder="Tuliskan keterangan jika ada..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "var(--sidebar-bg)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingRecord(null)}
                  disabled={isUpdating}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-solid"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI HAPUS */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={deletingRecord !== null}
        title="Konfirmasi Hapus Keterlambatan"
        itemName={
          deletingRecord
            ? `${deletingRecord.catering_nama} (${formatIndoDate(deletingRecord.tanggal)} - Shift ${
                deletingRecord.shift.toLowerCase() === "pagi" ? "Pagi" : "Malam"
              })`
            : ""
        }
        description="Apakah Anda yakin ingin menghapus data keterlambatan ini? Data yang sudah dihapus tidak dapat dipulihkan."
        confirmText="Hapus"
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingRecord(null)}
      />
    </div>
  );
}
