"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  PlusCircle,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Filter,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Play,
  Camera,
  FileText,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  Catering,
  getCatering,
  getAuditKriteria,
  AuditEntryItemResponse,
  AuditKriteriaItem,
  getUnifiedAuditEntries,
  getUnifiedAuditEntryDetail,
  deleteAuditEntry,
  deleteAuditEntryV1,
  getAuditFindingPhotoUrl,
} from "@/lib/api";
import { generateAuditExcelBuffer, formatDateID } from "@/lib/exportExcelAudit";
import { downloadExcelBuffer } from "@/lib/exportExcelKelayakan";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import AuditSubnav from "@/components/AuditSubnav";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { formatNumberID } from "@/lib/formatters";
import { getAuditStatusInfo, getAuditTypeInfo, formatDisplayDate } from "@/lib/audit";
import ProtectedImage from "@/components/ProtectedImage";

function CenteredSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: number | string;
  options: { value: number | string; label: string }[];
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder || "Pilih...";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        className="select-input"
        style={{
          width: "100%",
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 30px",
          textAlign: "center",
          fontWeight: 600,
          color: value === "" ? "var(--text-muted)" : "var(--text)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {displayLabel}
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      >
        {placeholder && !options.some((o) => o.value === "" || o.label === placeholder) && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}



function getPaginationRange(current: number, total: number): (number | string)[] {
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

export default function RiwayatAuditPage() {
  const router = useRouter();
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [selectedCatering, setSelectedCatering] = useState<number | "">("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [entries, setEntries] = useState<AuditEntryItemResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Detail Modal State
  const [viewingDetailId, setViewingDetailId] = useState<number | null>(null);
  const [detailEntry, setDetailEntry] = useState<AuditEntryItemResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [allKriteria, setAllKriteria] = useState<AuditKriteriaItem[]>([]);
  const [groupedKriteria, setGroupedKriteria] = useState<{
    A: Record<string, AuditKriteriaItem[]>;
    B: Record<string, AuditKriteriaItem[]>;
  }>({ A: {}, B: {} });

  // Lightbox State
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<AuditEntryItemResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showSuccess, showError, showWarning } = useToast();

  // Escape key handler for modal and lightbox accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewPhoto) {
          setPreviewPhoto(null);
        } else if (viewingDetailId) {
          setViewingDetailId(null);
          setDetailEntry(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewPhoto, viewingDetailId]);

  useEffect(() => {
    async function initData() {
      try {
        const [cats, kriteriaRes] = await Promise.all([
          getCatering(),
          getAuditKriteria(),
        ]);
        setCaterings(cats);
        const kList: AuditKriteriaItem[] =
          (kriteriaRes as any)?.all ||
          (kriteriaRes as any)?.kriteria ||
          (Array.isArray(kriteriaRes) ? kriteriaRes : []);
        setAllKriteria(kList);

        let grp = (kriteriaRes as any)?.grouped;
        if (!grp || (!grp.A && !grp.B)) {
          const gA: Record<string, AuditKriteriaItem[]> = {};
          const gB: Record<string, AuditKriteriaItem[]> = {};
          for (const item of kList) {
            const sisi = (item.sisi || "A").toUpperCase();
            const kat = item.kategori || "UMUM";
            if (sisi === "B") {
              if (!gB[kat]) gB[kat] = [];
              gB[kat].push(item);
            } else {
              if (!gA[kat]) gA[kat] = [];
              gA[kat].push(item);
            }
          }
          grp = { A: gA, B: gB };
        }
        setGroupedKriteria(grp);
      } catch (err) {
        console.error("Gagal inisialisasi master data:", err);
      }
    }
    initData();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await getUnifiedAuditEntries(
        selectedCatering,
        startDate || undefined,
        endDate || undefined
      );
      setEntries(res || []);
      setCurrentPage(1);
    } catch (err) {
      console.error("Gagal memuat riwayat audit:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedCatering, startDate, endDate]);

  // Client filtering
  const filteredEntries = useMemo(() => {
    return entries.filter((row) => {
      // Catering filter
      if (selectedCatering !== "" && row.catering_id !== Number(selectedCatering)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catName = (row.catering_nama || "").toLowerCase();
        const auditor = (row.created_by_name || row.created_by_name_snapshot || "").toLowerCase();
        if (!catName.includes(q) && !auditor.includes(q)) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== "all") {
        const isFindings = row.assessment_mode === "findings_v1";
        if (typeFilter === "findings_v1" && !isFindings) return false;
        if (typeFilter === "legacy_checklist" && isFindings) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const statusMeta = getAuditStatusInfo(row);
        if (statusFilter === "draft" && !statusMeta.isDraft) return false;
        if (statusFilter === "final" && statusMeta.isDraft) return false;
        if (statusFilter === "tanpa_temuan" && !statusMeta.isTanpaTemuan) return false;
        if (statusFilter === "dengan_temuan" && (statusMeta.isDraft || statusMeta.isTanpaTemuan || row.assessment_mode !== "findings_v1")) return false;
        if (statusFilter === "legacy" && row.assessment_mode === "findings_v1") return false;
      }

      return true;
    });
  }, [entries, selectedCatering, searchQuery, typeFilter, statusFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const dateA = new Date(a.tanggal).getTime();
      const dateB = new Date(b.tanggal).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id - a.id;
    });
  }, [filteredEntries]);

  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage) || 1;
  const paginatedEntries = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedEntries.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedEntries, currentPage]);

  const handleOpenDetail = async (id: number) => {
    try {
      setViewingDetailId(id);
      setDetailLoading(true);
      const data = await getUnifiedAuditEntryDetail(id);
      setDetailEntry(data);
    } catch (err) {
      console.error("Gagal memuat detail audit:", err);
      showError("Gagal memuat rincian audit.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenAudit = (row: AuditEntryItemResponse) => {
    if (row.status === "draft") {
      router.push(`/audit/input?id=${row.id}`);
    } else {
      handleOpenDetail(row.id);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (deleteTarget.assessment_mode === "findings_v1") {
        try {
          await deleteAuditEntryV1(deleteTarget.id);
        } catch {
          await deleteAuditEntry(deleteTarget.id);
        }
      } else {
        await deleteAuditEntry(deleteTarget.id);
      }
      showSuccess(`Audit ${deleteTarget.catering_nama} (${formatDisplayDate(deleteTarget.tanggal)}) berhasil dihapus.`);
      setDeleteTarget(null);
      fetchEntries();
    } catch (err: any) {
      const msg = err?.message || "Gagal menghapus entri audit.";
      setDeleteError(msg);
      showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleResetFilter = () => {
    setSelectedCatering("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
  };

  // Excel Export Handler
  const handleExportAuditExcel = async (targetEntriesList?: AuditEntryItemResponse[]) => {
    const listToExport = targetEntriesList || filteredEntries;
    if (listToExport.length === 0) {
      showWarning("Tidak ada entri audit yang siap diexport.");
      return;
    }

    try {
      setExporting(true);
      const catObj = caterings.find((c) => c.id === Number(selectedCatering));
      const cateringNama = catObj ? catObj.nama : "SEMUA CATERING";

      const fullListToExport = await Promise.all(
        listToExport.map(async (item) => {
          try {
            const detail = await getUnifiedAuditEntryDetail(item.id);
            return {
              ...item,
              tercentang_ids: detail.tercentang_ids || item.tercentang_ids,
              comments: detail.comments || item.comments,
            };
          } catch (e) {
            return item;
          }
        })
      );

      const buffer = await generateAuditExcelBuffer(
        fullListToExport,
        allKriteria,
        cateringNama,
        startDate || undefined,
        endDate || undefined
      );
      let fileName = "";
      if (fullListToExport.length === 1) {
        const item = fullListToExport[0];
        const catering = item.catering_nama || cateringNama;
        const tanggalStr = formatDateID(item.tanggal);
        fileName = `Form Audit_${catering}_${tanggalStr}.xlsx`;
      } else {
        const dateStr = fullListToExport[0]?.tanggal ? formatDateID(fullListToExport[0].tanggal) : "";
        fileName = `Form Audit_${cateringNama}${dateStr ? `_${dateStr}` : ""}.xlsx`;
      }

      downloadExcelBuffer(buffer, fileName);
      showSuccess(`File Excel "${fileName}" berhasil diunduh.`);
    } catch (err: any) {
      showError("Gagal melakukan export Excel Audit: " + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link
              href="/audit"
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
              AUDIT DAPUR
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              RIWAYAT AUDIT
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
            Riwayat Audit
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Lihat audit yang telah selesai dan lanjutkan audit yang masih berstatus draft.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/audit/input"
            className="btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12.5px",
              padding: "7px 14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <PlusCircle size={15} />
            <span>+ Input Audit Baru</span>
          </Link>
          <HeaderMetaBoxes />
        </div>
      </div>

      {/* Subnavigation Tabs */}
      <AuditSubnav activeTab="riwayat" />

      {/* Filter Card */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} style={{ color: "var(--red)" }} />
            <span>FILTER RIWAYAT AUDIT</span>
          </div>
          <ExportExcelButton
            onClick={() => handleExportAuditExcel()}
            isLoading={exporting}
          />
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label>KATERING</label>
              <CenteredSelect
                value={selectedCatering}
                placeholder="Semua Katering"
                options={caterings.map((c) => ({ value: c.id, label: c.nama }))}
                onChange={(val) => setSelectedCatering(val ? Number(val) : "")}
              />
            </div>

            <div>
              <label>TIPE AUDIT</label>
              <CenteredSelect
                value={typeFilter}
                placeholder="Semua Tipe"
                options={[
                  { value: "all", label: "Semua Tipe" },
                  { value: "findings_v1", label: "Audit Temuan" },
                  { value: "legacy_checklist", label: "Checklist Legacy" },
                ]}
                onChange={(val) => setTypeFilter(val)}
              />
            </div>

            <div>
              <label>STATUS</label>
              <CenteredSelect
                value={statusFilter}
                placeholder="Semua Status"
                options={[
                  { value: "all", label: "Semua Status" },
                  { value: "draft", label: "Draft" },
                  { value: "final", label: "Final" },
                  { value: "tanpa_temuan", label: "Tanpa Temuan" },
                  { value: "dengan_temuan", label: "Dengan Temuan" },
                  { value: "legacy", label: "Legacy" },
                ]}
                onChange={(val) => setStatusFilter(val)}
              />
            </div>

            <div>
              <label>TANGGAL MULAI</label>
              <IndoDatePicker
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label>TANGGAL SELESAI</label>
              <IndoDatePicker
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label>CARI</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Cari katering/auditor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ height: 38, width: "100%", paddingLeft: 30, fontSize: 12 }}
                  />
                  <Search size={14} style={{ position: "absolute", left: 9, top: 12, color: "var(--text-muted)" }} />
                </div>
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    height: 38,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0 14px",
                  }}
                  onClick={handleResetFilter}
                  title="Reset Filter"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--sidebar-bg)", textAlign: "center" }}>
                <th style={{ width: "4%", textAlign: "center" }}>NO</th>
                <th style={{ width: "12%", textAlign: "center" }}>TANGGAL</th>
                <th style={{ width: "16%", textAlign: "left" }}>KATERING</th>
                <th style={{ width: "14%", textAlign: "left" }}>AUDITOR</th>
                <th style={{ width: "12%", textAlign: "center" }}>TIPE</th>
                <th style={{ width: "12%", textAlign: "center" }}>STATUS</th>
                <th style={{ width: "10%", textAlign: "center" }}>TEMUAN</th>
                <th style={{ width: "10%", textAlign: "center" }}>NILAI AUDIT</th>
                <th style={{ width: "10%", textAlign: "center" }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 36, color: "var(--text-muted)" }}>
                    Memuat riwayat audit...
                  </td>
                </tr>
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 48 }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>
                      {entries.length === 0
                        ? "Belum ada data riwayat audit."
                        : "Tidak ada audit yang cocok dengan filter atau pencarian Anda."}
                    </div>
                    {entries.length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilter}
                        className="btn-outline"
                        style={{ fontSize: 12, padding: "6px 14px", marginTop: 8 }}
                      >
                        Reset Filter &amp; Pencarian
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((row, idx) => {
                  const noIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                  const typeInfo = getAuditTypeInfo(row);
                  const statusInfo = getAuditStatusInfo(row);
                  const isDraft = statusInfo.isDraft;
                  const auditorName = row.created_by_name || row.created_by_name_snapshot || "-";

                  return (
                    <tr
                      key={row.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest(".action-buttons, button, a, input, select")) return;
                        handleOpenAudit(row);
                      }}
                      className="audit-history-row"
                      style={{
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "background-color 0.12s ease",
                      }}
                      title={isDraft ? "Lanjutkan draft audit" : "Lihat detail laporan audit"}
                    >
                      <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)" }}>{noIndex}</td>
                      <td style={{ textAlign: "center" }}>{formatDisplayDate(row.tanggal)}</td>
                      <td style={{ textAlign: "left", fontWeight: 700 }}>{row.catering_nama}</td>
                      <td style={{ textAlign: "left", color: "var(--text-secondary)", fontSize: 12 }}>
                        {auditorName}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAudit(row);
                          }}
                          title={isDraft ? "Lanjutkan Draft Audit Temuan" : "Lihat Detail Audit Temuan"}
                          aria-label={`Buka ${typeInfo.label} untuk ${row.catering_nama}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 9px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: typeInfo.isFindings ? "rgba(59, 130, 246, 0.1)" : "rgba(148, 163, 184, 0.1)",
                            color: typeInfo.isFindings ? "#1d4ed8" : "#475569",
                            border: `1px solid ${typeInfo.isFindings ? "#bfdbfe" : "#cbd5e1"}`,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = "brightness(0.92)";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = "none";
                            e.currentTarget.style.transform = "none";
                          }}
                        >
                          <span>{typeInfo.label}</span>
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAudit(row);
                          }}
                          title={isDraft ? "Lanjutkan Draft Audit" : "Lihat Detail Audit"}
                          aria-label={`Status ${statusInfo.label} - Klik untuk melihat detail`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 9px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: statusInfo.badgeStyle.bg,
                            color: statusInfo.badgeStyle.color,
                            border: statusInfo.badgeStyle.border,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = "brightness(0.92)";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = "none";
                            e.currentTarget.style.transform = "none";
                          }}
                        >
                          <span>{statusInfo.label}</span>
                        </button>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>
                        {row.assessment_mode === "findings_v1" ? (
                          row.is_tanpa_temuan ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAudit(row);
                              }}
                              title="Audit tanpa temuan (100% Sesuai) - Klik untuk melihat detail"
                              style={{
                                border: "1px solid rgba(22, 163, 74, 0.2)",
                                background: "rgba(22, 163, 74, 0.08)",
                                color: "#16a34a",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = "brightness(0.92)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = "none";
                              }}
                            >
                              0 (Sesuai)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAudit(row);
                              }}
                              title={`Ditemukan ${row.findings_count || 0} temuan ketidaksesuaian - Klik untuk melihat detail`}
                              style={{
                                border: "1px solid rgba(220, 38, 38, 0.25)",
                                background: (row.findings_count || 0) > 0 ? "rgba(220, 38, 38, 0.08)" : "transparent",
                                color: (row.findings_count || 0) > 0 ? "#dc2626" : "var(--text-muted)",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = "brightness(0.92)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = "none";
                              }}
                            >
                              <span>{row.findings_count || 0}</span>
                              <span style={{ fontSize: 10, opacity: 0.85 }}>Temuan</span>
                            </button>
                          )
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Legacy</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "var(--red)", fontSize: 13.5 }}>
                        {isDraft ? (
                          <span style={{ color: "var(--text-muted)", fontSize: 11.5, fontWeight: 600 }}>[Draft]</span>
                        ) : (
                          `${Number(row.nilai_final).toFixed(2)}%`
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {isDraft ? (
                            <>
                              <Link
                                href={`/audit/input?id=${row.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="icon-btn"
                                style={{
                                  height: 32,
                                  width: 32,
                                  flexShrink: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(234, 179, 8, 0.1)",
                                  color: "#b45309",
                                }}
                                title="Lanjutkan Audit Draft"
                                aria-label="Lanjutkan Audit Draft"
                              >
                                <Play size={14} />
                              </Link>
                              <button
                                type="button"
                                className="icon-btn icon-btn-danger"
                                style={{ height: 32, width: 32, flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteTarget(row);
                                }}
                                title="Hapus Draft Audit"
                                aria-label="Hapus Draft Audit"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                style={{ height: 32, width: 32, flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(row.id);
                                }}
                                title="Lihat Detail Audit"
                                aria-label="Lihat Detail Audit"
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn"
                                style={{ height: 32, width: 32, flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportAuditExcel([row]);
                                }}
                                title="Export"
                                aria-label="Export"
                              >
                                <Download size={14} />
                              </button>

                              <button
                                type="button"
                                className="icon-btn icon-btn-danger"
                                style={{ height: 32, width: 32, flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError(null);
                                  setDeleteTarget(row);
                                }}
                                title="Hapus Data Audit"
                                aria-label="Hapus Data Audit"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
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

        {/* Pagination Bar */}
        {!loading && filteredEntries.length > 0 && (
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
                {Math.min((currentPage - 1) * itemsPerPage + 1, filteredEntries.length)} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredEntries.length)}
              </strong>{" "}
              dari <strong>{filteredEntries.length}</strong> entri
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

      {/* DUAL RENDERER DETAIL MODAL */}
      {viewingDetailId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => {
            setViewingDetailId(null);
            setDetailEntry(null);
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              width: "100%",
              maxWidth: 960,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--sidebar-bg)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
                    Detail Laporan Audit Dapur
                  </h3>
                  {detailEntry && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: detailEntry.assessment_mode === "findings_v1" ? "rgba(59, 130, 246, 0.1)" : "rgba(148, 163, 184, 0.1)",
                        color: detailEntry.assessment_mode === "findings_v1" ? "#1d4ed8" : "#475569",
                        border: `1px solid ${detailEntry.assessment_mode === "findings_v1" ? "#bfdbfe" : "#cbd5e1"}`,
                      }}
                    >
                      {detailEntry.assessment_mode === "findings_v1" ? "Audit Temuan V1" : "Checklist Legacy"}
                    </span>
                  )}
                </div>
                {detailEntry && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    {detailEntry.catering_nama} &bull; {formatDisplayDate(detailEntry.tanggal)}
                    {(detailEntry.created_by_name || detailEntry.created_by_name_snapshot) && (
                      <> &bull; Auditor: <strong>{detailEntry.created_by_name || detailEntry.created_by_name_snapshot}</strong></>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingDetailId(null);
                  setDetailEntry(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Tutup Modal Detail"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {detailLoading || !detailEntry ? (
                <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                  Memuat rincian laporan audit...
                </div>
              ) : (
                <div>
                  {/* Unified Audit Score & Metadata Header */}
                  <div
                    style={{
                      background: "var(--sidebar-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px 20px",
                      marginBottom: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                      {/* Nilai Audit */}
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          Nilai Audit
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: (detailEntry.nilai_audit ?? detailEntry.nilai_final) >= 80 ? "var(--green, #16a34a)" : "var(--red, #dc2626)" }}>
                          {Number(detailEntry.nilai_audit ?? detailEntry.nilai_final).toFixed(2)}%
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          Total Poin: {(detailEntry.nilai_sisi_a ?? detailEntry.total_nilai_a ?? 0) + (detailEntry.nilai_sisi_b ?? detailEntry.total_nilai_b ?? 0)} / {(detailEntry.maksimum_sisi_a ?? 510) + (detailEntry.maksimum_sisi_b ?? 650)}
                        </div>
                      </div>

                      <div style={{ width: 1, height: 42, background: "var(--border)" }} />

                      {/* Status */}
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          Status
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 10px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: detailEntry.status === "final" ? "rgba(22, 163, 74, 0.12)" : "rgba(234, 179, 8, 0.12)",
                              color: detailEntry.status === "final" ? "#16a34a" : "#b45309",
                              border: `1px solid ${detailEntry.status === "final" ? "rgba(22, 163, 74, 0.25)" : "rgba(234, 179, 8, 0.25)"}`,
                            }}
                          >
                            {detailEntry.status === "final" ? "Final" : "Draft"}
                          </span>
                        </div>
                      </div>

                      <div style={{ width: 1, height: 42, background: "var(--border)" }} />

                      {/* Tanggal & Katering */}
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          Tanggal &amp; Katering
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                          {formatDisplayDate(detailEntry.tanggal)}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                          {detailEntry.catering_nama}
                        </div>
                      </div>

                      {/* Temuan */}
                      {detailEntry.assessment_mode === "findings_v1" && (
                        <>
                          <div style={{ width: 1, height: 42, background: "var(--border)" }} />
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                              Temuan
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: (detailEntry.findings_count || 0) > 0 ? "var(--red)" : "var(--green)", marginTop: 2 }}>
                              {detailEntry.is_tanpa_temuan || (detailEntry.findings_count || 0) === 0 ? "0 Temuan (Sesuai)" : `${detailEntry.findings_count} Temuan (${detailEntry.violated_kriteria_count || 0} kriteria)`}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* General Scope Notes */}
                  {detailEntry.catatan_umum && (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: 24,
                        fontSize: 12.5,
                      }}
                    >
                      <strong style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                        CATATAN UMUM AUDIT:
                      </strong>
                      <div style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{detailEntry.catatan_umum}</div>
                    </div>
                  )}

                  {/* BRANCH: RENDERER FINDINGS V1 VS RENDERER LEGACY */}
                  {detailEntry.assessment_mode === "findings_v1" ? (
                    /* RENDERER FINDINGS V1 */
                    <div>
                      {detailEntry.is_tanpa_temuan || !detailEntry.findings || detailEntry.findings.length === 0 ? (
                        /* Positive State: Tanpa Temuan */
                        <div
                          style={{
                            padding: 32,
                            textAlign: "center",
                            background: "rgba(22, 163, 74, 0.05)",
                            border: "1px solid rgba(22, 163, 74, 0.2)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "50%",
                              background: "rgba(22, 163, 74, 0.12)",
                              color: "#16a34a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              margin: "0 auto 16px auto",
                            }}
                          >
                            <CheckCircle2 size={28} />
                          </div>
                          <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 800, color: "#15803d" }}>
                            Audit Selesai Tanpa Temuan
                          </h4>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", maxWidth: 480, marginInline: "auto" }}>
                            Seluruh 54 kriteria Audit Dapur dinyatakan memenuhi standar. Audit memperoleh nilai penuh (100.00%).
                          </p>
                        </div>
                      ) : (
                        /* Finding Cards List */
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                              Daftar Temuan Ketidaksesuaian ({detailEntry.findings.length} Temuan)
                            </h4>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              Kriteria Bermasalah: <strong>{detailEntry.violated_kriteria_count ?? detailEntry.findings.length}</strong>
                            </span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {detailEntry.findings.map((finding, idx) => (
                              <div
                                key={finding.id}
                                style={{
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)",
                                  overflow: "hidden",
                                  background: "var(--card)",
                                }}
                              >
                                {/* Card Header */}
                                <div
                                  style={{
                                    padding: "10px 16px",
                                    background: "var(--sidebar-bg)",
                                    borderBottom: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                      style={{
                                        background: "#dc2626",
                                        color: "#fff",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        padding: "2px 7px",
                                        borderRadius: 4,
                                      }}
                                    >
                                      Temuan #{idx + 1}
                                    </span>
                                    <strong style={{ fontSize: 13, color: "var(--text)" }}>
                                      {finding.sisi ? `Form ${finding.sisi}` : ""} • {finding.kategori || "Kriteria"}
                                    </strong>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {finding.point !== undefined && (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>
                                        -{finding.point} Poin
                                      </span>
                                    )}
                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                      {finding.photos?.length || 0} Foto Bukti
                                    </span>
                                  </div>
                                </div>

                                {/* Card Body */}
                                <div style={{ padding: 16 }}>
                                  {/* Kriteria Deskripsi */}
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3 }}>
                                      KRITERIA STANDAR:
                                    </div>
                                    <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>
                                      {finding.material && <span style={{ color: "var(--text-muted)" }}>[{finding.material}] </span>}
                                      {finding.nama_kriteria || "-"}
                                    </div>
                                  </div>

                                  {/* Keterangan Temuan */}
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3 }}>
                                      KETERANGAN KONDISI DITEMUKAN:
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        color: "var(--text)",
                                        background: "var(--bg-subtle)",
                                        padding: "8px 12px",
                                        borderRadius: 4,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {finding.keterangan}
                                    </div>
                                  </div>

                                  {/* Photos Gallery */}
                                  {finding.photos && finding.photos.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                                        FOTO BUKTI:
                                      </div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                        {finding.photos.map((photo) => {
                                          const photoUrl = getAuditFindingPhotoUrl(photo.id);
                                          return (
                                            <div
                                              key={photo.id}
                                              style={{
                                                position: "relative",
                                                width: 80,
                                                height: 80,
                                                borderRadius: 6,
                                                overflow: "hidden",
                                                border: "1px solid var(--border)",
                                                cursor: "pointer",
                                              }}
                                              onClick={() => setPreviewPhoto({ url: photoUrl, title: photo.original_filename || "Foto Bukti Temuan" })}
                                              title="Klik untuk melihat foto lebih besar"
                                            >
                                              <ProtectedImage
                                                src={photoUrl}
                                                alt={photo.original_filename || "Bukti Temuan"}
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* RENDERER LEGACY CHECKLIST */
                    <div>
                      {/* FORM A */}
                      <div style={{ marginBottom: 32, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                          FORM A: PEMERIKSAAN DAPUR
                        </div>

                        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
                          {Object.entries(groupedKriteria.A || {}).map(([katName, items]) => {
                            const tercentangIds = new Set(detailEntry.tercentang_ids || []);
                            const checkedCount = items.filter((it) => tercentangIds.has(it.id)).length;
                            const cleanKatName = katName.replace(/B\s*A\s*H\s*A\s*N/gi, "BAHAN").trim().toUpperCase();

                            return (
                              <div key={`ModalA-${katName}`} style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ padding: "8px 14px", background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, color: "var(--red)" }}>
                                  <span>{cleanKatName}</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{checkedCount} / {items.length} TERCENTANG</span>
                                </div>
                                <table style={{ width: "100%", fontSize: 12 }}>
                                  <tbody>
                                    {items.map((item, itemIdx) => {
                                      const isChecked = tercentangIds.has(item.id);
                                      return (
                                        <tr key={item.id} style={{ borderBottom: itemIdx === items.length - 1 ? "none" : "1px solid var(--border)", background: isChecked ? "rgba(34, 197, 94, 0.04)" : "transparent" }}>
                                          <td style={{ padding: "8px 12px", width: 40, textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{itemIdx + 1}</td>
                                          <td style={{ padding: "8px 12px", width: 180, fontWeight: 700 }}>{item.material || "-"}</td>
                                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{item.deskripsi}</td>
                                          <td style={{ padding: "8px 12px", width: 100, textAlign: "center" }}>+{item.point} Poin</td>
                                          <td style={{ padding: "8px 12px", width: 120, textAlign: "center" }}>
                                            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: isChecked ? "#16a34a" : "var(--sidebar-bg)", color: isChecked ? "#fff" : "var(--text-muted)" }}>
                                              {isChecked ? "TERCENTANG" : "BELUM"}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {(() => {
                                  const katComment = (detailEntry.comments || []).find(
                                    (c) => c.sisi.toUpperCase() === "A" && c.kategori.toUpperCase() === cleanKatName
                                  )?.comment;
                                  return katComment ? (
                                    <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", fontSize: 12, color: "var(--text-secondary)" }}>
                                      <strong style={{ color: "var(--text-muted)", fontSize: 11, display: "block", marginBottom: 2 }}>COMMENT:</strong>
                                      {katComment}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* FORM B */}
                      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                          FORM B: PEMERIKSAAN SERVIS &amp; HIGIENITAS
                        </div>

                        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
                          {Object.entries(groupedKriteria.B || {}).map(([katName, items]) => {
                            const tercentangIds = new Set(detailEntry.tercentang_ids || []);
                            const checkedCount = items.filter((it) => tercentangIds.has(it.id)).length;
                            const cleanKatName = katName.replace(/B\s*A\s*H\s*A\s*N/gi, "BAHAN").trim().toUpperCase();

                            return (
                              <div key={`ModalB-${katName}`} style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ padding: "8px 14px", background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, color: "var(--red)" }}>
                                  <span>{cleanKatName}</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{checkedCount} / {items.length} TERCENTANG</span>
                                </div>
                                <table style={{ width: "100%", fontSize: 12 }}>
                                  <tbody>
                                    {items.map((item, itemIdx) => {
                                      const isChecked = tercentangIds.has(item.id);
                                      return (
                                        <tr key={item.id} style={{ borderBottom: itemIdx === items.length - 1 ? "none" : "1px solid var(--border)", background: isChecked ? "rgba(34, 197, 94, 0.04)" : "transparent" }}>
                                          <td style={{ padding: "8px 12px", width: 40, textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{itemIdx + 1}</td>
                                          <td style={{ padding: "8px 12px", width: 180, fontWeight: 700 }}>{item.material || "-"}</td>
                                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{item.deskripsi}</td>
                                          <td style={{ padding: "8px 12px", width: 100, textAlign: "center" }}>+{item.point} Poin</td>
                                          <td style={{ padding: "8px 12px", width: 120, textAlign: "center" }}>
                                            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: isChecked ? "#16a34a" : "var(--sidebar-bg)", color: isChecked ? "#fff" : "var(--text-muted)" }}>
                                              {isChecked ? "TERCENTANG" : "BELUM"}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {(() => {
                                  const katComment = (detailEntry.comments || []).find(
                                    (c) => c.sisi.toUpperCase() === "B" && c.kategori.toUpperCase() === cleanKatName
                                  )?.comment;
                                  return katComment ? (
                                    <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", fontSize: 12, color: "var(--text-secondary)" }}>
                                      <strong style={{ color: "var(--text-muted)", fontSize: 11, display: "block", marginBottom: 2 }}>COMMENT:</strong>
                                      {katComment}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "50%",
                color: "#fff",
                cursor: "pointer",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Tutup preview foto"
            >
              <X size={18} />
            </button>
            <ProtectedImage
              src={previewPhoto.url}
              alt={previewPhoto.title}
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            />
            <div style={{ color: "#fff", fontSize: 12, marginTop: 8 }}>{previewPhoto.title}</div>
          </div>
        </div>
      )}

      {/* Unified ConfirmDeleteModal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.status === "draft" ? "Hapus Draft Audit Dapur?" : "Hapus Laporan Audit Dapur?"}
        itemName={
          deleteTarget
            ? `${deleteTarget.catering_nama} • ${formatDisplayDate(deleteTarget.tanggal)} ${deleteTarget.status !== "draft" ? `(Nilai: ${formatNumberID(deleteTarget.nilai_final, { decimals: 1 })}%)` : "(Draft)"}`
            : undefined
        }
        description={
          deleteTarget?.status === "draft"
            ? "Draft audit dan seluruh foto temuan yang terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            : "Apakah Anda yakin ingin menghapus data audit dapur ini? Seluruh temuan, skor kriteria A & B, dan catatan audit akan dihapus secara permanen."
        }
        confirmText={deleteTarget?.status === "draft" ? "Hapus Draft" : "Hapus Laporan"}
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
