"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Moon,
  Sun,
  RotateCcw,
  Utensils,
  ArrowLeft,
  Save,
  Copy,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Building2,
  Calendar,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  RefreshCw,
  X,
  Send,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import {
  MonthlyMenuPlanDetail,
  getMenuPlanDetailApi,
  updateMenuPlanItemsApi,
  submitMenuPlanApprovalApi,
  exportMenuPlanExcelApi,
  MenuItemPayload,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import IndoDatePicker from "@/components/IndoDatePicker";

const DAYS_HEADER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const COMPONENT_ROLES = [
  "Nasi / Karbohidrat",
  "Lauk Utama (Hewani)",
  "Lauk Pendamping",
  "Sayur / Kuah",
  "Pelengkap / Sambal",
  "Buah / Pencuci Mulut",
];

export default function RencanaMenuEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = (params?.id as string) || (searchParams?.get("id") ?? undefined);
  const planId = rawId ? Number(rawId) : 0;

  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [plan, setPlan] = useState<MonthlyMenuPlanDetail | null>(null);

  // Active Tab: Pagi atau Malam
  const [activeShift, setActiveShift] = useState<"Pagi" | "Malam">("Pagi");

  // Grid Data Structure:
  // key: `${dateStr}_${shift}_${order}` -> value: string
  const [menuItemsMap, setMenuItemsMap] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Copy Tool State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [sourceCopyDate, setSourceCopyDate] = useState("");
  const [targetCopyDate, setTargetCopyDate] = useState("");

  // Different Night Menu Tool State
  const [isDiffNightModalOpen, setIsDiffNightModalOpen] = useState(false);
  const [diffModalDate, setDiffModalDate] = useState<string>("");
  const [diffModalNightItems, setDiffModalNightItems] = useState<Record<number, string>>({
    1: "", 2: "", 3: "", 4: "", 5: "", 6: ""
  });

  const role = user?.role?.toLowerCase() || "";
  const isEditable = (plan?.status === "DRAFT" || plan?.status === "REVISION_REQUIRED") && (role === "admin" || role === "staff");

  // Prevent accidental navigation when unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Load Menu Plan Detail
  const loadPlanDetail = useCallback(async () => {
    if (!planId || isNaN(planId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getMenuPlanDetailApi(planId);
      setPlan(data);

      // Populate item map
      const map: Record<string, string> = {};
      (data.items || []).forEach((it) => {
        const key = `${it.menu_date}_${it.shift}_${it.item_order}`;
        map[key] = it.menu_name || "";
      });
      setMenuItemsMap(map);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat detail rencana menu", "error");
    } finally {
      setLoading(false);
    }
  }, [planId, showToast]);

  useEffect(() => {
    loadPlanDetail();
  }, [loadPlanDetail]);

  // Handle cell text change
  const handleItemChange = (dateStr: string, shift: "Pagi" | "Malam", order: number, value: string) => {
    if (!isEditable) return;
    const key = `${dateStr}_${shift}_${order}`;
    setMenuItemsMap((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
  };

  // Check if a day has perishable soup in morning (e.g. sayur bayam or sayur kunci)
  const isPerishableMorningSayur = useCallback((dateStr: string) => {
    const sayur = (menuItemsMap[`${dateStr}_Pagi_4`] || "").toLowerCase();
    return sayur.includes("bayam") || sayur.includes("kunci");
  }, [menuItemsMap]);

  // Check if a specific date has custom/different night menu compared to morning
  const isDateNightDiff = useCallback((dateStr: string) => {
    if (!dateStr) return false;
    let hasAnyDiff = false;
    let hasAnyPagi = false;
    for (let order = 1; order <= 6; order++) {
      const p = (menuItemsMap[`${dateStr}_Pagi_${order}`] || "").trim();
      const m = (menuItemsMap[`${dateStr}_Malam_${order}`] || "").trim();
      if (p) hasAnyPagi = true;
      if (m && p !== m) hasAnyDiff = true;
    }
    return hasAnyPagi && hasAnyDiff;
  }, [menuItemsMap]);

  // List of dates that have customized different night menus
  const datesWithNightDiff = useMemo(() => {
    if (!plan) return [];
    const list: Array<{ dateStr: string; day: number; sayurPagi: string; sayurMalam: string }> = [];
    const year = plan.effective_year;
    const month = plan.effective_month;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (isDateNightDiff(dateStr)) {
        list.push({
          dateStr,
          day,
          sayurPagi: menuItemsMap[`${dateStr}_Pagi_4`] || "(Kosong)",
          sayurMalam: menuItemsMap[`${dateStr}_Malam_4`] || "(Kosong)",
        });
      }
    }
    return list;
  }, [plan, isDateNightDiff, menuItemsMap]);

  // Open modal to configure different night menu for a date
  const openDifferentNightMenuModal = (targetDate?: string) => {
    if (!plan) return;
    const year = plan.effective_year;
    const month = plan.effective_month;
    const daysInMonth = new Date(year, month, 0).getDate();

    let chosenDate = targetDate;
    if (!chosenDate) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (isPerishableMorningSayur(dStr) && !isDateNightDiff(dStr)) {
          chosenDate = dStr;
          break;
        }
      }
      if (!chosenDate) {
        chosenDate = `${year}-${String(month).padStart(2, "0")}-01`;
      }
    }

    setDiffModalDate(chosenDate);
    const currentNight: Record<number, string> = {};
    for (let order = 1; order <= 6; order++) {
      const malamVal = menuItemsMap[`${chosenDate}_Malam_${order}`];
      const pagiVal = menuItemsMap[`${chosenDate}_Pagi_${order}`];
      currentNight[order] = (malamVal !== undefined && malamVal !== "") ? malamVal : (pagiVal || "");
    }
    setDiffModalNightItems(currentNight);
    setIsDiffNightModalOpen(true);
  };

  const handleDiffDateChange = (newDate: string) => {
    setDiffModalDate(newDate);
    const currentNight: Record<number, string> = {};
    for (let order = 1; order <= 6; order++) {
      const malamVal = menuItemsMap[`${newDate}_Malam_${order}`];
      const pagiVal = menuItemsMap[`${newDate}_Pagi_${order}`];
      currentNight[order] = (malamVal !== undefined && malamVal !== "") ? malamVal : (pagiVal || "");
    }
    setDiffModalNightItems(currentNight);
  };

  const handleSaveDiffNightModal = () => {
    if (!diffModalDate) return;
    setMenuItemsMap((prev) => {
      const next = { ...prev };
      for (let order = 1; order <= 6; order++) {
        next[`${diffModalDate}_Malam_${order}`] = diffModalNightItems[order] || "";
      }
      return next;
    });
    setHasUnsavedChanges(true);
    setIsDiffNightModalOpen(false);
    showToast(
      `Menu shift malam khusus ${diffModalDate} berhasil diterapkan. Klik "Simpan Draf" untuk menyimpan perubahan.`,
      "success"
    );
  };

  const handleResetNightToMatchPagi = () => {
    if (!diffModalDate) return;
    const resetNight: Record<number, string> = {};
    setMenuItemsMap((prev) => {
      const next = { ...prev };
      for (let order = 1; order <= 6; order++) {
        const pagiVal = prev[`${diffModalDate}_Pagi_${order}`] || "";
        next[`${diffModalDate}_Malam_${order}`] = pagiVal;
        resetNight[order] = pagiVal;
      }
      return next;
    });
    setDiffModalNightItems(resetNight);
    setHasUnsavedChanges(true);
    showToast(`Menu shift malam tanggal ${diffModalDate} telah disamakan dengan shift pagi.`, "info");
  };

  const handleCopyMorningToModalNight = () => {
    if (!diffModalDate) return;
    const copyNight: Record<number, string> = {};
    for (let order = 1; order <= 6; order++) {
      copyNight[order] = menuItemsMap[`${diffModalDate}_Pagi_${order}`] || "";
    }
    setDiffModalNightItems(copyNight);
  };

  // Sync entire night shift from morning shift across all days of the month
  const handleSyncNightWithMorning = () => {
    if (!plan || !isEditable) return;
    if (!window.confirm("Samakan seluruh komponen menu shift malam mengikuti shift pagi untuk seluruh hari di bulan ini? Setelah ini Anda dapat menyesuaikan tanggal-tanggal tertentu (misal sayur bayam/kunci).")) {
      return;
    }

    const year = plan.effective_year;
    const month = plan.effective_month;
    const daysInMonth = new Date(year, month, 0).getDate();

    setMenuItemsMap((prev) => {
      const next = { ...prev };
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        for (let order = 1; order <= 6; order++) {
          next[`${dateStr}_Malam_${order}`] = prev[`${dateStr}_Pagi_${order}`] || "";
        }
      }
      return next;
    });
    setHasUnsavedChanges(true);
    showToast("Seluruh komponen menu shift malam berhasil disamakan dengan shift pagi.", "success");
  };

  // Dynamic Calendar Matrix Computation (4 s/d 6 minggu)
  const calendarWeeks = useMemo(() => {
    if (!plan) return [];
    const year = plan.effective_year;
    const month = plan.effective_month; // 1..12

    // Jumlah hari dalam bulan berlaku (28, 29, 30, atau 31)
    const daysInMonth = new Date(year, month, 0).getDate();

    // Hari dalam seminggu untuk tanggal 1: 0 (Min), 1 (Sen), ..., 6 (Sab)
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    // Normalisasi agar Senin = 0, ..., Minggu = 6
    const offset = (firstDayIndex + 6) % 7;

    const weeks: Array<Array<{ day: number; dateStr: string; isCurrentMonth: boolean }>> = [];
    let currentWeek: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Hari kosong di awal minggu pertama
    for (let i = 0; i < offset; i++) {
      currentWeek.push({ day: 0, dateStr: "", isCurrentMonth: false });
    }

    // Hari-hari aktif bulan ini
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      currentWeek.push({ day, dateStr, isCurrentMonth: true });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Hari kosong di akhir minggu terakhir jika belum pas 7 hari
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ day: 0, dateStr: "", isCurrentMonth: false });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [plan]);

  // Handle Save All Items
  const handleSave = async () => {
    if (!plan || !isEditable) return;
    setSaving(true);
    try {
      const itemsPayload: MenuItemPayload[] = [];

      // Loop seluruh hari di bulan berlaku
      const year = plan.effective_year;
      const month = plan.effective_month;
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // Periksa apakah Shift Malam memiliki komponen yang sengaja diisi
        let nightHasItems = false;
        for (let order = 1; order <= 6; order++) {
          if (menuItemsMap[`${dateStr}_Malam_${order}`]?.trim()) {
            nightHasItems = true;
            break;
          }
        }

        // Simpan Shift Pagi
        for (let order = 1; order <= 6; order++) {
          const key = `${dateStr}_Pagi_${order}`;
          const val = menuItemsMap[key]?.trim();
          if (val) {
            itemsPayload.push({
              menu_date: dateStr,
              shift: "Pagi",
              item_order: order,
              item_role: COMPONENT_ROLES[order - 1],
              menu_name: val,
            });
          }
        }

        // Simpan Shift Malam: jika malam ada kustomisasi gunakan malam;
        // jika malam kosong otomatis gunakan shift pagi agar data lengkap
        for (let order = 1; order <= 6; order++) {
          const malamKey = `${dateStr}_Malam_${order}`;
          const pagiKey = `${dateStr}_Pagi_${order}`;
          const malamVal = menuItemsMap[malamKey]?.trim();
          const val = nightHasItems ? malamVal : (malamVal || menuItemsMap[pagiKey]?.trim());
          if (val) {
            itemsPayload.push({
              menu_date: dateStr,
              shift: "Malam",
              item_order: order,
              item_role: COMPONENT_ROLES[order - 1],
              menu_name: val,
            });
          }
        }
      }

      const res = await updateMenuPlanItemsApi(plan.id, {
        catatan: plan.catatan || undefined,
        items: itemsPayload,
      });

      setPlan(res);
      setHasUnsavedChanges(false);
      showToast("Seluruh komponen menu berhasil disimpan ke draf.", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan rencana menu.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Copy Menu from one date to another in the same shift and plan
  const executeCopy = () => {
    if (!sourceCopyDate || !targetCopyDate) {
      showToast("Pilih tanggal asal dan tanggal tujuan salin.", "error");
      return;
    }
    if (sourceCopyDate === targetCopyDate) {
      showToast("Tanggal asal dan tujuan tidak boleh sama.", "error");
      return;
    }

    setMenuItemsMap((prev) => {
      const next = { ...prev };
      for (let order = 1; order <= 6; order++) {
        const srcKey = `${sourceCopyDate}_${activeShift}_${order}`;
        const tgtKey = `${targetCopyDate}_${activeShift}_${order}`;
        next[tgtKey] = prev[srcKey] || "";
      }
      return next;
    });

    setHasUnsavedChanges(true);
    setIsCopyModalOpen(false);
    showToast(
      `Komponen menu shift ${activeShift} dari ${sourceCopyDate} berhasil disalin ke ${targetCopyDate}.`,
      "success"
    );
  };

  // Submit Plan for Official 3-Stage Approval (Phase 4)
  const handleSubmitApproval = async () => {
    if (!plan || !isEditable) return;
    setSubmittingApproval(true);
    try {
      // First save if any changes are pending
      if (hasUnsavedChanges) {
        await handleSave();
      }
      const res = await submitMenuPlanApprovalApi(plan.id);
      showToast("Rencana menu berhasil diajukan untuk proses approval resmi PT JAI.", "success");
      setIsSubmitModalOpen(false);
      await loadPlanDetail();
    } catch (err: any) {
      showToast(err.message || "Gagal mengajukan persetujuan rencana menu.", "error");
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Download official Excel workbook
  const handleExportExcel = async () => {
    if (!plan) return;
    setExportingExcel(true);
    try {
      const { blob, filename } = await exportMenuPlanExcelApi(plan.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("File Excel Rencana Menu berhasil diunduh.", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal mengunduh Excel rencana menu.", "error");
    } finally {
      setExportingExcel(false);
    }
  };

  const getStatusBadge = (status?: string, isActive?: boolean) => {
    if (isActive) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 700, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.35)" }}>
          <CheckCircle2 size={13} />
          ACTIVE
        </span>
      );
    }

    switch (status) {
      case "DRAFT":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 600, background: "rgba(148, 163, 184, 0.15)", color: "var(--text-secondary)", border: "1px solid rgba(148, 163, 184, 0.3)" }}>
            <Clock size={13} />
            DRAFT
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 600, background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
            <Clock size={13} />
            MENUNGGU APPROVAL
          </span>
        );
      case "APPROVED":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 600, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.35)" }}>
            <FileCheck2 size={13} />
            APPROVED
          </span>
        );
      case "SUPERSEDED":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 500, background: "rgba(100, 116, 139, 0.12)", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.25)" }}>
            TERGANTIKAN
          </span>
        );
      case "REVISION_REQUIRED":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 600, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.35)" }}>
            <AlertCircle size={13} />
            PERLU REVISI
          </span>
        );
      case "REJECTED":
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: "12px", fontWeight: 600, background: "rgba(225, 29, 72, 0.15)", color: "#e11d48", border: "1px solid rgba(225, 29, 72, 0.35)" }}>
            <AlertCircle size={13} />
            DITOLAK
          </span>
        );
      default:
        return (
          <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: "12px", background: "rgba(148, 163, 184, 0.1)" }}>
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
        <RefreshCw size={28} className="animate-spin text-primary" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600 }}>Memuat data rencana menu bulanan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <AlertCircle size={40} className="text-secondary" style={{ margin: "0 auto 12px" }} />
        <h2>Rencana Menu Tidak Ditemukan</h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Dokumen rencana menu dengan ID {planId} tidak dapat dimuat atau telah dihapus.
        </p>
        <Link href="/rencana-menu" className="btn btn-primary" style={{ marginTop: 16 }}>
          Kembali ke Daftar Rencana Menu
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: 80 }}>
      {/* Top Navigation Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Link
          href="/rencana-menu"
          className="btn btn-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "13px", padding: "6px 12px" }}
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </Link>

        {/* Phase 4 Preparation Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasUnsavedChanges && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "12.5px",
                color: "#f59e0b",
                fontWeight: 600,
                background: "rgba(245, 158, 11, 0.12)",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              <AlertCircle size={14} />
              Perubahan belum disimpan
            </span>
          )}

          {isEditable && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                <Save size={15} />
                {saving ? "Menyimpan..." : "Simpan Draf"}
              </button>

              <button
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={submittingApproval || saving}
                className="btn btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: "13.5px",
                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
                }}
              >
                <Send size={15} />
                Ajukan Persetujuan
              </button>
            </>
          )}

          {plan.approval_request_id && (
            <Link
              href={`/approval?id=${plan.approval_request_id}`}
              className="btn btn-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "13px",
                padding: "8px 14px",
                borderRadius: 8,
                color: "#3b82f6",
                borderColor: "rgba(59, 130, 246, 0.4)",
              }}
            >
              <ExternalLink size={14} />
              Lihat Dokumen Approval #{plan.approval_request_id}
            </Link>
          )}

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="btn btn-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "13px",
              padding: "8px 14px",
              borderRadius: 8,
            }}
          >
            <FileSpreadsheet size={15} className="text-success" />
            {exportingExcel ? "Mengunduh..." : "Export Excel (E-Sign)"}
          </button>
        </div>
      </div>

      {/* Header Info Card */}
      <div
        className="card-surface"
        style={{
          borderRadius: 12,
          padding: "20px 24px",
          border: "1px solid var(--border-color)",
          marginBottom: 20,
          background: "var(--card-bg, #ffffff)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="eyebrow" style={{ margin: 0 }}>PT. JATIM AUTOCOMP INDONESIA</span>
              <span style={{ color: "var(--border-color)" }}>•</span>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                ID Rencana #{plan.id}
              </span>
            </div>
            <h1 style={{ margin: "2px 0 6px 0", fontSize: "22px", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 size={24} className="text-primary" />
              {plan.catering_nama || "Semua Katering (PT JAI)"}
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                (Versi {plan.version})
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
              Periode Menu Berlaku: <strong style={{ color: "var(--text-primary)" }}>{plan.effective_menu_period}</strong> | Pengajuan: {plan.submission_period} <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 4, background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", fontSize: "11px", fontWeight: 700 }}>1 Laporan untuk Seluruh Vendor Katering</span>
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: 4, textAlign: "right" }}>
                Status Dokumen
              </div>
              {getStatusBadge(plan.status, plan.is_active)}
            </div>
            <HeaderMetaBoxes />
          </div>
        </div>

        {/* Informative Read-Only or Approval Banner */}
        {!isEditable && (
          <div
            style={{
              marginTop: 16,
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          >
            <Info size={16} className="text-primary" />
            <span>
              Dokumen ini berstatus <strong>{plan.status}</strong> dan berada dalam mode <strong>Read-Only</strong>.
              Pengeditan komponen hidangan hanya diizinkan pada draf sebelum disetujui.
            </span>
          </div>
        )}
      </div>

      {/* Shift Tabs & Copy Action Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Tab SHIFT PAGI & SHIFT MALAM */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveShift("Pagi")}
            className={`btn ${activeShift === "Pagi" ? "btn-primary" : "btn-outline"}`}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              fontSize: "13.5px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Clock size={16} />
            SHIFT PAGI
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("Malam")}
            className={`btn ${activeShift === "Malam" ? "btn-primary" : "btn-outline"}`}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              fontSize: "13.5px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Clock size={16} />
            SHIFT MALAM
          </button>
        </div>

        {/* Shift Malam Tools & Copy Tool */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {isEditable && (
            <>
              {/* TOMBOL UTAMA: Berikan Menu Berbeda Shift Malam */}
              <button
                type="button"
                onClick={() => openDifferentNightMenuModal()}
                className="btn btn-primary"
                title="Berikan menu berbeda untuk shift malam (misal jika shift pagi ada sayur kunci atau sayur bayam yang tidak tahan lama)"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: "13px",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                  borderColor: "#3730a3",
                  color: "#ffffff",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
                }}
              >
                <Moon size={15} />
                <span>Berikan Menu Berbeda Shift Malam</span>
              </button>

              {/* TOMBOL PEMBANTU: Samakan Menu Malam dari Pagi */}
              <button
                type="button"
                onClick={handleSyncNightWithMorning}
                className="btn btn-outline"
                title="Samakan seluruh komponen menu shift malam mengikuti shift pagi"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "12.5px",
                  padding: "8px 13px",
                  borderRadius: 8,
                }}
              >
                <RotateCcw size={14} />
                <span>Samakan Menu Malam dari Pagi</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCopyModalOpen(true)}
                className="btn btn-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "12.5px",
                  padding: "8px 13px",
                  borderRadius: 8,
                }}
              >
                <Copy size={14} />
                Salin Tanggal Lain
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ringkasan Hari dengan Menu Malam Berbeda */}
      {datesWithNightDiff.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(99, 102, 241, 0.08)",
            borderRadius: 8,
            border: "1px solid rgba(99, 102, 241, 0.25)",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#4338ca", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Moon size={14} />
            Tanggal dengan Menu Malam Berbeda ({datesWithNightDiff.length} hari):
          </span>
          {datesWithNightDiff.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => openDifferentNightMenuModal(d.dateStr)}
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                color: "#3730a3",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Tgl {d.day}</span>
              <span style={{ color: "#6b7280" }}>• Malam:</span>
              <span style={{ fontWeight: 700 }}>{d.sayurMalam}</span>
              <span>✏️</span>
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Calendar Grid */}
      <div
        className="card-surface"
        style={{
          borderRadius: 12,
          border: "1px solid var(--border-color)",
          background: "var(--card-bg, #ffffff)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ overflowX: "auto", minWidth: "100%" }}>
          <div style={{ minWidth: 1080 }}>
            {/* Days of Week Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                background: "var(--table-header-bg, #f8fafc)",
                borderBottom: "1px solid var(--border-color)",
                textAlign: "center",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {DAYS_HEADER.map((d, i) => (
                <div key={d} style={{ padding: "12px 8px", borderRight: i < 6 ? "1px solid var(--border-color)" : "none" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks Calendar Rows */}
            {calendarWeeks.map((week, weekIdx) => (
              <div
                key={`week_${weekIdx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  borderBottom: weekIdx < calendarWeeks.length - 1 ? "1px solid var(--border-color)" : "none",
                }}
              >
                {week.map((cell, dayIdx) => {
                  if (!cell.isCurrentMonth) {
                    return (
                      <div
                        key={`empty_${weekIdx}_${dayIdx}`}
                        style={{
                          background: "rgba(0, 0, 0, 0.02)",
                          borderRight: dayIdx < 6 ? "1px solid var(--border-color)" : "none",
                          minHeight: 180,
                        }}
                      />
                    );
                  }

                  const dateStr = cell.dateStr;
                  const isSunday = dayIdx === 6;

                  return (
                    <div
                      key={dateStr}
                      style={{
                        padding: "8px 10px",
                        borderRight: dayIdx < 6 ? "1px solid var(--border-color)" : "none",
                        background: isSunday ? "rgba(239, 68, 68, 0.02)" : "transparent",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {/* Day Number Header with Night Shift Diff Toggle */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "13px",
                            color: isSunday ? "#ef4444" : "var(--text-primary)",
                          }}
                        >
                          Tgl {cell.day}
                        </span>
                        {isEditable ? (
                          <button
                            type="button"
                            onClick={() => openDifferentNightMenuModal(dateStr)}
                            title={isDateNightDiff(dateStr) ? "Menu Shift Malam BERBEDA dari Shift Pagi (Klik untuk edit)" : "Berikan menu berbeda untuk shift malam pada tanggal ini (misal Sayur Kunci/Bayam)"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: isDateNightDiff(dateStr) ? "1px solid #6366f1" : "1px solid var(--border-color)",
                              background: isDateNightDiff(dateStr) ? "#eef2ff" : "rgba(0,0,0,0.03)",
                              color: isDateNightDiff(dateStr) ? "#4338ca" : "var(--text-secondary)",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Moon size={11} style={{ color: isDateNightDiff(dateStr) ? "#4f46e5" : "inherit" }} />
                            <span>{isDateNightDiff(dateStr) ? "Malam Beda" : "+ Beda Malam"}</span>
                          </button>
                        ) : isDateNightDiff(dateStr) ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "#eef2ff",
                              color: "#4338ca",
                              border: "1px solid #c7d2fe",
                            }}
                          >
                            <Moon size={10} />
                            Malam Beda
                          </span>
                        ) : (
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                            6 Komponen
                          </span>
                        )}
                      </div>

                      {/* 6 Component Item Inputs */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {[1, 2, 3, 4, 5, 6].map((order) => {
                          const key = `${dateStr}_${activeShift}_${order}`;
                          const val = menuItemsMap[key] || "";
                          const placeholder = COMPONENT_ROLES[order - 1];

                          return (
                            <div key={order} style={{ position: "relative" }}>
                              <input
                                type="text"
                                value={val}
                                readOnly={!isEditable}
                                disabled={!isEditable}
                                onChange={(e) => handleItemChange(dateStr, activeShift, order, e.target.value)}
                                placeholder={`${order}. ${placeholder}`}
                                title={`${placeholder}: ${val || "(Kosong)"}`}
                                style={{
                                  width: "100%",
                                  fontSize: "12px",
                                  padding: "5px 7px",
                                  borderRadius: 5,
                                  border: "1px solid var(--border-color)",
                                  background: !isEditable ? "rgba(0,0,0,0.02)" : "#ffffff",
                                  color: "var(--text-primary)",
                                  outline: "none",
                                  transition: "border-color 0.15s ease",
                                }}
                                className="input-cell"
                              />
                              {order === 4 && isPerishableMorningSayur(dateStr) && !isDateNightDiff(dateStr) && (
                                <div
                                  onClick={() => isEditable && openDifferentNightMenuModal(dateStr)}
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: "#b45309",
                                    background: "#fef3c7",
                                    padding: "2px 5px",
                                    borderRadius: 4,
                                    marginTop: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                    cursor: isEditable ? "pointer" : "default",
                                    lineHeight: 1.2,
                                  }}
                                  title="Sayur bayam/kunci tidak tahan lama untuk shift malam. Klik tombol '+ Beda Malam' untuk memberikan menu berbeda."
                                >
                                  <span>⚠️ Bayam/Kunci: Klik 'Beda Malam'</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Copy Modal Tool */}
      {isCopyModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card-surface"
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 14,
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
              background: "var(--card-bg, #ffffff)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Copy size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                  Salin Komponen Menu (Shift {activeShift})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="btn-icon"
                style={{ borderRadius: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Salin seluruh 6 slot komponen hidangan dari satu tanggal ke tanggal lain dalam rencana menu katering{" "}
                  <strong>{plan.catering_nama || "Semua Katering (PT JAI)"}</strong> ({activeShift}).
                </p>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: 5 }}>
                    Salin Dari Tanggal:
                  </label>
                  <IndoDatePicker
                    value={sourceCopyDate}
                    onChange={(e) => setSourceCopyDate(e.target.value)}
                    className="input-text"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: 5 }}>
                    Tempel ke Tanggal Tujuan:
                  </label>
                  <IndoDatePicker
                    value={targetCopyDate}
                    onChange={(e) => setTargetCopyDate(e.target.value)}
                    className="input-text"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border-color)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: "13px", padding: "6px 14px" }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeCopy}
                  className="btn btn-primary"
                  style={{
                    fontSize: "13px",
                    padding: "7px 16px",
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  Terapkan Salin Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Approval Confirmation Modal (Phase 4) */}
      {isSubmitModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card-surface"
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 14,
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
              background: "var(--card-bg, #ffffff)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Send size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Konfirmasi Pengajuan Approval
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="btn-icon"
                style={{ borderRadius: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                Anda akan mengajukan dokumen Rencana Menu Bulanan untuk katering{" "}
                <strong style={{ color: "var(--text-primary)" }}>{plan.catering_nama || "Semua Katering (PT JAI)"}</strong> periode{" "}
                <strong style={{ color: "var(--text-primary)" }}>{plan.effective_menu_period}</strong> (Versi {plan.version}).
              </p>

              <div
                style={{
                  background: "rgba(59, 130, 246, 0.06)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: "12.5px",
                  color: "var(--text-primary)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Info size={15} className="text-primary" />
                  Alur Persetujuan Resmi 3 Tahap PT JAI:
                </div>
                <div style={{ paddingLeft: 22, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  1. Tahap 1: <strong>Checked 1</strong><br />
                  2. Tahap 2: <strong>Checked 2</strong><br />
                  3. Tahap 3: <strong>Approved</strong>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: 4 }}>
                  * File Excel resmi dengan sheet E-Sign 3 kolom akan digenerate otomatis ke sistem approval CARMEN.
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  disabled={submittingApproval}
                  className="btn btn-ghost"
                  style={{ fontSize: "13px", padding: "7px 14px" }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitApproval}
                  disabled={submittingApproval}
                  className="btn btn-primary"
                  style={{
                    fontSize: "13px",
                    padding: "8px 18px",
                    borderRadius: 6,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {submittingApproval ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Ya, Ajukan Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Berikan Menu Berbeda Shift Malam */}
      {isDiffNightModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card-surface"
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: 14,
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              background: "var(--card-bg, #ffffff)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                color: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Moon size={20} style={{ color: "#fbbf24" }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                    Berikan Menu Berbeda untuk Shift Malam
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.75)" }}>
                    Khusus tanggal yang memiliki hidangan tidak tahan lama (misal Sayur Kunci atau Sayur Bayam)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDiffNightModalOpen(false)}
                className="btn-icon"
                style={{ color: "#ffffff", borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Alert Info Box */}
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                  color: "#92400e",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <AlertCircle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Pedoman Katering PT JAI:</strong> Pada dasarnya menu shift pagi dan shift malam adalah <strong>sama untuk seluruh katering</strong>. Namun hidangan sayur berkuah tertentu seperti <strong>Sayur Kunci</strong> atau <strong>Sayur Bayam</strong> berisiko rusak / basi jika dibiarkan hingga malam. Gunakan form ini untuk mengganti hidangan shift malam pada tanggal tersebut (misal menjadi Sayur Sop, Sayur Asem, atau Sayur Lodeh).
                </div>
              </div>

              {/* Tanggal Picker / Selector */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "12px 14px", background: "var(--content-bg, #f8fafc)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={16} className="text-primary" />
                  <label htmlFor="diff-date-select" style={{ fontSize: "13px", fontWeight: 700, margin: 0 }}>
                    Pilih Tanggal Berlaku:
                  </label>
                </div>
                <select
                  id="diff-date-select"
                  value={diffModalDate}
                  onChange={(e) => handleDiffDateChange(e.target.value)}
                  className="select-input"
                  style={{ minWidth: 260, height: 38, fontSize: "13px", fontWeight: 600 }}
                >
                  {calendarWeeks.flat().filter(c => c.isCurrentMonth).map(c => {
                    const dStr = c.dateStr;
                    const sayurPagi = menuItemsMap[`${dStr}_Pagi_4`] || "";
                    const isDiff = isDateNightDiff(dStr);
                    const isPerishable = isPerishableMorningSayur(dStr);
                    return (
                      <option key={dStr} value={dStr}>
                        Tgl {c.day} {sayurPagi ? `(${sayurPagi})` : ""}{isDiff ? " [🌙 Malam Beda]" : isPerishable ? " [⚠️ Perlu Beda]" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Side-by-Side: Pagi vs Malam */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Kolom Kiri: SHIFT PAGI (Referensi) */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "rgba(248, 250, 252, 0.8)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sun size={16} style={{ color: "#d97706" }} />
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>SHIFT PAGI (Referensi)</strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyMorningToModalNight}
                      className="btn btn-ghost"
                      style={{ fontSize: "11px", padding: "2px 6px" }}
                      title="Salin seluruh menu pagi ke kolom malam di sebelah kanan"
                    >
                      <Copy size={12} />
                      Salin ke Malam
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6].map((order) => {
                      const val = menuItemsMap[`${diffModalDate}_Pagi_${order}`] || "";
                      const label = COMPONENT_ROLES[order - 1];
                      const isBayamKunci = order === 4 && (val.toLowerCase().includes("bayam") || val.toLowerCase().includes("kunci"));

                      return (
                        <div key={order}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: 2 }}>
                            <span>{order}. {label}</span>
                            {isBayamKunci && (
                              <span style={{ color: "#d97706", fontWeight: 700, fontSize: "10px" }}>
                                ⚠️ Tidak tahan lama
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              padding: "6px 9px",
                              borderRadius: 5,
                              border: isBayamKunci ? "1px solid #f59e0b" : "1px solid var(--border-color)",
                              background: isBayamKunci ? "#fffbeb" : "#ffffff",
                              fontSize: "12px",
                              color: val ? "var(--text-primary)" : "var(--text-muted)",
                              fontWeight: isBayamKunci ? 700 : 500,
                            }}
                          >
                            {val || "(Belum diisi)"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Kolom Kanan: SHIFT MALAM (Kustomisasi Berbeda) */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 8,
                    border: "2px solid #6366f1",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Moon size={16} style={{ color: "#4f46e5" }} />
                      <strong style={{ fontSize: "13px", color: "#4338ca" }}>SHIFT MALAM (Menu Khusus)</strong>
                    </div>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "2px 6px", borderRadius: 4 }}>
                      Dapat Diedit
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6].map((order) => {
                      const val = diffModalNightItems[order] || "";
                      const label = COMPONENT_ROLES[order - 1];
                      const pagiVal = menuItemsMap[`${diffModalDate}_Pagi_${order}`] || "";
                      const isDiffFromPagi = val && pagiVal && val.trim() !== pagiVal.trim();

                      return (
                        <div key={order}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: 2 }}>
                            <span>{order}. {label}</span>
                            {isDiffFromPagi && (
                              <span style={{ color: "#4f46e5", fontWeight: 700, fontSize: "10px" }}>
                                ✨ Berbeda dari Pagi
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setDiffModalNightItems(prev => ({ ...prev, [order]: e.target.value }))}
                            placeholder={`${order}. ${label}`}
                            style={{
                              width: "100%",
                              fontSize: "12px",
                              padding: "6px 9px",
                              borderRadius: 5,
                              border: order === 4 ? "1.5px solid #6366f1" : "1px solid var(--border-color)",
                              outline: "none",
                              background: "#ffffff",
                              fontWeight: order === 4 ? 600 : 400,
                            }}
                          />
                          {/* Quick suggestions for Sayur / Kuah (order 4) */}
                          {order === 4 && (
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Saran:</span>
                              {["Sayur Sop Ayam", "Sayur Asem", "Sayur Lodeh", "Sayur Bening Labu Siam", "Soto Ayam"].map(sug => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => setDiffModalNightItems(prev => ({ ...prev, 4: sug }))}
                                  style={{
                                    fontSize: "10px",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid #c7d2fe",
                                    background: "#f5f3ff",
                                    color: "#4338ca",
                                    cursor: "pointer",
                                  }}
                                >
                                  + {sug}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--content-bg, #f8fafc)",
              }}
            >
              <div>
                {isDateNightDiff(diffModalDate) && (
                  <button
                    type="button"
                    onClick={handleResetNightToMatchPagi}
                    className="btn btn-outline"
                    style={{ fontSize: "12px", color: "#ef4444", borderColor: "#fca5a5" }}
                  >
                    <RotateCcw size={13} />
                    Reset Sama dengan Shift Pagi
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsDiffNightModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: "13px", padding: "6px 14px" }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveDiffNightModal}
                  className="btn btn-primary"
                  style={{
                    fontSize: "13px",
                    padding: "8px 18px",
                    borderRadius: 6,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                    borderColor: "#3730a3",
                  }}
                >
                  Terapkan Menu Malam Tanggal Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}