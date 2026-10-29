"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit3,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FileCheck2,
  X,
  Download,
  Power,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Layers,
  History,
  Trash2,
  Lock,
} from "lucide-react";
import {
  Catering,
  getCatering,
  MonthlyMenuPlanSummary,
  getMenuPlansApi,
  createMenuPlanApi,
  activateMenuPlanApi,
  exportMenuPlanExcelApi,
  deleteMenuPlanApi,
  MenuPlanCreatePayload,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import CateringShapeBadge from "@/components/CateringShapeBadge";

const BULAN_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

interface RencanaMenuViewProps {
  initialTab?: "overview" | "riwayat";
}

export default function RencanaMenuView({ initialTab = "overview" }: RencanaMenuViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "riwayat">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MonthlyMenuPlanSummary[]>([]);
  const [caterings, setCaterings] = useState<Catering[]>([]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterCatering, setFilterCatering] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination for Riwayat Table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingPlan, setDeletingPlan] = useState<MonthlyMenuPlanSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form Fields for Create
  const [selectedCateringId, setSelectedCateringId] = useState<number | "">("");
  const [effectiveYear, setEffectiveYear] = useState<number>(2026);
  const [effectiveMonth, setEffectiveMonth] = useState<number>(() => {
    const today = new Date();
    return today.getMonth() === 11 ? 1 : today.getMonth() + 2;
  });
  const [catatan, setCatatan] = useState("");

  const role = user?.role?.toLowerCase() || "";
  const canCreateOrEdit = role === "admin" || role === "staff";
  const isAdmin = role === "admin";

  // Hitung periode pengajuan berdasarkan waktu saat ini
  const submissionPeriodLabel = useMemo(() => {
    const now = new Date();
    const m = BULAN_NAMES[now.getMonth()];
    const y = now.getFullYear();
    return `${m} ${y}`;
  }, []);

  // Hitung nama periode menu berlaku
  const effectivePeriodLabel = useMemo(() => {
    const m = BULAN_NAMES[effectiveMonth - 1] || "";
    return `${m} ${effectiveYear}`;
  }, [effectiveMonth, effectiveYear]);

  // Load Katering List
  useEffect(() => {
    let isMounted = true;
    async function loadCateringList() {
      try {
        const data = await getCatering();
        if (isMounted) {
          const activeOnly = data.filter((c) => c.is_active !== false);
          setCaterings(activeOnly);
          if (activeOnly.length > 0 && selectedCateringId === "") {
            setSelectedCateringId(activeOnly[0].id);
          }
        }
      } catch (err) {
        console.error("Gagal memuat katering:", err);
      }
    }
    loadCateringList();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Menu Plans
  const loadMenuPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMenuPlansApi({});
      setPlans(data);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat daftar rencana menu", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMenuPlans();
  }, [loadMenuPlans]);

  // Map catering metadata
  const cateringMap = useMemo(() => {
    const map = new Map<number, Catering>();
    caterings.forEach((c) => map.set(c.id, c));
    return map;
  }, [caterings]);

  // Available Years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(2025);
    years.add(2026);
    years.add(2027);
    plans.forEach((p) => {
      if (p.effective_year) years.add(p.effective_year);
    });
    return Array.from(years).sort().reverse();
  }, [plans]);

  // Client-side text search & filtered list
  const filteredPlans = useMemo(() => {
    let result = plans;

    if (filterCatering !== "all") {
      result = result.filter((p) => p.catering_id === Number(filterCatering));
    }

    if (filterYear !== "all") {
      result = result.filter((p) => p.effective_year === Number(filterYear));
    }

    if (filterMonth !== "all") {
      result = result.filter((p) => p.effective_month === Number(filterMonth));
    }

    if (filterStatus !== "all") {
      if (filterStatus === "ACTIVE") {
        result = result.filter((p) => p.is_active);
      } else {
        result = result.filter((p) => p.status === filterStatus);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((p) => {
        const catName = p.catering_nama?.toLowerCase() || "";
        const eff = p.effective_menu_period?.toLowerCase() || "";
        const sub = p.submission_period?.toLowerCase() || "";
        const note = p.catatan?.toLowerCase() || "";
        return catName.includes(q) || eff.includes(q) || sub.includes(q) || note.includes(q);
      });
    }

    return result;
  }, [plans, filterCatering, filterYear, filterMonth, filterStatus, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPlans.length / pageSize) || 1;
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlans.slice(start, start + pageSize);
  }, [filteredPlans, currentPage, pageSize]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.is_active).length;
    const pending = plans.filter((p) => p.status === "PENDING_APPROVAL").length;
    const draftOrRevision = plans.filter(
      (p) => p.status === "DRAFT" || p.status === "REVISION_REQUIRED"
    ).length;
    return { total, active, pending, draftOrRevision };
  }, [plans]);

  // Handle Create Draft
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCateringId) {
      showToast("Pilih vendor katering terlebih dahulu.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: MenuPlanCreatePayload = {
        catering_id: Number(selectedCateringId),
        submission_period: submissionPeriodLabel,
        effective_menu_period: effectivePeriodLabel,
        effective_year: Number(effectiveYear),
        effective_month: Number(effectiveMonth),
        catatan: catatan.trim() || undefined,
      };

      const created = await createMenuPlanApi(payload);
      showToast(
        `Draf Rencana Menu ${created.catering_nama} (v${created.version}) berhasil dibuat.`,
        "success"
      );
      setIsCreateOpen(false);
      setCatatan("");
      loadMenuPlans();
    } catch (err: any) {
      showToast(err.message || "Gagal membuat draf rencana menu.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (plan: MonthlyMenuPlanSummary) => {
    if (
      !window.confirm(
        `Aktifkan Rencana Menu ${plan.catering_nama} versi ${plan.version} untuk periode ${plan.effective_menu_period}? Versi aktif sebelumnya akan dinonaktifkan.`
      )
    ) {
      return;
    }
    try {
      await activateMenuPlanApi(plan.id);
      showToast(
        `Rencana Menu ${plan.catering_nama} (v${plan.version}) berhasil diaktifkan.`,
        "success"
      );
      loadMenuPlans();
    } catch (err: any) {
      showToast(err.message || "Gagal mengaktifkan rencana menu.", "error");
    }
  };

  const handleExport = async (planId: number) => {
    try {
      const { blob, filename } = await exportMenuPlanExcelApi(planId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast("Berkas Excel Rencana Menu berhasil diunduh.", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal mengunduh berkas Excel.", "error");
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    setIsDeleting(true);
    try {
      const res = await deleteMenuPlanApi(deletingPlan.id);
      showToast(res.message || "Rencana menu berhasil dihapus.", "success");
      setDeletingPlan(null);
      loadMenuPlans();
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus rencana menu.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterCatering("all");
    setFilterYear("all");
    setFilterMonth("all");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (isActive) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: "11.5px",
            fontWeight: 700,
            background: "rgba(22, 163, 74, 0.12)",
            color: "#16a34a",
            border: "1px solid rgba(22, 163, 74, 0.3)",
          }}
        >
          <CheckCircle2 size={13} />
          ACTIVE
        </span>
      );
    }

    switch (status) {
      case "DRAFT":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 600,
              background: "rgba(100, 116, 139, 0.1)",
              color: "var(--text-secondary)",
              border: "1px solid rgba(100, 116, 139, 0.25)",
            }}
          >
            <Clock size={13} />
            DRAFT
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 700,
              background: "rgba(217, 119, 6, 0.12)",
              color: "#d97706",
              border: "1px solid rgba(217, 119, 6, 0.3)",
            }}
          >
            <Clock size={13} />
            MENUNGGU APPROVAL
          </span>
        );
      case "APPROVED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 700,
              background: "rgba(37, 99, 235, 0.12)",
              color: "#2563eb",
              border: "1px solid rgba(37, 99, 235, 0.3)",
            }}
          >
            <FileCheck2 size={13} />
            APPROVED
          </span>
        );
      case "SUPERSEDED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 500,
              background: "rgba(100, 116, 139, 0.1)",
              color: "#64748b",
              border: "1px solid rgba(100, 116, 139, 0.2)",
            }}
          >
            TERGANTIKAN (v)
          </span>
        );
      case "REVISION_REQUIRED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 700,
              background: "rgba(220, 38, 38, 0.12)",
              color: "#dc2626",
              border: "1px solid rgba(220, 38, 38, 0.3)",
            }}
          >
            <AlertCircle size={13} />
            PERLU REVISI
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              fontSize: "11.5px",
              background: "rgba(148, 163, 184, 0.1)",
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow">PT JAI / PERENCANAAN MENU</span>
          <h1 className="page-title">Perencanaan Menu Bulanan</h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "13px" }}>
            Penyusunan jadwal menu makanan resmi per katering untuk bulan berikutnya, integrasi kalori, dan approval berjenjang.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {canCreateOrEdit && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-solid"
              style={{
                padding: "9px 16px",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Buat Rencana Menu</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab("riwayat");
              if (typeof window !== "undefined") {
                window.history.replaceState(null, "", "/rencana-menu/riwayat");
              }
            }}
            className="btn btn-secondary"
            title="Buka riwayat arsip rencana menu"
            style={{
              padding: "9px 14px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <History size={15} />
            <span>Riwayat Perencanaan ({plans.length})</span>
          </button>

          <HeaderMetaBoxes />
        </div>
      </div>

      {/* Tab Navigation: Identik dengan Komplain & Reward Punishment */}
      <div
        role="tablist"
        aria-label="Navigasi Perencanaan Menu"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border, #e2e8f0)",
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-overview-menu"
          aria-controls="panel-overview-menu"
          aria-selected={activeTab === "overview"}
          onClick={() => {
            setActiveTab("overview");
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/rencana-menu");
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: activeTab === "overview" ? 700 : 600,
            color: activeTab === "overview" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
            backgroundColor: activeTab === "overview" ? "rgba(143, 26, 37, 0.05)" : "transparent",
            border: "none",
            borderBottom:
              activeTab === "overview"
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
          <CalendarDays size={16} strokeWidth={activeTab === "overview" ? 2.3 : 1.8} />
          <span>Menu Aktif &amp; Berjalan</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-riwayat-menu"
          aria-controls="panel-riwayat-menu"
          aria-selected={activeTab === "riwayat"}
          onClick={() => {
            setActiveTab("riwayat");
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/rencana-menu/riwayat");
            }
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
          <span>Riwayat Perencanaan</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 9999,
              backgroundColor: activeTab === "riwayat" ? "var(--red, #b3212f)" : "#e2e8f0",
              color: activeTab === "riwayat" ? "#ffffff" : "#475569",
              marginLeft: 4,
            }}
          >
            {plans.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MENU AKTIF & RINGKASAN */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div id="panel-overview-menu" role="tabpanel" aria-labelledby="tab-overview-menu" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* KPI Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {/* Total Rencana Menu */}
            <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  TOTAL DOKUMEN MENU
                </span>
                <Layers size={18} style={{ color: "var(--red)" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
                {metrics.total}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Tercatat di seluruh katering
              </div>
            </div>

            {/* Menu Aktif Saat Ini */}
            <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  MENU AKTIF (BERLAKU)
                </span>
                <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>
                {metrics.active}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Rujukan otomatis kalori harian
              </div>
            </div>

            {/* Menunggu Approval */}
            <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  MENUNGGU APPROVAL
                </span>
                <Clock size={18} style={{ color: "#d97706" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#d97706" }}>
                {metrics.pending}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Dalam alur verifikasi &amp; pengesahan
              </div>
            </div>

            {/* Draf / Perlu Revisi */}
            <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                  DRAF &amp; REVISI
                </span>
                <AlertCircle size={18} style={{ color: "#dc2626" }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#dc2626" }}>
                {metrics.draftOrRevision}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Dapat diedit &amp; disesuaikan
              </div>
            </div>
          </div>

          {/* Quick Active Cards per Catering */}
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                  Status Rencana Menu Aktif per Vendor Katering
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
                  Rencana menu yang sedang aktif menjadi sumber pengisian menu otomatis pada input kalori harian.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("riwayat");
                  if (typeof window !== "undefined") {
                    window.history.replaceState(null, "", "/rencana-menu/riwayat");
                  }
                }}
                className="btn btn-outline"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span>Buka Riwayat Seluruh Arsip</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {caterings.map((c) => {
                const activePlan = plans.find((p) => p.catering_id === c.id && p.is_active);
                const latestDraft = plans.find((p) => p.catering_id === c.id && (p.status === "DRAFT" || p.status === "REVISION_REQUIRED"));
                const pendingPlan = plans.find((p) => p.catering_id === c.id && p.status === "PENDING_APPROVAL");

                return (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: 8,
                      padding: 18,
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 14,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <CateringShapeBadge shape={c.bentuk} color={c.warna} size={20} />
                          <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>{c.nama}</span>
                        </div>
                        {c.reward_punishment_group && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "#f1f5f9",
                              color: "#475569",
                            }}
                          >
                            Grup {c.reward_punishment_group}
                          </span>
                        )}
                      </div>

                      {/* Active Status */}
                      <div style={{ padding: "12px", background: activePlan ? "rgba(22, 163, 74, 0.05)" : "#f8fafc", borderRadius: 6, border: `1px solid ${activePlan ? "rgba(22, 163, 74, 0.2)" : "#e2e8f0"}`, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>MENU BERLAKU AKTIF:</span>
                          {activePlan ? getStatusBadge("ACTIVE", true) : <span style={{ fontSize: 11, color: "#94a3b8" }}>Belum Ada</span>}
                        </div>
                        {activePlan ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                              {activePlan.effective_menu_period} (v{activePlan.version})
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <Link href={`/rencana-menu/${activePlan.id}`} className="btn btn-outline" style={{ height: 28, fontSize: 11, padding: "0 8px" }}>
                                <Eye size={12} />
                                <span>Lihat</span>
                              </Link>
                              <button type="button" onClick={() => handleExport(activePlan.id)} className="btn btn-outline" style={{ height: 28, fontSize: 11, padding: "0 8px" }} title="Unduh Excel">
                                <Download size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Belum ada rencana menu yang diaktifkan untuk vendor ini.</p>
                        )}
                      </div>

                      {/* Pending or Draft info */}
                      {pendingPlan && (
                        <div style={{ fontSize: 12, color: "#d97706", display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#fffbeb", borderRadius: 4, marginBottom: 6 }}>
                          <Clock size={13} />
                          <span>Versi {pendingPlan.version} ({pendingPlan.effective_menu_period}) sedang menunggu approval.</span>
                        </div>
                      )}

                      {latestDraft && (
                        <div style={{ fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#fef2f2", borderRadius: 4 }}>
                          <Edit3 size={13} />
                          <span>Draf v{latestDraft.version} ({latestDraft.effective_menu_period}) siap diedit.</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                      {canCreateOrEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCateringId(c.id);
                            setIsCreateOpen(true);
                          }}
                          className="btn btn-outline"
                          style={{ flex: 1, fontSize: 12, height: 32 }}
                        >
                          <Plus size={13} />
                          <span>Buat Draf Menu</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterCatering(String(c.id));
                          setActiveTab("riwayat");
                          if (typeof window !== "undefined") {
                            window.history.replaceState(null, "", "/rencana-menu/riwayat");
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, height: 32 }}
                      >
                        <span>Lihat Arsip ({plans.filter((p) => p.catering_id === c.id).length})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT PERENCANAAN MENU LENGKAP */}
      {/* ========================================================================= */}
      {activeTab === "riwayat" && (
        <div id="panel-riwayat-menu" role="tabpanel" aria-labelledby="tab-riwayat-menu" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Summary Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div className="panel" style={{ padding: "16px 18px", marginBottom: 0, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <History size={20} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>TOTAL DOKUMEN TERCATAT</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{metrics.total}</div>
              </div>
            </div>

            <div className="panel" style={{ padding: "16px 18px", marginBottom: 0, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(22, 163, 74, 0.1)", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>MENU AKTIF</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{metrics.active}</div>
              </div>
            </div>

            <div className="panel" style={{ padding: "16px 18px", marginBottom: 0, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(217, 119, 6, 0.1)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>MENUNGGU APPROVAL</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{metrics.pending}</div>
              </div>
            </div>

            <div className="panel" style={{ padding: "16px 18px", marginBottom: 0, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Edit3 size={20} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>DRAF &amp; PERLU REVISI</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{metrics.draftOrRevision}</div>
              </div>
            </div>
          </div>

          {/* Filter & Action Card */}
          <div className="panel" style={{ padding: 18, marginBottom: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 240px", minWidth: 220 }}>
                <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Cari katering, periode, atau catatan..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input-field"
                  style={{ width: "100%", height: 38, paddingLeft: 34, fontSize: 13 }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    title="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Katering */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Katering:</span>
                <select
                  value={filterCatering}
                  onChange={(e) => {
                    setFilterCatering(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select-input"
                  style={{ height: 38, fontSize: 12.5, minWidth: 140 }}
                >
                  <option value="all">Semua Katering</option>
                  {caterings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tahun */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Tahun:</span>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select-input"
                  style={{ height: 38, fontSize: 12.5, minWidth: 95 }}
                >
                  <option value="all">Semua</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Bulan */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Bulan:</span>
                <select
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select-input"
                  style={{ height: 38, fontSize: 12.5, minWidth: 110 }}
                >
                  <option value="all">Semua Bulan</option>
                  {BULAN_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select-input"
                  style={{ height: 38, fontSize: 12.5, minWidth: 130 }}
                >
                  <option value="all">Semua Status</option>
                  <option value="ACTIVE">ACTIVE (Aktif)</option>
                  <option value="APPROVED">APPROVED (Disetujui)</option>
                  <option value="PENDING_APPROVAL">MENUNGGU APPROVAL</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="REVISION_REQUIRED">PERLU REVISI</option>
                  <option value="SUPERSEDED">TERGANTIKAN</option>
                </select>
              </div>

              {/* Reset filter */}
              {(searchTerm || filterCatering !== "all" || filterYear !== "all" || filterMonth !== "all" || filterStatus !== "all") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-secondary"
                  style={{ height: 38, fontSize: 12.5, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  title="Reset seluruh filter"
                >
                  <RefreshCw size={13} />
                  <span>Reset</span>
                </button>
              )}

              {/* Buat Menu Baru */}
              {canCreateOrEdit && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="btn btn-solid"
                  style={{ height: 38, fontSize: 12.5, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
                >
                  <Plus size={15} />
                  <span>Buat Rencana Menu</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ width: 44, textAlign: "center", padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>NO</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>VENDOR KATERING</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>PERIODE PENGAJUAN</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>PERIODE BERLAKU</th>
                    <th style={{ width: 75, textAlign: "center", padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>VERSI</th>
                    <th style={{ width: 140, textAlign: "center", padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>STATUS</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>TANGGAL DIBUAT</th>
                    <th style={{ width: 220, textAlign: "right", padding: "12px 16px", fontWeight: 700, fontSize: 11.5, color: "#475569", textTransform: "uppercase" }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <RefreshCw size={24} className="animate-spin text-primary" />
                          <span>Memuat riwayat rencana menu...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPlans.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "54px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                        <div style={{ maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <History size={36} style={{ color: "#cbd5e1" }} />
                          <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>Tidak ada riwayat rencana menu yang sesuai</h4>
                          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                            {searchTerm || filterCatering !== "all" || filterYear !== "all" || filterMonth !== "all" || filterStatus !== "all"
                              ? "Coba ubah kata kunci pencarian atau reset filter untuk menampilkan kembali data."
                              : "Belum ada dokumen rencana menu yang tersimpan di sistem."}
                          </p>
                          {(searchTerm || filterCatering !== "all" || filterYear !== "all" || filterMonth !== "all" || filterStatus !== "all") && (
                            <button type="button" onClick={handleResetFilters} className="btn btn-secondary" style={{ marginTop: 6, fontSize: 12 }}>
                              Reset Seluruh Filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPlans.map((p, idx) => {
                      const isEditable = (p.status === "DRAFT" || p.status === "REVISION_REQUIRED") && canCreateOrEdit;
                      const canDeleteThis = canCreateOrEdit && (isAdmin || p.status === "DRAFT" || p.status === "REVISION_REQUIRED");
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const cateringInfo = cateringMap.get(p.catering_id);
                      const createdDate = new Date(p.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            backgroundColor: p.is_active ? "rgba(22, 163, 74, 0.03)" : "transparent",
                            transition: "background-color 0.12s ease",
                          }}
                        >
                          <td style={{ textAlign: "center", color: "#64748b", fontWeight: 600, padding: "12px 14px", verticalAlign: "middle" }}>
                            {rowNum}
                          </td>

                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {cateringInfo ? (
                                <CateringShapeBadge shape={cateringInfo.bentuk} color={cateringInfo.warna} size={18} />
                              ) : (
                                <Building2 size={16} className="text-secondary" />
                              )}
                              <div>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>
                                  {p.catering_nama || `Katering ID ${p.catering_id}`}
                                </span>
                                {cateringInfo?.reward_punishment_group && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      marginLeft: 6,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      background: "rgba(15, 39, 71, 0.08)",
                                      color: "var(--text-secondary)",
                                    }}
                                  >
                                    Grup {cateringInfo.reward_punishment_group}
                                  </span>
                                )}
                                {p.is_active && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      marginLeft: 6,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      background: "rgba(22, 163, 74, 0.12)",
                                      color: "#16a34a",
                                      border: "1px solid rgba(22, 163, 74, 0.3)",
                                    }}
                                  >
                                    SEDANG AKTIF
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "12px 14px", color: "var(--text-secondary)", verticalAlign: "middle" }}>
                            {p.submission_period}
                          </td>

                          <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text)", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Calendar size={13} style={{ color: "var(--red-dark, #8f1a25)" }} />
                              <span>{p.effective_menu_period}</span>
                            </div>
                          </td>

                          <td style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "#f1f5f9",
                                fontWeight: 700,
                                fontSize: 11.5,
                                color: "#0f172a",
                              }}
                            >
                              v{p.version}
                            </span>
                          </td>

                          <td style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            {getStatusBadge(p.status, p.is_active)}
                          </td>

                          <td style={{ padding: "12px 14px", color: "var(--text-secondary)", fontSize: 12, verticalAlign: "middle" }}>
                            <div>{createdDate}</div>
                            {p.created_by_nama && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                oleh {p.created_by_nama}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                              {/* Lihat / Edit */}
                              <Link
                                href={`/rencana-menu/${p.id}`}
                                className={isEditable ? "btn btn-solid" : "btn btn-outline"}
                                style={{ height: 30, padding: "0 10px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}
                                title={isEditable ? "Edit jadwal komponen menu" : "Lihat rincian rencana menu"}
                              >
                                {isEditable ? (
                                  <>
                                    <Edit3 size={12} />
                                    <span>Edit</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye size={12} />
                                    <span>Lihat</span>
                                  </>
                                )}
                              </Link>

                              {/* Unduh Excel */}
                              <button
                                type="button"
                                onClick={() => handleExport(p.id)}
                                className="btn btn-outline"
                                title="Unduh Berkas Excel Resmi (.xlsx)"
                                style={{ height: 30, padding: "0 8px", fontSize: 11, color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4" }}
                              >
                                <Download size={13} />
                              </button>

                              {/* Approval link jika ada */}
                              {p.approval_request_id && (
                                <Link
                                  href={`/approval?id=${p.approval_request_id}`}
                                  className="btn btn-outline"
                                  title="Buka Dokumen Approval CARMEN"
                                  style={{ height: 30, padding: "0 8px", fontSize: 11, color: "#2563eb", borderColor: "rgba(37, 99, 235, 0.3)" }}
                                >
                                  <ExternalLink size={12} />
                                </Link>
                              )}

                              {/* Aktifkan (Khusus Admin bila APPROVED & belum ACTIVE) */}
                              {isAdmin && p.status === "APPROVED" && !p.is_active && (
                                <button
                                  type="button"
                                  onClick={() => handleActivate(p)}
                                  className="btn"
                                  style={{ height: 30, padding: "0 8px", fontSize: 11, fontWeight: 700, background: "#16a34a", color: "#ffffff", border: "none" }}
                                  title="Aktifkan rencana menu ini"
                                >
                                  <Power size={12} />
                                </button>
                              )}

                              {/* Hapus Rencana Menu */}
                              {canDeleteThis && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingPlan(p)}
                                  className="btn btn-outline"
                                  title="Hapus dokumen rencana menu ini"
                                  style={{ height: 30, padding: "0 8px", fontSize: 11, color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                                >
                                  <Trash2 size={13} />
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
            </div>

            {/* Pagination Footer */}
            {filteredPlans.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: 12.5, color: "#64748b" }}>
                  Menampilkan <strong>{paginatedPlans.length}</strong> dari <strong>{filteredPlans.length}</strong> dokumen
                  {filteredPlans.length !== plans.length && ` (disaring dari total ${plans.length} dokumen)`}
                </div>

                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="btn-page-nav"
                      style={{
                        height: 32,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        borderRadius: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#475569",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        opacity: currentPage === 1 ? 0.45 : 1,
                      }}
                    >
                      Sebelumnya
                    </button>

                    <div style={{ display: "flex", gap: 4 }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          style={{
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: pg === currentPage ? "1px solid var(--red-dark, #8f1a25)" : "1px solid #e2e8f0",
                            background: pg === currentPage ? "var(--red-dark, #8f1a25)" : "#fff",
                            color: pg === currentPage ? "#fff" : "#475569",
                            borderRadius: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {pg}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="btn-page-nav"
                      style={{
                        height: 32,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        borderRadius: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#475569",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        opacity: currentPage === totalPages ? 0.45 : 1,
                      }}
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Buat Rencana Menu */}
      {isCreateOpen && (
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
            className="panel"
            style={{
              width: "100%",
              maxWidth: 500,
              borderRadius: "var(--radius)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
              marginBottom: 0,
            }}
          >
            {/* Modal Header */}
            <div className="panel-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CalendarDays size={18} style={{ color: "var(--red)" }} />
                <span>Buat Draf Rencana Menu Bulanan</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="hamburger-btn"
                style={{ display: "inline-flex", width: 28, height: 28 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="panel-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Vendor Katering */}
                <div>
                  <label htmlFor="modal-catering-select">
                    Vendor Katering <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <select
                    id="modal-catering-select"
                    value={selectedCateringId}
                    onChange={(e) => setSelectedCateringId(Number(e.target.value))}
                    required
                    className="select-input"
                    style={{ width: "100%", height: 42, fontSize: 13 }}
                  >
                    <option value="" disabled>
                      -- Pilih Vendor Katering --
                    </option>
                    {caterings.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama} {c.reward_punishment_group ? `(Grup ${c.reward_punishment_group})` : ""}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
                    Menu bersifat spesifik per katering (Akbar dan Alvia independen).
                  </p>
                </div>

                {/* Periode Pengajuan (Auto/Computed) */}
                <div
                  style={{
                    background: "var(--content-bg)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "block" }}>
                    PERIODE PENGAJUAN:
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                    {submissionPeriodLabel}
                  </span>
                </div>

                {/* Periode Menu Berlaku */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label htmlFor="modal-month-select">
                      Bulan Berlaku <span style={{ color: "var(--red)" }}>*</span>
                    </label>
                    <select
                      id="modal-month-select"
                      value={effectiveMonth}
                      onChange={(e) => setEffectiveMonth(Number(e.target.value))}
                      className="select-input"
                      style={{ width: "100%", height: 42, fontSize: 13 }}
                    >
                      {BULAN_NAMES.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="modal-year-select">
                      Tahun Berlaku <span style={{ color: "var(--red)" }}>*</span>
                    </label>
                    <select
                      id="modal-year-select"
                      value={effectiveYear}
                      onChange={(e) => setEffectiveYear(Number(e.target.value))}
                      className="select-input"
                      style={{ width: "100%", height: 42, fontSize: 13 }}
                    >
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </select>
                  </div>
                </div>

                {/* Ringkasan Periode Target */}
                <div
                  style={{
                    background: "rgba(37, 99, 235, 0.06)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Calendar size={18} style={{ color: "#2563eb" }} />
                  <div>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "block" }}>
                      Target Menu Berlaku:
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
                      {effectivePeriodLabel}
                    </span>
                  </div>
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label htmlFor="modal-catatan">Catatan (Opsional)</label>
                  <textarea
                    id="modal-catatan"
                    rows={2}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Contoh: Perubahan menu lauk sayur khusus shift malam..."
                    className="input-field"
                    style={{ width: "100%", fontSize: 12.5, resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
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
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="btn btn-outline"
                  style={{ fontSize: 12 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-solid"
                  style={{ fontSize: 12 }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Membuat Draf...</span>
                    </>
                  ) : (
                    "Buat Draf Sekarang"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Rencana Menu */}
      {deletingPlan && (
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
            className="panel"
            style={{
              width: "100%",
              maxWidth: 460,
              borderRadius: "var(--radius)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              marginBottom: 0,
            }}
          >
            <div className="panel-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Trash2 size={18} style={{ color: "var(--red, #ef4444)" }} />
                <span>Konfirmasi Hapus Rencana Menu</span>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDeletingPlan(null)}
                className="hamburger-btn"
                style={{ display: "inline-flex", width: 28, height: 28 }}
                disabled={isDeleting}
              >
                <X size={16} />
              </button>
            </div>

            <div className="panel-body">
              <p style={{ margin: "0 0 14px 0", fontSize: 13.5, color: "#0f172a", lineHeight: 1.5 }}>
                Apakah Anda yakin ingin menghapus dokumen rencana menu berikut?
              </p>

              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: "#991b1b", marginBottom: 4 }}>
                  {deletingPlan.catering_nama} (v{deletingPlan.version})
                </div>
                <div style={{ fontSize: 12.5, color: "#7f1d1d" }}>
                  Periode Berlaku: <strong>{deletingPlan.effective_menu_period}</strong>
                </div>
                <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                  Status Dokumen: <strong>{deletingPlan.status}</strong>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                Seluruh rincian item menu untuk shift pagi dan malam pada dokumen ini akan dihapus permanen dari sistem.
              </p>

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
                  onClick={() => setDeletingPlan(null)}
                  disabled={isDeleting}
                  className="btn btn-outline"
                  style={{ fontSize: 12 }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  disabled={isDeleting}
                  className="btn"
                  style={{
                    fontSize: 12,
                    background: "var(--red, #b3212f)",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    padding: "8px 16px",
                  }}
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    "Ya, Hapus Rencana Menu"
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
