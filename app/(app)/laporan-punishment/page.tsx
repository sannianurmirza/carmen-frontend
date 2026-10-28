"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  ClipboardCheck,
  ClipboardList,
  Utensils,
  MessageSquareWarning,
  History,
  Save,
  CheckCircle2,
  Download,
  AlertTriangle,
  RotateCcw,
  Eye,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  Lock,
  AlertCircle,
  Building2,
  Users,
  Check,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  getPunishmentMonthlyPreviewApi,
  savePunishmentMonthlyApi,
  listPunishmentMonthlyApi,
  getPunishmentMonthlyDetailApi,
  finalizePunishmentMonthlyApi,
  exportPunishmentMonthlyExcelApi,
  deletePunishmentMonthlyApi,
  LaporanPunishmentPreviewResponse,
  LaporanPunishmentBulananItem,
  LaporanPunishmentDetailResponse,
  CateringOrderItem,
} from "@/lib/api";
import { normalizeCateringKalori } from "@/lib/punishmentNormalizers";
import { useToast } from "@/context/ToastContext";
import { useModalA11y } from "@/hooks/useModalA11y";

const BULAN_LIST = [
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

const MONTH_NAMES = BULAN_LIST.map((b) => b.label);

function getDefaultCycleDates(month: number, year: number) {
  let prevM = month - 1;
  let prevY = year;
  if (prevM === 0) {
    prevM = 12;
    prevY = year - 1;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${prevY}-${pad(prevM)}-20`;
  const end = `${year}-${pad(month)}-19`;
  return { start, end };
}

function formatIndoDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    }
  } catch {}
  return dateStr;
}

function formatIndoDateFull(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    }
  } catch {}
  return dateStr;
}

function formatPeriodeAktif(startDateStr?: string, endDateStr?: string): string {
  if (!startDateStr || !endDateStr) return "-";
  try {
    const pStart = startDateStr.split("-");
    const pEnd = endDateStr.split("-");
    if (pStart.length === 3 && pEnd.length === 3) {
      const dStart = new Date(parseInt(pStart[0], 10), parseInt(pStart[1], 10) - 1, parseInt(pStart[2], 10));
      const dEnd = new Date(parseInt(pEnd[0], 10), parseInt(pEnd[1], 10) - 1, parseInt(pEnd[2], 10));
      const startDay = dStart.getDate();
      const startMonth = dStart.toLocaleDateString("id-ID", { month: "long" });
      const startYear = dStart.getFullYear();
      const endDay = dEnd.getDate();
      const endMonth = dEnd.toLocaleDateString("id-ID", { month: "long" });
      const endYear = dEnd.getFullYear();
      if (startYear === endYear) {
        return `${startDay} ${startMonth}–${endDay} ${endMonth} ${endYear}`;
      } else {
        return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
      }
    }
  } catch {}
  return `${startDateStr}–${endDateStr}`;
}

export default function LaporanPunishmentPage() {
  const { showToast } = useToast();

  // Current Date default
  const now = new Date();
  const currentMonth = now.getDate() >= 20 ? (now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2) : now.getMonth() + 1;
  const currentYear = now.getDate() >= 20 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const initialCycle = getDefaultCycleDates(currentMonth, currentYear);
  const [startDate, setStartDate] = useState<string>(initialCycle.start);
  const [endDate, setEndDate] = useState<string>(initialCycle.end);
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  // Loading & Data states
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const [previewData, setPreviewData] = useState<LaporanPunishmentPreviewResponse | null>(null);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);
  const [reportStatus, setReportStatus] = useState<"draft" | "final" | null>(null);
  const [selectedReport, setSelectedReport] = useState<LaporanPunishmentDetailResponse | null>(null);
  const [showRecalculateModal, setShowRecalculateModal] = useState<boolean>(false);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Sumber status aturan: berasal dari draft yang sedang dibuka (selectedReport) jika ada, bukan preview terbaru
  const activeRuleConfig = selectedReport?.snapshot?.rule_version_config ?? previewData?.rule_version_config;
  const activeRuleStatus = selectedReport
    ? (selectedReport.rule_status || activeRuleConfig?.status || "MENUNGGU_KONFIRMASI")
    : (previewData?.rule_version_config?.status || "DISETUJUI");

  // Helper canonical rule version (2025_v1, 2025, dsb. merefleksikan 2025-10)
  const canonicalRule = (v?: string) => {
    if (!v) return "2025-10";
    const s = String(v).trim().toLowerCase();
    if (["2025_v1", "2025", "2025_10", "oktober_2025", "2025_oktober"].includes(s)) return "2025-10";
    return v;
  };

  const isRuleApprovedForDraft = selectedReport
    ? (selectedReport.is_rule_approved ?? (activeRuleStatus === "DISETUJUI"))
    : (previewData?.is_rule_approved === true && previewData?.rule_version_config?.status === "DISETUJUI");

  const isLegacyDraft = Boolean(
    selectedReport &&
    reportStatus === "draft" &&
    (selectedReport.is_legacy ?? (canonicalRule(selectedReport.rule_version) !== canonicalRule(selectedReport.active_rule_version || previewData?.active_rule_version) || !isRuleApprovedForDraft))
  );

  // User input orders & kebersihan state per catering
  const [ordersMap, setOrdersMap] = useState<Record<number, { pagi: number; malam: number; kondisi: string }>>({});
  const [showOrderPanel, setShowOrderPanel] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"resum" | "terlambat" | "kelayakan" | "audit" | "kalori" | "komplain">("resum");

  // History modal
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<LaporanPunishmentBulananItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Finalize confirm modal
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [showAuditIncompleteModal, setShowAuditIncompleteModal] = useState<boolean>(false);

  // Trigger refs for modal accessibility
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const finalizeButtonRef = useRef<HTMLButtonElement>(null);
  const recalculateButtonRef = useRef<HTMLButtonElement>(null);

  // Modal a11y hooks (Focus trap, Esc key, restore focus)
  const historyModalRef = useModalA11y<HTMLDivElement>({
    isOpen: historyOpen,
    onClose: () => setHistoryOpen(false),
    isLoading: historyLoading,
    triggerRef: historyButtonRef,
  });

  const finalizeModalRef = useModalA11y<HTMLDivElement>({
    isOpen: showFinalizeModal,
    onClose: () => setShowFinalizeModal(false),
    isLoading: finalizing,
    triggerRef: finalizeButtonRef,
  });

  const auditIncompleteModalRef = useModalA11y<HTMLDivElement>({
    isOpen: showAuditIncompleteModal,
    onClose: () => setShowAuditIncompleteModal(false),
    triggerRef: finalizeButtonRef,
  });

  const recalculateModalRef = useModalA11y<HTMLDivElement>({
    isOpen: showRecalculateModal,
    onClose: () => setShowRecalculateModal(false),
    isLoading: recalculating,
    triggerRef: recalculateButtonRef,
  });

  // When month or year changes and not custom date, update cycle
  const handleMonthYearChange = (newM: number, newY: number) => {
    setSelectedMonth(newM);
    setSelectedYear(newY);
    setSelectedReport(null);
    setSavedReportId(null);
    setReportStatus(null);
    setFetchError(null);
    setDateValidationError(null);
    if (!isCustomDate) {
      const cycle = getDefaultCycleDates(newM, newY);
      setStartDate(cycle.start);
      setEndDate(cycle.end);
    }
  };

  // Manual date change handlers
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      setDateValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal selesai");
    } else {
      setDateValidationError(null);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && startDate > val) {
      setDateValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal selesai");
    } else {
      setDateValidationError(null);
    }
  };

  const handleResetStandardPeriod = () => {
    setIsCustomDate(false);
    setDateValidationError(null);
    const cycle = getDefaultCycleDates(selectedMonth, selectedYear);
    setStartDate(cycle.start);
    setEndDate(cycle.end);
  };

  const handleTampilkanData = () => {
    if (startDate > endDate) {
      setDateValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal selesai");
      showToast("Tanggal mulai tidak boleh melebihi tanggal selesai", "error");
      return;
    }
    fetchPreview(startDate, endDate);
  };

  // Fetch preview calculation
  const fetchPreview = useCallback(async (start: string, end: string) => {
    if (start > end) {
      setDateValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal selesai");
      showToast("Tanggal mulai tidak boleh melebihi tanggal selesai", "error");
      return;
    }
    setDateValidationError(null);
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getPunishmentMonthlyPreviewApi(start, end);
      setPreviewData(res);

      if (res.existing_report) {
        setSavedReportId(res.existing_report.id);
        setReportStatus(res.existing_report.status as any);
        try {
          const detail = await getPunishmentMonthlyDetailApi(res.existing_report.id);
          setSelectedReport(detail);
        } catch {}
      } else {
        setSavedReportId(null);
        setReportStatus(null);
        setSelectedReport(null);
      }

      // Initialize ordersMap from preview caterings
      setOrdersMap((prev) => {
        const next = { ...prev };
        (res.caterings || []).forEach((c: any) => {
          if (c?.catering_id) {
            const ordSrc = c.order_source;
            const isConfirmed =
              (ordSrc?.source_type === "daily_order" && ordSrc?.is_complete) ||
              (ordSrc?.source_type === "catering_order_quota" && ordSrc?.status === "confirmed") ||
              ordSrc?.source_type === "historical_final_snapshot";
            if (isConfirmed || !next[c.catering_id]) {
              next[c.catering_id] = {
                pagi: ordSrc?.order_pagi ?? c.order_pagi ?? c.jumlah_order_pagi ?? 0,
                malam: ordSrc?.order_malam ?? c.order_malam ?? c.jumlah_order_malam ?? 0,
                kondisi: next[c.catering_id]?.kondisi || c.kebersihan_kondisi || "belum_dinilai",
              };
            }
          }
        });
        return next;
      });
    } catch (err: any) {
      const msg = err.message || "Gagal memuat data laporan";
      setFetchError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load preview initially
  useEffect(() => {
    fetchPreview(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate preview locally with current ordersMap
  const handleApplyOrders = async () => {
    await handleSaveDraft(false);
    showToast("Dasar order dan kebersihan diterapkan ke preview", "success");
  };

  // Save Draft
  const handleSaveDraft = async (showNotification = true) => {
    if (!previewData) return;
    setSaving(true);
    try {
      const ordersPayload: CateringOrderItem[] = previewData.caterings.map((c) => {
        const ord = ordersMap[c.catering_id] || { pagi: 0, malam: 0, kondisi: "belum_dinilai" };
        const score =
          ord.kondisi === "bersih"
            ? 10
            : ord.kondisi === "tidak_rapi"
            ? 8
            : ord.kondisi === "kotor"
            ? 6
            : ord.kondisi === "melanggar"
            ? 4
            : null;
        const parseOrderNum = (val: unknown): number => {
          if (typeof val === "number" && Number.isFinite(val) && val >= 0) return val;
          if (typeof val === "string" && val.trim() !== "") {
            const num = Number(val);
            if (Number.isFinite(num) && num >= 0) return num;
          }
          return 0;
        };
        const ordSrc = c.order_source;
        const isAuthOrLegacy =
          ordSrc?.source_type === "daily_order" ||
          (ordSrc?.source_type === "catering_order_quota" && ordSrc?.status === "confirmed") ||
          ordSrc?.source_type === "legacy_report_order" ||
          ordSrc?.source_type === "historical_final_snapshot";

        const orderPagi = isAuthOrLegacy ? (ordSrc?.order_pagi ?? parseOrderNum(ord.pagi)) : 0;
        const orderMalam = isAuthOrLegacy ? (ordSrc?.order_malam ?? parseOrderNum(ord.malam)) : 0;

        return {
          catering_id: c.catering_id,
          jumlah_order_pagi: orderPagi,
          jumlah_order_malam: orderMalam,
          kebersihan_kondisi: ord.kondisi,
          kebersihan_score: score,
        };
      });

      const targetRule = previewData?.active_rule_version || selectedReport?.active_rule_version;
      const res = await savePunishmentMonthlyApi({
        start_date: startDate,
        end_date: endDate,
        bulan_laporan: selectedMonth,
        tahun_laporan: selectedYear,
        caterings_order: ordersPayload,
        rule_version: targetRule,
      });

      setSavedReportId(res.id);
      setReportStatus("draft");
      const detail = await getPunishmentMonthlyDetailApi(res.id);
      setSelectedReport(detail);

      if (detail.snapshot) {
        setPreviewData(detail.snapshot);
      }

      if (showNotification) {
        showToast("Draft laporan berhasil disimpan", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan draft", "error");
    } finally {
      setSaving(false);
    }
  };

  // Confirm Finalize
  const handleConfirmFinalize = async () => {
    if (!savedReportId) {
      try {
        await handleSaveDraft(false);
      } catch {
        return;
      }
    }

    if (!isRuleApprovedForDraft || isLegacyDraft) {
      const rStat = activeRuleStatus || "BELUM_DISETUJUI";
      showToast(`Finalisasi diblokir: Aturan perhitungan belum berstatus DISETUJUI (status: ${rStat}). Lakukan 'Hitung Ulang dengan Aturan Aktif' terlebih dahulu.`, "error");
      setShowFinalizeModal(false);
      return;
    }

    const isShiftBlocked = selectedReport
      ? selectedReport.snapshot?.is_shift_rules_confirmed === false
      : previewData?.is_shift_rules_confirmed === false;

    if (isShiftBlocked) {
      showToast("Finalisasi diblokir: Aturan shift belum disetujui.", "error");
      setShowFinalizeModal(false);
      return;
    }

    const unconfirmedKebersihan = previewData?.caterings.some((c) => {
      const ord = ordersMap[c.catering_id];
      return !ord || ord.kondisi === "belum_dinilai";
    });

    if (unconfirmedKebersihan) {
      showToast("Finalisasi belum tersedia: Sumber data Kebersihan Kantin belum dikonfirmasi.", "error");
      setShowFinalizeModal(false);
      return;
    }

    if (previewData?.audit_completeness && !previewData.audit_completeness.is_complete) {
      setShowFinalizeModal(false);
      setShowAuditIncompleteModal(true);
      return;
    }

    setFinalizing(true);
    try {
      const targetId = savedReportId!;
      const res = await finalizePunishmentMonthlyApi(targetId);
      setReportStatus("final");
      setShowFinalizeModal(false);
      showToast("Laporan berhasil difinalisasi dan dikunci", "success");
      const detail = await getPunishmentMonthlyDetailApi(targetId);
      setSelectedReport(detail);
      if (detail.snapshot) {
        setPreviewData(detail.snapshot);
      }
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (errMsg.includes("Data Audit Belum Lengkap")) {
        setShowFinalizeModal(false);
        setShowAuditIncompleteModal(true);
      } else {
        showToast(errMsg || "Gagal memfinalisasi laporan", "error");
      }
    } finally {
      setFinalizing(false);
    }
  };

  // Recalculate Draft with Active Rules
  const handleRecalculateWithActiveRule = async () => {
    if (!savedReportId || !selectedReport) return;
    setRecalculating(true);
    try {
      const ordersPayload: CateringOrderItem[] = (selectedReport.caterings_order || []).map((o) => ({
        catering_id: o.catering_id,
        jumlah_order_pagi: o.jumlah_order_pagi,
        jumlah_order_malam: o.jumlah_order_malam,
        kebersihan_kondisi: o.kebersihan_kondisi,
        kebersihan_score: o.kebersihan_score,
      }));

      const activeVer = selectedReport.active_rule_version || previewData?.active_rule_version;
      const res = await savePunishmentMonthlyApi({
        start_date: selectedReport.periode_mulai,
        end_date: selectedReport.periode_selesai,
        bulan_laporan: selectedReport.bulan_laporan,
        tahun_laporan: selectedReport.tahun_laporan,
        caterings_order: ordersPayload,
        rule_version: activeVer,
      });

      setShowRecalculateModal(false);
      showToast(`Draft berhasil dihitung ulang menggunakan Ketentuan Aktif (${activeVer})`, "success");
      const detail = await getPunishmentMonthlyDetailApi(res.id);
      setSelectedReport(detail);
      if (detail.snapshot) {
        setPreviewData(detail.snapshot);
      }
    } catch (err: any) {
      showToast(err.message || "Gagal menghitung ulang draft", "error");
    } finally {
      setRecalculating(false);
    }
  };

  // Download Excel
  const handleDownloadExcel = async (reportId?: number) => {
    const idToDownload = reportId || savedReportId;
    if (!idToDownload) {
      showToast("Silakan simpan draft terlebih dahulu untuk mengunduh Excel", "error");
      return;
    }
    setExporting(true);
    try {
      const { blob, filename } = await exportPunishmentMonthlyExcelApi(idToDownload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Excel Laporan Punishment berhasil diunduh", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal mengunduh Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  // Open History Modal
  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const list = await listPunishmentMonthlyApi();
      setHistoryList(list);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat histori laporan", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Report from History
  const handleOpenReport = async (reportId: number) => {
    setLoading(true);
    try {
      const detail = await getPunishmentMonthlyDetailApi(reportId);
      setSelectedReport(detail);
      setSavedReportId(detail.id);
      setReportStatus(detail.status as any);
      setStartDate(detail.periode_mulai);
      setEndDate(detail.periode_selesai);
      setSelectedMonth(detail.bulan_laporan);
      setSelectedYear(detail.tahun_laporan);
      setIsCustomDate(true);

      if (detail.snapshot) {
        setPreviewData(detail.snapshot);
      }

      const ordMap: Record<number, { pagi: number; malam: number; kondisi: string }> = {};
      (detail.caterings_order || []).forEach((o) => {
        ordMap[o.catering_id] = {
          pagi: o.jumlah_order_pagi,
          malam: o.jumlah_order_malam,
          kondisi: o.kebersihan_kondisi || "bersih",
        };
      });
      setOrdersMap(ordMap);

      setHistoryOpen(false);
      showToast(`Laporan periode ${detail.periode_mulai} s.d ${detail.periode_selesai} berhasil dibuka`, "info");
    } catch (err: any) {
      showToast(err.message || "Gagal membuka laporan", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete Draft from History
  const handleDeleteDraft = async (id: number) => {
    if (!confirm("Hapus draft laporan ini dari histori?")) return;
    try {
      await deletePunishmentMonthlyApi(id);
      showToast("Draft berhasil dihapus", "success");
      const list = await listPunishmentMonthlyApi();
      setHistoryList(list);
      if (savedReportId === id) {
        setSavedReportId(null);
        setReportStatus(null);
        setSelectedReport(null);
      }
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus draft", "error");
    }
  };

  // Completeness items
  const completeness = previewData?.completeness;

  // Order completeness calculation (Phase 3B)
  const isOrderComplete = useMemo(() => {
    if (previewData?.is_order_complete !== undefined) {
      return previewData.is_order_complete;
    }
    if (!previewData?.caterings || previewData.caterings.length === 0) return true;
    return previewData.caterings.every((c: any) => {
      const src = c.order_source;
      return src ? src.is_complete : true;
    });
  }, [previewData]);

  const incompleteOrderCaterings = useMemo(() => {
    if (previewData?.incomplete_order_caterings) {
      return previewData.incomplete_order_caterings;
    }
    if (!previewData?.caterings) return [];
    return previewData.caterings
      .filter((c: any) => c.order_source && !c.order_source.is_complete)
      .map((c: any) => c.catering_nama);
  }, [previewData]);

  // Kebersihan completeness calculation
  const isKebersihanComplete = useMemo(() => {
    if (!previewData?.caterings || previewData.caterings.length === 0) return false;
    return previewData.caterings.every((c) => {
      const ord = ordersMap[c.catering_id];
      return ord && ord.kondisi && ord.kondisi !== "belum_dinilai";
    });
  }, [previewData, ordersMap]);

  const evaluatedKebersihanCount = useMemo(() => {
    if (!previewData?.caterings) return 0;
    return previewData.caterings.filter((c) => {
      const ord = ordersMap[c.catering_id];
      return ord && ord.kondisi && ord.kondisi !== "belum_dinilai";
    }).length;
  }, [previewData, ordersMap]);

  const filledOrdersCount = useMemo(() => {
    if (!previewData?.caterings) return 0;
    return previewData.caterings.filter((c) => {
      const ord = ordersMap[c.catering_id];
      return ord && ((Number(ord.pagi) || 0) > 0 || (Number(ord.malam) || 0) > 0);
    }).length;
  }, [previewData, ordersMap]);

  const totalCaterings = previewData?.total_caterings || previewData?.caterings?.length || 5;

  // Summary statistics for RESUM tab
  const kpiStats = useMemo(() => {
    const cats = previewData?.caterings || [];
    const total = cats.length;
    const withPunishment = cats.filter((c) => (c.total_punishment_pagi || 0) > 0 || (c.total_punishment_malam || 0) > 0).length;
    const totalPorsiPotong = cats.reduce((acc, c) => acc + (c.total_punishment_pagi || 0) + (c.total_punishment_malam || 0), 0);
    const isReady = isKebersihanComplete && isOrderComplete && isRuleApprovedForDraft && !isLegacyDraft;
    return { total, withPunishment, totalPorsiPotong, isReady };
  }, [previewData, isKebersihanComplete, isOrderComplete, isRuleApprovedForDraft, isLegacyDraft]);

  const selectedMonthObj = BULAN_LIST.find((b) => b.value === selectedMonth);
  const selectedMonthLabel = selectedMonthObj ? selectedMonthObj.label : "Bulan";

  // Helper status badge mapper
  const getCompletenessBadge = (item?: { status: string; count?: number; caterings_count?: number }) => {
    const st = item?.status;
    if (st === "Tersedia") {
      return {
        label: "Lengkap",
        bg: "#f0fdf4",
        text: "#166534",
        border: "#bbf7d0",
      };
    }
    if (st === "Belum Lengkap") {
      return {
        label: "Belum lengkap",
        bg: "#fffbeb",
        text: "#92400e",
        border: "#fde68a",
      };
    }
    if (st === "Tidak Ada Data") {
      return {
        label: "Tidak ada data",
        bg: "#f8fafc",
        text: "#475569",
        border: "#cbd5e1",
      };
    }
    if (st === "Gagal Dimuat" || st === "Error") {
      return {
        label: "Gagal dimuat",
        bg: "#fef2f2",
        text: "#991b1b",
        border: "#fecaca",
      };
    }
    return {
      label: "Memuat...",
      bg: "#f8fafc",
      text: "#64748b",
      border: "#e2e8f0",
    };
  };

  // Tab definitions
  const tabsList = [
    { id: "resum", label: "Ringkasan (RESUM)" },
    { id: "terlambat", label: "Keterlambatan" },
    { id: "kelayakan", label: "Kelayakan Menu" },
    { id: "audit", label: "Hasil Audit" },
    { id: "kalori", label: "Kalori Harian" },
    { id: "komplain", label: "Komplain" },
  ];

  // Tab keyboard navigation
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = (index + 1) % tabsList.length;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = (index - 1 + tabsList.length) % tabsList.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = tabsList.length - 1;
    }
    if (nextIndex >= 0) {
      const nextTab = tabsList[nextIndex];
      setActiveTab(nextTab.id as any);
      const btn = document.getElementById(`tab-${nextTab.id}`);
      if (btn) btn.focus();
    }
  };

  // Completeness items definition
  const completenessItems = [
    {
      id: "terlambat",
      tabId: "terlambat",
      title: "Keterlambatan",
      icon: <Clock size={18} aria-hidden="true" />,
      progressText: completeness?.keterlambatan?.count
        ? `${completeness.keterlambatan.count} kejadian tercatat`
        : "0 kejadian tercatat",
      badge: getCompletenessBadge(completeness?.keterlambatan),
    },
    {
      id: "kelayakan",
      tabId: "kelayakan",
      title: "Kelayakan Menu",
      icon: <ClipboardCheck size={18} aria-hidden="true" />,
      progressText: `${completeness?.kelayakan?.caterings_count ?? 0} dari ${totalCaterings} katering dinilai`,
      badge: getCompletenessBadge(completeness?.kelayakan),
    },
    {
      id: "audit",
      tabId: "audit",
      title: "Audit Dapur",
      icon: <ClipboardList size={18} aria-hidden="true" />,
      progressText: previewData?.audit_completeness
        ? `${previewData.audit_completeness.total_completed} dari ${previewData.audit_completeness.total_required} katering diaudit (Final)`
        : `${completeness?.audit?.caterings_count ?? 0} dari ${totalCaterings} katering diaudit`,
      badge: previewData?.audit_completeness
        ? (previewData.audit_completeness.is_complete
            ? {
                label: "Lengkap",
                bg: "#f0fdf4",
                text: "#166534",
                border: "#bbf7d0",
              }
            : {
                label: "Belum lengkap",
                bg: "#fffbeb",
                text: "#92400e",
                border: "#fde68a",
              })
        : getCompletenessBadge(completeness?.audit),
    },
    {
      id: "kalori",
      tabId: "kalori",
      title: "Kalori Harian",
      icon: <Utensils size={18} aria-hidden="true" />,
      progressText: `${completeness?.kalori?.count ?? 0} pengujian sampel`,
      badge: getCompletenessBadge(completeness?.kalori),
    },
    {
      id: "komplain",
      tabId: "komplain",
      title: "Komplain Katering",
      icon: <MessageSquareWarning size={18} aria-hidden="true" />,
      progressText: `${completeness?.komplain?.count ?? 0} komplain tercatat`,
      badge: getCompletenessBadge(completeness?.komplain),
    },
    {
      id: "order",
      tabId: "resum",
      title: "Order / Kuota Katering",
      icon: <FileSpreadsheet size={18} aria-hidden="true" />,
      progressText: `${previewData?.completeness?.order?.caterings_count ?? 0} dari ${totalCaterings} katering terkonfirmasi`,
      badge: isOrderComplete
        ? {
            label: "Lengkap",
            bg: "#f0fdf4",
            text: "#166534",
            border: "#bbf7d0",
          }
        : {
            label: "Belum lengkap",
            bg: "#fffbeb",
            text: "#92400e",
            border: "#fde68a",
          },
    },
  ];

  return (
    <div
      className="punishment-page-container"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "32px 32px 80px",
      }}
    >
      <style>{`
        .punishment-page-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 32px 80px;
        }
        @media (max-width: 1024px) {
          .punishment-page-container {
            padding: 20px 20px 60px !important;
          }
        }
        @media (max-width: 640px) {
          .punishment-page-container {
            padding: 16px 16px 40px !important;
          }
        }
        .completeness-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
          border-bottom: 1px solid #f1f5f9;
        }
        .completeness-row:hover {
          background-color: #f8fafc;
        }
        .completeness-row:focus-visible {
          outline: 2px solid #2563eb !important;
          outline-offset: -2px !important;
        }
        .action-bar-container {
          display: flex;
          justifyContent: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px 20px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        @media (max-width: 768px) {
          .action-bar-container {
            flex-direction: column;
            align-items: stretch;
          }
          .action-buttons-group {
            flex-direction: column;
            width: 100%;
          }
          .action-buttons-group button {
            width: 100%;
            justify-content: center;
          }
        }
        @keyframes headerEntrance {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes filterEntrance {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes manualDateExpand {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes statusDotIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .header-animated {
          animation: headerEntrance 220ms ease-out forwards;
        }
        .period-panel-container {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          padding: 20px 24px;
          margin-bottom: 24px;
          animation: filterEntrance 260ms 40ms ease-out backwards;
        }
        .history-header-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 44px;
          padding: 0 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
        }
        .history-header-btn:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
        }
        .history-header-btn:active {
          transform: translateY(1px);
        }
        .history-header-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          border-color: #2563eb;
        }
        .status-dot-animated {
          animation: statusDotIn 180ms ease-out forwards;
        }
        .period-grid {
          display: grid;
          grid-template-columns: minmax(180px, 1.1fr) minmax(120px, 0.7fr) minmax(180px, 1fr) minmax(180px, 1fr) auto;
          gap: 16px;
          align-items: end;
        }
        @media (max-width: 1199px) and (min-width: 768px) {
          .period-grid {
            grid-template-columns: 1fr 1fr;
          }
          .period-grid-btn-col {
            grid-column: span 2;
          }
        }
        @media (max-width: 767px) {
          .period-grid {
            grid-template-columns: 1fr;
          }
          .period-grid-btn-col button {
            width: 100% !important;
          }
        }
        .period-input {
          width: 100%;
          height: 48px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #ffffff;
          padding: 0 14px;
          font-size: 15px;
          color: #0f172a;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .period-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .period-input-readonly {
          width: 100%;
          height: 48px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #f8fafc;
          padding: 0 14px 0 38px;
          font-size: 15px;
          color: #334155;
          cursor: default;
        }
        .btn-tampilkan-data {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 20px;
          white-space: nowrap;
          border-radius: 7px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
          min-width: 160px;
          transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
        }
        .btn-tampilkan-data:hover:not(:disabled) {
          background-color: #1d4ed8;
        }
        .btn-tampilkan-data:active:not(:disabled) {
          transform: translateY(1px);
        }
        .btn-tampilkan-data:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
        }
        .btn-tampilkan-data:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }
        .btn-toggle-manual {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 40px;
          padding: 0 10px;
          border-radius: 6px;
          background: none;
          border: none;
          color: #2563eb;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
        }
        .btn-toggle-manual:hover {
          text-decoration: underline;
          background-color: #f1f5f9;
        }
        .btn-toggle-manual:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .manual-date-accordion {
          animation: manualDateExpand 180ms ease-out;
          margin-top: 16px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        /* Panel Kelengkapan Sumber Data */
        .completeness-panel-container {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          margin-bottom: 24px;
          overflow: hidden;
          animation: filterEntrance 260ms 80ms ease-out backwards;
        }
        .completeness-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .completeness-table-header {
          display: grid;
          grid-template-columns: minmax(220px, 1.1fr) minmax(240px, 1.5fr) minmax(150px, auto) 20px;
          gap: 12px;
          padding: 10px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .completeness-row-btn {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(220px, 1.1fr) minmax(240px, 1.5fr) minmax(150px, auto) 20px;
          gap: 12px;
          align-items: center;
          padding: 12px 20px;
          min-height: 54px;
          border: none;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: background-color 150ms ease, color 150ms ease;
        }
        .completeness-row-btn:hover {
          background-color: #f8fafc;
        }
        .completeness-row-btn:hover .completeness-source-name {
          color: #1d4ed8;
        }
        .completeness-row-btn:hover .completeness-icon-box {
          color: #2563eb;
        }
        .completeness-row-btn:hover .completeness-chevron {
          transform: translateX(2px);
          color: #2563eb;
        }
        .completeness-row-btn:focus-visible {
          outline: 2px solid #2563eb !important;
          outline-offset: -2px !important;
        }
        .completeness-row-btn:active {
          background-color: #f1f5f9;
        }
        .completeness-row-btn.active {
          border-left: 3px solid #2563eb;
          background-color: #f8fbff;
        }
        .completeness-row-btn.active .completeness-source-name {
          color: #1d4ed8;
          font-weight: 600;
        }
        .completeness-row-btn.active .completeness-icon-box {
          color: #2563eb;
        }
        .completeness-chevron {
          transition: transform 120ms ease, color 120ms ease;
          color: #94a3b8;
        }
        @keyframes rowFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .row-stagger-0 { animation: rowFadeIn 180ms 0ms ease-out backwards; }
        .row-stagger-1 { animation: rowFadeIn 180ms 25ms ease-out backwards; }
        .row-stagger-2 { animation: rowFadeIn 180ms 50ms ease-out backwards; }
        .row-stagger-3 { animation: rowFadeIn 180ms 75ms ease-out backwards; }
        .row-stagger-4 { animation: rowFadeIn 180ms 100ms ease-out backwards; }
        .skeleton-row {
          height: 54px;
          padding: 12px 20px;
          display: grid;
          grid-template-columns: minmax(220px, 1.1fr) minmax(240px, 1.5fr) minmax(150px, auto) 20px;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
        }
        .skeleton-bar {
          height: 16px;
          border-radius: 4px;
          background: #f1f5f9;
          animation: skeletonPulse 1.5s ease-in-out infinite;
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .completeness-col-status {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .completeness-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 140px;
          min-width: 140px;
          height: 28px;
          padding: 0 12px;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 600;
          text-align: center;
          white-space: nowrap;
          box-sizing: border-box;
        }
        @media (max-width: 1199px) and (min-width: 768px) {
          .completeness-table-header,
          .completeness-row-btn,
          .skeleton-row {
            grid-template-columns: minmax(180px, 1.1fr) minmax(160px, 1fr) minmax(150px, auto) 20px;
          }
        }
        @media (max-width: 767px) {
          .completeness-table-header {
            display: none !important;
          }
          .completeness-row-btn,
          .skeleton-row {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 12px 16px !important;
            gap: 6px !important;
          }
          .completeness-col-source {
            flex: 1 1 auto !important;
          }
          .completeness-col-chevron {
            order: 2 !important;
          }
          .completeness-col-progress {
            flex: 1 1 100% !important;
            padding-left: 32px !important;
            font-size: 13px !important;
            color: #64748b !important;
            order: 3 !important;
          }
          .completeness-col-status {
            order: 4 !important;
            padding-left: 32px !important;
            margin-top: 4px !important;
            justify-content: flex-start !important;
          }
        }

        /* Accordion Pengaturan Order & Kebersihan */
        .order-accordion-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          margin-bottom: 24px;
          overflow: hidden;
          transition: border-color 200ms ease;
        }
        .order-accordion-container.open {
          border-color: #bfdbfe;
        }
        .order-accordion-header-btn {
          width: 100%;
          display: flex;
          justifyContent: space-between;
          align-items: center;
          padding: 16px 20px;
          min-height: 78px;
          background: #ffffff;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background-color 150ms ease;
        }
        .order-accordion-header-btn:hover {
          background-color: #f8fafc;
        }
        .order-accordion-header-btn.open {
          background-color: #f8fbff;
          border-bottom: 1px solid #e2e8f0;
        }
        .order-accordion-header-btn.open:hover {
          background-color: #f0f7ff;
        }
        .order-accordion-header-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        @media (max-width: 640px) {
          .order-accordion-header-btn {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .order-accordion-header-right {
            width: 100%;
            justify-content: space-between;
          }
        }
        .order-accordion-body {
          padding: 20px;
          animation: accordionBodyExpand 200ms ease-out forwards;
        }
        @keyframes accordionBodyExpand {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Navigasi Tab Laporan */
        .tab-list {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }
        .tab-button {
          position: relative;
          min-height: 48px;
          padding: 0 16px;
          white-space: nowrap;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 150ms ease, background-color 150ms ease;
        }
        .tab-button:hover {
          background-color: #f8fafc;
          color: #1e293b;
        }
        .tab-button.active {
          color: #1d4ed8;
        }
        .tab-button:focus-visible {
          outline: 2px solid #2563eb !important;
          outline-offset: -2px !important;
        }
        .tab-indicator {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #2563eb;
          border-radius: 2px 2px 0 0;
          transition: transform 160ms ease-out, opacity 160ms ease-out;
        }
        @keyframes tabContentFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .tab-content-animated {
          animation: tabContentFadeIn 180ms ease-out forwards;
        }
        .tab-content-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 10px 10px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        @media (max-width: 640px) {
          .tab-content-container {
            padding: 16px 12px;
          }
        }

        /* Tabel RESUM */
        .resum-table-wrapper {
          overflow-x: auto;
          overscroll-behavior-inline: contain;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
        }
        .resum-table {
          width: 100%;
          min-width: 1180px;
          table-layout: auto;
          border-collapse: collapse;
          font-size: 14px;
          text-align: left;
        }
        .resum-table th {
          background: #f8fafc;
          padding: 12px 10px;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          border-bottom: 2px solid #cbd5e1;
          vertical-align: bottom;
          line-height: 1.3;
        }
        .resum-table td {
          padding: 12px 10px;
          min-height: 56px;
          border-bottom: 1px solid #e2e8f0;
          color: #0f172a;
          line-height: 1.4;
          vertical-align: middle;
        }
        .resum-table tbody tr {
          transition: background-color 120ms ease;
          background-color: #ffffff;
        }
        .resum-table tbody tr:nth-child(even) {
          background-color: #fbfdff;
        }
        .resum-table tbody tr:hover {
          background-color: #f8fafc !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .header-animated,
          .period-panel-container,
          .manual-date-accordion,
          .status-dot-animated,
          .history-header-btn,
          .btn-tampilkan-data,
          .btn-toggle-manual,
          .completeness-panel-container,
          .order-accordion-container,
          .order-accordion-body,
          .row-stagger-0,
          .row-stagger-1,
          .row-stagger-2,
          .row-stagger-3,
          .row-stagger-4,
          .completeness-chevron,
          .skeleton-bar,
          .tab-content-animated,
          .tab-indicator {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
      {/* 1. Header Halaman */}
      <header
        className="header-animated"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ flex: "1 1 540px", minWidth: 280 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#2563eb",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            LAPORAN
          </span>
          <h1
            style={{
              fontSize: "clamp(24px, 2.5vw, 30px)",
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 8px",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            Laporan Punishment Bulanan
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#475569",
              margin: "0 0 10px",
              maxWidth: 720,
              lineHeight: 1.5,
            }}
          >
            Rekapitulasi performa dan punishment supplier catering berdasarkan ketentuan penilaian aktif.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 14, color: "#475569" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: previewData?.is_shift_rules_confirmed ? "#166534" : "#991b1b", fontWeight: 500 }}>
              <span
                className="status-dot-animated"
                style={{ width: 8, height: 8, borderRadius: "50%", background: previewData?.is_shift_rules_confirmed ? "#16a34a" : "#dc2626" }}
                aria-hidden="true"
              />
              {previewData?.is_shift_rules_confirmed ? "Aturan perhitungan aktif" : "Ketentuan perhitungan belum dikonfirmasi"}
            </span>

            {reportStatus && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500, color: reportStatus === "final" ? "#166534" : "#92400e" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: reportStatus === "final" ? "#16a34a" : "#d97706" }} aria-hidden="true" />
                Status: {reportStatus === "final" ? "Final (Terkunci)" : "Draft"}
              </span>
            )}

            {isLegacyDraft && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c2410c", fontWeight: 600 }}>
                <AlertTriangle size={14} aria-hidden="true" />
                Draft menggunakan aturan lama
              </span>
            )}
          </div>
        </div>

        <div>
          <button
            ref={historyButtonRef}
            type="button"
            className="history-header-btn"
            onClick={handleOpenHistory}
          >
            <History size={18} color="#2563eb" aria-hidden="true" />
            Riwayat Laporan
          </button>
        </div>
      </header>

      {/* 2. Filter Periode Laporan */}
      <section
        aria-label="Filter Periode Laporan"
        className="period-panel-container"
      >
        <div style={{ marginBottom: 16 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#0f172a",
              margin: "0 0 4px",
              lineHeight: 1.3,
            }}
          >
            Periode laporan
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: "#64748b",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Pilih bulan laporan. Periode standar dihitung otomatis dari tanggal 20 sampai 19.
          </p>
        </div>

        <div className="period-grid">
          <div>
            <label
              htmlFor="filter-bulan"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 6,
                whiteSpace: "nowrap",
              }}
            >
              Bulan laporan
            </label>
            <select
              id="filter-bulan"
              value={selectedMonth}
              onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedYear)}
              className="period-input"
            >
              {BULAN_LIST.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-tahun"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 6,
                whiteSpace: "nowrap",
              }}
            >
              Tahun
            </label>
            <input
              id="filter-tahun"
              type="number"
              value={selectedYear}
              onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
              className="period-input"
            />
          </div>

          <div>
            <label
              htmlFor="filter-start-date"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 6,
                whiteSpace: "nowrap",
              }}
            >
              Tanggal mulai
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                id="filter-start-date"
                type="text"
                readOnly
                value={formatIndoDate(startDate)}
                title={isCustomDate ? "Tanggal manual aktif" : "Otomatis mengikuti siklus 20–19"}
                className="period-input-readonly"
              />
              <Calendar size={17} color="#64748b" style={{ position: "absolute", left: 14, pointerEvents: "none" }} aria-hidden="true" />
            </div>
          </div>

          <div>
            <label
              htmlFor="filter-end-date"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 6,
                whiteSpace: "nowrap",
              }}
            >
              Tanggal selesai
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                id="filter-end-date"
                type="text"
                readOnly
                value={formatIndoDate(endDate)}
                title={isCustomDate ? "Tanggal manual aktif" : "Otomatis mengikuti siklus 20–19"}
                className="period-input-readonly"
              />
              <Calendar size={17} color="#64748b" style={{ position: "absolute", left: 14, pointerEvents: "none" }} aria-hidden="true" />
            </div>
          </div>

          <div className="period-grid-btn-col">
            <button
              type="button"
              onClick={handleTampilkanData}
              disabled={loading}
              className="btn-tampilkan-data"
            >
              {loading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Calendar size={17} aria-hidden="true" />}
              {loading ? "Memuat..." : "Tampilkan Data"}
            </button>
          </div>
        </div>

        {/* Accordion Tanggal Manual (Progressive Disclosure) */}
        {isCustomDate && (
          <div className="manual-date-accordion">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    margin: "0 0 2px",
                  }}
                >
                  Atur tanggal manual
                </h3>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  Tentukan tanggal mulai dan selesai secara khusus.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetStandardPeriod}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Gunakan periode standar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label
                  htmlFor="manual-start-date"
                  style={{
                    display: "block",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Tanggal mulai manual
                </label>
                <input
                  id="manual-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="period-input"
                  style={{
                    borderColor: dateValidationError ? "#dc2626" : "#cbd5e1",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="manual-end-date"
                  style={{
                    display: "block",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Tanggal selesai manual
                </label>
                <input
                  id="manual-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="period-input"
                  style={{
                    borderColor: dateValidationError ? "#dc2626" : "#cbd5e1",
                  }}
                />
              </div>
            </div>

            {dateValidationError && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#dc2626",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>{dateValidationError}</span>
              </div>
            )}
          </div>
        )}

        {/* Informasi Periode Aktif & Kontrol Atur Tanggal Manual */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569" }}>
            <Info size={16} color="#2563eb" style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>
              Periode aktif: {formatPeriodeAktif(startDate, endDate)}
            </span>
          </div>

          <div>
            {!isCustomDate ? (
              <button
                type="button"
                onClick={() => setIsCustomDate(true)}
                aria-expanded={false}
                className="btn-toggle-manual"
              >
                <Calendar size={15} aria-hidden="true" />
                Atur tanggal manual
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetStandardPeriod}
                aria-expanded={true}
                className="btn-toggle-manual"
              >
                <RotateCcw size={15} aria-hidden="true" />
                Gunakan periode standar
              </button>
            )}
          </div>
        </div>

        {fetchError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "#991b1b",
              fontSize: 13.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={handleTampilkanData}
              style={{
                background: "#ffffff",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Coba Lagi
            </button>
          </div>
        )}
      </section>


      {/* 3. Kelengkapan Sumber Data (Satu Panel Ringkas) */}
      <section
        aria-label="Kelengkapan sumber data"
        className="completeness-panel-container"
      >
        <div className="completeness-panel-header">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 4px", lineHeight: 1.3 }}>
            Kelengkapan sumber data
          </h2>
          <p style={{ fontSize: 13.5, color: "#64748b", margin: 0, lineHeight: 1.4 }}>
            Pilih sumber data untuk melihat rinciannya
          </p>
        </div>

        {/* Column header */}
        <div className="completeness-table-header" aria-hidden="true">
          <div>Sumber data</div>
          <div>Progres</div>
          <div style={{ textAlign: "center" }}>Status</div>
          <div></div>
        </div>

        {/* Rows */}
        <div role="region" aria-label="Daftar kelengkapan sumber data">
          {loading && !previewData ? (
            // Skeleton rows
            [0, 1, 2, 3, 4].map((idx) => (
              <div key={idx} className="skeleton-row" aria-hidden="true">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="skeleton-bar" style={{ width: 18, height: 18, borderRadius: 4 }} />
                  <div className="skeleton-bar" style={{ width: 120 + idx * 10 }} />
                </div>
                <div className="skeleton-bar" style={{ width: 160 }} />
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div className="skeleton-bar" style={{ width: 140, height: 28, borderRadius: 6 }} />
                </div>
                <div />
              </div>
            ))
          ) : fetchError && !previewData ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
              <p style={{ margin: "0 0 10px", color: "#991b1b" }}>Kelengkapan data tidak dapat dimuat.</p>
              <button
                type="button"
                onClick={handleTampilkanData}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 6,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Coba lagi
              </button>
            </div>
          ) : (
            completenessItems.map((item, idx) => {
              const isSelected = activeTab === item.tabId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.tabId as any)}
                  className={`completeness-row-btn row-stagger-${idx} ${isSelected ? "active" : ""}`}
                  aria-label={`Buka rincian ${item.title}. Status: ${item.badge.label}. Progres: ${item.progressText}.`}
                >
                  <div className="completeness-col-source" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      className="completeness-icon-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 20,
                        color: isSelected ? "#2563eb" : "#475569",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    <span
                      className="completeness-source-name"
                      style={{
                        fontSize: 14.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "#1d4ed8" : "#0f172a",
                      }}
                    >
                      {item.title}
                    </span>
                  </div>

                  <div className="completeness-col-progress" style={{ fontSize: 14, color: "#475569" }}>
                    {item.progressText}
                  </div>

                  <div className="completeness-col-status" style={{ display: "flex", justifyContent: "center" }}>
                    <span
                      className="completeness-status-badge"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 140,
                        minWidth: 140,
                        height: 28,
                        padding: "0 12px",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                        background: item.badge.bg,
                        color: item.badge.text,
                        border: `1px solid ${item.badge.border}`,
                      }}
                    >
                      {item.badge.label}
                    </span>
                  </div>

                  <div className="completeness-col-chevron" style={{ display: "flex", justifyContent: "center" }}>
                    <ChevronRight size={16} className="completeness-chevron" aria-hidden="true" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* 4. Pengaturan Order & Kebersihan (Accordion) */}
      <section
        aria-label="Pengaturan order dan kebersihan"
        className={`order-accordion-container ${showOrderPanel ? "open" : ""}`}
      >
        <button
          type="button"
          aria-expanded={showOrderPanel}
          aria-controls="panel-order-kebersihan"
          onClick={() => setShowOrderPanel(!showOrderPanel)}
          className={`order-accordion-header-btn ${showOrderPanel ? "open" : ""}`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                background: showOrderPanel ? "#eff6ff" : "#f8fafc",
                color: showOrderPanel ? "#2563eb" : "#475569",
                border: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Utensils size={18} />
            </span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", margin: "0 0 3px", lineHeight: 1.3 }}>
                Pengaturan order dan kebersihan
              </h3>
              <p style={{ fontSize: 13.5, color: "#64748b", margin: "0 0 4px", lineHeight: 1.4 }}>
                Lengkapi jumlah order dan penilaian kebersihan setiap katering
              </p>
              <div style={{ fontSize: 13, color: "#475569", fontWeight: 400 }}>
                Order {previewData?.completeness?.order?.caterings_count ?? 0}/{totalCaterings} Terkonfirmasi • Kebersihan {evaluatedKebersihanCount}/{totalCaterings}
              </div>
            </div>
          </div>

          <div className="order-accordion-header-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 28,
                padding: "0 10px",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                background: (isKebersihanComplete && isOrderComplete) ? "#f0fdf4" : "#fffbeb",
                color: (isKebersihanComplete && isOrderComplete) ? "#166534" : "#92400e",
                border: `1px solid ${(isKebersihanComplete && isOrderComplete) ? "#bbf7d0" : "#fde68a"}`,
              }}
            >
              {(isKebersihanComplete && isOrderComplete) ? "Sudah lengkap" : "Belum lengkap"}
            </span>
            <ChevronDown
              size={18}
              color="#475569"
              style={{
                transform: showOrderPanel ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
              aria-hidden="true"
            />
          </div>
        </button>

        {showOrderPanel && (
          <div id="panel-order-kebersihan" className="order-accordion-body">
            {/* Order Completeness Alert */}
            {!isOrderComplete && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 16px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  color: "#92400e",
                  fontSize: 13.5,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, color: "#d97706" }} aria-hidden="true" />
                  <span>
                    Data jumlah order harian belum lengkap untuk katering:{" "}
                    <strong>{incompleteOrderCaterings.join(", ") || "sebagian katering"}</strong>. Laporan belum dapat difinalisasi sebelum seluruh order harian terisi.
                  </span>
                </div>
                <Link
                  href="/kalori-harian/input"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    borderRadius: 6,
                    color: "#b45309",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  Input Kalori → Data Pengiriman Hari Ini <ExternalLink size={14} />
                </Link>
              </div>
            )}

            {!isKebersihanComplete && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  color: "#92400e",
                  fontSize: 13.5,
                  marginBottom: 14,
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>Data kebersihan belum lengkap. Laporan belum dapat difinalisasi.</span>
              </div>
            )}

            <div style={{ marginBottom: 14, fontSize: 13.5, color: "#475569" }}>
              Jumlah order bersumber resmi dari Order Harian (Input Kalori) dan digunakan sebagai dasar perhitungan denda shift.
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>No</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>Nama Katering</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>Sumber Order</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>Order Pagi (pcs)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>Order Malam (pcs)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>Total Order</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>Kondisi Kebersihan</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>Skor Kebersihan (Max 10)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData?.caterings.map((c: any, i: number) => {
                    const ord = ordersMap[c.catering_id] || { pagi: 0, malam: 0, kondisi: "bersih" };
                    const ordSrc = c.order_source;
                    const isDailyOrder = ordSrc?.source_type === "daily_order";
                    const isDailyComplete = isDailyOrder && ordSrc?.is_complete;
                    const isAuthoritative = isDailyComplete || (ordSrc?.source_type === "catering_order_quota" && ordSrc?.status === "confirmed") || ordSrc?.source_type === "historical_final_snapshot";
                    const isLegacyDraft = ordSrc?.source_type === "legacy_report_order";
                    const isDraftUnconfirmed = ordSrc?.status === "draft";
                    const isDailyIncomplete = isDailyOrder && !ordSrc?.is_complete;

                    const pagiVal = (isDailyOrder || isAuthoritative)
                      ? ordSrc?.order_pagi
                      : isLegacyDraft
                      ? (ordSrc?.order_pagi ?? ord.pagi ?? c.order_pagi ?? c.jumlah_order_pagi ?? 0)
                      : isDraftUnconfirmed
                      ? ordSrc?.order_pagi
                      : null;
                    const malamVal = (isDailyOrder || isAuthoritative)
                      ? ordSrc?.order_malam
                      : isLegacyDraft
                      ? (ordSrc?.order_malam ?? ord.malam ?? c.order_malam ?? c.jumlah_order_malam ?? 0)
                      : isDraftUnconfirmed
                      ? ordSrc?.order_malam
                      : null;
                    const totalVal =
                      pagiVal != null && malamVal != null
                        ? Math.round(((Number(pagiVal) || 0) + (Number(malamVal) || 0)) * 100) / 100
                        : null;
                    const ctaUrl = "/kalori-harian/input";
                    return (
                      <tr
                        key={c.catering_id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: "10px 12px", textAlign: "left", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>
                          {c.catering_nama}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {isDailyComplete ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 9px",
                                borderRadius: 5,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                              }}
                              title="Sumber resmi dari Order Harian Kalori (Lengkap)"
                            >
                              <ShieldCheck size={13} /> Sumber Order: Order Harian
                            </span>
                          ) : isDailyIncomplete ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "4px 9px",
                                  borderRadius: 5,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "#fffbeb",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                }}
                                title={ordSrc?.compatibility_reason || "Data jumlah order harian belum lengkap"}
                              >
                                <AlertTriangle size={13} /> Data jumlah order harian belum lengkap
                              </span>
                              <Link
                                href={ctaUrl}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 2,
                                  fontSize: 11,
                                  color: "#d97706",
                                  textDecoration: "underline",
                                  fontWeight: 600,
                                }}
                                title="Buka modul Input Kalori untuk mengisi order harian"
                              >
                                Input Kalori → Data Pengiriman Hari Ini <ExternalLink size={10} />
                              </Link>
                            </div>
                          ) : isAuthoritative ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 9px",
                                borderRadius: 5,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                              }}
                              title="Sumber resmi terkonfirmasi"
                            >
                              <ShieldCheck size={13} /> Terkonfirmasi
                            </span>
                          ) : isLegacyDraft ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 9px",
                                borderRadius: 5,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "#eff6ff",
                                color: "#1e40af",
                                border: "1px solid #bfdbfe",
                              }}
                              title="Sumber draft legacy transisional"
                            >
                              <Info size={13} /> Draft Legacy
                            </span>
                          ) : isDraftUnconfirmed ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "4px 9px",
                                  borderRadius: 5,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "#fffbeb",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                }}
                                title="Order tercatat di operasional tapi masih berstatus Draft"
                              >
                                <AlertTriangle size={13} /> Belum Dikonfirmasi
                              </span>
                              <Link
                                href={ctaUrl}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 2,
                                  fontSize: 11,
                                  color: "#d97706",
                                  textDecoration: "underline",
                                  fontWeight: 600,
                                }}
                                title="Buka Input Kalori"
                              >
                                Input Kalori → Data Pengiriman Hari Ini <ExternalLink size={10} />
                              </Link>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "4px 9px",
                                  borderRadius: 5,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "#fef2f2",
                                  color: "#991b1b",
                                  border: "1px solid #fecaca",
                                }}
                                title="Belum ada data order di operasional"
                              >
                                <AlertCircle size={13} /> Data jumlah order harian belum lengkap
                              </span>
                              <Link
                                href={ctaUrl}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 2,
                                  fontSize: 11,
                                  color: "#dc2626",
                                  textDecoration: "underline",
                                  fontWeight: 600,
                                }}
                                title="Buka Input Kalori untuk mengisi data pengiriman hari ini"
                              >
                                Input Kalori → Data Pengiriman Hari Ini <ExternalLink size={10} />
                              </Link>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {pagiVal != null ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontWeight: 600,
                                color: (isDailyComplete || isAuthoritative) ? "#166534" : "#b45309",
                                background: (isDailyComplete || isAuthoritative) ? "#f0fdf4" : "#fffbeb",
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: `1px solid ${(isDailyComplete || isAuthoritative) ? "#bbf7d0" : "#fde68a"}`,
                              }}
                              title="Total order pagi dari data harian"
                            >
                              <Lock size={12} color={(isDailyComplete || isAuthoritative) ? "#166534" : "#b45309"} />
                              <span>{Number(pagiVal).toLocaleString("id-ID")}</span>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 14 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {malamVal != null ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontWeight: 600,
                                color: (isDailyComplete || isAuthoritative) ? "#166534" : "#b45309",
                                background: (isDailyComplete || isAuthoritative) ? "#f0fdf4" : "#fffbeb",
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: `1px solid ${(isDailyComplete || isAuthoritative) ? "#bbf7d0" : "#fde68a"}`,
                              }}
                              title="Total order malam dari data harian"
                            >
                              <Lock size={12} color={(isDailyComplete || isAuthoritative) ? "#166534" : "#b45309"} />
                              <span>{Number(malamVal).toLocaleString("id-ID")}</span>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 14 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                          {totalVal != null ? totalVal.toLocaleString("id-ID") : "-"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "left" }}>
                          <select
                            value={ord.kondisi}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOrdersMap((prev) => ({
                                ...prev,
                                [c.catering_id]: { ...ord, kondisi: v },
                              }));
                            }}
                            disabled={reportStatus === "final"}
                            aria-label={`Kondisi Kebersihan ${c.catering_nama}`}
                            style={{
                              height: 38,
                              padding: "0 10px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 6,
                              fontSize: 13.5,
                              color: "#0f172a",
                              background: reportStatus === "final" ? "#f1f5f9" : "#ffffff",
                              width: "100%",
                              maxWidth: 320,
                            }}
                          >
                            <option value="belum_dinilai">Belum dinilai (null)</option>
                            <option value="bersih">Bersih dan rapi, tidak melanggar (10)</option>
                            <option value="tidak_rapi">Tidak rapi, tidak melanggar (8)</option>
                            <option value="kotor">Kotor, tidak melanggar (6)</option>
                            <option value="melanggar">Melanggar minimal satu kedisiplinan (4)</option>
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>
                          {ord.kondisi === "bersih" ? (
                            <span style={{ color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 8px", borderRadius: 4 }}>10</span>
                          ) : ord.kondisi === "tidak_rapi" ? (
                            <span style={{ color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "3px 8px", borderRadius: 4 }}>8</span>
                          ) : ord.kondisi === "kotor" ? (
                            <span style={{ color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: 4 }}>6</span>
                          ) : ord.kondisi === "melanggar" ? (
                            <span style={{ color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: 4 }}>4</span>
                          ) : (
                            <span style={{ color: "#991b1b", fontSize: 12.5 }}>Belum dinilai</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {reportStatus !== "final" && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleApplyOrders}
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 44,
                    padding: "0 20px",
                    borderRadius: 7,
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                    transition: "background-color 150ms ease, transform 100ms ease",
                  }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                  Simpan & Terapkan Perhitungan
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Navigasi Tab Laporan */}
      <section aria-label="Tab Laporan Punishment" style={{ marginBottom: 24 }}>
        {/* Horizontal Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Kategori Data Laporan Punishment"
          className="tab-list"
        >
          {tabsList.map((t, idx) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-controls={`tabpanel-${t.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`tab-button ${isActive ? "active" : ""}`}
              >
                <span>{t.label}</span>
                {isActive && <span className="tab-indicator" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div
          id={`tabpanel-${activeTab}`}
          key={activeTab}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="tab-content-container tab-content-animated"
        >
          {/* TAB 1: RESUM */}
          {activeTab === "resum" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px", color: "#0f172a" }}>
                  Ringkasan performa dan punishment
                </h2>
                <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                  Perbandingan skor performa dan punishment setiap catering pada periode laporan.
                </p>
              </div>

              {/* Error State Banner */}
              {fetchError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#991b1b" }}>
                    <AlertCircle size={18} aria-hidden="true" />
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Ringkasan laporan tidak dapat dimuat.</span>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => fetchPreview(startDate, endDate)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 6,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <RotateCcw size={13} aria-hidden="true" className={loading ? "animate-spin" : ""} />
                    <span>Coba lagi</span>
                  </button>
                </div>
              )}

              {/* Tabel RESUM */}
              <div className="resum-table-wrapper">
                <table className="resum-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56, textAlign: "center" }}>No.</th>
                      <th style={{ minWidth: 160, textAlign: "left" }}>Nama catering</th>
                      <th style={{ minWidth: 88, textAlign: "center" }}>
                        <span>Terlambat</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 30</small>
                      </th>
                      <th style={{ minWidth: 88, textAlign: "center" }}>
                        <span>Kelayakan</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 20</small>
                      </th>
                      <th style={{ minWidth: 82, textAlign: "center" }}>
                        <span>Audit</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 10</small>
                      </th>
                      <th style={{ minWidth: 82, textAlign: "center" }}>
                        <span>Kalori</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 15</small>
                      </th>
                      <th style={{ minWidth: 88, textAlign: "center" }}>
                        <span>Komplain</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 15</small>
                      </th>
                      <th style={{ minWidth: 110, textAlign: "center" }}>
                        <span>Kebersihan</span>
                        <small style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", marginTop: 2 }}>Maks. 10</small>
                      </th>
                      <th style={{ minWidth: 96, textAlign: "center" }}>Total skor</th>
                      <th style={{ minWidth: 72, textAlign: "center" }}>Grade</th>
                      <th style={{ minWidth: 180, textAlign: "center" }}>Evaluasi kontrak</th>
                      <th style={{ minWidth: 120, textAlign: "right" }}>Punishment pagi</th>
                      <th style={{ minWidth: 120, textAlign: "right" }}>Punishment malam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, rIdx) => (
                        <tr key={`skel-resum-${rIdx}`}>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <div className="skeleton-bar" style={{ width: 24, margin: "0 auto" }} />
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            <div className="skeleton-bar" style={{ width: 120 }} />
                          </td>
                          {Array.from({ length: 6 }).map((_, cIdx) => (
                            <td key={`skel-c-${cIdx}`} style={{ padding: "14px 10px", textAlign: "center" }}>
                              <div className="skeleton-bar" style={{ width: 36, margin: "0 auto" }} />
                            </td>
                          ))}
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <div className="skeleton-bar" style={{ width: 44, margin: "0 auto" }} />
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <div className="skeleton-bar" style={{ width: 28, margin: "0 auto" }} />
                          </td>
                          <td style={{ padding: "14px 12px", textAlign: "center" }}>
                            <div className="skeleton-bar" style={{ width: 130, margin: "0 auto" }} />
                          </td>
                          <td style={{ padding: "14px 12px", textAlign: "right" }}>
                            <div className="skeleton-bar" style={{ width: 50, marginLeft: "auto" }} />
                          </td>
                          <td style={{ padding: "14px 12px", textAlign: "right" }}>
                            <div className="skeleton-bar" style={{ width: 50, marginLeft: "auto" }} />
                          </td>
                        </tr>
                      ))
                    ) : previewData?.caterings && previewData.caterings.length > 0 ? (
                      previewData.caterings.map((c, i) => {
                        const kal = normalizeCateringKalori(c);
                        const isKebersihanEvaluated =
                          c?.kebersihan?.score_performance !== null &&
                          c?.kebersihan?.score_performance !== undefined;
                        const hasScore =
                          isKebersihanEvaluated &&
                          c?.total_score_performance !== null &&
                          c?.total_score_performance !== undefined;
                        const hasGrade = isKebersihanEvaluated && Boolean(c?.grade_letter);
                        const hasPunishPagi =
                          c?.total_punishment_pagi !== null &&
                          c?.total_punishment_pagi !== undefined &&
                          Number(c.total_punishment_pagi) > 0;
                        const hasPunishMalam =
                          c?.total_punishment_malam !== null &&
                          c?.total_punishment_malam !== undefined &&
                          Number(c.total_punishment_malam) > 0;

                        return (
                          <tr key={c?.catering_id ?? i}>
                            <td style={{ textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                            <td
                              style={{
                                textAlign: "left",
                                fontWeight: 600,
                                color: "#0f172a",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {c?.catering_nama ?? "—"}
                            </td>
                            <td style={{ textAlign: "center" }}>{c?.keterlambatan?.score_performance ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{c?.menu_kelayakan?.score_performance ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{c?.hasil_audit?.score_performance ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{kal.score_performance ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{c?.jumlah_komplain?.score_performance ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              {isKebersihanEvaluated ? (
                                <span>{c.kebersihan?.score_performance}</span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: 26,
                                    padding: "0 8px",
                                    borderRadius: 5,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#92400e",
                                    background: "#fffbeb",
                                    border: "1px solid #fde68a",
                                  }}
                                >
                                  Belum dinilai
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {hasScore ? (
                                <span style={{ fontWeight: 700, color: "#1d4ed8" }}>
                                  {c.total_score_performance}
                                </span>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {hasGrade ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    minWidth: 28,
                                    height: 24,
                                    padding: "0 8px",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    background:
                                      c.grade_letter === "A"
                                        ? "#f0fdf4"
                                        : c.grade_letter === "B"
                                        ? "#eff6ff"
                                        : c.grade_letter === "C"
                                        ? "#fffbeb"
                                        : "#fef2f2",
                                    color:
                                      c.grade_letter === "A"
                                        ? "#166534"
                                        : c.grade_letter === "B"
                                        ? "#1d4ed8"
                                        : c.grade_letter === "C"
                                        ? "#92400e"
                                        : "#991b1b",
                                    border: `1px solid ${
                                      c.grade_letter === "A"
                                        ? "#bbf7d0"
                                        : c.grade_letter === "B"
                                        ? "#bfdbfe"
                                        : c.grade_letter === "C"
                                        ? "#fde68a"
                                        : "#fecaca"
                                    }`,
                                  }}
                                >
                                  {c.grade_letter}
                                </span>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center", fontSize: 13 }}>
                              {isKebersihanEvaluated && c?.grade_desc ? (
                                <span style={{ color: "#334155" }}>{c.grade_desc}</span>
                              ) : (
                                <span
                                  style={{ color: "#64748b" }}
                                  title="Total skor, grade, dan evaluasi tersedia setelah seluruh komponen dinilai."
                                >
                                  Menunggu data lengkap
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {hasPunishPagi ? (
                                <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                                  {Number(c.total_punishment_pagi).toFixed(2)}
                                </span>
                              ) : isKebersihanEvaluated && Number(c?.total_punishment_pagi) === 0 ? (
                                <span style={{ color: "#334155", fontWeight: 500 }}>0.00</span>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {hasPunishMalam ? (
                                <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                                  {Number(c.total_punishment_malam).toFixed(2)}
                                </span>
                              ) : isKebersihanEvaluated && Number(c?.total_punishment_malam) === 0 ? (
                                <span style={{ color: "#334155", fontWeight: 500 }}>0.00</span>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={13} style={{ padding: "48px 24px", textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <Info size={24} color="#94a3b8" aria-hidden="true" />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
                              Belum ada data catering untuk periode ini.
                            </span>
                            <span style={{ fontSize: 13, color: "#64748b" }}>
                              Periksa periode laporan atau lengkapi data sumber terlebih dahulu.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Keterangan tanda kosong jika penilaian belum lengkap */}
              {!isKebersihanComplete && (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
                  — Belum tersedia karena penilaian belum lengkap.
                </p>
              )}
            </div>
          )}

          {/* TAB 2: KETERLAMBATAN */}
          {activeTab === "terlambat" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  1. Pengiriman Terlambat Datang
                </h2>
                <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Aturan: 1-5m (5%), 6-10m (10%), 11-30m (25%), 31-60m (35%), &gt;60m/tdk kirim (50%). Score max 30.
                </p>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "12px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Lamanya</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Jumlah Kejadian</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Pagi (pcs)</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Malam (pcs)</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>Score Performance (Max 30)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData?.caterings.map((c, i) => {
                      const t = c?.keterlambatan;
                      return (
                        <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                          <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                          <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center" }}>{t?.lamanya_ringkasan || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center" }}>{t?.jumlah_kejadian || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: t?.pengurangan_poin_pagi && t.pengurangan_poin_pagi > 0 ? "#dc2626" : "inherit" }}>
                            {t?.pengurangan_poin_pagi && t.pengurangan_poin_pagi > 0 ? t.pengurangan_poin_pagi : "-"}
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: t?.pengurangan_poin_malam && t.pengurangan_poin_malam > 0 ? "#dc2626" : "inherit" }}>
                            {t?.pengurangan_poin_malam && t.pengurangan_poin_malam > 0 ? t.pengurangan_poin_malam : "-"}
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>{t?.score_performance ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MENU & KELAYAKAN */}
          {activeTab === "kelayakan" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  2. Menu dan Kelayakan
                </h2>
                <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Standar Skor: &gt;80% (20), 65-80% (10), &lt;65% (5). Aturan Punishment 2025: 85-90% (6%), 0-84% (10%), &gt;90% (0%).
                </p>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "12px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Nilai Kelayakan (%)</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punishment Pagi (pcs)</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>Score Performance (Max 20)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData?.caterings.map((c, i) => {
                      const m = c?.menu_kelayakan;
                      return (
                        <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                          <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                          <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 600 }}>{m?.formatted_persen || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: m?.pengurangan_poin_pagi && m.pengurangan_poin_pagi > 0 ? "#dc2626" : "inherit" }}>
                            {m?.pengurangan_poin_pagi && m.pengurangan_poin_pagi > 0 ? m.pengurangan_poin_pagi : "-"}
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>{m?.score_performance ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HASIL AUDIT */}
          {activeTab === "audit" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  3. Hasil Audit Dapur Supplier
                </h2>
                <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Skor Standar 2018: 95-100% (10), 81-94% (8), 70-80% (6), 0-69% (4). Punishment 2025: &gt;95% (0%), 86-95% (4%), 76-85% (6%), 66-75% (8%), 0-65% (10%).
                </p>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "12px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Nilai Audit (%)</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Grade</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Pagi</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Malam</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>Score Performance (Max 10)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData?.caterings.map((c, i) => {
                      const a = c?.hasil_audit;
                      return (
                        <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                          <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                          <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 600 }}>{a?.formatted_persen || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700 }}>{a?.grade || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626" }}>{a?.pengurangan_poin_pagi && a.pengurangan_poin_pagi > 0 ? a.pengurangan_poin_pagi : "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626" }}>{a?.pengurangan_poin_malam && a.pengurangan_poin_malam > 0 ? a.pengurangan_poin_malam : "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>{a?.score_performance ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: KALORI */}
          {activeTab === "kalori" && (
            <div>
              {/* Bagian A: Punishment Kalori Minus */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  4A. Punishment Kalori Minus
                </h2>
                <p style={{ fontSize: 13.5, color: "#475569", margin: "0 0 12px", lineHeight: 1.5 }}>
                  1x tdk berturut (3%), 2x berturut-turut (7%), hari berikutnya berturut (5%), sidak (5%).
                </p>

                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                        <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Tdk Berturut (3%)</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>2x Berturut (7%)</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Berikutnya (5%)</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Sidak (5%)</th>
                        <th style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Pagi</th>
                        <th style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Malam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData?.caterings.map((c, i) => {
                        const kalori = normalizeCateringKalori(c);
                        const p = kalori.pelanggaran;
                        return (
                          <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                            <td style={{ padding: "10px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                            <td style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {p.minus_tidak_berturut.ada ? `${p.minus_tidak_berturut.jumlah}x${p.minus_tidak_berturut.tanggal_display ? ` (${p.minus_tidak_berturut.tanggal_display})` : ""}` : "-"}
                            </td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {p.minus_2_berturut.ada ? `${p.minus_2_berturut.jumlah}x${p.minus_2_berturut.tanggal_display ? ` (${p.minus_2_berturut.tanggal_display})` : ""}` : "-"}
                            </td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {p.minus_berikutnya.ada ? `${p.minus_berikutnya.jumlah}x${p.minus_berikutnya.tanggal_display ? ` (${p.minus_berikutnya.tanggal_display})` : ""}` : "-"}
                            </td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {p.minus_sidak.ada ? `${p.minus_sidak.jumlah}x${p.minus_sidak.tanggal_display ? ` (${p.minus_sidak.tanggal_display})` : ""}` : "-"}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>
                              {p.total_pengurangan_poin_pagi > 0 ? p.total_pengurangan_poin_pagi : "-"}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>
                              {p.total_pengurangan_poin_malam > 0 ? p.total_pengurangan_poin_malam : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bagian B: Pencapaian Kalori */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  4B. Pencapaian Kalori (≥ 900 kkal)
                </h2>
                <p style={{ fontSize: 13.5, color: "#475569", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Standar Skor 2018: 100% (15), 80-99% (12), 60-79% (8), 0-59% (5).
                </p>

                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                        <th style={{ padding: "12px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                        <th style={{ padding: "12px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                        <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Mencapai</th>
                        <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Tidak Mencapai</th>
                        <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Jumlah Pengiriman</th>
                        <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Persentase (%)</th>
                        <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>Score Performance (Max 15)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData?.caterings.map((c, i) => {
                        const kalori = normalizeCateringKalori(c);
                        const pc = kalori.pencapaian;
                        return (
                          <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                            <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                            <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                            <td style={{ padding: "12px 12px", textAlign: "center" }}>{pc.jumlah_mencapai}</td>
                            <td style={{ padding: "12px 12px", textAlign: "center" }}>{pc.jumlah_tidak_mencapai}</td>
                            <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 600 }}>{pc.jumlah_pengiriman}</td>
                            <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700 }}>{pc.formatted_persen}</td>
                            <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>{kalori.score_performance}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: KOMPLAIN */}
          {activeTab === "komplain" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                  5. Jumlah Komplain Katering
                </h2>
                <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Standar Skor 2018: 0 komplain (15), 1-2 (12), 3-4 (8), ≥5 (5). Aturan Punishment 2025: 5% per pengaduan pada shift kejadian.
                </p>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "12px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>No</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Nama Katering</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Jumlah Komplain</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Jenis / Ringkasan Komplain</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Pagi</th>
                      <th style={{ padding: "12px 12px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>Punish Malam</th>
                      <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>Score Performance (Max 15)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData?.caterings.map((c, i) => {
                      const k = c?.jumlah_komplain;
                      return (
                        <tr key={c?.catering_id ?? i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "rgba(248, 250, 252, 0.6)" : "#ffffff" }}>
                          <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                          <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>{c?.catering_nama ?? "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700 }}>{k?.jumlah_komplain ?? 0}</td>
                          <td style={{ padding: "12px 16px", textAlign: "left", fontSize: 13.5, color: "#334155" }}>{k?.ringkasan_jenis || "-"}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: k?.pengurangan_poin_pagi && k.pengurangan_poin_pagi > 0 ? "#dc2626" : "inherit" }}>
                            {k?.pengurangan_poin_pagi && k.pengurangan_poin_pagi > 0 ? k.pengurangan_poin_pagi : "-"}
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "right", color: k?.pengurangan_poin_malam && k.pengurangan_poin_malam > 0 ? "#dc2626" : "inherit" }}>
                            {k?.pengurangan_poin_malam && k.pengurangan_poin_malam > 0 ? k.pengurangan_poin_malam : "-"}
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "#1e40af", background: "#eff6ff" }}>{k?.score_performance ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. Action Bar Laporan */}
      <footer className="action-bar-container">
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
          {reportStatus === "final" ? (
            <ShieldCheck size={17} color="#166534" aria-hidden="true" />
          ) : (
            <Info size={17} color="#2563eb" aria-hidden="true" />
          )}
          <span>
            {reportStatus === "final"
              ? "Laporan telah difinalisasi dan terkunci."
              : !isKebersihanComplete
              ? "Data kebersihan belum lengkap. Laporan belum dapat difinalisasi."
              : isLegacyDraft
              ? "Draft menggunakan aturan lama. Lakukan hitung ulang sebelum finalisasi."
              : "Laporan berstatus Draft dan siap disimpan atau difinalisasi."}
          </span>
        </div>

        <div className="action-buttons-group" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Destructive: Hapus Draft (hanya jika draft tersimpan ada) */}
          {reportStatus === "draft" && savedReportId && (
            <button
              type="button"
              onClick={() => handleDeleteDraft(savedReportId)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 44,
                padding: "0 16px",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                color: "#dc2626",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              title="Hapus draft laporan ini"
            >
              <Trash2 size={15} aria-hidden="true" />
              Hapus Draft
            </button>
          )}

          {/* Secondary: Unduh Excel */}
          <button
            type="button"
            onClick={() => handleDownloadExcel()}
            disabled={exporting || !savedReportId}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 44,
              padding: "0 18px",
              borderRadius: 6,
              background: !savedReportId ? "#cbd5e1" : "#16a34a",
              color: "#ffffff",
              border: "none",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: exporting || !savedReportId ? "not-allowed" : "pointer",
              boxShadow: !savedReportId ? "none" : "0 1px 2px rgba(22, 163, 74, 0.2)",
              transition: "background 0.15s ease",
            }}
            title={!savedReportId ? "Simpan draft terlebih dahulu untuk mengunduh Excel" : "Unduh Laporan Format Excel"}
          >
            {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            Export Excel
          </button>

          {/* Secondary / Warning Action: Hitung Ulang Draft Lama */}
          {isLegacyDraft && (
            <button
              ref={recalculateButtonRef}
              type="button"
              onClick={() => setShowRecalculateModal(true)}
              disabled={recalculating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 44,
                padding: "0 18px",
                borderRadius: 6,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#c2410c",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: recalculating ? "not-allowed" : "pointer",
              }}
              title={`Bangun ulang snapshot dari data sumber menggunakan Ketentuan Perhitungan Aktif (${selectedReport?.active_rule_version || previewData?.active_rule_version || ""})`}
            >
              {recalculating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
              Hitung Ulang dengan Aturan Aktif
            </button>
          )}

          {/* Primary Action 1: Simpan Draft */}
          {reportStatus !== "final" && (
            <button
              type="button"
              onClick={() => handleSaveDraft(true)}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 44,
                padding: "0 18px",
                borderRadius: 6,
                background: "#ffffff",
                border: "1px solid #2563eb",
                color: "#2563eb",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(37, 99, 235, 0.1)",
                transition: "all 0.15s ease",
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Simpan Draft
            </button>
          )}

          {/* Primary Action 2: Finalisasi Laporan */}
          {reportStatus !== "final" && (
            <button
              ref={finalizeButtonRef}
              type="button"
              onClick={() => {
                if (!isRuleApprovedForDraft || isLegacyDraft) {
                  const rStat = activeRuleStatus || "BELUM_DISETUJUI";
                  showToast(`Finalisasi diblokir: Aturan perhitungan belum berstatus DISETUJUI (status: ${rStat}). Lakukan 'Hitung Ulang dengan Aturan Aktif' terlebih dahulu.`, "error");
                  return;
                }
                const isShiftBlocked = selectedReport
                  ? selectedReport.snapshot?.is_shift_rules_confirmed === false
                  : previewData?.is_shift_rules_confirmed === false;
                if (isShiftBlocked) {
                  showToast("Finalisasi diblokir: Aturan shift belum disetujui.", "error");
                  return;
                }
                // Check audit completeness!
                if (previewData?.audit_completeness && !previewData.audit_completeness.is_complete) {
                  setShowAuditIncompleteModal(true);
                  return;
                }
                if (!isOrderComplete) {
                  showToast(
                    `Finalisasi diblokir: Data Order Catering belum dikonfirmasi untuk katering: ${incompleteOrderCaterings.join(", ") || "sebagian katering"}. Pastikan seluruh katering memiliki order terkonfirmasi.`,
                    "error"
                  );
                  return;
                }
                if (!isKebersihanComplete) {
                  showToast("Finalisasi belum tersedia: Sumber data Kebersihan Kantin belum lengkap.", "error");
                  return;
                }
                setShowFinalizeModal(true);
              }}
              disabled={Boolean(
                finalizing ||
                !isRuleApprovedForDraft ||
                isLegacyDraft ||
                !isOrderComplete ||
                !isKebersihanComplete ||
                (selectedReport ? selectedReport.snapshot?.is_shift_rules_confirmed === false : previewData?.is_shift_rules_confirmed === false)
              )}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 44,
                padding: "0 22px",
                borderRadius: 6,
                background:
                  !isRuleApprovedForDraft ||
                  isLegacyDraft ||
                  !isOrderComplete ||
                  !isKebersihanComplete ||
                  (selectedReport ? selectedReport.snapshot?.is_shift_rules_confirmed === false : previewData?.is_shift_rules_confirmed === false) ||
                  (previewData?.audit_completeness && !previewData.audit_completeness.is_complete)
                    ? "#94a3b8"
                    : "#2563eb",
                color: "#ffffff",
                border: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor:
                  !isRuleApprovedForDraft || isLegacyDraft || !isOrderComplete || !isKebersihanComplete || (selectedReport ? selectedReport.snapshot?.is_shift_rules_confirmed === false : previewData?.is_shift_rules_confirmed === false)
                    ? "not-allowed"
                    : "pointer",
                boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                transition: "background 0.15s ease",
              }}
              title={
                previewData?.audit_completeness && !previewData.audit_completeness.is_complete
                  ? `Data Audit Belum Lengkap: ${previewData.audit_completeness.message}`
                  : !isOrderComplete
                  ? `Data Order Catering Belum Lengkap: ${incompleteOrderCaterings.join(", ") || "Harap konfirmasi order di menu Order Catering"}`
                  : !isKebersihanComplete
                  ? "Finalisasi belum tersedia karena data Kebersihan Kantin belum lengkap."
                  : !isRuleApprovedForDraft || isLegacyDraft
                  ? "Draft menggunakan aturan lama/belum disetujui. Lakukan hitung ulang."
                  : "Finalisasi Laporan dan Kunci Snapshot"
              }
            >
              {finalizing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              Finalisasi Laporan
            </button>
          )}
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: Histori Laporan Punishment */}
      {/* ========================================================================= */}
      {historyOpen && (
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
            ref={historyModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 780,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <History size={18} color="#2563eb" aria-hidden="true" />
                <h2 id="history-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  Riwayat Laporan Punishment Bulanan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Tutup jendela riwayat laporan"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                  display: "flex",
                  borderRadius: 4,
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} aria-hidden="true" />
                  Memuat histori laporan...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                  Belum ada laporan punishment yang tersimpan.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", color: "#1e293b", fontWeight: 700 }}>Periode Laporan</th>
                      <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Status</th>
                      <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Aturan</th>
                      <th style={{ padding: "10px 10px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Dibuat</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px", textAlign: "left" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            Periode {MONTH_NAMES[item.bulan_laporan - 1] || item.bulan_laporan} {item.tahun_laporan}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {item.periode_mulai} s.d {item.periode_selesai}
                          </div>
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 12,
                              background: item.status === "final" ? "#dcfce7" : "#fef3c7",
                              color: item.status === "final" ? "#166534" : "#92400e",
                              border: `1px solid ${item.status === "final" ? "#bbf7d0" : "#fde68a"}`,
                            }}
                          >
                            {item.status === "final" ? "FINAL" : "DRAFT"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center", fontSize: 12.5, color: "#475569" }}>
                          {item.rule_version}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center", fontSize: 12.5, color: "#64748b" }}>
                          {item.generated_at ? new Date(item.generated_at).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenReport(item.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                height: 32,
                                padding: "0 10px",
                                borderRadius: 4,
                                background: "#2563eb",
                                color: "#ffffff",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 12.5,
                                fontWeight: 500,
                              }}
                              title="Buka Laporan"
                            >
                              <Eye size={13} aria-hidden="true" />
                              Buka
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadExcel(item.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                height: 32,
                                padding: "0 10px",
                                borderRadius: 4,
                                background: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 12.5,
                                fontWeight: 500,
                              }}
                              title="Unduh File Excel"
                            >
                              <Download size={13} aria-hidden="true" />
                              Excel
                            </button>

                            {item.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDraft(item.id)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  height: 32,
                                  padding: "0 10px",
                                  borderRadius: 4,
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  cursor: "pointer",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                }}
                                title="Hapus Draft"
                              >
                                <Trash2 size={13} aria-hidden="true" />
                                Hapus
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Data Audit Belum Lengkap */}
      {/* ========================================================================= */}
      {showAuditIncompleteModal && (
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
            ref={auditIncompleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-incomplete-modal-title"
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
              <h2 id="audit-incomplete-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                Data Audit Belum Lengkap
              </h2>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, margin: "0 0 14px" }}>
              Finalisasi belum dapat dilakukan karena masih ada katering yang belum memiliki Audit final pada periode ini:
            </p>

            <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 6, padding: "12px 16px", marginBottom: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, fontWeight: 650, color: "#92400e", lineHeight: 1.6 }}>
                {(previewData?.audit_completeness?.missing_caterings || []).map((c) => (
                  <li key={c.id}>{c.nama}</li>
                ))}
              </ul>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: "0 0 20px" }}>
              Sesuai keputusan bisnis resmi, katering yang wajib diaudit harus memiliki record Audit berstatus <strong>FINAL</strong> (baik Tanpa Temuan maupun Dengan Temuan). Laporan tidak dapat difinalisasi jika audit masih berstatus Draft atau belum diisi.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAuditIncompleteModal(false)}
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

      {/* ========================================================================= */}
      {/* MODAL 2: Konfirmasi Finalisasi Laporan */}
      {/* ========================================================================= */}
      {showFinalizeModal && (
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
            ref={finalizeModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="finalize-modal-title"
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
              <h2 id="finalize-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                Konfirmasi Finalisasi Laporan
              </h2>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, margin: "0 0 16px" }}>
              Apakah Anda yakin ingin memfinalisasi laporan untuk periode{" "}
              <strong>
                {formatIndoDate(startDate)} s.d {formatIndoDate(endDate)}
              </strong>
              ?
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14, marginBottom: 20, fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Status laporan akan diubah menjadi <strong>FINAL</strong>.</li>
                <li>Snapshot data punishment akan <strong>dikunci secara permanen</strong>.</li>
                <li>Laporan lama tidak akan berubah meskipun master katering atau data operasional sumber diubah di kemudian hari.</li>
              </ul>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                disabled={finalizing}
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={finalizing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                }}
              >
                {finalizing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                Ya, Finalisasi Laporan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Konfirmasi Hitung Ulang Draft */}
      {/* ========================================================================= */}
      {showRecalculateModal && (
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
            ref={recalculateModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recalculate-modal-title"
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ea580c", marginBottom: 14 }}>
              <RotateCcw size={22} aria-hidden="true" />
              <h2 id="recalculate-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                Konfirmasi Hitung Ulang Draft
              </h2>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, margin: "0 0 16px" }}>
              Draft ini saat ini menggunakan versi aturan <strong>{selectedReport?.rule_version}</strong> (status: {activeRuleStatus}).
              Apakah Anda ingin menghitung ulang draft ini menggunakan <strong>Ketentuan Perhitungan Aktif ({selectedReport?.active_rule_version || previewData?.active_rule_version || "Aktif"} - Disetujui)</strong>?
            </p>

            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: 14, marginBottom: 20, fontSize: 13, color: "#9a3412", lineHeight: 1.55 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Data order porsi dan kondisi kebersihan yang sudah diisi akan <strong>tetap dipertahankan</strong>.</li>
                <li>Snapshot perhitungan denda akan dievaluasi ulang menggunakan aturan bisnis aktif yang disahkan.</li>
                <li>Setelah dihitung ulang, draft akan dapat difinalisasi jika seluruh data lengkap.</li>
              </ul>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowRecalculateModal(false)}
                disabled={recalculating}
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRecalculateWithActiveRule}
                disabled={recalculating}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "#ea580c",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                }}
              >
                {recalculating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
                Ya, Hitung Ulang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
