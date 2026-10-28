"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  X,
  Utensils,
  Trash2,
  Lock,
  FileSpreadsheet,
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  Catering,
  KaloriHarian,
  getCatering,
  getKaloriHarian,
  deleteKaloriHarian,
  konfirmasiMingguanKalori,
  exportKaloriMonthlyExcelApi,
} from "@/lib/api";
import { generateKaloriExcelBuffer, generateKaloriWeeklyExcelBuffer } from "@/lib/exportExcelKalori";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { CateringSelect } from "@/components/CateringSelect";
import { useToast } from "@/context/ToastContext";
import { downloadExcelBuffer } from "@/lib/exportExcelKelayakan";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import { formatNumberID } from "@/lib/formatters";

const ITEMS_PER_PAGE = 10;

function formatDisplayDate(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${monthNames[monthIdx] || month} ${year}`;
}

function formatExportFilename(startISO: string, endISO: string): string {
  if (!startISO || !endISO) return "Kalori Harian.xlsx";
  const [sYear, sMonth, sDay] = startISO.split("-").map(Number);
  const [eYear, eMonth, eDay] = endISO.split("-").map(Number);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const sMonthName = monthNames[sMonth - 1] || "";
  const eMonthName = monthNames[eMonth - 1] || "";

  if (sYear === eYear && sMonth === eMonth) {
    return `Kalori Harian ${sDay} - ${eDay} ${sMonthName} ${sYear}.xlsx`;
  } else if (sYear === eYear) {
    return `Kalori Harian ${sDay} ${sMonthName} - ${eDay} ${eMonthName} ${sYear}.xlsx`;
  } else {
    return `Kalori Harian ${sDay} ${sMonthName} ${sYear} - ${eDay} ${eMonthName} ${eYear}.xlsx`;
  }
}

function formatWeeklyExportFilename(startISO: string, endISO: string): string {
  if (!startISO || !endISO) return "Summary Kalori Weekly.xlsx";
  const [sYear, sMonth, sDay] = startISO.split("-").map(Number);
  const [eYear, eMonth, eDay] = endISO.split("-").map(Number);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const sMonthName = monthNames[sMonth - 1] || "";
  const eMonthName = monthNames[eMonth - 1] || "";

  if (sYear === eYear && sMonth === eMonth) {
    return `Summary Kalori Weekly_${sDay} - ${eDay} ${sMonthName} ${sYear}.xlsx`;
  } else if (sYear === eYear) {
    return `Summary Kalori Weekly_${sDay} ${sMonthName} - ${eDay} ${eMonthName} ${sYear}.xlsx`;
  } else {
    return `Summary Kalori Weekly_${sDay} ${sMonthName} ${sYear} - ${eDay} ${eMonthName} ${eYear}.xlsx`;
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

function formatDec(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  return formatNumberID(v, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Removed static getWarnaBentuk; dynamic lookup is used in export functions

function normalizeCategory(rawCat: string | null | undefined): string {
  if (!rawCat) return "Lain-lain";
  const trimmed = rawCat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "nasi") return "Nasi";
  if (lower === "sayur") return "Sayur";
  if (lower === "lauk") return "Lauk";
  if (lower === "buah") return "Buah";
  if (lower === "lain-lain" || lower === "lain_lain" || lower === "lainlain") return "Lain-lain";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

interface PreviewGroupItem {
  id?: number;
  nama_bahan: string;
  standar_kalori: number;
  standar_berat?: number | null;
  berat_aktual: number;
  b_val: number;
  energi_val: number;
}

interface PreviewGroup {
  category: string;
  itemRole: string;
  menuName: string;
  roleStandardBerat: number | null;
  totalActualBerat: number;
  totalB: number;
  items: PreviewGroupItem[];
}

function processModalPreviewGroups(entry: KaloriHarian): PreviewGroup[] {
  const rawBahan = entry.bahan || [];
  if (rawBahan.length === 0) return [];

  const KATEGORI_ORDER = ["Nasi", "Sayur", "Lauk", "Buah", "Lain-lain"];
  const tempMap = new Map<string, typeof rawBahan>();

  for (const b of rawBahan) {
    const cat = normalizeCategory(b.kategori);
    let role = b.item_role ? b.item_role.trim() : "";
    if (!role) {
      if (cat === "Sayur") role = "SAYUR";
      else if (cat === "Nasi") role = "NASI/MIE";
      else if (cat === "Buah") role = "BUAH";
      else role = "LAUK UTAMA";
    }
    const key = `${cat}__${role}`;
    if (!tempMap.has(key)) tempMap.set(key, []);
    tempMap.get(key)!.push({ ...b, kategori: cat, item_role: role });
  }

  const sortedEntries = Array.from(tempMap.entries()).sort((a, b) => {
    const catA = a[1][0]?.kategori || "";
    const catB = b[1][0]?.kategori || "";
    let idxA = KATEGORI_ORDER.indexOf(catA);
    let idxB = KATEGORI_ORDER.indexOf(catB);
    if (idxA === -1) idxA = 99;
    if (idxB === -1) idxB = 99;
    return idxA - idxB;
  });

  const result: PreviewGroup[] = [];

  for (const [, rawItems] of sortedEntries) {
    if (!rawItems || rawItems.length === 0) continue;
    const cat = rawItems[0].kategori || "Lain-lain";
    const role = rawItems[0].item_role || "";

    let menuName = "";
    if (cat === "Nasi") menuName = entry.nama_masakan_nasi || "Nasi";
    else if (cat === "Sayur") menuName = entry.nama_masakan_sayur || "Tumis sayur";
    else menuName = role || cat;

    let roleStandardBerat: number | null = null;
    for (const item of rawItems) {
      if (item.standar_berat !== null && item.standar_berat !== undefined) {
        roleStandardBerat = item.standar_berat;
      }
    }

    const totalActualBerat = rawItems.reduce((acc, i) => acc + (i.berat_aktual || 0), 0);

    const items: PreviewGroupItem[] = rawItems.map((item) => {
      let bVal = 0;
      if (item.standar_berat !== null && item.standar_berat !== undefined) {
        bVal = item.standar_berat;
      } else if (roleStandardBerat !== null && roleStandardBerat > 0) {
        if (totalActualBerat <= roleStandardBerat) {
          bVal = item.berat_aktual || 0;
        } else {
          bVal = totalActualBerat > 0 ? ((item.berat_aktual || 0) / totalActualBerat) * roleStandardBerat : 0;
        }
      } else {
        bVal = item.berat_aktual || 0;
      }

      const stdKal = item.standar_kalori || 0;
      const energiVal = (stdKal / 100) * bVal;

      return {
        ...item,
        b_val: bVal,
        energi_val: energiVal,
      };
    });

    const totalB = items.reduce((acc, i) => acc + i.b_val, 0);

    result.push({
      category: cat,
      itemRole: role,
      menuName,
      roleStandardBerat,
      totalActualBerat,
      totalB,
      items,
    });
  }

  return result;
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDaysISO(baseISO: string, days: number): string {
  if (!baseISO) return todayISO();
  const parts = baseISO.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return todayISO();
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function RekapMingguanContent() {
  const searchParams = useSearchParams();

  // Master data
  const [caterings, setCaterings] = useState<Catering[]>([]);

  // Filter state
  const [rekapCateringId, setRekapCateringId] = useState<number | "">(() => {
    const pCat = searchParams.get("catering_id");
    return pCat ? Number(pCat) : "";
  });
  const [rekapStart, setRekapStart] = useState<string>(() => {
    const pStart = searchParams.get("start");
    return pStart || "";
  });
  const [rekapEnd, setRekapEnd] = useState<string>(() => {
    const pEnd = searchParams.get("end");
    return pEnd || "";
  });
  const [shift, setShift] = useState<string>("");

  // Data state
  const [rekapData, setRekapData] = useState<KaloriHarian[]>([]);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [rekapError, setRekapError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<"mingguan" | "bulanan">("mingguan");
  const [exportType, setExportType] = useState<"harian" | "mingguan">("mingguan");
  const [modalSingleDate, setModalSingleDate] = useState<string>("");
  const [modalStartDate, setModalStartDate] = useState<string>("");
  const [modalEndDate, setModalEndDate] = useState<string>("");
  const [modalCateringId, setModalCateringId] = useState<number | "">("");
  const [modalShift, setModalShift] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Monthly Export Modal State
  const initialDate = useMemo(() => new Date(), []);
  const [monthlyMonth, setMonthlyMonth] = useState<number>(initialDate.getMonth() + 1);
  const [monthlyYear, setMonthlyYear] = useState<number>(initialDate.getFullYear());
  const [monthlyHolidays, setMonthlyHolidays] = useState<string[]>([]);
  const [holidayInput, setHolidayInput] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);

  // Focus trap / accessibility refs
  const exportModalRef = useRef<HTMLDivElement>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  // Toast Notification
  const { showToast, showSuccess, showError, showWarning } = useToast();

  // Modal preview & delete state
  const [previewModalEntry, setPreviewModalEntry] = useState<KaloriHarian | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KaloriHarian | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Confirmation state
  const [confirmingRekap, setConfirmingRekap] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{
    hari_dikonfirmasi: number;
    periode_ids: number[];
  } | null>(null);

  // Read URL search params
  useEffect(() => {
    const pCat = searchParams.get("catering_id");
    const pStart = searchParams.get("start");
    const pEnd = searchParams.get("end");
    if (pCat) setRekapCateringId(Number(pCat));
    if (pStart) setRekapStart(pStart);
    if (pEnd) setRekapEnd(pEnd);
  }, [searchParams]);

  // Load caterings
  useEffect(() => {
    async function loadCateringList() {
      try {
        const cats = await getCatering();
        setCaterings(cats);
      } catch (err) {
        console.error("Gagal memuat daftar katering:", err);
      }
    }
    loadCateringList();
  }, []);

  // Fetch rekap data when filters change
  const fetchRekap = async () => {
    try {
      setLoadingRekap(true);
      setRekapError(null);
      setConfirmResult(null);
      const data = await getKaloriHarian(
        rekapCateringId ? Number(rekapCateringId) : "",
        rekapStart || "",
        rekapEnd || ""
      );
      setRekapData(data);
      setCurrentPage(1);
    } catch (err: any) {
      setRekapError(err.message || "Gagal memuat rekap mingguan.");
    } finally {
      setLoadingRekap(false);
    }
  };

  useEffect(() => {
    fetchRekap();
  }, [rekapCateringId, rekapStart, rekapEnd]);

  // Filtered & Sorted data for main table
  const filteredData = useMemo(() => {
    let result = [...rekapData];
    if (shift) {
      result = result.filter((d) => d.shift?.toLowerCase() === shift.toLowerCase());
    }
    return result.sort((a, b) => {
      const dDiff = b.tanggal.localeCompare(a.tanggal);
      if (dDiff !== 0) return dDiff;
      const shiftRank = (s: string) => (s?.toUpperCase() === "PAGI" ? 1 : 2);
      const sDiff = shiftRank(a.shift || "") - shiftRank(b.shift || "");
      if (sDiff !== 0) return sDiff;
      return (b.id || 0) - (a.id || 0);
    });
  }, [rekapData, shift]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;

  const paginatedData = useMemo(() => {
    const validPage = Math.min(currentPage, totalPages);
    const startIdx = (validPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredData, currentPage, totalPages]);

  const handleExportSingleKaloriRow = async (row: KaloriHarian) => {
    try {
      const cateringObj = caterings.find((c) => c.id === row.catering_id);
      if (!cateringObj) {
        showError("Data katering tidak ditemukan untuk entri ini.");
        return;
      }
      const buffer = await generateKaloriExcelBuffer([row], cateringObj, row.tanggal, row.tanggal);
      const filename = `Kalori Harian ${cateringObj.nama} ${formatDisplayDate(row.tanggal)}.xlsx`;
      downloadExcelBuffer(buffer, filename);
      showSuccess(`File Excel "${filename}" berhasil diunduh.`);
    } catch (err: any) {
      showError("Gagal mengekspor laporan harian kalori: " + (err.message || err));
    }
  };

  // Month date range calculations
  const BULAN_OPTIONS = useMemo(
    () => [
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
    ],
    []
  );

  const maxDayInMonthlyMonth = useMemo(() => {
    return new Date(monthlyYear, monthlyMonth, 0).getDate();
  }, [monthlyYear, monthlyMonth]);

  const minMonthlyDateStr = `${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}-01`;
  const maxMonthlyDateStr = `${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}-${String(maxDayInMonthlyMonth).padStart(2, "0")}`;

  const handleMonthChange = (m: number) => {
    setMonthlyMonth(m);
    setMonthlyHolidays((prev) =>
      prev.filter((d) => {
        const parts = d.split("-");
        return Number(parts[0]) === monthlyYear && Number(parts[1]) === m;
      })
    );
  };

  const handleYearChange = (y: number) => {
    setMonthlyYear(y);
    setMonthlyHolidays((prev) =>
      prev.filter((d) => {
        const parts = d.split("-");
        return Number(parts[0]) === y && Number(parts[1]) === monthlyMonth;
      })
    );
  };

  const handleAddHoliday = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return;
    const [y, m] = parts.map(Number);
    if (y !== monthlyYear || m !== monthlyMonth) {
      showWarning(`Tanggal libur harus berada dalam bulan ${monthlyMonth}/${monthlyYear}.`);
      return;
    }
    if (!monthlyHolidays.includes(dateStr)) {
      const updated = [...monthlyHolidays, dateStr].sort();
      setMonthlyHolidays(updated);
    }
    setHolidayInput("");
  };

  const handleRemoveHoliday = (dateStr: string) => {
    setMonthlyHolidays((prev) => prev.filter((d) => d !== dateStr));
  };

  // Open Export Modal with default date range
  const handleOpenExportModal = () => {
    prevActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    const dates = filteredData.map((d) => d.tanggal).filter(Boolean).sort();
    const sDate = dates.length > 0 ? dates[0] : rekapStart || todayISO();
    const eDate = dates.length > 0 ? dates[dates.length - 1] : rekapEnd || todayISO();
    setModalStartDate(sDate);
    setModalEndDate(eDate);
    setModalCateringId(rekapCateringId !== "" ? rekapCateringId : "");
    setModalShift(shift || "");
    setExportError(null);
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    setShowExportModal(false);
    setExportError(null);
    if (prevActiveElementRef.current) {
      prevActiveElementRef.current.focus();
    }
  };

  // Keyboard accessibility (Escape + Focus Trap)
  useEffect(() => {
    if (!showExportModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isExporting) {
          e.preventDefault();
          handleCloseExportModal();
        }
        return;
      }

      if (e.key === "Tab" && exportModalRef.current) {
        const focusableElements = exportModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]:not([disabled])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showExportModal, isExporting]);

  // Execute Export Modal Action
  const handleExecuteExportModal = async () => {
    if (isExporting) return;
    setExportError(null);

    // Flow 1: Laporan Bulanan (New Feature)
    if (reportCategory === "bulanan") {
      if (!monthlyMonth || monthlyMonth < 1 || monthlyMonth > 12) {
        showWarning("Pilih bulan laporan yang valid (1-12).");
        return;
      }
      if (!monthlyYear || monthlyYear < 1900 || monthlyYear > 2100) {
        showWarning("Masukkan tahun laporan yang valid.");
        return;
      }

      setIsExporting(true);
      try {
        const { blob, filename } = await exportKaloriMonthlyExcelApi(
          monthlyMonth,
          monthlyYear,
          monthlyHolidays
        );

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess(`Laporan kalori bulanan "${filename}" berhasil diexport.`);
        handleCloseExportModal();
      } catch (err: any) {
        const msg = err.message || "Gagal melakukan export Excel bulanan.";
        setExportError(msg);
        showError(msg);
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // Flow 2: Laporan Mingguan (Existing Feature)
    if (!modalStartDate || !modalEndDate) {
      showWarning("Harap tentukan tanggal mulai dan tanggal selesai.");
      return;
    }
    if (modalStartDate > modalEndDate) {
      showWarning("Tanggal mulai tidak boleh melebihi tanggal selesai.");
      return;
    }

    setIsExporting(true);
    try {
      const targetEntries = await getKaloriHarian(
        modalCateringId !== "" ? Number(modalCateringId) : "",
        modalStartDate,
        modalEndDate,
        modalShift || undefined
      );

      if (!targetEntries || targetEntries.length === 0) {
        showWarning("Tidak ada entri kalori harian yang sesuai dengan filter.");
        setIsExporting(false);
        return;
      }

      const sDate = modalStartDate;
      const eDate = modalEndDate;

      if (exportType === "mingguan") {
        const buffer = await generateKaloriWeeklyExcelBuffer(
          targetEntries,
          caterings,
          sDate,
          eDate,
          modalCateringId,
          modalShift
        );
        const filename = formatWeeklyExportFilename(sDate, eDate);
        downloadExcelBuffer(buffer, filename);
        showSuccess(`Laporan mingguan kalori "${filename}" berhasil diexport.`);
      } else {
        const cateringObj = caterings.find((c) => c.id === Number(modalCateringId)) ?? {
          id: 0,
          nama: "SEMUA CATERING",
          warna: "biru" as const,
          bentuk: "circle" as const,
          is_active: true,
        };

        const cateringsById = new Map(caterings.map((item) => [item.id, item]));
        const buffer = await generateKaloriExcelBuffer(
          targetEntries,
          cateringObj,
          sDate,
          eDate,
          cateringsById,
          { groupByDateSheets: true }
        );
        const filename = formatExportFilename(sDate, eDate);
        downloadExcelBuffer(buffer, filename);
        showSuccess(`Laporan detail kalori "${filename}" berhasil diexport.`);
      }

      handleCloseExportModal();
    } catch (err: any) {
      showError("Gagal melakukan export Excel: " + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  // Delete Kalori Entry Action
  const handleDeleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteKaloriHarian(deleteTarget.id);
      setDeleteTarget(null);
      setPreviewModalEntry(null);
      fetchRekap();
      showSuccess("Laporan kalori harian berhasil dihapus.");
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus entri kalori.");
    } finally {
      setDeleting(false);
    }
  };

  // Confirm weekly achievement action
  const handleConfirmWeekly = async () => {
    if (!rekapCateringId) {
      showWarning("Silakan pilih Katering terlebih dahulu.");
      return;
    }

    try {
      setConfirmingRekap(true);
      const result = await konfirmasiMingguanKalori({
        catering_id: Number(rekapCateringId),
        start: rekapStart,
        end: rekapEnd,
      });
      setConfirmResult(result);
      showSuccess(`Konfirmasi mingguan berhasil: ${result.hari_dikonfirmasi} hari telah dikonfirmasi.`);
    } catch (err: any) {
      showError("Gagal melakukan konfirmasi: " + (err.message || err));
    } finally {
      setConfirmingRekap(false);
    }
  };

  return (
    <div>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Link
              href="/kalori-harian"
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
              KALORI
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              EXPORT &amp; RIWAYAT
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Export &amp; Riwayat Laporan Kalori</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Filter Card with Header Export Button */}
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
            <span>Filter Riwayat Kalori</span>
          </div>

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
                value={rekapCateringId}
                placeholder="Semua Katering"
                options={caterings.map((c) => ({ value: c.id, label: c.nama }))}
                onChange={(val) => setRekapCateringId(val ? Number(val) : "")}
              />
            </div>

            <div>
              <label>TANGGAL MULAI</label>
              <input
                type="date"
                value={rekapStart}
                onChange={(e) => setRekapStart(e.target.value)}
                style={{ textAlign: "center" }}
              />
            </div>

            <div>
              <label>TANGGAL SELESAI</label>
              <input
                type="date"
                value={rekapEnd}
                onChange={(e) => setRekapEnd(e.target.value)}
                style={{ textAlign: "center" }}
              />
            </div>

            <div>
              <label>SHIFT</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 38,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShift((prev) => (prev === "Pagi" ? "" : "Pagi"))}
                  className={`btn ${shift === "Pagi" ? "btn-solid" : "btn-outline"}`}
                  style={{ flex: 1, height: "100%", fontSize: 12, justifyContent: "center" }}
                >
                  Pagi
                </button>
                <button
                  type="button"
                  onClick={() => setShift((prev) => (prev === "Malam" ? "" : "Malam"))}
                  className={`btn ${shift === "Malam" ? "btn-solid" : "btn-outline"}`}
                  style={{
                    flex: 1,
                    height: "100%",
                    fontSize: 12,
                    justifyContent: "center",
                    backgroundColor: shift === "Malam" ? "#1e293b" : "transparent",
                    borderColor: shift === "Malam" ? "#1e293b" : "var(--border-strong)",
                    color: shift === "Malam" ? "#ffffff" : "var(--text)",
                  }}
                >
                  Malam
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rekapError && <div className="error-box">{rekapError}</div>}

      {/* Confirm Success Message */}
      {confirmResult && (
        <div className="panel" style={{ borderLeft: "4px solid var(--green)", background: "var(--green-bg)", marginBottom: 24 }}>
          <div className="panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--green)", fontWeight: 700, fontSize: 15 }}>
                <CheckCircle2 size={20} />
                <span>{confirmResult.hari_dikonfirmasi} Hari Berhasil Dikonfirmasi ke Pencapaian Kalori!</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Data periode telah diperbarui dan siap dihitung di laporan performa katering.
              </p>
            </div>

            <Link href="/performance" className="btn btn-solid">
              Buka Halaman Performance <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Data Table Panel */}
      <div className="panel">
        <div className="panel-header" style={{ justifyContent: "space-between" }}>
          <span>Daftar Entri Kalori ({filteredData.length} Laporan)</span>
          {rekapCateringId && (
            <button
              type="button"
              className="btn btn-solid"
              disabled={rekapData.length === 0 || confirmingRekap}
              onClick={handleConfirmWeekly}
              style={{ fontSize: 12, height: 32 }}
            >
              {confirmingRekap ? "Memproses..." : "Konfirmasi ke Pencapaian Kalori"}
            </button>
          )}
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
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
              {loadingRekap ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                    Memuat riwayat laporan kalori harian...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                    Belum ada laporan kalori harian tersimpan untuk filter ini.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const cateringObj = caterings.find((c) => c.id === row.catering_id);
                  const cateringNama = cateringObj ? cateringObj.nama : `Catering #${row.catering_id}`;

                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>{globalIndex}</td>
                      <td style={{ fontWeight: 700 }}>{cateringNama}</td>
                      <td>{formatDisplayDate(row.tanggal)}</td>
                      <td>
                        <span className={`pill ${row.shift === "Pagi" ? "pill-pagi" : "pill-malam"}`}>
                          {row.shift?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ height: 32, width: 32, flexShrink: 0 }}
                            onClick={() => setPreviewModalEntry(row)}
                            title="See Report"
                            aria-label="See Report"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            className="icon-btn"
                            style={{ height: 32, width: 32, flexShrink: 0 }}
                            onClick={() => handleExportSingleKaloriRow(row)}
                            title="Export"
                            aria-label="Export"
                          >
                            <Download size={14} />
                          </button>

                          {row.is_locked ? (
                            <span
                              className="icon-btn"
                              style={{
                                height: 32,
                                width: 32,
                                flexShrink: 0,
                                opacity: 0.6,
                                cursor: "not-allowed",
                                color: "var(--amber-600, #d97706)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              title={row.lock_reason || "Terkunci otomatis karena laporan bulanan telah FINAL"}
                              aria-label="Terkunci (FINAL)"
                            >
                              <Lock size={14} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              style={{ height: 32, width: 32, flexShrink: 0 }}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(row);
                              }}
                              title="Hapus Laporan Kalori"
                              aria-label="Hapus Laporan Kalori"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Compact Pagination Bar */}
          {filteredData.length > 0 && (
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
                  {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredData.length)} -{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}
                </strong>{" "}
                dari <strong>{filteredData.length}</strong> laporan
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

      {/* Export Modal Popup Flow */}
      {showExportModal && (
        <div className="modal-overlay">
          <div
            ref={exportModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            className="modal-card"
            style={{ maxWidth: 560, width: "92%", padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div id="export-modal-title" style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>
                Export Laporan Kalori
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                onClick={handleCloseExportModal}
                aria-label="Tutup popup export"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Pilih jenis laporan dan parameter untuk mengeksport rekapitulasi data kalori ke format Excel.
            </div>

            {/* Selector Jenis Laporan: Mingguan vs Bulanan */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                JENIS LAPORAN
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setReportCategory("mingguan");
                    setExportError(null);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: reportCategory === "mingguan" ? "2px solid var(--red, #dc2626)" : "1px solid #cbd5e1",
                    backgroundColor: reportCategory === "mingguan" ? "rgba(220, 38, 38, 0.05)" : "var(--card, #fff)",
                    color: reportCategory === "mingguan" ? "var(--red, #dc2626)" : "var(--text)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Laporan Mingguan
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportCategory("bulanan");
                    setExportError(null);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: reportCategory === "bulanan" ? "2px solid var(--red, #dc2626)" : "1px solid #cbd5e1",
                    backgroundColor: reportCategory === "bulanan" ? "rgba(220, 38, 38, 0.05)" : "var(--card, #fff)",
                    color: reportCategory === "bulanan" ? "var(--red, #dc2626)" : "var(--text)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Laporan Bulanan (Baru)
                </button>
              </div>
            </div>

            {/* ================= FLOW LAPORAN MINGGUAN ================= */}
            {reportCategory === "mingguan" && (
              <>
                {/* 1. Pilihan format export */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                    FORMAT EXPORT MINGGUAN
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setExportType("mingguan")}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: exportType === "mingguan" ? "2px solid var(--red, #dc2626)" : "1px solid #cbd5e1",
                        backgroundColor: exportType === "mingguan" ? "rgba(220, 38, 38, 0.05)" : "var(--card, #fff)",
                        color: exportType === "mingguan" ? "var(--red, #dc2626)" : "var(--text)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      Weekly Summary (Opsi Mingguan)
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportType("harian")}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: exportType === "harian" ? "2px solid var(--red, #dc2626)" : "1px solid #cbd5e1",
                        backgroundColor: exportType === "harian" ? "rgba(220, 38, 38, 0.05)" : "var(--card, #fff)",
                        color: exportType === "harian" ? "var(--red, #dc2626)" : "var(--text)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      Detail Rincian (Format Harian)
                    </button>
                  </div>
                </div>

                {/* 2. Dropdown Katering dan Shift dalam satu baris */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      KATERING
                    </label>
                    <CateringSelect
                      caterings={caterings}
                      value={modalCateringId}
                      onChange={(val) => setModalCateringId(val ? Number(val) : "")}
                      context="filter"
                      allLabel="Semua Katering"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      SHIFT
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={modalShift}
                        onChange={(e) => setModalShift(e.target.value)}
                        className="select-input"
                        style={{
                          width: "100%",
                          height: 38,
                          appearance: "none",
                          paddingRight: 32,
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        <option value="">Semua Shift</option>
                        <option value="Pagi">Pagi</option>
                        <option value="Malam">Malam</option>
                      </select>
                      <ChevronDown
                        size={16}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "var(--text-muted)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Tanggal Mulai dan Tanggal Selesai dalam satu baris */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      TANGGAL MULAI
                    </label>
                    <input
                      type="date"
                      value={modalStartDate}
                      onChange={(e) => setModalStartDate(e.target.value)}
                      className="select-input"
                      style={{ textAlign: "center", width: "100%", height: 38 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      TANGGAL SELESAI
                    </label>
                    <input
                      type="date"
                      value={modalEndDate}
                      onChange={(e) => setModalEndDate(e.target.value)}
                      className="select-input"
                      style={{ textAlign: "center", width: "100%", height: 38 }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ================= FLOW LAPORAN BULANAN ================= */}
            {reportCategory === "bulanan" && (
              <>
                {/* 1. Bulan dan Tahun Laporan */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      BULAN LAPORAN
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={monthlyMonth}
                        onChange={(e) => handleMonthChange(Number(e.target.value))}
                        className="select-input"
                        style={{
                          width: "100%",
                          height: 38,
                          appearance: "none",
                          paddingRight: 32,
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {BULAN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "var(--text-muted)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                      TAHUN LAPORAN
                    </label>
                    <input
                      type="number"
                      value={monthlyYear}
                      min={1900}
                      max={2100}
                      onChange={(e) => handleYearChange(Number(e.target.value))}
                      className="select-input"
                      style={{ width: "100%", height: 38, textAlign: "center", fontWeight: 600 }}
                    />
                  </div>
                </div>

                {/* Info Periode Kalender Bulanan */}
                <div
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.04)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    marginBottom: 16,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Calendar size={14} />
                  <span>
                    Periode: <strong>1 {BULAN_OPTIONS.find((b) => b.value === monthlyMonth)?.label} {monthlyYear}</strong> &ndash;{" "}
                    <strong>{maxDayInMonthlyMonth} {BULAN_OPTIONS.find((b) => b.value === monthlyMonth)?.label} {monthlyYear}</strong> (Kalender Standar)
                  </span>
                </div>

                {/* 2. Daftar Tanggal Libur (Multi-Date Picker) */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                    TANGGAL LIBUR KHUSUS
                  </label>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                    Pilih tanggal libur khusus/nasional dalam bulan ini. Sabtu dan Minggu tidak otomatis merah apabila tidak ditambahkan.
                  </div>

                  {/* Input penambah tanggal libur */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input
                      type="date"
                      value={holidayInput}
                      min={minMonthlyDateStr}
                      max={maxMonthlyDateStr}
                      onChange={(e) => setHolidayInput(e.target.value)}
                      className="select-input"
                      style={{ flex: 1, height: 36, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddHoliday(holidayInput)}
                      disabled={!holidayInput}
                      className="btn btn-outline"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        height: 36,
                        padding: "0 12px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <Plus size={14} />
                      Tambah
                    </button>
                  </div>

                  {/* Daftar tanggal libur terpilih (Badges) */}
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 6,
                      padding: 10,
                      minHeight: 46,
                      backgroundColor: "var(--bg, #f8fafc)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {monthlyHolidays.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                        Tidak ada tanggal libur yang dipilih.
                      </span>
                    ) : (
                      monthlyHolidays.map((hDate) => (
                        <span
                          key={hDate}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "rgba(220, 38, 38, 0.08)",
                            color: "var(--red, #dc2626)",
                            border: "1px solid rgba(220, 38, 38, 0.2)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {formatDisplayDate(hDate)}
                          <button
                            type="button"
                            onClick={() => handleRemoveHoliday(hDate)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: "var(--red, #dc2626)",
                              display: "inline-flex",
                            }}
                            aria-label={`Hapus hari libur ${hDate}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Error Message Box */}
            {exportError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 6,
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} />
                <span>{exportError}</span>
              </div>
            )}

            {/* 4. Tombol Batal dan Export Excel */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCloseExportModal}
                disabled={isExporting}
              >
                Batal
              </button>
              <ExportExcelButton
                onClick={handleExecuteExportModal}
                isLoading={isExporting}
                disabled={reportCategory === "bulanan" && (!monthlyMonth || !monthlyYear)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Unified ConfirmDeleteModal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Hapus Laporan Kalori Harian?"
        itemName={
          deleteTarget
            ? `${caterings.find((c) => c.id === deleteTarget.catering_id)?.nama || "Katering"} — ${deleteTarget.tanggal} (${deleteTarget.shift || "Pagi"}) — ${deleteTarget.nama_masakan_sayur || deleteTarget.jenis_masakan || "Kalori Harian"} (${formatNumberID(deleteTarget.total_kalori, { decimals: 1 })} kkal)`
            : undefined
        }
        description="Apakah Anda yakin ingin menghapus data kalori harian ini? Seluruh rincian bahan dan perhitungan energi terkait akan dihapus secara permanen."
        confirmText="Hapus Laporan"
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

      {/* Modal Preview: See Report (Exact Excel Layout Matching Screenshot) */}
      {previewModalEntry && (() => {
        const cateringObj = caterings.find((c) => c.id === previewModalEntry.catering_id);
        const namaCatering = cateringObj ? cateringObj.nama : "Catering";
        const previewGroups = processModalPreviewGroups(previewModalEntry);
        const totalAllItems = previewGroups.reduce((acc, g) => acc + g.items.length, 0);

        return (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: 1100, width: "95%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", marginBottom: 6 }}>
                    Preview Laporan Excel Kalori Harian
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Katering: <strong style={{ color: "var(--text)" }}>{namaCatering}</strong> &nbsp;|&nbsp; Tanggal: <strong style={{ color: "var(--text)" }}>{formatDisplayDate(previewModalEntry.tanggal)}</strong> &nbsp;|&nbsp; Shift: <strong style={{ color: "var(--text)" }}>{previewModalEntry.shift}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                  onClick={() => setPreviewModalEntry(null)}
                >
                  <X size={20} />
                </button>
              </div>

              {previewGroups.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Tidak ada rincian bahan makanan pada entri ini.</p>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "center", minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: "var(--sidebar-bg)", color: "var(--text)", fontWeight: 800 }}>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "6%", textAlign: "center" }}>SHIFT</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "13%", textAlign: "center" }}>MENU</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "15%", textAlign: "center" }}>BAHAN</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "9%", textAlign: "center" }}>STANDARD KALORI<br/>(A)</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "9%", textAlign: "center" }}>STANDARD BERAT</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "9%", textAlign: "center" }}>ACTUAL BERAT</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "10%", textAlign: "center" }}>TOTAL ACTUAL BERAT</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "11%", textAlign: "center" }}>BERAT MAXIMAL SESUAI STANDARD (gr)<br/>(B)</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "8%", textAlign: "center" }}>TOTAL BERAT</th>
                        <th style={{ border: "1px solid var(--border)", padding: "10px 6px", width: "10%", textAlign: "center" }}>ENERGI (kkal)<br/><span style={{ fontSize: 9.5, fontWeight: 500 }}>( ( B : 100 ) X A )</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewGroups.map((grp, gIdx) => {
                        return grp.items.map((it, iIdx) => {
                          const isFirstInGroup = iIdx === 0;
                          return (
                            <tr key={`${gIdx}-${iIdx}`} style={{ background: "var(--card)" }}>
                              {/* Shift cell - merged across all items in table */}
                              {gIdx === 0 && iIdx === 0 && (
                                <td
                                  rowSpan={totalAllItems}
                                  style={{
                                    border: "1px solid var(--border)",
                                    padding: 8,
                                    fontWeight: 800,
                                    verticalAlign: "middle",
                                    background: "var(--card)",
                                    fontSize: 12,
                                  }}
                                >
                                  {previewModalEntry.shift?.toUpperCase()}
                                </td>
                              )}

                              {/* Menu / Role Category cell - merged per group */}
                              {isFirstInGroup && (
                                <td
                                  rowSpan={grp.items.length}
                                  style={{
                                    border: "1px solid var(--border)",
                                    padding: 8,
                                    fontWeight: 700,
                                    textAlign: "left",
                                    verticalAlign: "middle",
                                    fontSize: 11,
                                  }}
                                >
                                  {grp.category.toUpperCase()} : {grp.menuName}
                                </td>
                              )}

                              {/* Bahan */}
                              <td style={{ border: "1px solid var(--border)", padding: 6, textAlign: "left" }}>
                                {it.nama_bahan}
                              </td>

                              {/* Standard Kalori (A) */}
                              <td style={{ border: "1px solid var(--border)", padding: 6 }}>
                                {it.standar_kalori}
                              </td>

                              {/* Standard Berat - merged per group */}
                              {isFirstInGroup && (
                                <td
                                  rowSpan={grp.items.length}
                                  style={{
                                    border: "1px solid var(--border)",
                                    padding: 6,
                                    fontWeight: 700,
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {grp.roleStandardBerat !== null ? formatDec(grp.roleStandardBerat) : "-"}
                                </td>
                              )}

                              {/* Actual Berat */}
                              <td style={{ border: "1px solid var(--border)", padding: 6 }}>
                                {formatDec(it.berat_aktual)}
                              </td>

                              {/* Total Actual Berat - merged per group */}
                              {isFirstInGroup && (
                                <td
                                  rowSpan={grp.items.length}
                                  style={{
                                    border: "1px solid var(--border)",
                                    padding: 6,
                                    fontWeight: 700,
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {formatDec(grp.totalActualBerat)}
                                </td>
                              )}

                              {/* Berat Maximal Sesuai Standard (B) */}
                              <td style={{ border: "1px solid var(--border)", padding: 6 }}>
                                {formatDec(it.b_val)}
                              </td>

                              {/* Total Berat - merged per group */}
                              {isFirstInGroup && (
                                <td
                                  rowSpan={grp.items.length}
                                  style={{
                                    border: "1px solid var(--border)",
                                    padding: 6,
                                    fontWeight: 700,
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {formatDec(grp.totalB)}
                                </td>
                              )}

                              {/* Energi (kkal) */}
                              <td style={{ border: "1px solid var(--border)", padding: 6, fontWeight: 700 }}>
                                {formatDec(it.energi_val)}
                              </td>
                            </tr>
                          );
                        });
                      })}
                      {/* Total Energi Row */}
                      <tr style={{ background: "var(--sidebar-bg)", fontWeight: 800 }}>
                        <td colSpan={9} style={{ border: "1px solid var(--border)", padding: 10, textAlign: "right", fontSize: 12 }}>
                          Total energi (kalori)
                        </td>
                        <td style={{ border: "1px solid var(--border)", padding: 10, textAlign: "center", fontSize: 13, color: "var(--red)" }}>
                          {formatDec(previewModalEntry.total_kalori)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <span className={`pill ${previewModalEntry.mencapai ? "status-approved" : "pill-combo"}`}>
                  {previewModalEntry.mencapai ? "Mencapai Standard Kalori" : "Tidak Mencapai Standard Kalori"}
                </span>

                <button type="button" className="btn btn-outline" onClick={() => setPreviewModalEntry(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function RekapMingguanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Memuat halaman...</div>}>
      <RekapMingguanContent />
    </Suspense>
  );
}
