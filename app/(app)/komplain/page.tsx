"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquareWarning,
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
  UploadCloud,
  Image as ImageIcon,
  FileWarning,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  Catering,
  getCatering,
  KomplainRecord,
  KomplainPayload,
  SourceMenuResponse,
  getKomplainCatering as getKomplain,
  getKomplainCateringById as getKomplainById,
  getSourceMenu,
  uploadFotoKomplain,
  createKomplainCatering as createKomplain,
  updateKomplainCatering as updateKomplain,
  deleteKomplainCatering as deleteKomplain,
  exportKomplainExcelApi,
  exportKomplainWeeklyExcelApi,
  getBaseUrl,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ProtectedImage from "@/components/ProtectedImage";
import { useToast } from "@/context/ToastContext";
import { formatIndoTimestamp } from "@/lib/formatters";
import { useModalA11y } from "@/hooks/useModalA11y";


function formatIndoDate(dateStr: string, fullMonth: boolean = true): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: fullMonth ? "long" : "short",
        year: "numeric",
      });
    }
  } catch {}
  return dateStr;
}

interface CustomSelectProps {
  id?: string;
  value: string | number;
  placeholder: string;
  options: { value: string | number; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
}

function CustomSelect({ id, value, placeholder, options, onChange, disabled }: CustomSelectProps) {
  return (
    <div className="select-custom-wrap">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={value ? "has-value" : "is-placeholder"}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="select-custom-arrow">
        <ChevronDown size={15} />
      </div>
    </div>
  );
}

export default function KomplainPage() {
  const { showSuccess, showError, showWarning } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"input" | "riwayat">("input");

  // Master Caterings
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [activeCaterings, setActiveCaterings] = useState<Catering[]>([]);

  // =========================================================================
  // TAB 1: FORM INPUT KOMPLAIN STATE
  // =========================================================================
  const [formTanggal, setFormTanggal] = useState<string>("");
  const [formShift, setFormShift] = useState<"" | "Pagi" | "Malam">("");
  const [formCateringId, setFormCateringId] = useState<number | "">("");

  // Menu Search State
  const [menuLoading, setMenuLoading] = useState<boolean>(false);
  const [menuResult, setMenuResult] = useState<SourceMenuResponse | null>(null);
  const [menuConfirmed, setMenuConfirmed] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Foto State
  const [formFotoFile, setFormFotoFile] = useState<File | null>(null);
  const [formFotoPreview, setFormFotoPreview] = useState<string | null>(null);
  const [formFotoPath, setFormFotoPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keterangan State
  const [formKeterangan, setFormKeterangan] = useState<string>("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // =========================================================================
  // TAB 2: RIWAYAT KOMPLAIN STATE
  // =========================================================================
  const [records, setRecords] = useState<KomplainRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterShift, setFilterShift] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals state
  const [viewingRecord, setViewingRecord] = useState<KomplainRecord | null>(null);
  const [photoPreviewModalUrl, setPhotoPreviewModalUrl] = useState<string | null>(null);

  // Edit modal state
  const [editingRecord, setEditingRecord] = useState<KomplainRecord | null>(null);
  const [editTanggal, setEditTanggal] = useState<string>("");
  const [editShift, setEditShift] = useState<"" | "Pagi" | "Malam">("");
  const [editCateringId, setEditCateringId] = useState<number | "">("");
  const [editKeterangan, setEditKeterangan] = useState<string>("");
  const [editFotoFile, setEditFotoFile] = useState<File | null>(null);
  const [editFotoPreview, setEditFotoPreview] = useState<string | null>(null);
  const [editFotoPath, setEditFotoPath] = useState<string | null>(null);
  const [editMenuLoading, setEditMenuLoading] = useState<boolean>(false);
  const [editMenuResult, setEditMenuResult] = useState<SourceMenuResponse | null>(null);
  const [editMenuConfirmed, setEditMenuConfirmed] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const editAbortControllerRef = useRef<AbortController | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete modal state
  const [deletingRecord, setDeletingRecord] = useState<KomplainRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Download Excel state (keyed by komplain ID)
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadExcel = async (id: number) => {
    if (downloadingId !== null) return;
    setDownloadingId(id);
    try {
      const { blob, filename } = await exportKomplainExcelApi(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess("Laporan Komplain berhasil diunduh.");
    } catch (err: any) {
      showError(err?.message || "Gagal mengunduh laporan Komplain.");
    } finally {
      setDownloadingId(null);
    }
  };

  // =========================================================================
  // WEEKLY EXPORT STATE & HANDLERS
  // =========================================================================
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState<boolean>(false);
  const [isExportingWeekly, setIsExportingWeekly] = useState<boolean>(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState<string>("");
  const [weeklyEndDate, setWeeklyEndDate] = useState<string>("");
  const [weeklyCateringId, setWeeklyCateringId] = useState<string>("all");
  const [weeklyShift, setWeeklyShift] = useState<string>("all");
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const handleOpenWeeklyModal = () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 6);

    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setWeeklyStartDate(fmt(past));
    setWeeklyEndDate(fmt(today));
    setWeeklyCateringId("all");
    setWeeklyShift("all");
    setWeeklyError(null);
    setIsWeeklyModalOpen(true);
  };

  // Accessibility hooks untuk seluruh modal di halaman Komplain
  const submitModalRef = useModalA11y<HTMLDivElement>({
    isOpen: showSubmitModal,
    onClose: () => setShowSubmitModal(false),
    isLoading: isSubmitting,
  });

  const viewModalRef = useModalA11y<HTMLDivElement>({
    isOpen: Boolean(viewingRecord),
    onClose: () => setViewingRecord(null),
  });

  const editModalRef = useModalA11y<HTMLDivElement>({
    isOpen: Boolean(editingRecord),
    onClose: () => !isUpdating && setEditingRecord(null),
    isLoading: isUpdating,
  });

  const photoModalRef = useModalA11y<HTMLDivElement>({
    isOpen: Boolean(photoPreviewModalUrl),
    onClose: () => setPhotoPreviewModalUrl(null),
  });

  const weeklyModalRef = useModalA11y<HTMLDivElement>({
    isOpen: isWeeklyModalOpen,
    onClose: () => !isExportingWeekly && setIsWeeklyModalOpen(false),
    isLoading: isExportingWeekly,
  });

  const handleWeeklyExportSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isExportingWeekly) return;

    setWeeklyError(null);

    if (!weeklyStartDate || !weeklyStartDate.trim()) {
      setWeeklyError("Tanggal mulai wajib dipilih.");
      return;
    }
    if (!weeklyEndDate || !weeklyEndDate.trim()) {
      setWeeklyError("Tanggal selesai wajib dipilih.");
      return;
    }

    const startObj = new Date(weeklyStartDate + "T00:00:00");
    const endObj = new Date(weeklyEndDate + "T00:00:00");

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      setWeeklyError("Format tanggal tidak valid.");
      return;
    }

    if (endObj < startObj) {
      setWeeklyError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    const diffTime = endObj.getTime() - startObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 7) {
      setWeeklyError(`Rentang tanggal maksimal 7 hari kalender secara inklusif (pilihan Anda: ${diffDays} hari).`);
      return;
    }

