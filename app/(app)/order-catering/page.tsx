"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ReceiptText,
  Calendar,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  X,
  ShieldCheck,
  Lock,
  Info,
  Check,
  AlertTriangle,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Boxes,
} from "lucide-react";
import {
  Catering,
  getCatering,
  CateringOrderQuota,
  getOrderCateringApi,
  createOrderCateringApi,
  updateOrderCateringApi,
  confirmOrderCateringApi,
  deleteOrderCateringApi,
  getPeriodeDates,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

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

const TAHUN_OPTIONS = [2024, 2025, 2026, 2027];

/**
 * Format angka order/kuota.
 * Contoh: 1,711.11 atau 983 atau 2,694.11
 */
function formatOrderNumber(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDateIndo(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTimeIndo(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return "-";
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    const datePart = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${datePart} ${timePart}`;
  } catch {
    return dateTimeStr;
  }
}

// export default function OrderCateringPage() {
export default function DeprecatedOrderCateringPage() {
  // DEPRECATED / COMPATIBILITY ONLY
  // Alur operasional aktif telah dipindahkan ke modul Kalori (Data Pengiriman Hari Ini).
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const isAdmin = user?.role === "admin";

  // Parameter periode kontekstual dari URL (CTA Punishment: periode_mulai, periode_selesai, bulan, tahun)
  const paramStart = searchParams.get("periode_mulai") || searchParams.get("start_date");
  const paramEnd = searchParams.get("periode_selesai") || searchParams.get("end_date");
  const paramMonth = searchParams.get("bulan");
  const paramYear = searchParams.get("tahun");

  let initialMonth = paramMonth ? parseInt(paramMonth, 10) : NaN;
  let initialYear = paramYear ? parseInt(paramYear, 10) : NaN;

  // Jika bulan/tahun tidak diberikan tapi periode_selesai tersedia (e.g. 2026-09-19 -> bulan 9, tahun 2026)
  if ((isNaN(initialMonth) || isNaN(initialYear)) && paramEnd) {
    const parts = paramEnd.split("-");
    if (parts.length === 3) {
      if (isNaN(initialYear)) initialYear = parseInt(parts[0], 10);
      if (isNaN(initialMonth)) initialMonth = parseInt(parts[1], 10);
    }
  }

  const [selectedMonth, setSelectedMonth] = useState<number>(
    isNaN(initialMonth) ? 9 : initialMonth
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    isNaN(initialYear) ? 2026 : initialYear
  );

  // Periode dates (20th of M-1 to 19th of M)
  const { periode_mulai: defStart, periode_selesai: defEnd } = useMemo(
    () => getPeriodeDates(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  // Prioritaskan exact dates dari query parameter jika disediakan
  const [periodeMulai, setPeriodeMulai] = useState<string>(paramStart || defStart);
  const [periodeSelesai, setPeriodeSelesai] = useState<string>(paramEnd || defEnd);

  const isInitialMount = useRef(true);

  // Sync saat dropdown bulan/tahun diubah pengguna di UI
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const p = getPeriodeDates(selectedMonth, selectedYear);
    setPeriodeMulai(p.periode_mulai);
    setPeriodeSelesai(p.periode_selesai);
  }, [selectedMonth, selectedYear]);

  // Data states
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [orderRecords, setOrderRecords] = useState<CateringOrderQuota[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "draft" | "unfilled">("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"input" | "detail">("input");
  const [activeCatering, setActiveCatering] = useState<Catering | null>(null);
  const [activeOrder, setActiveOrder] = useState<CateringOrderQuota | null>(null);

  // Form Fields
  const [formOrderPagi, setFormOrderPagi] = useState<string>("0");
  const [formOrderMalam, setFormOrderMalam] = useState<string>("0");
  const [formCatatan, setFormCatatan] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // Fetch all active caterings and order quota records for the period
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, orderRes] = await Promise.all([
        getCatering({ activeOnly: true }),
        getOrderCateringApi({
          periode_mulai: periodeMulai,
          periode_selesai: periodeSelesai,
        }),
      ]);
      setCaterings(catsRes);
      setOrderRecords(orderRes);

      const now = new Date();
      setLastUpdated(
        `${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}, ${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}`
      );
    } catch (err: any) {
      showToast(err?.message || "Gagal memuat data order catering.", "error");
    } finally {
      setLoading(false);
    }
  }, [periodeMulai, periodeSelesai, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map order quota by catering_id
  const orderMap = useMemo(() => {
    const map = new Map<number, CateringOrderQuota>();
    for (const rec of orderRecords) {
      map.set(rec.catering_id, rec);
    }
    return map;
  }, [orderRecords]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = caterings.length;
    let confirmedCount = 0;
    let draftCount = 0;
    let totalPagi = 0;
    let totalMalam = 0;

    for (const c of caterings) {
      const rec = orderMap.get(c.id);
      if (rec) {
        if (rec.status === "confirmed") confirmedCount++;
        else if (rec.status === "draft") draftCount++;

        totalPagi += Number(rec.order_pagi) || 0;
        totalMalam += Number(rec.order_malam) || 0;
      }
    }
    const unfilledCount = Math.max(0, total - confirmedCount - draftCount);
    const totalKeseluruhan = totalPagi + totalMalam;

    return {
      total,
      confirmedCount,
      draftCount,
      unfilledCount,
      totalPagi: roundToTwo(totalPagi),
      totalMalam: roundToTwo(totalMalam),
      totalKeseluruhan: roundToTwo(totalKeseluruhan),
    };
  }, [caterings, orderMap]);

  function roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  // Filter caterings
  const filteredCaterings = useMemo(() => {
    let list = caterings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.nama.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => {
        const rec = orderMap.get(c.id);
        if (statusFilter === "confirmed") return rec?.status === "confirmed";
        if (statusFilter === "draft") return rec?.status === "draft";
        if (statusFilter === "unfilled") return !rec;
        return true;
      });
    }

    return list;
  }, [caterings, orderMap, searchQuery, statusFilter]);

  // Derived live total order in modal
  const liveTotalOrder = useMemo(() => {
    const pagi = parseFloat(formOrderPagi);
    const malam = parseFloat(formOrderMalam);
    const validPagi = !isNaN(pagi) && pagi >= 0 ? pagi : 0;
    const validMalam = !isNaN(malam) && malam >= 0 ? malam : 0;
    return roundToTwo(validPagi + validMalam);
  }, [formOrderPagi, formOrderMalam]);

  // Open modal for input or editing
  const handleOpenInput = (catering: Catering) => {
    const existing = orderMap.get(catering.id) || null;
    setActiveCatering(catering);
    setActiveOrder(existing);
    setFormError(null);

    if (existing) {
      if (existing.status === "confirmed") {
        setModalMode("detail");
      } else {
        setModalMode("input");
      }
      setFormOrderPagi(String(existing.order_pagi));
      setFormOrderMalam(String(existing.order_malam));
      setFormCatatan(existing.catatan || "");
    } else {
      setModalMode("input");
      setFormOrderPagi("0");
      setFormOrderMalam("0");
      setFormCatatan("");
    }
    setModalOpen(true);
  };

  // Open read-only detail modal
  const handleOpenDetail = (catering: Catering) => {
    const existing = orderMap.get(catering.id) || null;
    setActiveCatering(catering);
    setActiveOrder(existing);
    setModalMode("detail");
    setModalOpen(true);
  };

  // Save Draft (Create or Update)
  const handleSaveDraft = async () => {
    if (!activeCatering) return;

    setFormError(null);
    const pagiNum = parseFloat(formOrderPagi);
    const malamNum = parseFloat(formOrderMalam);

    if (isNaN(pagiNum)) {
      setFormError("Order shift pagi harus berupa angka yang valid.");
      return;
    }
    if (isNaN(malamNum)) {
      setFormError("Order shift malam harus berupa angka yang valid.");
      return;
    }
    if (pagiNum < 0) {
      setFormError("Order shift pagi tidak boleh bernilai negatif.");
      return;
    }
    if (malamNum < 0) {
      setFormError("Order shift malam tidak boleh bernilai negatif.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeOrder) {
        // Update existing draft
        const updated = await updateOrderCateringApi(activeOrder.id, {
          order_pagi: pagiNum,
          order_malam: malamNum,
          catatan: formCatatan.trim() || undefined,
        });
        showToast(`Draft order untuk ${activeCatering.nama} berhasil diperbarui.`, "success");
        setActiveOrder(updated);
      } else {
        // Create new draft
        const created = await createOrderCateringApi({
          catering_id: activeCatering.id,
          periode_mulai: periodeMulai,
          periode_selesai: periodeSelesai,
          order_pagi: pagiNum,
          order_malam: malamNum,
          catatan: formCatatan.trim() || undefined,
        });
        showToast(`Draft order untuk ${activeCatering.nama} berhasil disimpan.`, "success");
        setActiveOrder(created);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || "Gagal menyimpan draft order catering.");
      showToast(err?.message || "Gagal menyimpan draft order catering.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Order (Admin only)
  const handleConfirmOrder = async () => {
    if (!activeOrder || !isAdmin) return;

    setIsSubmitting(true);
    try {
      await confirmOrderCateringApi(activeOrder.id);
      showToast(
        `Order catering ${activeCatering?.nama || ""} berhasil dikonfirmasi dan dikunci.`,
        "success"
      );
      setShowConfirmModal(false);
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Gagal mengonfirmasi order catering.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Draft (Admin only, draft only)
  const handleDeleteDraft = async () => {
    if (!activeOrder || !isAdmin) return;

    setIsSubmitting(true);
    try {
      await deleteOrderCateringApi(activeOrder.id);
      showToast(`Draft order ${activeCatering?.nama || ""} berhasil dihapus.`, "success");
      setShowDeleteModal(false);
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Gagal menghapus draft order catering.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* DEPRECATION WARNING BANNER */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">Halaman Ini Telah Didepresiasi (Compatibility Only)</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Alur operasional aktif telah dialihkan ke menu <strong>Kalori → Input Kalori (Data Pengiriman Hari Ini)</strong>.
            </p>
          </div>
        </div>
        <Link
          href="/kalori-harian/input"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition"
        >
          Ke Input Kalori →
        </Link>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Order / Kuota Catering
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pengelolaan jumlah order katering per shift dan periode.
              </p>
            </div>
          </div>
        </div>

        {/* PERIOD SELECTOR & REFRESH */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-card border border-border rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <select
              aria-label="Pilih Bulan"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer pr-2"
            >
              {BULAN_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Pilih Tahun"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer border-l border-border pl-2"
            >
              {TAHUN_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground bg-card hover:bg-accent border border-border rounded-xl shadow-sm transition-colors disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* PERIOD INFO BANNER */}
      <div className="bg-card/70 backdrop-blur border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Periode Siklus Operasional
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatDateIndo(periodeMulai)} &mdash; {formatDateIndo(periodeSelesai)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 px-3 py-1.5 rounded-lg border border-border/50">
          <Info className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Siklus tanggal 20 bulan sebelumnya s/d 19 bulan berjalan.</span>
        </div>
      </div>

      {/* KPI / RINGKASAN CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1: Total Katering */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Total Katering</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Katering aktif</div>
        </div>

        {/* Card 2: Confirmed */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-xs font-medium">Confirmed</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.confirmedCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Terkunci & resmi</div>
        </div>

        {/* Card 3: Draft */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-medium">Draft</span>
            <Edit3 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.draftCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Dalam proses</div>
        </div>

        {/* Card 4: Belum Diisi */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-xs font-medium">Belum Diisi</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.unfilledCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Perlu diisi</div>
        </div>

        {/* Card 5: Total Order Pagi */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Order Pagi</span>
            <Boxes className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {formatOrderNumber(stats.totalPagi)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Porsi shift pagi</div>
        </div>

        {/* Card 6: Total Order Malam */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Order Malam</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {formatOrderNumber(stats.totalMalam)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Porsi shift malam</div>
        </div>

        {/* Card 7: Total Keseluruhan */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between bg-gradient-to-br from-card to-primary/5">
          <div className="flex items-center justify-between text-primary mb-1">
            <span className="text-xs font-semibold">Total Order</span>
            <ReceiptText className="w-4 h-4" />
          </div>
          <div className="text-lg font-extrabold text-primary">
            {formatOrderNumber(stats.totalKeseluruhan)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Pagi + malam</div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama katering..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-accent/40 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Semua ({caterings.length})
          </button>
          <button
            onClick={() => setStatusFilter("confirmed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === "confirmed"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Confirmed ({stats.confirmedCount})
          </button>
          <button
            onClick={() => setStatusFilter("draft")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === "draft"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Draft ({stats.draftCount})
          </button>
          <button
            onClick={() => setStatusFilter("unfilled")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === "unfilled"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Belum Diisi ({stats.unfilledCount})
          </button>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Memuat data order catering...</p>
          </div>
        ) : filteredCaterings.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-base font-semibold text-foreground">Belum ada data order untuk periode ini.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? "Tidak ada katering yang cocok dengan kata kunci pencarian."
                : "Pilih periode lain atau mulai mengisi order kuota katering."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Katering</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Order Pagi</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Order Malam</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total Order</th>
                  <th className="py-3.5 px-4 font-semibold">Update Terakhir</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCaterings.map((catering) => {
                  const order = orderMap.get(catering.id);
                  const isConfirmed = order?.status === "confirmed";
                  const isDraft = order?.status === "draft";
                  const isUnfilled = !order;

                  return (
                    <tr
                      key={catering.id}
                      className="hover:bg-accent/40 transition-colors group"
                    >
                      {/* Catering Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{catering.nama}</span>
                        </div>
                        {order?.catatan && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                            Catatan: {order.catatan}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isConfirmed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Lock className="w-3 h-3" />
                            Confirmed
                          </span>
                        )}
                        {isDraft && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                        {isUnfilled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Belum Diisi
                          </span>
                        )}
                      </td>

                      {/* Order Pagi */}
                      <td className="py-3.5 px-4 text-right font-medium text-foreground">
                        {order ? formatOrderNumber(order.order_pagi) : "-"}
                      </td>

                      {/* Order Malam */}
                      <td className="py-3.5 px-4 text-right font-medium text-foreground">
                        {order ? formatOrderNumber(order.order_malam) : "-"}
                      </td>

                      {/* Total Order */}
                      <td className="py-3.5 px-4 text-right font-bold text-foreground">
                        {order ? (
                          <span className="text-primary font-bold">
                            {formatOrderNumber(order.total_order ?? (order.order_pagi + order.order_malam))}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Update Terakhir */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {order ? (
                          <div>
                            <div>{formatDateTimeIndo(order.updated_at || order.created_at)}</div>
                            {isConfirmed && order.confirmed_at && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Locked: {formatDateTimeIndo(order.confirmed_at)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        {isConfirmed && (
                          <button
                            onClick={() => handleOpenDetail(catering)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-accent hover:bg-accent/80 border border-border rounded-lg shadow-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            Lihat Detail
                          </button>
                        )}
                        {isDraft && (
                          <button
                            onClick={() => handleOpenInput(catering)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg shadow-sm transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Lanjutkan
                          </button>
                        )}
                        {isUnfilled && (
                          <button
                            onClick={() => handleOpenInput(catering)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Isi Order
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INPUT / EDIT DRAFT MODAL */}
      {modalOpen && modalMode === "input" && activeCatering && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-primary" />
                  {activeOrder ? "Edit Draft Order Catering" : "Isi Order Kuota Catering"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Masukkan jumlah order per shift untuk periode berjalan.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Error Banner */}
              {formError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Context: Catering & Periode */}
              <div className="bg-accent/40 border border-border/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Katering:</span>
                  <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {activeCatering.nama}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2">
                  <span className="text-muted-foreground font-medium">Periode:</span>
                  <span className="font-semibold text-foreground">
                    {formatDateIndo(periodeMulai)} &mdash; {formatDateIndo(periodeSelesai)}
                  </span>
                </div>
              </div>

              {/* Form Input: Order Pagi */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Order Shift Pagi</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Nilai &ge; 0 (desimal didukung)
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formOrderPagi}
                  onChange={(e) => setFormOrderPagi(e.target.value)}
                  placeholder="0"
                  className="w-full bg-accent/30 border border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Contoh: 1711.11 atau 983. Dapat bernilai 0 untuk draft.
                </p>
              </div>

              {/* Form Input: Order Malam */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Order Shift Malam</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Nilai &ge; 0 (desimal didukung)
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formOrderMalam}
                  onChange={(e) => setFormOrderMalam(e.target.value)}
                  placeholder="0"
                  className="w-full bg-accent/30 border border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Contoh: 983.0 atau 1250. Dapat bernilai 0 untuk draft.
                </p>
              </div>

              {/* Live Preview: Total Order */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Total Order (Preview)
                  </span>
                  <span className="text-[11px] text-muted-foreground">Pagi + Malam</span>
                </div>
                <div className="text-2xl font-black text-primary tracking-tight">
                  {formatOrderNumber(liveTotalOrder)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>
                    Dihitung otomatis: {formatOrderNumber(parseFloat(formOrderPagi) || 0)} (Pagi) +{" "}
                    {formatOrderNumber(parseFloat(formOrderMalam) || 0)} (Malam)
                  </span>
                </div>
              </div>

              {/* Form Input: Catatan Optional */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Tambahkan catatan keterangan kuota bila diperlukan..."
                  className="w-full bg-accent/30 border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {activeOrder && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isSubmitting}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                    title="Hapus Draft Order"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {activeOrder ? "Simpan Perubahan Draft" : "Simpan Draft"}
                </button>

                {activeOrder && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Konfirmasi Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMED DETAIL MODAL (READ-ONLY) */}
      {modalOpen && modalMode === "detail" && activeCatering && activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Detail Kuota Order (Confirmed)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Data resmi operasional telah dikonfirmasi dan terkunci.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Status Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Data Terkunci (Read-Only)</div>
                  <div className="mt-0.5 text-muted-foreground">
                    Data order ini telah dikonfirmasi oleh Admin dan dikunci untuk menjaga integritas data histori operasional.
                  </div>
                </div>
              </div>

              {/* Context Info */}
              <div className="bg-accent/40 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Katering:</span>
                  <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {activeCatering.nama}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2.5">
                  <span className="text-muted-foreground font-medium">Periode Siklus:</span>
                  <span className="font-semibold text-foreground">
                    {formatDateIndo(activeOrder.periode_mulai)} &mdash; {formatDateIndo(activeOrder.periode_selesai)}
                  </span>
                </div>
              </div>

              {/* Order Breakdown Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-2xl p-3.5">
                  <div className="text-xs text-muted-foreground font-medium">Order Shift Pagi</div>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {formatOrderNumber(activeOrder.order_pagi)}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-3.5">
                  <div className="text-xs text-muted-foreground font-medium">Order Shift Malam</div>
                  <div className="text-xl font-bold text-foreground mt-1">
                    {formatOrderNumber(activeOrder.order_malam)}
                  </div>
                </div>
              </div>

              {/* Total Order Box */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Total Order Quota
                  </div>
                  <div className="text-2xl font-black text-primary mt-0.5">
                    {formatOrderNumber(activeOrder.total_order ?? (activeOrder.order_pagi + activeOrder.order_malam))}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Pagi + Malam
                </div>
              </div>

              {/* Catatan if available */}
              {activeOrder.catatan && (
                <div className="bg-card border border-border rounded-2xl p-3.5">
                  <div className="text-xs text-muted-foreground font-medium">Catatan Operasional</div>
                  <div className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                    {activeOrder.catatan}
                  </div>
                </div>
              )}

              {/* Audit Metadata */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1.5 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                  Histori Audit
                </div>
                <div className="flex justify-between">
                  <span>Dibuat pada:</span>
                  <span className="font-medium text-foreground">
                    {formatDateTimeIndo(activeOrder.created_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Terakhir diubah:</span>
                  <span className="font-medium text-foreground">
                    {formatDateTimeIndo(activeOrder.updated_at)}
                  </span>
                </div>
                {activeOrder.confirmed_at && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Dikonfirmasi pada:</span>
                    <span>{formatDateTimeIndo(activeOrder.confirmed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 text-xs font-semibold text-foreground bg-accent hover:bg-accent/80 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM ORDER MODAL DIALOG */}
      {showConfirmModal && activeOrder && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-foreground">Konfirmasi Order Catering</h4>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Setelah dikonfirmasi, data order dikunci dan akan menjadi sumber resmi perhitungan laporan pada fase integrasi berikutnya.
            </p>

            <div className="bg-accent/40 border border-border rounded-2xl p-3.5 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Katering:</span>
                <span className="font-bold text-foreground">{activeCatering?.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Pagi:</span>
                <span className="font-semibold text-foreground">
                  {formatOrderNumber(parseFloat(formOrderPagi) || activeOrder.order_pagi)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Malam:</span>
                <span className="font-semibold text-foreground">
                  {formatOrderNumber(parseFloat(formOrderMalam) || activeOrder.order_malam)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1 font-bold text-primary">
                <span>Total Order:</span>
                <span>{formatOrderNumber(liveTotalOrder)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Ya, Konfirmasi Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DRAFT MODAL DIALOG */}
      {showDeleteModal && activeOrder && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2.5 rounded-2xl bg-destructive/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-foreground">Hapus Draft Order</h4>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Apakah Anda yakin ingin menghapus draft kuota order untuk katering{" "}
              <strong className="text-foreground">{activeCatering?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
