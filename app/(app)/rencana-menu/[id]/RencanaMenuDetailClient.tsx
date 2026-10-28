"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
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
  const planId = Number(params?.id);

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
    if (!planId || isNaN(planId)) return;
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

        // Simpan kedua shift (Pagi & Malam)
        for (const shift of ["Pagi", "Malam"] as const) {
          for (let order = 1; order <= 6; order++) {
            const key = `${dateStr}_${shift}_${order}`;
            const val = menuItemsMap[key]?.trim();
            if (val) {
              itemsPayload.push({
                menu_date: dateStr,
                shift: shift,
                item_order: order,
                item_role: COMPONENT_ROLES[order - 1],
                menu_name: val,
              });
            }
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
              {plan.catering_nama}
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                (Versi {plan.version})
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
              Periode Menu Berlaku: <strong style={{ color: "var(--text-primary)" }}>{plan.effective_menu_period}</strong> | Pengajuan: {plan.submission_period}
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

        {/* Copy Date Tool */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isEditable && (
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(true)}
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
              <Copy size={14} />
              Salin Menu Tanggal Lain
            </button>
          )}
        </div>
      </div>

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
                      {/* Day Number Header */}
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
                        <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                          6 Komponen
                        </span>
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
                  <strong>{plan.catering_nama}</strong> ({activeShift}).
                </p>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: 5 }}>
                    Salin Dari Tanggal:
                  </label>
                  <input
                    type="date"
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
                  <input
                    type="date"
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
                <strong style={{ color: "var(--text-primary)" }}>{plan.catering_nama}</strong> periode{" "}
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
                  1. Tahap 1: <strong>Checked 1</strong> (Staff Catering)<br />
                  2. Tahap 2: <strong>Checked 2</strong> (Supervisor GA / IR)<br />
                  3. Tahap 3: <strong>Approved</strong> (Manager / Dept Head)
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
    </div>
  );
}
