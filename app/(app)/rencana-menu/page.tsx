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
  Layers,
  History,
  Trash2,
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

export default function RencanaMenuPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MonthlyMenuPlanSummary[]>([]);
  const [caterings, setCaterings] = useState<Catering[]>([]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterCatering, setFilterCatering] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("2026");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
      const params: any = {};
      if (filterCatering !== "all") params.catering_id = Number(filterCatering);
      if (filterYear !== "all") params.effective_year = Number(filterYear);
      if (filterMonth !== "all") params.effective_month = Number(filterMonth);
      if (filterStatus !== "all") params.status = filterStatus;

      const data = await getMenuPlansApi(params);
      setPlans(data);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat daftar rencana menu", "error");
    } finally {
      setLoading(false);
    }
  }, [filterCatering, filterYear, filterMonth, filterStatus, showToast]);

  useEffect(() => {
    loadMenuPlans();
  }, [loadMenuPlans]);

  // Map catering metadata
  const cateringMap = useMemo(() => {
    const map = new Map<number, Catering>();
    caterings.forEach((c) => map.set(c.id, c));
    return map;
  }, [caterings]);

  // Client-side text search & filtered list
  const filteredPlans = useMemo(() => {
    if (!searchTerm.trim()) return plans;
    const q = searchTerm.toLowerCase().trim();
    return plans.filter((p) => {
      const catName = p.catering_nama?.toLowerCase() || "";
      const eff = p.effective_menu_period?.toLowerCase() || "";
      const sub = p.submission_period?.toLowerCase() || "";
      return catName.includes(q) || eff.includes(q) || sub.includes(q);
    });
  }, [plans, searchTerm]);

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
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">PT JAI / PERENCANAAN MENU</span>
          <h1 className="page-title">Perencanaan Menu Bulanan</h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: "13px" }}>
            Penyusunan jadwal menu makanan resmi per katering untuk bulan berikutnya, integrasi kalori, dan approval berjenjang.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                gap: 7,
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Buat Rencana Menu</span>
            </button>
          )}

          {/* HANYA 1 TOMBOL HISTORI DI HALAMAN INI */}
          <Link
            href="/rencana-menu/riwayat"
            className="btn btn-secondary"
            title="Buka halaman histori seluruh periode rencana menu"
            style={{
              padding: "9px 14px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <History size={15} />
            <span>Histori Perencanaan ({plans.length})</span>
          </Link>

          <HeaderMetaBoxes />
        </div>
      </div>

      {/* Metrics Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Rencana Menu */}
        <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}
            >
              TOTAL RENCANA MENU
            </span>
            <Layers size={18} style={{ color: "var(--red)" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Semua versi &amp; katering
          </div>
        </div>

        {/* Menu Aktif Saat Ini */}
        <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}
            >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}
            >
              MENUNGGU APPROVAL
            </span>
            <Clock size={18} style={{ color: "#d97706" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#d97706" }}>
            {metrics.pending}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Sedang dalam alur SPV / Manager
          </div>
        </div>

        {/* Draf / Perlu Revisi */}
        <div className="panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}
            >
              DRAF &amp; REVISI
            </span>
            <AlertCircle size={18} style={{ color: "#dc2626" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#dc2626" }}>
            {metrics.draftOrRevision}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Dapat diedit &amp; diajukan ulang
          </div>
        </div>
      </div>

      {/* Main Table Panel (SESUAI DENGAN SEMULA) */}
      <div className="panel" style={{ padding: 24 }}>
        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: "relative",
              minWidth: 260,
              flex: "1 1 280px",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Cari katering atau periode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{
                width: "100%",
                paddingLeft: 36,
                height: 40,
                fontSize: 13,
              }}
            />
          </div>

          {/* Quick Filters */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {/* Filter Katering */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                KATERING:
              </span>
              <select
                value={filterCatering}
                onChange={(e) => setFilterCatering(e.target.value)}
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
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                TAHUN:
              </span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="select-input"
                style={{ height: 38, fontSize: 12.5, minWidth: 95 }}
              >
                <option value="all">Semua</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            {/* Filter Bulan */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                BULAN:
              </span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
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
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                STATUS:
              </span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="select-input"
                style={{ height: 38, fontSize: 12.5, minWidth: 130 }}
              >
                <option value="all">Semua Status</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_APPROVAL">MENUNGGU APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUPERSEDED">SUPERSEDED</option>
                <option value="REVISION_REQUIRED">PERLU REVISI</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadMenuPlans()}
              className="btn btn-outline"
              title="Muat ulang data"
              style={{
                height: 38,
                padding: "0 12px",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 880,
              borderCollapse: "collapse",
              fontSize: 12.5,
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--sidebar-bg, #ffffff)",
                }}
              >
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                    width: 50,
                    textAlign: "center",
                  }}
                >
                  NO
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                  }}
                >
                  VENDOR KATERING
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                  }}
                >
                  PERIODE PENGAJUAN
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                  }}
                >
                  PERIODE BERLAKU
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                    textAlign: "center",
                    width: 70,
                  }}
                >
                  VERSI
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                    textAlign: "center",
                    width: 140,
                  }}
                >
                  STATUS
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                  }}
                >
                  TANGGAL DIBUAT
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    fontSize: 11.5,
                    letterSpacing: "0.04em",
                    color: "var(--text)",
                    textAlign: "right",
                    width: 190,
                  }}
                >
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "48px 20px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>Memuat daftar rencana menu...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "60px 20px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: 360,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          background: "rgba(148, 163, 184, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CalendarDays size={24} className="text-secondary" />
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--text)",
                        }}
                      >
                        Belum Ada Rencana Menu
                      </p>
                      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                        Tidak ada dokumen rencana menu yang cocok dengan kata kunci atau filter saat ini.
                      </p>
                      {canCreateOrEdit && (
                        <button
                          type="button"
                          onClick={() => setIsCreateOpen(true)}
                          className="btn btn-outline"
                          style={{ marginTop: 6, fontSize: 12 }}
                        >
                          <Plus size={14} />
                          <span>Buat Draf Pertama</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlans.map((p, idx) => {
                  const isEditable =
                    (p.status === "DRAFT" || p.status === "REVISION_REQUIRED") && canCreateOrEdit;
                  const canDeleteThis =
                    canCreateOrEdit && (isAdmin || p.status === "DRAFT" || p.status === "REVISION_REQUIRED");
                  const createdDate = new Date(p.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const cateringInfo = cateringMap.get(p.catering_id);

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      {/* No */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: 12,
                          fontWeight: 500,
                          verticalAlign: "middle",
                        }}
                      >
                        {idx + 1}
                      </td>

                      {/* Vendor Katering with Visual Shape Badge */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "left",
                          verticalAlign: "middle",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {cateringInfo ? (
                            <CateringShapeBadge
                              shape={cateringInfo.bentuk}
                              color={cateringInfo.warna}
                              size={18}
                            />
                          ) : (
                            <Building2 size={16} className="text-secondary" />
                          )}
                          <div>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "var(--text)",
                                fontSize: 13,
                              }}
                            >
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
                                AKTIF
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Periode Pengajuan */}
                      <td
                        style={{
                          padding: "11px 14px",
                          color: "var(--text-secondary)",
                          verticalAlign: "middle",
                        }}
                      >
                        {p.submission_period}
                      </td>

                      {/* Periode Berlaku */}
                      <td
                        style={{
                          padding: "11px 14px",
                          fontWeight: 600,
                          color: "var(--text)",
                          verticalAlign: "middle",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={13} style={{ color: "var(--red)" }} />
                          <span>{p.effective_menu_period}</span>
                        </div>
                      </td>

                      {/* Versi */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: "rgba(15, 39, 71, 0.06)",
                            fontWeight: 700,
                            fontSize: 11.5,
                            color: "var(--text)",
                          }}
                        >
                          v{p.version}
                        </span>
                      </td>

                      {/* Status */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {getStatusBadge(p.status, p.is_active)}
                      </td>

                      {/* Tanggal Dibuat */}
                      <td
                        style={{
                          padding: "11px 14px",
                          color: "var(--text-secondary)",
                          fontSize: 12,
                          verticalAlign: "middle",
                        }}
                      >
                        <div>{createdDate}</div>
                        {p.created_by_nama && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            oleh {p.created_by_nama}
                          </div>
                        )}
                      </td>

                      {/* Aksi: Approval, Unduh Excel, Aktifkan, Lihat/Edit, dan Hapus */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "right",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          {/* Tombol Akses Dokumen Approval */}
                          {p.approval_request_id && (
                            <Link
                              href={`/approval?id=${p.approval_request_id}`}
                              className="btn btn-outline"
                              title="Buka Dokumen Approval CARMEN"
                              style={{
                                height: 30,
                                padding: "0 8px",
                                fontSize: 11,
                                color: "#2563eb",
                                borderColor: "rgba(37, 99, 235, 0.3)",
                              }}
                            >
                              <ExternalLink size={12} />
                              <span>Approval</span>
                            </Link>
                          )}

                          {/* Tombol Unduh Excel */}
                          <button
                            type="button"
                            onClick={() => handleExport(p.id)}
                            className="btn btn-outline"
                            title="Unduh Berkas Excel Resmi (.xlsx)"
                            style={{
                              height: 30,
                              padding: "0 8px",
                              fontSize: 11,
                              color: "#166534",
                              borderColor: "#bbf7d0",
                              background: "#f0fdf4",
                            }}
                          >
                            <Download size={13} />
                          </button>

                          {/* Tombol Aktifkan (Khusus Admin bila APPROVED & belum ACTIVE) */}
                          {isAdmin && p.status === "APPROVED" && !p.is_active && (
                            <button
                              type="button"
                              onClick={() => handleActivate(p)}
                              className="btn"
                              style={{
                                height: 30,
                                padding: "0 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                background: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                              }}
                            >
                              <Power size={12} />
                              <span>Aktifkan</span>
                            </button>
                          )}

                          {/* Tombol Lihat / Edit */}
                          <Link
                            href={`/rencana-menu/${p.id}`}
                            className={isEditable ? "btn btn-solid" : "btn btn-outline"}
                            style={{
                              height: 30,
                              padding: "0 10px",
                              fontSize: 11.5,
                            }}
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

                          {/* Tombol Hapus Rencana Menu */}
                          {canDeleteThis && (
                            <button
                              type="button"
                              onClick={() => setDeletingPlan(p)}
                              className="btn btn-outline"
                              title="Hapus dokumen rencana menu ini"
                              style={{
                                height: 30,
                                padding: "0 8px",
                                fontSize: 11,
                                color: "#b91c1c",
                                borderColor: "#fecaca",
                                background: "#fef2f2",
                              }}
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
      </div>

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
