"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  History,
  Star,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Download,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Catering,
  getCatering,
  KelayakanEntry,
  getKelayakanEntries,
  deleteKelayakanEntry,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useToast } from "@/context/ToastContext";
import {
  generateKelayakanExcelBuffer,
  downloadExcelBuffer,
} from "@/lib/exportExcelKelayakan";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { formatPercentID } from "@/lib/formatters";

const ITEMS_PER_PAGE = 10;

function formatDisplayDate(iso: string): string {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${monthNames[monthIdx] || month} ${year}`;
}

function formatExportFilename(startISO: string, endISO: string): string {
  if (!startISO || !endISO) return "Menu Kelayakan.xlsx";
  const [sYear, sMonth, sDay] = startISO.split("-").map(Number);
  const [eYear, eMonth, eDay] = endISO.split("-").map(Number);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const sMonthName = monthNames[sMonth - 1] || "";
  const eMonthName = monthNames[eMonth - 1] || "";

  if (sYear === eYear && sMonth === eMonth) {
    return `Menu Kelayakan ${sDay} - ${eDay} ${sMonthName} ${sYear}.xlsx`;
  } else if (sYear === eYear) {
    return `Menu Kelayakan ${sDay} ${sMonthName} - ${eDay} ${eMonthName} ${sYear}.xlsx`;
  } else {
    return `Menu Kelayakan ${sDay} ${sMonthName} ${sYear} - ${eDay} ${eMonthName} ${eYear}.xlsx`;
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

const MENU_CATEGORIES = [
  { id: "nasi", label: "Nasi", icon: "🍚", kelayakanKey: "nasi_kelayakan", rasaKey: "nasi_rasa" },
  { id: "lauk", label: "Lauk", icon: "🍗", kelayakanKey: "lauk_kelayakan", rasaKey: "lauk_rasa" },
  { id: "sayur", label: "Sayur", icon: "🥦", kelayakanKey: "sayur_kelayakan", rasaKey: "sayur_rasa" },
  { id: "sambal", label: "Sambal", icon: "🌶️", kelayakanKey: "sambal_kelayakan", rasaKey: "sambal_rasa" },
  { id: "kerupuk", label: "Kerupuk", icon: "🥨", kelayakanKey: "kerupuk_kelayakan", rasaKey: "kerupuk_rasa" },
  { id: "buah", label: "Buah", icon: "🍎", kelayakanKey: "buah_kelayakan", rasaKey: "buah_rasa" },
] as const;

type KelayakanReportGroup = {
  key: string;
  catering_id: number;
  catering_nama: string;
  tanggal: string;
  shift: string;
  entries: KelayakanEntry[];
};

interface CenteredSelectProps {
  value: string | number;
  placeholder: string;
  options: { value: string | number; label: string }[];
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

function CenteredSelect({ value, placeholder, options, onChange, style }: CenteredSelectProps) {
  const selectedOption = options.find((o) => String(o.value) === String(value));
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
        border: "1px solid #cbd5e1",
        borderRadius: "var(--radius-sm, 4px)",
        background: "var(--card, #ffffff)",
        padding: "0 28px",
        fontSize: 13.5,
        fontWeight: 400,
        color: "#64748b",
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
          fontWeight: 400,
          color: "#64748b",
          display: "block",
        }}
      >
        {displayLabel}
      </span>
      <ChevronDown size={14} style={{ position: "absolute", right: 14, color: "#64748b", pointerEvents: "none" }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
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

function StarRating({
  value,
  max = 3,
  readOnly = true,
}: {
  value: number;
  max?: number;
  readOnly?: boolean;
}) {
  const getLabel = (star: number) => {
    if (star === 1) return "1 (Kurang)";
    if (star === 2) return "2 (Cukup)";
    if (star === 3) return "3 (Baik)";
    return "";
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
          const isFilled = star <= value;
          return (
            <div
              key={star}
              style={{
                padding: "4px 6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={getLabel(star)}
            >
              <Star
                size={22}
                fill={isFilled ? "#f59e0b" : "transparent"}
                color={isFilled ? "#f59e0b" : "var(--text-muted)"}
                strokeWidth={1.75}
              />
            </div>
          );
        })}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: value > 0 ? "var(--text)" : "var(--text-muted)",
        }}
      >
        {value > 0 ? getLabel(value) : "Belum diisi"}
      </span>
    </div>
  );
}

export default function ExportKelayakanPage() {
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [cateringId, setCateringId] = useState<number | "">("");

  // History Filter States (Default empty shift = Semua Shift)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [shift, setShift] = useState<string>("");

  const [rawHistoryEntries, setRawHistoryEntries] = useState<KelayakanEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // View Detail Modal State
  const [viewModalTarget, setViewModalTarget] = useState<{
    key: string;
    catering_id: number;
    catering_nama: string;
    tanggal: string;
    shift: string;
  } | null>(null);
  const [viewModalEntries, setViewModalEntries] = useState<KelayakanEntry[]>([]);
  const [viewModalLoading, setViewModalLoading] = useState<boolean>(false);
  const [viewModalError, setViewModalError] = useState<string | null>(null);
  const viewReqIdRef = useRef<number>(0);
  const viewTriggerBtnRef = useRef<HTMLElement | null>(null);
  const viewModalCardRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<"harian" | "mingguan">("mingguan");
  const [modalSingleDate, setModalSingleDate] = useState<string>("");
  const [modalStartDate, setModalStartDate] = useState<string>("");
  const [modalEndDate, setModalEndDate] = useState<string>("");
  const [modalEntries, setModalEntries] = useState<KelayakanEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Delete Confirmation States
  const [deleteSingleEntryTarget, setDeleteSingleEntryTarget] = useState<{
    id: number;
    shift: string;
    cateringNama: string;
    tanggal: string;
  } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<KelayakanReportGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showSuccess, showError, showWarning } = useToast();

  useEffect(() => {
    getCatering()
      .then((data) => setCaterings(data))
      .catch(() => {});
  }, []);

  const loadHistory = (cId?: number | "", shf?: string, sDate?: string, eDate?: string) => {
    setLoadingHistory(true);
    getKelayakanEntries(cId, undefined, shf || undefined, sDate, eDate)
      .then((res) => {
        setRawHistoryEntries(res.entries || []);
      })
      .catch(() => {
        setRawHistoryEntries([]);
      })
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    setCurrentPage(1);
    loadHistory(cateringId, shift, startDate, endDate);
  }, [cateringId, shift, startDate, endDate]);

  // Main Page Report Groups
  const reportGroups = useMemo<KelayakanReportGroup[]>(() => {
    if (!rawHistoryEntries.length) return [];

    const map = new Map<string, KelayakanEntry[]>();

    for (const entry of rawHistoryEntries) {
      const key = `${entry.catering_id}__${entry.tanggal}__${entry.shift}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }

    const result: KelayakanReportGroup[] = [];

    for (const [key, groupEntries] of map.entries()) {
      const first = groupEntries[0];
      const catObj = caterings.find((c) => c.id === first.catering_id);
      const catering_nama = catObj?.nama || `Catering #${first.catering_id}`;

      result.push({
        key,
        catering_id: first.catering_id,
        catering_nama,
        tanggal: first.tanggal,
        shift: first.shift,
        entries: groupEntries,
      });
    }

    return result.sort((a, b) => {
      const dateDiff = b.tanggal.localeCompare(a.tanggal);
      if (dateDiff !== 0) return dateDiff;

      const shiftRank = (s: string) => (s.toUpperCase() === "PAGI" ? 1 : 2);
      const sDiff = shiftRank(a.shift) - shiftRank(b.shift);
      if (sDiff !== 0) return sDiff;

      const aMaxId = Math.max(...a.entries.map((e) => e.id || 0));
      const bMaxId = Math.max(...b.entries.map((e) => e.id || 0));
      return bMaxId - aMaxId;
    });
  }, [rawHistoryEntries, caterings]);

  const totalPages = Math.ceil(reportGroups.length / ITEMS_PER_PAGE) || 1;

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return reportGroups.slice(start, start + ITEMS_PER_PAGE);
  }, [reportGroups, currentPage]);

  // Fetch ALL entries (both Pagi & Malam) for the Modal Date Range
  useEffect(() => {
    if (showExportModal && modalStartDate && modalEndDate) {
      getKelayakanEntries(undefined, undefined, undefined, modalStartDate, modalEndDate)
        .then((res) => setModalEntries(res.entries || []))
        .catch(() => setModalEntries([]));
    } else {
      setModalEntries([]);
    }
  }, [showExportModal, modalStartDate, modalEndDate]);

  // Group modal entries for export (contains BOTH Pagi & Malam shifts)
  const modalSelectedGroups = useMemo<KelayakanReportGroup[]>(() => {
    if (!modalEntries.length) return [];

    const map = new Map<string, KelayakanEntry[]>();

    for (const entry of modalEntries) {
      const key = `${entry.catering_id}__${entry.tanggal}__${entry.shift}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }

    const result: KelayakanReportGroup[] = [];

    for (const [key, groupEntries] of map.entries()) {
      const first = groupEntries[0];
      const catObj = caterings.find((c) => c.id === first.catering_id);
      const catering_nama = catObj?.nama || `Catering #${first.catering_id}`;

      result.push({
        key,
        catering_id: first.catering_id,
        catering_nama,
        tanggal: first.tanggal,
        shift: first.shift,
        entries: groupEntries,
      });
    }

    return result.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [modalEntries, caterings]);

  // Handle Open Export Modal with default date range
  const handleOpenExportModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (reportGroups.length > 0) {
      const dates = reportGroups.map((g) => g.tanggal).sort();
      setModalStartDate(dates[0]);
      setModalEndDate(dates[dates.length - 1]);
      setModalSingleDate(dates[dates.length - 1]);
    } else {
      setModalStartDate(today);
      setModalEndDate(today);
      setModalSingleDate(today);
    }
    setExportType("mingguan");
    setShowExportModal(true);
  };

  // Open View Detail Modal by specific report group identifiers
  const handleOpenViewModal = useCallback(
    (group: KelayakanReportGroup, e?: React.MouseEvent<HTMLElement>) => {
      viewTriggerBtnRef.current =
        (e?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement) || null;

      // Clear previous report data immediately to prevent stale flash
      setViewModalEntries([]);
      setViewModalError(null);
      setViewModalLoading(true);

      const target = {
        key: group.key,
        catering_id: group.catering_id,
        catering_nama: group.catering_nama,
        tanggal: group.tanggal,
        shift: group.shift,
      };
      setViewModalTarget(target);

      // Fetch fresh details from API by ID/params
      const reqId = ++viewReqIdRef.current;
      getKelayakanEntries(group.catering_id, group.tanggal, group.shift)
        .then((res) => {
          if (viewReqIdRef.current !== reqId) return;
          setViewModalEntries(res.entries || []);
        })
        .catch((err: unknown) => {
          if (viewReqIdRef.current !== reqId) return;
          if (group.entries && group.entries.length > 0) {
            setViewModalEntries(group.entries);
          } else {
            const msg =
              err instanceof Error ? err.message : "Gagal memuat rincian laporan kelayakan.";
            setViewModalError(msg);
          }
        })
        .finally(() => {
          if (viewReqIdRef.current === reqId) {
            setViewModalLoading(false);
          }
        });
    },
    []
  );

  const handleRetryLoadDetail = useCallback(() => {
    if (!viewModalTarget) return;
    setViewModalLoading(true);
    setViewModalError(null);
    const reqId = ++viewReqIdRef.current;
    getKelayakanEntries(viewModalTarget.catering_id, viewModalTarget.tanggal, viewModalTarget.shift)
      .then((res) => {
        if (viewReqIdRef.current !== reqId) return;
        setViewModalEntries(res.entries || []);
      })
      .catch((err: unknown) => {
        if (viewReqIdRef.current !== reqId) return;
        const msg =
          err instanceof Error ? err.message : "Gagal memuat rincian laporan kelayakan.";
        setViewModalError(msg);
      })
      .finally(() => {
        if (viewReqIdRef.current === reqId) {
          setViewModalLoading(false);
        }
      });
  }, [viewModalTarget]);

  const handleCloseViewModal = useCallback(() => {
    setViewModalTarget(null);
    setViewModalEntries([]);
    setViewModalError(null);
    setViewModalLoading(false);
    viewReqIdRef.current++;

    // Restore focus to trigger element
    setTimeout(() => {
      if (viewTriggerBtnRef.current && typeof viewTriggerBtnRef.current.focus === "function") {
        viewTriggerBtnRef.current.focus();
      }
    }, 50);
  }, []);

  // Lock body scroll and handle keyboard accessibility (Escape, Focus trap)
  useEffect(() => {
    if (!viewModalTarget) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus on close button or modal container
    const timer = setTimeout(() => {
      if (viewModalCardRef.current) {
        const closeBtn = viewModalCardRef.current.querySelector<HTMLElement>('button[aria-label="Tutup modal"]');
        if (closeBtn) {
          closeBtn.focus();
        } else {
          viewModalCardRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If delete confirmation modal is active, let it handle Escape
        if (deleteSingleEntryTarget) return;
        e.preventDefault();
        handleCloseViewModal();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && viewModalCardRef.current) {
        const focusable = viewModalCardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]:not([disabled]), input:not([disabled]), select:not([disabled])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewModalTarget, deleteSingleEntryTarget, handleCloseViewModal]);

  const handleDeleteSingleEntryConfirm = async () => {
    if (!deleteSingleEntryTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteKelayakanEntry(deleteSingleEntryTarget.id);
      loadHistory(cateringId, shift, startDate, endDate);
      if (viewModalTarget) {
        const updatedEntries = viewModalEntries.filter((e) => e.id !== deleteSingleEntryTarget.id);
        if (updatedEntries.length === 0) {
          handleCloseViewModal();
        } else {
          setViewModalEntries(updatedEntries);
        }
      }
      showSuccess(`Entri menu kelayakan (${deleteSingleEntryTarget.shift}) berhasil dihapus.`);
      setDeleteSingleEntryTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus entri kelayakan.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteReportGroupConfirm = async () => {
    if (!deleteGroupTarget) return;
    setDeleting(true);
    setDeleteError(null);
    let successCount = 0;
    let failedCount = 0;
    try {
      for (const entry of deleteGroupTarget.entries) {
        if (entry.id) {
          try {
            await deleteKelayakanEntry(entry.id);
            successCount++;
          } catch {
            failedCount++;
          }
        }
      }
      loadHistory(cateringId, shift, startDate, endDate);
      if (failedCount > 0) {
        setDeleteError(`Sebagian data gagal dihapus: ${successCount} berhasil, ${failedCount} gagal.`);
      } else {
        showSuccess(`Laporan kelayakan (${deleteGroupTarget.catering_nama}) berhasil dihapus.`);
        setDeleteGroupTarget(null);
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus laporan kelayakan.");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportSingleGroup = async (group: KelayakanReportGroup) => {
    try {
      const buffer = await generateKelayakanExcelBuffer([group], { isSingleReport: true });
      const filename = `Menu Kelayakan ${group.catering_nama} ${formatDisplayDate(group.tanggal)}.xlsx`;
      downloadExcelBuffer(buffer, filename);
      showSuccess(`File Excel "${filename}" berhasil diunduh.`);
    } catch {
      showError("Gagal menggenerate file Excel Laporan Kelayakan.");
    }
  };

  // Perform Excel Export based on Modal Date Range Selection (Exporting BOTH Pagi and Malam)
  const handleExecuteExportMingguan = async () => {
    if (modalSelectedGroups.length < 4) {
      showWarning("Minimal harus terdapat 4 laporan kelayakan untuk Export Laporan Mingguan.");
      return;
    }

    setIsExporting(true);
    try {
      const buffer = await generateKelayakanExcelBuffer(modalSelectedGroups);
      const filename = formatExportFilename(modalStartDate, modalEndDate);
      downloadExcelBuffer(buffer, filename);
      setShowExportModal(false);
      showSuccess(`File Excel "${filename}" berhasil diunduh.`);
    } catch {
      showError("Gagal menggenerate file Excel Laporan Kelayakan.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header Row with Breadcrumbs on Left and HeaderMetaBoxes on Right */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link
              href="/kelayakan"
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
              KELAYAKAN
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              EXPORT
            </span>
          </div>
          <h1 className="page-title">Export &amp; Riwayat Laporan Kelayakan</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Main Report History List */}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Utensils size={16} />
                <span>Filter Riwayat Kelayakan</span>
              </div>

              {/* Export to Excel Button */}
              <ExportExcelButton
                onClick={handleOpenExportModal}
                isLoading={isExporting}
              />
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
                <div>
                  <label>KATERING</label>
                  <CenteredSelect
                    value={cateringId}
                    placeholder="Semua Katering"
                    options={caterings.map((c) => ({ value: c.id, label: c.nama }))}
                    onChange={(val) => setCateringId(val ? Number(val) : "")}
                  />
                </div>

                <div>
                  <label>TANGGAL MULAI</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ textAlign: "center" }}
                  />
                </div>

                <div>
                  <label>TANGGAL SELESAI</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ textAlign: "center" }}
                  />
                </div>

                <div>
                  <label>SHIFT</label>
                  <div
                    style={{
                      display: "flex",
                      height: 38,
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShift((prev) => (prev === "Pagi" ? "" : "Pagi"))}
                      style={{
                        flex: 1,
                        background: shift === "Pagi" ? "var(--red)" : "var(--card)",
                        color: shift === "Pagi" ? "#ffffff" : "var(--text)",
                        border: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                    >
                      Pagi
                    </button>
                    <button
                      type="button"
                      onClick={() => setShift((prev) => (prev === "Malam" ? "" : "Malam"))}
                      style={{
                        flex: 1,
                        background: shift === "Malam" ? "#1c1b1a" : "var(--card)",
                        color: shift === "Malam" ? "#ffffff" : "var(--text)",
                        border: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                    >
                      Malam
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>No</th>
                  <th style={{ width: "34%" }}>Katering</th>
                  <th style={{ width: "20%" }}>Tanggal</th>
                  <th style={{ width: "15%" }}>Shift</th>
                  <th style={{ width: "25%", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      Memuat riwayat laporan kelayakan...
                    </td>
                  </tr>
                ) : paginatedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      Belum ada laporan kelayakan tersimpan untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  paginatedGroups.map((group, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                    return (
                      <tr key={group.key}>
                        <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                          {globalIndex}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {group.catering_nama}
                        </td>
                        <td>
                          {formatDisplayDate(group.tanggal)}
                        </td>
                        <td>
                          <span className={`pill ${group.shift === "Pagi" ? "pill-pagi" : "pill-malam"}`}>
                            {group.shift.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ height: 32, width: 32, flexShrink: 0 }}
                              onClick={(e) => handleOpenViewModal(group, e)}
                              title="Lihat Detail Laporan"
                              aria-label="Lihat Detail Laporan"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn"
                              style={{ height: 32, width: 32, flexShrink: 0 }}
                              onClick={() => handleExportSingleGroup(group)}
                              title="Export"
                              aria-label="Export"
                            >
                              <Download size={14} />
                            </button>

                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              style={{ height: 32, width: 32, flexShrink: 0 }}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteGroupTarget(group);
                              }}
                              title="Hapus Laporan"
                              aria-label="Hapus Laporan"
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

            {/* Pagination Bar */}
            {reportGroups.length > 0 && (
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  background: "var(--sidebar-bg)",
                }}
              >
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>
                  Menampilkan{" "}
                  <strong>
                    {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, reportGroups.length)}
                  </strong>{" "}
                  -{" "}
                  <strong>
                    {Math.min(currentPage * ITEMS_PER_PAGE, reportGroups.length)}
                  </strong>{" "}
                  dari <strong>{reportGroups.length}</strong> laporan
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>

                  {getPaginationRange(currentPage, totalPages).map((item, idx) => {
                    if (item === "...") {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          style={{
                            padding: "0 6px",
                            color: "var(--text-muted)",
                            fontWeight: 700,
                            fontSize: 13,
                            userSelect: "none",
                          }}
                        >
                          ...
                        </span>
                      );
                    }

                    const pageNum = item as number;
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
                          borderRadius: "var(--radius-sm)",
                          border: isActive ? "1px solid var(--red)" : "1px solid var(--border)",
                          background: isActive ? "var(--red)" : "var(--card)",
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
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
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

      {/* View Detail Modal: Popup Modal for Kelayakan Report Group */}
      {viewModalTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteSingleEntryTarget) {
              handleCloseViewModal();
            }
          }}
          style={{ zIndex: 1100 }}
          role="presentation"
        >
          <div
            ref={viewModalCardRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-kelayakan-modal-title"
            tabIndex={-1}
            style={{
              maxWidth: 1000,
              width: "95%",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header matching View Kalori */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 20,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 16,
              }}
            >
              <div>
                <div
                  id="view-kelayakan-modal-title"
                  style={{
                    fontWeight: 800,
                    fontSize: 18,
                    color: "var(--text)",
                    marginBottom: 6,
                  }}
                >
                  Detail Laporan Kelayakan Menu
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  Katering:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {viewModalTarget.catering_nama}
                  </strong>{" "}
                  &nbsp;|&nbsp; Tanggal:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {formatDisplayDate(viewModalTarget.tanggal)}
                  </strong>{" "}
                  &nbsp;|&nbsp; Shift:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {viewModalTarget.shift}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={handleCloseViewModal}
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            {viewModalLoading ? (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <Loader2 size={26} className="animate-spin" style={{ color: "var(--red)" }} />
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                  Memuat rincian laporan kelayakan...
                </span>
              </div>
            ) : viewModalError ? (
              <div style={{ padding: 36, textAlign: "center" }}>
                <AlertCircle size={32} color="var(--red)" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
                  Gagal Memuat Rincian Laporan
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                  {viewModalError}
                </p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleRetryLoadDetail}
                >
                  Coba Lagi
                </button>
              </div>
            ) : viewModalEntries.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 36, fontSize: 13 }}>
                Tidak ada rincian kelayakan pada laporan ini.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {viewModalEntries.map((entry, idx) => {
                  const totalVal = entry.total_nilai ?? 0;
                  const scoreVal =
                    entry.score_presentase ?? Math.round((totalVal / 39) * 100 * 100) / 100;

                  return (
                    <div
                      key={entry.id || idx}
                      className="panel"
                      style={{
                        padding: 20,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingBottom: 14,
                          marginBottom: 16,
                          borderBottom: "1px solid var(--border)",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                          ENTRI KELAYAKAN #{idx + 1}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                            Total Nilai: <strong style={{ color: "var(--text)" }}>{totalVal}/39</strong>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                            Score Presentase: <strong>{formatPercentID(scoreVal, 2)}</strong>
                          </span>
                          {entry.id && (
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              style={{ height: 32, width: 32 }}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteSingleEntryTarget({
                                  id: entry.id!,
                                  shift: viewModalTarget.shift,
                                  cateringNama: viewModalTarget.catering_nama,
                                  tanggal: viewModalTarget.tanggal,
                                });
                              }}
                              title="Hapus Entri Ini"
                              aria-label="Hapus Entri Ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: 14,
                        }}
                      >
                        {MENU_CATEGORIES.map((cat) => (
                          <div
                            key={cat.id}
                            style={{
                              background: "var(--sidebar-bg)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: "var(--text)",
                                marginBottom: 10,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span>{cat.icon}</span>
                              <span>Kategori: {cat.label}</span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div>
                                <label style={{ fontSize: 10.5, marginBottom: 2 }}>KELAYAKAN</label>
                                <StarRating value={(entry as any)[cat.kelayakanKey] || 0} readOnly />
                              </div>
                              <div>
                                <label style={{ fontSize: 10.5, marginBottom: 2 }}>RASA</label>
                                <StarRating value={(entry as any)[cat.rasaKey] || 0} readOnly />
                              </div>
                            </div>
                          </div>
                        ))}

                        <div
                          style={{
                            background: "var(--sidebar-bg)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: "var(--text)",
                              marginBottom: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>🍱</span>
                            <span>Kondisi Rantang</span>
                          </div>
                          <div>
                            <label style={{ fontSize: 10.5, marginBottom: 2 }}>KONDISI RANTANG</label>
                            <StarRating value={entry.kondisi_rantang || 0} readOnly />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Footer matching View Kalori */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Total Entri: <strong style={{ color: "var(--text)" }}>{viewModalEntries.length}</strong>
                </span>
                {viewModalEntries.length > 0 && (() => {
                  const avgScore =
                    viewModalEntries.reduce((acc, e) => {
                      const tVal = e.total_nilai ?? 0;
                      return acc + (e.score_presentase ?? (tVal / 39) * 100);
                    }, 0) / viewModalEntries.length;
                  return (
                    <span className="pill pill-combo" style={{ fontWeight: 700, fontSize: 12 }}>
                      Rata-rata Skor: {formatPercentID(avgScore, 2)}
                    </span>
                  );
                })()}
              </div>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCloseViewModal}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP EXPORT MODAL */}
      {showExportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
              border: "1px solid var(--border-strong)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--sidebar-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
                <FileSpreadsheet size={20} color="var(--red)" />
                <span>Export Laporan Mingguan Kelayakan</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  borderRadius: 4,
                }}
                title="Tutup Modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 20 }}>
                Pilih rentang tanggal untuk mengeksport rekap laporan mingguan kelayakan catering ke format Excel:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: "var(--sidebar-bg)",
                    padding: 16,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={15} color="var(--red)" />
                    RENTANG TANGGAL EXPORT MINGGUAN
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                        TANGGAL MULAI
                      </label>
                      <input
                        type="date"
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 38,
                          textAlign: "center",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 13,
                          background: "var(--card)",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                        TANGGAL SELESAI
                      </label>
                      <input
                        type="date"
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 38,
                          textAlign: "center",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 13,
                          background: "var(--card)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                  {modalSelectedGroups.length < 4 ? (
                    <div
                      style={{
                        padding: 14,
                        background: "var(--amber-bg, #fffbeb)",
                        border: "1px solid var(--amber, #f59e0b)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12.5,
                        color: "var(--amber, #b45309)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <span>
                        Minimal 4 laporan dibutuhkan. Ditemukan:{" "}
                        <strong>{modalSelectedGroups.length} laporan</strong> (Shift Pagi &amp; Malam) pada rentang tanggal ini.
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 14,
                        background: "var(--green-bg, #f0fdf4)",
                        border: "1px solid var(--green, #16a34a)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12.5,
                        color: "var(--green, #15803d)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                      <span>
                        Otomatis mencocokkan <strong>{modalSelectedGroups.length} laporan</strong> (Shift Pagi &amp; Malam) pada rentang tanggal ini. Siap diexport.
                      </span>
                    </div>
                  )}
                </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                background: "var(--sidebar-bg)",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowExportModal(false)}
                style={{ height: 38, padding: "0 18px", fontSize: 13 }}
              >
                Batal
              </button>
              <ExportExcelButton
                onClick={handleExecuteExportMingguan}
                disabled={modalSelectedGroups.length < 4}
                isLoading={isExporting}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Kelayakan Entry Modal */}
      <ConfirmDeleteModal
        isOpen={deleteSingleEntryTarget !== null}
        title="Hapus Entri Kelayakan?"
        itemName={
          deleteSingleEntryTarget
            ? `${deleteSingleEntryTarget.cateringNama} — ${deleteSingleEntryTarget.tanggal} (Shift ${deleteSingleEntryTarget.shift})`
            : undefined
        }
        description="Apakah Anda yakin ingin menghapus entri penilaian kelayakan ini? Data penilaian 13 kriteria pada entri ini akan dihapus secara permanen."
        confirmText="Hapus Entri"
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteSingleEntryConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteSingleEntryTarget(null);
            setDeleteError(null);
          }
        }}
      />

      {/* Delete Entire Kelayakan Report Group Modal */}
      <ConfirmDeleteModal
        isOpen={deleteGroupTarget !== null}
        title="Hapus Laporan Kelayakan?"
        count={deleteGroupTarget ? deleteGroupTarget.entries.length : undefined}
        itemName={
          deleteGroupTarget
            ? `${deleteGroupTarget.catering_nama} — ${deleteGroupTarget.tanggal} (Shift ${deleteGroupTarget.shift})`
            : undefined
        }
        description={
          deleteGroupTarget ? (
            <span>
              Laporan ini berisi <strong>{deleteGroupTarget.entries.length} entri</strong> penilaian kelayakan. Apakah Anda yakin ingin menghapus seluruh entri dalam laporan ini secara permanen?
            </span>
          ) : undefined
        }
        confirmText="Hapus Seluruh Laporan"
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteReportGroupConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteGroupTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