    setIsExportingWeekly(true);
    try {
      const { blob, filename } = await exportKomplainWeeklyExcelApi({
        start_date: weeklyStartDate,
        end_date: weeklyEndDate,
        catering_id: weeklyCateringId !== "all" ? weeklyCateringId : undefined,
        shift: weeklyShift !== "all" ? weeklyShift : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setIsWeeklyModalOpen(false);
      showSuccess("Laporan Komplain mingguan berhasil diunduh.");
    } catch (err: any) {
      const errMsg = err?.message || "Gagal mengunduh laporan Komplain mingguan.";
      setWeeklyError(errMsg);
      showError(errMsg);
    } finally {
      setIsExportingWeekly(false);
    }
  };

  // =========================================================================
  // LOAD MASTER DATA
  // =========================================================================
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

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getKomplain({
        start: filterStartDate || undefined,
        end: filterEndDate || undefined,
        shift: filterShift || undefined,
      });
      setRecords(data);
    } catch (err: any) {
      showError(err?.message || "Gagal memuat riwayat komplain");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filterStartDate, filterEndDate, filterShift, showError]);

  useEffect(() => {
    loadCaterings();
  }, [loadCaterings]);

  useEffect(() => {
    if (activeTab === "riwayat") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Selected Catering Name in Tab 1
  const selectedCatering = useMemo(() => {
    if (!formCateringId) return null;
    return caterings.find((c) => c.id === Number(formCateringId)) || null;
  }, [caterings, formCateringId]);

  // =========================================================================
  // AUTO MENU SEARCH FOR TAB 1 (INPUT)
  // =========================================================================
  useEffect(() => {
    // Batalkan request yang sedang berjalan jika pilihan berubah
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMenuConfirmed(false);

    // Menu belum dicari jika tiga filter belum lengkap
    if (!formTanggal || !formShift || !formCateringId) {
      setMenuResult(null);
      setMenuLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMenuLoading(true);

    getSourceMenu(formTanggal, formShift, Number(formCateringId), controller.signal)
      .then((res) => {
        setMenuResult(res);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setMenuResult({
            found: false,
            count: 0,
            report_id: null,
            menu: null,
            message: err?.message || "Gagal memeriksa laporan menu makanan.",
          });
        }
      })
      .finally(() => {
        setMenuLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [formTanggal, formShift, formCateringId]);

  // =========================================================================
  // FOTO UPLOAD HANDLER FOR TAB 1
  // =========================================================================
  const handleSelectFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ["jpg", "jpeg", "png", "webp"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExts.includes(ext) || !file.type.startsWith("image/")) {
      showWarning("Hanya file gambar (.jpg, .jpeg, .png, .webp) yang diperbolehkan.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showWarning("Ukuran file foto maksimal 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFormFotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFormFotoPreview(objectUrl);
  };

  const handleRemoveFoto = useCallback(() => {
    if (formFotoPreview && formFotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(formFotoPreview);
    }
    setFormFotoFile(null);
    setFormFotoPreview(null);
    setFormFotoPath(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [formFotoPreview]);

  // Reset Tab 1 Form
  const resetForm = useCallback(() => {
    setFormTanggal("");
    setFormShift("");
    setFormCateringId("");
    setMenuResult(null);
    setMenuConfirmed(false);
    setMenuLoading(false);
    handleRemoveFoto();
    setFormKeterangan("");
    setShowSubmitModal(false);
  }, [handleRemoveFoto]);

  // Form Validity Check
  const isFormValid = useMemo(() => {
    if (!formTanggal || formTanggal.trim() === "") return false;
    if (!formShift || formShift.trim() === "") return false;
    if (!formCateringId || Number(formCateringId) <= 0) return false;
    if (!menuResult || !menuResult.found || !menuResult.report_id) return false;
    if (!menuConfirmed) return false;
    if (!formKeterangan || formKeterangan.trim().length === 0) return false;
    if (formKeterangan.trim().length > 1000) return false;
    return true;
  }, [formTanggal, formShift, formCateringId, menuResult, menuConfirmed, formKeterangan]);

  // Submit Handler
  const handleExecuteSave = async () => {
    if (!isFormValid || !menuResult || !menuResult.report_id) return;
    setIsSubmitting(true);

    try {
      let uploadedFotoPath = formFotoPath;
      if (formFotoFile) {
        const uploadRes = await uploadFotoKomplain(formFotoFile);
        uploadedFotoPath = uploadRes.foto_path;
      }

      const payload: KomplainPayload = {
        tanggal: formTanggal,
        shift: formShift,
        catering_id: Number(formCateringId),
        source_report_id: menuResult.report_id,
        menu_snapshot: menuResult.menu || "",
        foto_path: uploadedFotoPath || null,
        keterangan: formKeterangan.trim(),
      };

      await createKomplain(payload);
      showSuccess("Komplain berhasil disimpan.");
      resetForm();
      setActiveTab("riwayat");
      loadHistory();
    } catch (err: any) {
      showError(err?.message || "Gagal menyimpan komplain.");
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  // =========================================================================
  // AUTO MENU SEARCH FOR EDIT MODAL
  // =========================================================================
  const isEditComboChanged = useMemo(() => {
    if (!editingRecord) return false;
    return (
      editTanggal !== editingRecord.tanggal ||
      editShift.toLowerCase() !== editingRecord.shift.toLowerCase() ||
      Number(editCateringId) !== editingRecord.catering_id
    );
  }, [editingRecord, editTanggal, editShift, editCateringId]);

  useEffect(() => {
    if (!editingRecord) return;

    if (editAbortControllerRef.current) {
      editAbortControllerRef.current.abort();
      editAbortControllerRef.current = null;
    }

    // Jika kombinasi tanggal/shift/catering tidak berubah dari data awal, gunakan snapshot awal
    if (!isEditComboChanged) {
      setEditMenuResult({
        found: true,
        count: 1,
        report_id: editingRecord.source_report_id,
        menu: editingRecord.menu_snapshot,
        tanggal: editingRecord.tanggal,
        shift: editingRecord.shift,
        catering_id: editingRecord.catering_id,
        catering_nama: editingRecord.catering_nama,
      });
      setEditMenuConfirmed(true);
      setEditMenuLoading(false);
      return;
    }

    // Jika kombinasi berubah, reset konfirmasi dan ambil menu baru
    setEditMenuConfirmed(false);
    if (!editTanggal || !editShift || !editCateringId) {
      setEditMenuResult(null);
      setEditMenuLoading(false);
      return;
    }

    const controller = new AbortController();
    editAbortControllerRef.current = controller;
    setEditMenuLoading(true);

    getSourceMenu(editTanggal, editShift, Number(editCateringId), controller.signal)
      .then((res) => {
        setEditMenuResult(res);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setEditMenuResult({
            found: false,
            count: 0,
            report_id: null,
            menu: null,
            message: err?.message || "Gagal memeriksa laporan menu makanan.",
          });
        }
      })
      .finally(() => {
        setEditMenuLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [editingRecord, isEditComboChanged, editTanggal, editShift, editCateringId]);

  const handleOpenEdit = (rec: KomplainRecord) => {
    setEditingRecord(rec);
    setEditTanggal(rec.tanggal);
    setEditShift(rec.shift.toLowerCase() === "malam" ? "Malam" : "Pagi");
    setEditCateringId(rec.catering_id);
    setEditKeterangan(rec.keterangan || "");
    setEditFotoFile(null);
    setEditFotoPreview(rec.foto_path || null);
    setEditFotoPath(rec.foto_path || null);
    setEditMenuConfirmed(true);
  };

  const handleSelectEditFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ["jpg", "jpeg", "png", "webp"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExts.includes(ext) || !file.type.startsWith("image/")) {
      showWarning("Hanya file gambar (.jpg, .jpeg, .png, .webp) yang diperbolehkan.");
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showWarning("Ukuran file foto maksimal 5MB.");
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }

    setEditFotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setEditFotoPreview(objectUrl);
  };

  const handleRemoveEditFoto = () => {
    if (editFotoPreview && editFotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(editFotoPreview);
    }
    setEditFotoFile(null);
    setEditFotoPreview(null);
    setEditFotoPath(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleExecuteUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!editTanggal) {
      showWarning("Silakan tentukan tanggal.");
      return;
    }
    if (!editShift) {
      showWarning("Silakan pilih shift.");
      return;
    }
    if (!editCateringId) {
      showWarning("Silakan pilih katering.");
      return;
    }
    if (!editMenuResult || !editMenuResult.found || !editMenuResult.report_id) {
      showWarning("Data menu makanan sumber belum valid untuk kombinasi tanggal, shift, dan katering ini.");
      return;
    }
    if (isEditComboChanged && !editMenuConfirmed) {
      showWarning("Silakan periksa dan centang konfirmasi menu terbaru.");
      return;
    }
    if (!editKeterangan.trim()) {
      showWarning("Keterangan komplain wajib diisi.");
      return;
    }

    setIsUpdating(true);
    try {
      let finalFotoPath = editFotoPath;
      if (editFotoFile) {
        const uploadRes = await uploadFotoKomplain(editFotoFile);
        finalFotoPath = uploadRes.foto_path;
      }

      const payload: KomplainPayload = {
        tanggal: editTanggal,
        shift: editShift,
        catering_id: Number(editCateringId),
        source_report_id: editMenuResult.report_id,
        menu_snapshot: editMenuResult.menu || editingRecord.menu_snapshot,
        foto_path: finalFotoPath || null,
        keterangan: editKeterangan.trim(),
      };

      await updateKomplain(editingRecord.id, payload);
      showSuccess("Data komplain berhasil diperbarui.");
      setEditingRecord(null);
      loadHistory();
    } catch (err: any) {
      showError(err?.message || "Gagal memperbarui data komplain.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      await deleteKomplain(deletingRecord.id);
      showSuccess("Data komplain berhasil dihapus.");
      setDeletingRecord(null);
      loadHistory();
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus data komplain.");
    } finally {
      setIsDeleting(false);
    }
  };

  // History Filter & Search
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nama = (r.catering_nama || "").toLowerCase();
        const ket = (r.keterangan || "").toLowerCase();
        const menu = (r.menu_snapshot || "").toLowerCase();
        if (!nama.includes(q) && !ket.includes(q) && !menu.includes(q)) return false;
      }
      return true;
    });
  }, [records, searchQuery]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIdx, startIdx + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterShift("");
    setCurrentPage(1);
    loadHistory();
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      <style>{`
        .kp-tablist-nav {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--border, #e2e8f0);
          margin-bottom: 24px;
          overflow-x: visible;
          overflow-y: visible;
        }

        .select-custom-wrap {
          position: relative;
          width: 100%;
        }
        .select-custom-wrap select {
          width: 100%;
          height: 38px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: var(--radius-sm, 4px);
          padding: 0 38px 0 12px;
          font-size: 13.5px;
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
        .select-custom-wrap select.is-placeholder {
          color: var(--text-muted, #94a3b8);
          font-weight: 400;
        }
        .select-custom-wrap select::-ms-expand {
          display: none;
        }
        .select-custom-wrap select:focus {
          border-color: var(--red, #991b1b);
          box-shadow: 0 0 0 3px var(--red-bg, rgba(239, 68, 68, 0.1));
        }
        .select-custom-wrap .select-custom-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .form-cols-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: 1.5fr 1.1fr 1.1fr 1.1fr auto;
          gap: 12px;
          align-items: flex-end;
        }
        .filters-grid > div {
          min-width: 0;
        }

        .menu-confirm-panel {
          border: 1px solid #bfdbfe;
          background-color: #f8fafc;
          border-left: 4px solid #2563eb;
          border-radius: 6px;
          padding: 16px;
          margin-top: 12px;
          transition: all 180ms ease;
        }
        .menu-empty-panel {
          border: 1px dashed #cbd5e1;
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 16px;
          margin-top: 12px;
          color: #64748b;
          font-size: 13.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .menu-error-panel {
          border: 1px solid #fecaca;
          background-color: #fef2f2;
          border-left: 4px solid #dc2626;
          border-radius: 6px;
          padding: 16px;
          margin-top: 12px;
          color: #991b1b;
          font-size: 13.5px;
        }

        .komplain-desktop-table {
          display: block;
        }
        .komplain-tablet-cards {
          display: none;
        }

        /* Tablet Landscape: 768px - 1023px */
        @media (max-width: 1023px) and (min-width: 768px) {
          .filters-grid {
            grid-template-columns: 1.3fr 1fr 1fr 1fr auto;
            gap: 10px;
          }
        }

        /* Tablet Portrait: 600px - 767px */
        @media (max-width: 767px) {
          .form-cols-3 {
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .form-col-catering {
            grid-column: span 2;
          }
          .filters-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .filter-col-search {
            grid-column: span 2;
          }
          .filter-col-actions {
            grid-column: span 2;
            display: flex;
            justify-content: flex-end;
          }
          .komplain-desktop-table {
            display: none !important;
          }
          .komplain-tablet-cards {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
        }

        /* Modal Simpan Komplain Animations & Styles */
        @keyframes submitModalBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes submitModalCardScaleIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .submit-modal-overlay {
          animation: submitModalBackdropFadeIn 180ms ease-out;
        }
        .submit-modal-card {
          width: 100%;
          max-width: 580px;
          max-height: calc(100vh - 48px);
          animation: submitModalCardScaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (max-width: 1023px) {
          .submit-modal-card {
            max-width: min(600px, calc(100vw - 48px));
          }
        }
        .submit-modal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .submit-modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
        }
        .submit-modal-btn {
          height: 38px;
          border-radius: 6px;
        }

        /* MODAL EXPORT KOMPLAIN MINGGUAN REFINEMENT */
        .weekly-modal-card {
          width: 100%;
          max-width: 680px;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background-color: #ffffff;
          border-radius: 10px;
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.08);
          padding: 26px 28px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          animation: submitModalCardScaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (max-width: 1023px) {
          .weekly-modal-card {
            max-width: min(680px, calc(100vw - 48px));
          }
        }
        @media (max-width: 767px) {
          .weekly-modal-card {
            max-width: calc(100vw - 32px);
            padding: 22px 20px;
          }
        }
        .weekly-modal-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 16px;
          row-gap: 20px;
          width: 100%;
        }
        @media (max-width: 540px) {
          .weekly-modal-form-grid {
            grid-template-columns: 1fr;
            row-gap: 16px;
          }
        }
        .weekly-modal-field-wrap {
          min-width: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        .weekly-modal-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          margin-bottom: 8px;
          color: var(--text, #0f172a);
          line-height: 1;
        }
        .weekly-modal-label .label-optional {
          font-size: 11px;
          font-weight: 400;
          color: var(--text-muted, #64748b);
          margin-left: 3px;
        }
        .weekly-modal-label .label-required {
          color: var(--red, #ef4444);
          font-weight: 600;
        }
        .weekly-modal-input {
          width: 100%;
          height: 46px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 6px;
          padding: 0 12px;
          font-size: 13.5px;
          font-family: inherit;
          background-color: var(--card, #ffffff);
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .weekly-modal-input:focus {
          border-color: var(--red-dark, #8f1a25);
          box-shadow: 0 0 0 3px rgba(143, 26, 37, 0.1);
        }
        .weekly-modal-card .select-custom-wrap {
          width: 100%;
          min-width: 0;
        }
        .weekly-modal-card .select-custom-wrap select {
          height: 46px !important;
          border-radius: 6px !important;
          font-size: 13.5px !important;
          line-height: 44px !important;
          padding: 0 36px 0 12px !important;
          box-sizing: border-box !important;
        }
        .weekly-modal-card .select-custom-wrap .select-custom-arrow {
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
        }
        .weekly-modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          border-top: 1px solid var(--border, #e2e8f0);
          padding-top: 20px;
          margin-top: 22px;
          width: 100%;
        }
        .weekly-modal-btn {
          height: 42px;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: 600;
          box-sizing: border-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .submit-modal-overlay,
          .submit-modal-card,
          .weekly-modal-card {
            animation: none !important;
            transform: none !important;
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
            Komplain Katering
          </h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* 2. Tab Navigasi */}
      <div
        role="tablist"
        aria-label="Tab Menu Komplain"
        className="kp-tablist-nav"
      >
        <button
          type="button"
          role="tab"
          id="tab-input-komplain"
          aria-controls="panel-input-komplain"
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
            transition: "all 150ms ease",
            marginBottom: -1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <PlusCircle size={16} strokeWidth={activeTab === "input" ? 2.3 : 1.8} />
          <span>Input Komplain</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-riwayat-komplain"
          aria-controls="panel-riwayat-komplain"
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
            transition: "all 150ms ease",
            marginBottom: -1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <History size={16} strokeWidth={activeTab === "riwayat" ? 2.3 : 1.8} />
          <span>Riwayat Komplain</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FORM INPUT KOMPLAIN */}
      {/* ========================================================================= */}
      {activeTab === "input" && (
        <div
          id="panel-input-komplain"
          role="tabpanel"
          aria-labelledby="tab-input-komplain"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isFormValid) {
                setShowSubmitModal(true);
              }
            }}
            className="card"
            style={{
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {/* Grid 3 Kolom: Tanggal, Shift, Catering */}
            <div className="form-cols-3">
              {/* 1. Tanggal */}
              <div className="form-col-tanggal">
                <label
                  htmlFor="input-tanggal"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Tanggal <span style={{ color: "var(--red, #ef4444)" }}>*</span>
                </label>
                <input
                  id="input-tanggal"
                  type="date"
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid var(--border-strong, #cbd5e1)",
                    borderRadius: "var(--radius-sm, 4px)",
                    padding: "0 12px",
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    backgroundColor: "var(--card, #ffffff)",
                    color: formTanggal ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {formTanggal && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                    {formatIndoDate(formTanggal, true)}
                  </p>
                )}
              </div>

              {/* 2. Shift */}
              <div className="form-col-shift">
                <label
                  htmlFor="input-shift"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Shift <span style={{ color: "var(--red, #ef4444)" }}>*</span>
                </label>
                <CustomSelect
                  id="input-shift"
                  value={formShift}
                  placeholder="Pilih shift"
                  options={[
                    { value: "Pagi", label: "Pagi" },
                    { value: "Malam", label: "Malam" },
                  ]}
                  onChange={(val) => setFormShift(val as "" | "Pagi" | "Malam")}
                />
              </div>

              {/* 3. Nama Catering */}
              <div className="form-col-catering">
                <label
                  htmlFor="input-catering"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Nama Catering <span style={{ color: "var(--red, #ef4444)" }}>*</span>
                </label>
                <CustomSelect
                  id="input-catering"
                  value={formCateringId}
                  placeholder="Pilih catering"
                  options={activeCaterings.map((c) => ({
                    value: c.id,
                    label: c.nama,
                  }))}
                  onChange={(val) => setFormCateringId(val ? Number(val) : "")}
                />
              </div>
            </div>

            {/* 4. Konfirmasi Menu Otomatis */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--text, #0f172a)",
                }}
              >
                Konfirmasi Menu <span style={{ color: "var(--red, #ef4444)" }}>*</span>
              </label>

              {/* Belum lengkap 3 pilihan */}
              {(!formTanggal || !formShift || !formCateringId) && (
                <div className="menu-empty-panel">
                  <AlertCircle size={17} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <span>
                    Pilih tanggal, shift, dan catering terlebih dahulu untuk menampilkan menu makanan secara otomatis.
                  </span>
                </div>
              )}

              {/* Sedang memuat */}
              {Boolean(formTanggal && formShift && formCateringId && menuLoading) && (
                <div className="menu-empty-panel" style={{ color: "#2563eb", borderColor: "#bfdbfe" }}>
                  <Loader2 size={17} className="spin" style={{ flexShrink: 0 }} />
                  <span>Mencari laporan menu makanan...</span>
                </div>
              )}

              {/* Data menu ditemukan (tepat 1) */}
              {Boolean(formTanggal && formShift && formCateringId && !menuLoading && menuResult?.found) && (
                <div className="menu-confirm-panel">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={16} style={{ color: "#2563eb", flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e3a8a" }}>
                      Menu pada {formatIndoDate(formTanggal, true)}, shift {formShift}, untuk catering{" "}
                      {selectedCatering?.nama || menuResult?.catering_nama || "JIHAN"} adalah:
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 14px 24px",
                      fontSize: 14,
                      lineHeight: "1.5",
                      color: "#1e293b",
                      fontWeight: 500,
                      backgroundColor: "#ffffff",
                      padding: "10px 14px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {menuResult?.menu}
                  </p>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      marginLeft: 4,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      id="checkbox-konfirmasi-menu"
                      checked={menuConfirmed}
                      onChange={(e) => setMenuConfirmed(e.target.checked)}
                      style={{
                        width: 17,
                        height: 17,
                        marginTop: 2,
                        cursor: "pointer",
                        accentColor: "var(--red, #ef4444)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: menuConfirmed ? 600 : 500,
                        color: menuConfirmed ? "#0f172a" : "#475569",
                      }}
                    >
                      Saya sudah memeriksa dan memastikan menu di atas sesuai dengan komplain.
                    </span>
                  </label>
                </div>
              )}

              {/* Data menu tidak ditemukan (count == 0) */}
              {Boolean(
                formTanggal &&
                  formShift &&
                  formCateringId &&
                  !menuLoading &&
                  menuResult &&
                  !menuResult.found &&
                  menuResult.count === 0
              )}
              {formTanggal &&
                formShift &&
                formCateringId &&
                !menuLoading &&
                menuResult &&
                !menuResult.found &&
                menuResult.count === 0 && (
                  <div className="menu-empty-panel" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}>
                    <FileWarning size={18} style={{ color: "#d97706", flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: "#b45309" }}>
                        Data menu belum tersedia untuk tanggal, shift, dan catering yang dipilih.
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#78350f" }}>
                        Pastikan laporan Kalori Harian untuk kombinasi tersebut sudah dicatat terlebih dahulu.
                      </p>
                    </div>
                  </div>
                )}

              {/* Data sumber ganda (count > 1) */}
              {Boolean(
                formTanggal &&
                  formShift &&
                  formCateringId &&
                  !menuLoading &&
                  menuResult &&
                  !menuResult.found &&
                  menuResult.count > 1
              )}
              {formTanggal &&
                formShift &&
                formCateringId &&
                !menuLoading &&
                menuResult &&
                !menuResult.found &&
                menuResult.count > 1 && (
                  <div className="menu-error-panel">
                    <p style={{ margin: 0, fontWeight: 700 }}>Peringatan Data Ganda</p>
                    <p style={{ margin: "4px 0 0", lineHeight: "1.4" }}>
                      {menuResult.message ||
                        "Terdapat lebih dari satu data laporan sumber untuk kombinasi ini. Komplain belum dapat dilanjutkan."}
                    </p>
                  </div>
                )}
            </div>

            {/* 5. Foto Catering (Upload) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Foto Catering <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted, #94a3b8)" }}>(Opsional)</span>
                </label>
              </div>

              <input
                ref={fileInputRef}
                id="input-foto-komplain"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleSelectFoto}
                style={{ display: "none" }}
              />

              {!formFotoPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "1px dashed var(--border-strong, #cbd5e1)",
                    borderRadius: 6,
                    padding: "18px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: "var(--bg-subtle, #f8fafc)",
                    transition: "all 140ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--red, #ef4444)";
                    e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong, #cbd5e1)";
                    e.currentTarget.style.backgroundColor = "var(--bg-subtle, #f8fafc)";
                  }}
                >
                  <UploadCloud size={24} style={{ color: "var(--text-muted, #94a3b8)", margin: "0 auto 6px" }} />
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text, #0f172a)" }}>
                    Klik untuk memilih foto bukti catering
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                    Format: JPG, JPEG, PNG, WEBP (Maksimal 5MB)
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: 12,
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 6,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div
                    onClick={() => setPhotoPreviewModalUrl(formFotoPreview)}
                    style={{ cursor: "zoom-in" }}
                    title="Klik untuk memperbesar"
                  >
                    <ProtectedImage
                      src={formFotoPreview}
                      alt="Preview Bukti Komplain"
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "cover",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text, #0f172a)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formFotoFile ? formFotoFile.name : "Foto Komplain"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                      {formFotoFile ? `${(formFotoFile.size / 1024).toFixed(1)} KB` : "Foto terpasang"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline"
                      style={{ height: 32, fontSize: 12, padding: "0 10px" }}
                    >
                      Ganti Foto
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFoto}
                      className="btn btn-outline"
                      style={{ height: 32, fontSize: 12, padding: "0 10px", color: "var(--red, #ef4444)" }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Keterangan Komplain */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  htmlFor="input-keterangan-komplain"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Keterangan Komplain <span style={{ color: "var(--red, #ef4444)" }}>*</span>
                </label>
                <span
                  style={{
                    fontSize: 12,
                    color: formKeterangan.length > 900 ? "var(--red, #ef4444)" : "var(--text-muted, #94a3b8)",
                    fontWeight: formKeterangan.length > 900 ? 600 : 400,
                  }}
                >
                  {formKeterangan.length} / 1.000 karakter
                </span>
              </div>
              <textarea
                id="input-keterangan-komplain"
                rows={4}
                maxLength={1000}
                placeholder="Tuliskan rincian komplain secara jelas dan singkat."
                value={formKeterangan}
                onChange={(e) => setFormKeterangan(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid var(--border-strong, #cbd5e1)",
                  borderRadius: "var(--radius-sm, 4px)",
                  padding: "10px 12px",
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  backgroundColor: "var(--card, #ffffff)",
                  color: "var(--text, #0f172a)",
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "vertical",
                  minHeight: 84,
                }}
              />
            </div>

            {/* Action Bar Tab 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                paddingTop: 8,
                borderTop: "1px solid var(--border, #e2e8f0)",
              }}
            >
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-outline"
                style={{ height: 38, fontSize: 13.5, padding: "0 18px" }}
              >
                Reset Form
              </button>
              <button
                id="btn-submit-komplain"
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="btn btn-primary"
                style={{
                  height: 38,
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "0 22px",
                  backgroundColor: isFormValid ? "var(--red-dark, #8f1a25)" : "var(--border-strong, #cbd5e1)",
                  cursor: isFormValid && !isSubmitting ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Simpan Komplain</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT KOMPLAIN TABLE */}
      {/* ========================================================================= */}
      {activeTab === "riwayat" && (
        <div
          id="panel-riwayat-komplain"
          role="tabpanel"
          aria-labelledby="tab-riwayat-komplain"
        >
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: "18px 20px",
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <div className="filters-grid">
              {/* Search */}
              <div className="filter-col-search">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 5,
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Cari Katering / Menu / Keterangan
                </label>
                <div style={{ position: "relative", width: "100%" }}>
                  <Search
                    size={15}
                    style={{
                      position: "absolute",
                      left: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted, #94a3b8)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Ketik kata kunci..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: "100%",
                      height: 38,
                      border: "1px solid var(--border-strong, #cbd5e1)",
                      borderRadius: "var(--radius-sm, 4px)",
                      padding: "0 12px 0 34px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      backgroundColor: "var(--card, #ffffff)",
                      color: "var(--text, #0f172a)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Tanggal Mulai */}
              <div className="filter-col-start">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 5,
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid var(--border-strong, #cbd5e1)",
                    borderRadius: "var(--radius-sm, 4px)",
                    padding: "0 10px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    backgroundColor: "var(--card, #ffffff)",
                    color: filterStartDate ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Tanggal Selesai */}
              <div className="filter-col-end">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 5,
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Tanggal Selesai
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    height: 38,
                    border: "1px solid var(--border-strong, #cbd5e1)",
                    borderRadius: "var(--radius-sm, 4px)",
                    padding: "0 10px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    backgroundColor: "var(--card, #ffffff)",
                    color: filterEndDate ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Shift */}
              <div className="filter-col-shift">
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 5,
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Shift
                </label>
                <CustomSelect
                  value={filterShift}
                  placeholder="Semua Shift"
                  options={[
                    { value: "Pagi", label: "Pagi" },
                    { value: "Malam", label: "Malam" },
                  ]}
                  onChange={(val) => {
                    setFilterShift(val);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Reset & Export Mingguan Buttons */}
              <div
                className="filter-col-actions"
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-outline"
                  style={{
                    height: 38,
                    fontSize: 13,
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                  title="Reset semua filter"
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWeeklyModal}
                  className="btn btn-primary"
                  style={{
                    height: 38,
                    fontSize: 13,
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                  title="Export"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <div className="komplain-desktop-table" style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--border, #e2e8f0)",
                      backgroundColor: "var(--bg-subtle, #f8fafc)",
                    }}
                  >
                    <th style={{ padding: "10px 8px", width: 40, textAlign: "center", fontWeight: 700 }}>
                      No
                    </th>
                    <th style={{ padding: "10px 8px", width: 95, fontWeight: 700 }}>Tanggal</th>
                    <th style={{ padding: "10px 8px", width: 68, fontWeight: 700 }}>Shift</th>
                    <th style={{ padding: "10px 10px", minWidth: 120, fontWeight: 700 }}>Menu</th>
                    <th style={{ padding: "10px 8px", width: 95, fontWeight: 700 }}>Catering</th>
                    <th style={{ padding: "10px 8px", width: 65, textAlign: "center", fontWeight: 700 }}>
                      Foto Catering
                    </th>
                    <th style={{ padding: "10px 10px", minWidth: 120, fontWeight: 700 }}>Keterangan</th>
                    <th style={{ padding: "10px 8px", width: 155, minWidth: 155, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                        <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                        <p style={{ margin: 0 }}>Memuat riwayat komplain...</p>
                      </td>
                    </tr>
                  ) : currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                        <MessageSquareWarning size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                        <p style={{ margin: 0, fontWeight: 600 }}>Belum ada data komplain.</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                          {records.length > 0 ? "Tidak ada komplain yang cocok dengan filter." : "Silakan masukkan komplain baru melalui tab Input Komplain."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((rec, idx) => {
                      const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr
                          key={rec.id}
                          style={{
                            borderBottom: "1px solid var(--border, #e2e8f0)",
                            transition: "background-color 100ms ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          {/* 1. No */}
                          <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 500, color: "var(--text-muted, #64748b)" }}>
                            {rowNumber}
                          </td>

                          {/* 2. Tanggal */}
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {formatIndoDate(rec.tanggal, false)}
                          </td>

                          {/* 3. Shift */}
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 11.5,
                                fontWeight: 600,
                                backgroundColor: rec.shift.toLowerCase() === "malam" ? "#f1f5f9" : "#eff6ff",
                                color: rec.shift.toLowerCase() === "malam" ? "#334155" : "#1d4ed8",
                                border: rec.shift.toLowerCase() === "malam" ? "1px solid #cbd5e1" : "1px solid #bfdbfe",
                              }}
                            >
                              {rec.shift}
                            </span>
                          </td>

                          {/* 4. Menu */}
                          <td style={{ padding: "10px 10px", lineHeight: "1.4" }}>
                            <div
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word",
                              }}
                              title={rec.menu_snapshot}
                            >
                              {rec.menu_snapshot}
                            </div>
                          </td>

                          {/* 5. Catering */}
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {rec.catering_nama}
                          </td>

                          {/* 6. Foto Catering */}
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            {rec.foto_path ? (
                              <button
                                type="button"
                                onClick={() => setPhotoPreviewModalUrl(rec.foto_path || null)}
                                title="Klik untuk memperbesar foto bukti"
                                style={{
                                  padding: 0,
                                  border: "1px solid var(--border, #e2e8f0)",
                                  background: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                }}
                              >
                                <ProtectedImage
                                  src={rec.foto_path}
                                  alt={`Bukti ${rec.catering_nama}`}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-muted, #94a3b8)" }}>-</span>
                            )}
                          </td>

                          {/* 7. Keterangan */}
                          <td style={{ padding: "10px 10px", lineHeight: "1.4" }}>
                            <div
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word",
                                color: "#334155",
                              }}
                              title={rec.keterangan}
                            >
                              {rec.keterangan}
                            </div>
                          </td>

                          {/* 8. Aksi */}
                          <td style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setViewingRecord(rec)}
                                aria-label={`Lihat detail komplain ID ${rec.id}`}
                                title="Lihat Detail"
                                className="btn btn-outline"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 4,
                                }}
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(rec)}
                                aria-label={`Edit komplain ID ${rec.id}`}
                                title="Edit Komplain"
                                className="btn btn-outline"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 4,
                                }}
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadExcel(rec.id)}
                                disabled={downloadingId === rec.id}
                                aria-label="Export"
                                title="Export"
                                className="btn btn-outline"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 4,
                                  cursor: downloadingId === rec.id ? "not-allowed" : "pointer",
                                  opacity: downloadingId === rec.id ? 0.7 : 1,
                                }}
                              >
                                {downloadingId === rec.id ? (
                                  <Loader2 size={14} className="animate-spin" style={{ animation: "spin 0.8s linear infinite" }} />
                                ) : (
                                  <Download size={14} />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingRecord(rec)}
                                aria-label={`Hapus komplain ID ${rec.id}`}
                                title="Hapus Komplain"
                                className="btn btn-outline"
                                style={{
                                  width: 30,
                                  height: 30,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 4,
                                  color: "var(--red, #ef4444)",
                                }}
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
            </div>

            {/* Tampilan Tablet Portrait (< 768px: Card Khusus Tablet Tanpa Horizontal Scroll) */}
            <div className="komplain-tablet-cards">
              {isLoadingHistory ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                  <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                  <p style={{ margin: 0 }}>Memuat riwayat komplain...</p>
                </div>
              ) : currentRecords.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                  <MessageSquareWarning size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Belum ada data komplain.</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                    {records.length > 0
                      ? "Tidak ada komplain yang cocok dengan filter."
                      : "Silakan masukkan komplain baru melalui tab Input Komplain."}
                  </p>
                </div>
              ) : (
                currentRecords.map((rec, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <div
                      key={`tab-card-${rec.id}`}
                      style={{
                        padding: "16px 20px",
                        borderRadius: 8,
                        border: "1px solid var(--border, #e2e8f0)",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {/* Baris 1 Tablet Card: Info Kiri, Aksi Icon-Only di Kanan */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          borderBottom: "1px solid var(--border, #f1f5f9)",
                          paddingBottom: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 26,
                              height: 24,
                              padding: "0 6px",
                              borderRadius: 4,
                              backgroundColor: "var(--bg-subtle, #f1f5f9)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text-muted, #475569)",
                            }}
                          >
                            #{rowNumber}
                          </span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                            {formatIndoDate(rec.tanggal, false)}
                          </span>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              fontWeight: 600,
                              backgroundColor: rec.shift.toLowerCase() === "malam" ? "#f1f5f9" : "#eff6ff",
                              color: rec.shift.toLowerCase() === "malam" ? "#334155" : "#1d4ed8",
                              border: rec.shift.toLowerCase() === "malam" ? "1px solid #cbd5e1" : "1px solid #bfdbfe",
                            }}
                          >
                            {rec.shift}
                          </span>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 700,
                              backgroundColor: "rgba(143, 26, 37, 0.08)",
                              color: "var(--red-dark, #8f1a25)",
                            }}
                          >
                            {rec.catering_nama}
                          </span>
                        </div>

                        {/* Tombol Aksi Icon-Only dengan Tooltip */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setViewingRecord(rec)}
                            aria-label={`Lihat detail komplain #${rec.id}`}
                            title="Lihat Detail"
                            className="btn btn-outline"
                            style={{
                              width: 32,
                              height: 32,
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            aria-label={`Edit komplain #${rec.id}`}
                            title="Edit Komplain"
                            className="btn btn-outline"
                            style={{
                              width: 32,
                              height: 32,
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadExcel(rec.id)}
                            disabled={downloadingId === rec.id}
                            aria-label="Export"
                            title="Export"
                            className="btn btn-outline"
                            style={{
                              width: 32,
                              height: 32,
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                              cursor: downloadingId === rec.id ? "not-allowed" : "pointer",
                              opacity: downloadingId === rec.id ? 0.7 : 1,
                            }}
                          >
                            {downloadingId === rec.id ? (
                              <Loader2 size={15} className="animate-spin" style={{ animation: "spin 0.8s linear infinite" }} />
                            ) : (
                              <Download size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRecord(rec)}
                            aria-label={`Hapus komplain #${rec.id}`}
                            title="Hapus Komplain"
                            className="btn btn-outline"
                            style={{
                              width: 32,
                              height: 32,
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                              color: "var(--red, #ef4444)",
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Baris 2 Tablet Card: 2 Kolom (Menu & Keterangan + Foto) */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 14,
                        }}
                      >
                        {/* Kolom 1: Menu Makanan */}
                        <div
                          style={{
                            backgroundColor: "var(--bg-subtle, #f8fafc)",
                            padding: "10px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--border, #e2e8f0)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-muted, #64748b)",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            Menu Makanan
                          </span>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              lineHeight: "1.45",
                              color: "var(--text, #1e293b)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                            title={rec.menu_snapshot}
                          >
                            {rec.menu_snapshot}
                          </p>
                        </div>

                        {/* Kolom 2: Keterangan & Foto Bukti */}
                        <div
                          style={{
                            backgroundColor: "var(--bg-subtle, #f8fafc)",
                            padding: "10px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--border, #e2e8f0)",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          {rec.foto_path && (
                            <div
                              onClick={() => setPhotoPreviewModalUrl(rec.foto_path || null)}
                              style={{
                                flexShrink: 0,
                                cursor: "zoom-in",
                                borderRadius: 4,
                                overflow: "hidden",
                                border: "1px solid var(--border, #cbd5e1)",
                              }}
                              title="Klik untuk memperbesar foto bukti"
                            >
                              <ProtectedImage
                                src={rec.foto_path}
                                alt={`Bukti ${rec.catering_nama}`}
                                style={{ width: 44, height: 44, objectFit: "cover", display: "block" }}
                              />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--text-muted, #64748b)",
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              Keterangan
                            </span>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 13,
                                lineHeight: "1.45",
                                color: "var(--text, #334155)",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word",
                              }}
                              title={rec.keterangan}
                            >
                              {rec.keterangan}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: "var(--text-muted, #64748b)" }}>
                  Menampilkan{" "}
                  <strong>
                    {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>{" "}
                  - <strong>{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> dari{" "}
                  <strong>{filteredRecords.length}</strong> data komplain
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="btn btn-outline"
                    style={{
                      height: 32,
                      padding: "0 10px",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      opacity: currentPage === 1 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft size={14} />
                    <span>Sebelumnya</span>
                  </button>

                  <span style={{ fontSize: 13, fontWeight: 600, padding: "0 8px" }}>
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="btn btn-outline"
                    style={{
                      height: 32,
                      padding: "0 10px",
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      opacity: currentPage === totalPages ? 0.5 : 1,
                    }}
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PRE-SUBMIT CONFIRMATION (SIMPAN KOMPLAIN?) */}
      {/* ========================================================================= */}
      {showSubmitModal && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="submit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setShowSubmitModal(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
          }}
        >
          <div
            ref={submitModalRef}
            className="submit-modal-card"
            style={{
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: 8,
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.08)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* 1. Header Modal */}
            <div
              style={{
                padding: "20px 24px 16px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                borderBottom: "1px solid var(--border, #f1f5f9)",
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: "rgba(143, 26, 37, 0.1)",
                    color: "var(--red-dark, #8f1a25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <MessageSquareWarning size={20} />
                </div>
                <div>
                  <h3
                    id="submit-modal-title"
                    style={{
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 700,
                      color: "var(--text, #0f172a)",
                      lineHeight: 1.25,
                    }}
                  >
                    Simpan Komplain?
                  </h3>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 13,
                      color: "var(--text-muted, #64748b)",
                      lineHeight: 1.4,
                    }}
                  >
                    Pastikan tanggal, shift, catering, menu, dan keterangan komplain sudah sesuai.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isSubmitting && setShowSubmitModal(false)}
                disabled={isSubmitting}
                aria-label="Tutup modal"
                style={{
                  background: "none",
                  border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  color: "var(--text-muted, #94a3b8)",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Ringkasan Data Modal */}
            <div style={{ padding: "20px 24px", overflowY: "auto" }}>
              <div
                style={{
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  borderRadius: 6,
                  border: "1px solid var(--border, #e2e8f0)",
                  padding: "16px 18px",
                  fontSize: 13,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Tanggal/Shift & Catering (Grid 2 kolom pada desktop, 1 kolom pada mobile) */}
                <div className="submit-modal-grid">
                  <div>
                    <span
                      style={{
                        color: "var(--text-muted, #64748b)",
                        display: "block",
                        fontSize: 12,
                        marginBottom: 2,
                        fontWeight: 400,
                      }}
                    >
                      Tanggal &amp; Shift
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
                      {formatIndoDate(formTanggal, true)} ({formShift || "-"})
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        color: "var(--text-muted, #64748b)",
                        display: "block",
                        fontSize: 12,
                        marginBottom: 2,
                        fontWeight: 400,
                      }}
                    >
                      Catering
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
                      {selectedCatering?.nama || "-"}
                    </span>
                  </div>
                </div>

                {/* Menu Makanan (Lebar penuh, line-height nyaman, tidak seluruh isi ditebalkan) */}
                <div style={{ borderTop: "1px solid var(--border, #f1f5f9)", paddingTop: 10 }}>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      display: "block",
                      fontSize: 12,
                      marginBottom: 3,
                      fontWeight: 400,
                    }}
                  >
                    Menu Makanan
                  </span>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text, #1e293b)",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                      fontWeight: 450,
                    }}
                  >
                    {menuResult?.menu || "-"}
                  </p>
                </div>

                {/* Foto Bukti (Lebar penuh) */}
                <div style={{ borderTop: "1px solid var(--border, #f1f5f9)", paddingTop: 10 }}>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      display: "block",
                      fontSize: 12,
                      marginBottom: 2,
                      fontWeight: 400,
                    }}
                  >
                    Foto Bukti
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      color: formFotoFile ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                      wordBreak: "break-all",
                    }}
                  >
                    {formFotoFile ? formFotoFile.name : "Tidak ada foto"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Footer Aksi Modal */}
            <div
              className="submit-modal-footer"
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="btn btn-outline submit-modal-btn"
                style={{
                  height: 38,
                  padding: "0 18px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteSave}
                disabled={isSubmitting}
                className="btn btn-primary submit-modal-btn"
                style={{
                  height: 38,
                  padding: "0 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  backgroundColor: "var(--red-dark, #8f1a25)",
                  borderColor: "var(--red-dark, #8f1a25)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Komplain</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL VIEW MODAL (LIHAT) */}
      {/* ========================================================================= */}
      {viewingRecord && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
          }}
        >
          <div
            ref={viewModalRef}
            className="card"
            style={{
              maxWidth: 600,
              width: "100%",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              padding: 24,
              borderRadius: 8,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.08)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 id="view-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                Detail Komplain #{viewingRecord.id}
              </h3>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                aria-label="Tutup modal detail"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--text-muted, #94a3b8)",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Grid 2 Kolom: Tanggal, Shift, Catering */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ backgroundColor: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: 4 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", display: "block", marginBottom: 2 }}>
                    Tanggal &amp; Shift
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text, #0f172a)" }}>
                    {formatIndoDate(viewingRecord.tanggal, true)} ({viewingRecord.shift})
                  </span>
                </div>

                <div style={{ backgroundColor: "var(--bg-subtle, #f8fafc)", padding: "10px 12px", borderRadius: 4 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", display: "block", marginBottom: 2 }}>
                    Catering
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text, #0f172a)" }}>
                    {viewingRecord.catering_nama}
                  </span>
                </div>
              </div>

              {/* Menu Snapshot */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", display: "block", marginBottom: 4 }}>
                  Menu Makanan Saat Itu
                </span>
                <div
                  style={{
                    backgroundColor: "var(--bg-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 4,
                    padding: "10px 14px",
                    fontSize: 13,
                    lineHeight: "1.5",
                    color: "var(--text, #0f172a)",
                  }}
                >
                  {viewingRecord.menu_snapshot}
                </div>
              </div>

              {/* Foto Bukti (Jika Ada) */}
              {viewingRecord.foto_path && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", display: "block", marginBottom: 6 }}>
                    Foto Bukti Komplain
                  </span>
                  <div
                    onClick={() => setPhotoPreviewModalUrl(viewingRecord.foto_path || null)}
                    style={{
                      display: "inline-block",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: 6,
                      overflow: "hidden",
                      cursor: "zoom-in",
                      maxWidth: "100%",
                      maxHeight: 280,
                    }}
                    title="Klik untuk memperbesar foto bukti"
                  >
                    <ProtectedImage
                      src={viewingRecord.foto_path}
                      alt={`Bukti ${viewingRecord.catering_nama}`}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 280,
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Keterangan */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", display: "block", marginBottom: 4 }}>
                  Keterangan Komplain
                </span>
                <div
                  style={{
                    backgroundColor: "var(--bg-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 4,
                    padding: "12px 14px",
                    fontSize: 13.5,
                    lineHeight: "1.55",
                    color: "var(--text, #0f172a)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {viewingRecord.keterangan}
                </div>
              </div>

              {/* Metadata Created/Updated */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: "var(--text-muted, #94a3b8)",
                  paddingTop: 8,
                  borderTop: "1px dashed var(--border, #e2e8f0)",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <span>Dibuat: {formatIndoTimestamp(viewingRecord.created_at)}</span>
                {viewingRecord.updated_at && viewingRecord.updated_at !== viewingRecord.created_at && (
                  <span>Diperbarui: {formatIndoTimestamp(viewingRecord.updated_at)}</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="btn btn-outline"
                style={{ height: 36, padding: "0 20px", fontSize: 13 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT MODAL */}
      {/* ========================================================================= */}
      {editingRecord && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
          }}
        >
          <div
            ref={editModalRef}
            className="card"
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              padding: 24,
              borderRadius: 8,
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.08)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 id="edit-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                Edit Komplain #{editingRecord.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                aria-label="Tutup modal edit"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--text-muted, #94a3b8)",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteUpdate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 3 Kolom: Tanggal, Shift, Catering */}
              <div className="form-cols-3">
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Tanggal <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    style={{
                      width: "100%",
                      height: 38,
                      border: "1px solid var(--border-strong, #cbd5e1)",
                      borderRadius: "var(--radius-sm, 4px)",
                      padding: "0 10px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Shift <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <CustomSelect
                    value={editShift}
                    placeholder="Pilih shift"
                    options={[
                      { value: "Pagi", label: "Pagi" },
                      { value: "Malam", label: "Malam" },
                    ]}
                    onChange={(val) => setEditShift(val as "" | "Pagi" | "Malam")}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Nama Catering <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <CustomSelect
                    value={editCateringId}
                    placeholder="Pilih catering"
                    options={caterings.map((c) => ({
                      value: c.id,
                      label: c.nama + (!c.is_active ? " (Nonaktif)" : ""),
                    }))}
                    onChange={(val) => setEditCateringId(val ? Number(val) : "")}
                  />
                </div>
              </div>

              {/* Menu Confirmation on Edit */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  Konfirmasi Menu
                </label>

                {editMenuLoading ? (
                  <div className="menu-empty-panel" style={{ color: "#2563eb", borderColor: "#bfdbfe" }}>
                    <Loader2 size={16} className="spin" />
                    <span>Mencari laporan menu makanan terbaru...</span>
                  </div>
                ) : editMenuResult?.found ? (
                  <div className="menu-confirm-panel">
                    <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                      Menu: {editMenuResult.menu}
                    </p>
                    {isEditComboChanged && (
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={editMenuConfirmed}
                          onChange={(e) => setEditMenuConfirmed(e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: "var(--red, #ef4444)", marginTop: 2 }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                          Saya sudah memeriksa dan memastikan menu di atas sesuai dengan perubahan komplain.
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="menu-empty-panel" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}>
                    <FileWarning size={16} style={{ color: "#d97706" }} />
                    <span style={{ fontSize: 13, color: "#92400e" }}>
                      {editMenuResult?.message || "Data menu belum tersedia untuk kombinasi tanggal, shift, dan catering ini."}
                    </span>
                  </div>
                )}
              </div>

              {/* Foto Catering Edit */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  Foto Catering <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>(Opsional)</span>
                </label>

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleSelectEditFoto}
                  style={{ display: "none" }}
                />

                {!editFotoPreview ? (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="btn btn-outline"
                    style={{ height: 36, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <UploadCloud size={16} />
                    <span>Pilih Foto Bukti</span>
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, border: "1px solid #e2e8f0", borderRadius: 6 }}>
                    <ProtectedImage
                      src={editFotoPreview || undefined}
                      alt="Preview Foto Edit"
                      style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {editFotoFile ? editFotoFile.name : "Foto Tersimpan"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="btn btn-outline"
                        style={{ height: 30, fontSize: 12, padding: "0 8px" }}
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveEditFoto}
                        className="btn btn-outline"
                        style={{ height: 30, fontSize: 12, padding: "0 8px", color: "var(--red)" }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Keterangan Edit */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Keterangan Komplain <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{editKeterangan.length} / 1.000 karakter</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid var(--border-strong, #cbd5e1)",
                    borderRadius: "var(--radius-sm, 4px)",
                    padding: "10px",
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  disabled={isUpdating}
                  className="btn btn-outline"
                  style={{ height: 38, padding: "0 18px", fontSize: 13 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isUpdating ||
                    !editTanggal ||
                    !editShift ||
                    !editCateringId ||
                    !editMenuResult?.found ||
                    (isEditComboChanged && !editMenuConfirmed) ||
                    !editKeterangan.trim()
                  }
                  className="btn btn-primary"
                  style={{
                    height: 38,
                    padding: "0 22px",
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: "var(--red-dark, #8f1a25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION (MENGGUNAKAN ConfirmDeleteModal) */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRecord)}
        title="Hapus Data Komplain?"
        description={
          deletingRecord ? (
            <span>
              Apakah Anda yakin ingin menghapus data komplain untuk katering{" "}
              <strong>{deletingRecord.catering_nama}</strong> tanggal{" "}
              <strong>{formatIndoDate(deletingRecord.tanggal, true)}</strong> (shift {deletingRecord.shift})?
            </span>
          ) : undefined
        }
        impactWarning="Tindakan ini akan menghapus catatan komplain secara permanen."
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingRecord(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL 5: PHOTO PREVIEW MODAL */}
      {/* ========================================================================= */}
      {photoPreviewModalUrl && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau Foto Komplain"
          onClick={() => setPhotoPreviewModalUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          <div
            ref={photoModalRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              backgroundColor: "#ffffff",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => setPhotoPreviewModalUrl(null)}
              aria-label="Tutup pratinjau foto"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Tutup Pratinjau Foto"
            >
              <X size={18} />
            </button>
            <ProtectedImage
              src={photoPreviewModalUrl || undefined}
              alt="Pratinjau Foto Komplain"
              style={{
                display: "block",
                maxWidth: "85vw",
                maxHeight: "85vh",
                objectFit: "contain",
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: EXPORT KOMPLAIN MINGGUAN MODAL */}
      {/* ========================================================================= */}
      {isWeeklyModalOpen && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-export-mingguan-title"
          className="submit-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
          }}
        >
          <div
            ref={weeklyModalRef}
            className="card weekly-modal-card"
          >
            {/* Header Modal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                borderBottom: "1px solid var(--border, #e2e8f0)",
                paddingBottom: 16,
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary, #2563eb)",
                    flexShrink: 0,
                  }}
                >
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3
                    id="modal-export-mingguan-title"
                    style={{
                      margin: 0,
                      fontSize: 16.5,
                      fontWeight: 700,
                      color: "var(--text, #0f172a)",
                      lineHeight: 1.25,
                    }}
                  >
                    Export Komplain Mingguan
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: "var(--text-muted, #64748b)",
                      lineHeight: 1.35,
                    }}
                  >
                    Download rekapan komplain dalam rentang maksimal 7 hari kalender
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isExportingWeekly && setIsWeeklyModalOpen(false)}
                disabled={isExportingWeekly}
                aria-label="Tutup modal export mingguan"
                style={{
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: isExportingWeekly ? "not-allowed" : "pointer",
                  color: "var(--text-muted, #64748b)",
                  borderRadius: 6,
                  transition: "background-color 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <X size={19} />
              </button>
            </div>

            {/* Error Message Box */}
            {weeklyError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 6,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: 13,
                  marginBottom: 20,
                  lineHeight: 1.45,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <AlertCircle size={17} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{weeklyError}</span>
              </div>
            )}

            <form onSubmit={handleWeeklyExportSubmit} style={{ width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
                {/* Grid 2x2 Simetris Penuh */}
                <div className="weekly-modal-form-grid">
                  {/* 1. Tanggal Mulai */}
                  <div className="weekly-modal-field-wrap">
                    <label htmlFor="weekly-start-date" className="weekly-modal-label">
                      TANGGAL MULAI <span className="label-required">*</span>
                    </label>
                    <input
                      id="weekly-start-date"
                      type="date"
                      value={weeklyStartDate}
                      onChange={(e) => {
                        setWeeklyStartDate(e.target.value);
                        setWeeklyError(null);
                      }}
                      required
                      className="weekly-modal-input"
                      style={{
                        color: weeklyStartDate ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                      }}
                    />
                  </div>

                  {/* 2. Tanggal Selesai */}
                  <div className="weekly-modal-field-wrap">
                    <label htmlFor="weekly-end-date" className="weekly-modal-label">
                      TANGGAL SELESAI <span className="label-required">*</span>
                    </label>
                    <input
                      id="weekly-end-date"
                      type="date"
                      value={weeklyEndDate}
                      onChange={(e) => {
                        setWeeklyEndDate(e.target.value);
                        setWeeklyError(null);
                      }}
                      required
                      className="weekly-modal-input"
                      style={{
                        color: weeklyEndDate ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
                      }}
                    />
                  </div>

                  {/* 3. Catering */}
                  <div className="weekly-modal-field-wrap">
                    <label htmlFor="weekly-catering" className="weekly-modal-label">
                      CATERING <span className="label-optional">(OPSIONAL)</span>
                    </label>
                    <CustomSelect
                      id="weekly-catering"
                      value={weeklyCateringId}
                      placeholder="Semua Catering"
                      options={[
                        { value: "all", label: "Semua Catering" },
                        ...activeCaterings.map((c) => ({
                          value: String(c.id),
                          label: c.nama,
                        })),
                      ]}
                      onChange={(val) => setWeeklyCateringId(val)}
                    />
                  </div>

                  {/* 4. Shift */}
                  <div className="weekly-modal-field-wrap">
                    <label htmlFor="weekly-shift" className="weekly-modal-label">
                      SHIFT <span className="label-optional">(OPSIONAL)</span>
                    </label>
                    <CustomSelect
                      id="weekly-shift"
                      value={weeklyShift}
                      placeholder="Semua Shift"
                      options={[
                        { value: "all", label: "Semua Shift" },
                        { value: "Pagi", label: "Pagi" },
                        { value: "Malam", label: "Malam" },
                      ]}
                      onChange={(val) => setWeeklyShift(val)}
                    />
                  </div>
                </div>

                {/* Panel Ketentuan Sesuai Hierarki */}
                <div
                  style={{
                    width: "100%",
                    backgroundColor: "var(--bg-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.55,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Ketentuan:</span>{" "}
                    <span>Rentang tanggal maksimal 7 hari kalender secara inklusif (contoh: 1–7 September).</span>
                  </div>
                  <div>
                    Seluruh laporan dalam rentang tanggal dan filter terpilih akan diekspor ke satu file Excel.
                  </div>
                </div>
              </div>

              {/* Modal Footer: Batal & Export Excel side-by-side horizontally */}
              <div className="weekly-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  disabled={isExportingWeekly}
                  className="btn btn-outline weekly-modal-btn"
                  style={{
                    padding: "0 22px",
                    cursor: isExportingWeekly ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isExportingWeekly}
                  className="btn btn-primary weekly-modal-btn"
                  style={{
                    padding: "0 22px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: isExportingWeekly ? "not-allowed" : "pointer",
                    opacity: isExportingWeekly ? 0.7 : 1,
                  }}
                >
                  {isExportingWeekly ? (
                    <>
                      <Loader2 size={16} className="spin" style={{ animation: "spin 0.8s linear infinite" }} />
                      <span>Mengunduh...</span>
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      <span>Export</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
