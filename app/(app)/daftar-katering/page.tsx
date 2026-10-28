"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Store,
  Plus,
  Search,
  Edit2,
  Power,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
  Building2,
} from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useToast } from "@/context/ToastContext";
import CateringShapeBadge, {
  AVAILABLE_SHAPES,
  SHAPE_LABELS,
} from "@/components/CateringShapeBadge";
import CateringColorPickerModal from "@/components/CateringColorPickerModal";
import {
  Catering,
  CateringShape,
  CateringColor,
  CATERING_COLOR_CONFIG,
  CATERING_SHAPE_LABELS,
  DeletionImpactResponse,
  getCatering,
  createCatering,
  updateCatering,
  updateCateringStatus,
  getCateringDeletionImpact,
  deleteCatering,
} from "@/lib/api";

const AVAILABLE_COLORS: CateringColor[] = [
  "merah",
  "biru",
  "hijau",
  "kuning",
  "oranye",
  "ungu",
  "merah-muda",
  "cokelat",
  "abu-abu",
  "hitam",
];

const IMPACT_LABELS: Record<string, string> = {
  laporan_periode: "Laporan Periode",
  audit_periode: "Skor Audit Periode",
  komplain: "Catatan Komplain",
  pelanggaran_kalori: "Pelanggaran Kalori",
  pencapaian_kalori: "Pencapaian Kalori",
  kelayakan_menu: "Kelayakan Menu Periode",
  keterlambatan_pengiriman: "Keterlambatan Pengiriman",
  kalori_harian: "Entri Kalori Harian",
  bahan_kalori_harian: "Rincian Bahan Kalori",
  penilaian_kelayakan: "Inspeksi Kelayakan Menu",
  audit_dapur: "Audit Dapur & Servis",
  item_audit_dapur: "Item Checklist Audit",
  komentar_audit_dapur: "Komentar Audit Dapur",
  kalori_minus: "Keterangan Kalori Minus",
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export default function DaftarKateringPage() {
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal Form State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedCatering, setSelectedCatering] = useState<Catering | null>(null);

  const [formNama, setFormNama] = useState<string>("");
  const [formWarna, setFormWarna] = useState<CateringColor>("biru");
  const [formColorHex, setFormColorHex] = useState<string | null>(null);
  const [formBentuk, setFormBentuk] = useState<CateringShape>("circle");
  const [formRPGroup, setFormRPGroup] = useState<"A" | "B" | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Status Toggle Confirmation Dialog
  const [statusDialogData, setStatusDialogData] = useState<{
    catering: Catering;
    targetStatus: boolean;
  } | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deleteModalCatering, setDeleteModalCatering] = useState<Catering | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeletionImpactResponse | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState<boolean>(false);
  const [deleteImpactError, setDeleteImpactError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Color Picker Modal State
  const [colorPickerCatering, setColorPickerCatering] = useState<Catering | null>(null);

  // Notification Toast via centralized useToast
  const { showToast } = useToast();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchCaterings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatering();
      setCaterings(data);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat daftar katering.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaterings();
  }, []);

  // Filtered List
  const filteredCaterings = useMemo(() => {
    return caterings.filter((c) => {
      const matchSearch = c.nama.toLowerCase().includes(searchTerm.trim().toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter === "active") return c.is_active;
      if (statusFilter === "inactive") return !c.is_active;
      return true;
    });
  }, [caterings, searchTerm, statusFilter]);

  // Metrics
  const totalCount = caterings.length;
  const activeCount = caterings.filter((c) => c.is_active).length;
  const inactiveCount = caterings.filter((c) => !c.is_active).length;

  // Open Modal Helpers
  const openAddModal = () => {
    setModalMode("add");
    setSelectedCatering(null);
    setFormNama("");
    setFormWarna("biru");
    setFormColorHex(null);
    setFormBentuk("circle");
    setFormRPGroup("");
    setFormError(null);
    setIsModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const openEditModal = (c: Catering) => {
    setModalMode("edit");
    setSelectedCatering(c);
    setFormNama(c.nama);
    const validColor = AVAILABLE_COLORS.includes(c.warna as CateringColor)
      ? (c.warna as CateringColor)
      : "biru";
    setFormWarna(validColor);
    setFormColorHex(c.color_hex || null);
    setFormBentuk(c.bentuk === "rectangle" ? "rectangle" : "circle");
    setFormRPGroup(c.reward_punishment_group || "");
    setFormError(null);
    setIsModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const closeModal = () => {
    if (formSubmitting) return;
    setIsModalOpen(false);
    setFormError(null);
  };

  // Open Delete Modal
  const openDeleteModal = async (c: Catering) => {
    setDeleteModalCatering(c);
    setDeleteImpact(null);
    setDeleteImpactError(null);
    setDeleteError(null);
    setDeleteImpactLoading(true);

    try {
      const impact = await getCateringDeletionImpact(c.id);
      setDeleteImpact(impact);
    } catch (err: any) {
      setDeleteImpactError(err?.message || "Gagal memuat dampak penghapusan data.");
    } finally {
      setDeleteImpactLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleteSubmitting) return;
    setDeleteModalCatering(null);
    setDeleteImpact(null);
    setDeleteError(null);
  };

  // Keyboard accessibility (Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isModalOpen && !formSubmitting) closeModal();
        if (deleteModalCatering && !deleteSubmitting) closeDeleteModal();
        if (statusDialogData && !statusSubmitting) setStatusDialogData(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, formSubmitting, deleteModalCatering, deleteSubmitting, statusDialogData, statusSubmitting]);

  // Handle Form Submit (Add / Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formNama.trim();
    if (!cleanName || cleanName.length < 2) {
      setFormError("Nama katering wajib diisi minimal 2 karakter.");
      return;
    }
    if (cleanName.length > 100) {
      setFormError("Nama katering maksimal 100 karakter.");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const rpGroup: "A" | "B" | null =
        formRPGroup === "A" || formRPGroup === "B" ? formRPGroup : null;

      if (modalMode === "add") {
        const created = await createCatering({
          nama: cleanName,
          warna: formWarna,
          color_hex: formColorHex,
          bentuk: formBentuk,
          reward_punishment_group: rpGroup,
        });
        setCaterings((prev) => [created, ...prev]);
        showToast(`Katering "${created.nama}" berhasil ditambahkan!`);
      } else if (modalMode === "edit" && selectedCatering) {
        const updated = await updateCatering(selectedCatering.id, {
          nama: cleanName,
          warna: formWarna,
          color_hex: formColorHex,
          bentuk: formBentuk,
          reward_punishment_group: rpGroup,
        });
        setCaterings((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        showToast(`Perubahan data katering "${updated.nama}" berhasil disimpan!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Terjadi kesalahan saat menyimpan katering.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate / Deactivate)
  const handleConfirmStatusToggle = async () => {
    if (!statusDialogData) return;
    const { catering, targetStatus } = statusDialogData;
    setStatusSubmitting(true);

    try {
      const updated = await updateCateringStatus(catering.id, targetStatus);
      setCaterings((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showToast(
        targetStatus
          ? `Katering "${catering.nama}" berhasil diaktifkan kembali.`
          : `Katering "${catering.nama}" berhasil dinonaktifkan.`
      );
      setStatusDialogData(null);
    } catch (err: any) {
      showToast(err?.message || "Gagal mengubah status katering.", "error");
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Permanent Delete
  const handleConfirmDelete = async () => {
    if (!deleteModalCatering) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const res = await deleteCatering(deleteModalCatering.id, true);
      setCaterings((prev) => prev.filter((item) => item.id !== deleteModalCatering.id));
      showToast(res.message || `Katering "${deleteModalCatering.nama}" berhasil dihapus.`);
      setDeleteModalCatering(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus katering.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleRetryLoadImpact = async () => {
    if (!deleteModalCatering) return;
    setDeleteImpactLoading(true);
    setDeleteImpactError(null);
    setDeleteImpact(null);

    try {
      const impact = await getCateringDeletionImpact(deleteModalCatering.id);
      setDeleteImpact(impact);
    } catch (err: any) {
      setDeleteImpactError(
        err?.message || "Dampak penghapusan gagal dimuat. Silakan coba kembali."
      );
    } finally {
      setDeleteImpactLoading(false);
    }
  };

  const isDeleteConfirmed =
    deleteModalCatering !== null &&
    deleteImpact !== null &&
    !deleteImpactLoading &&
    !deleteImpactError;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">PT JAI / MASTER DATA</span>
          <h1 className="page-title">Daftar Katering</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn btn-solid"
            onClick={openAddModal}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Tambah Katering</span>
          </button>
          <HeaderMetaBoxes />
        </div>
      </div>

      {/* Metrics Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
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
              TOTAL KATERING
            </span>
            <Building2 size={18} style={{ color: "var(--red)" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Vendor terdaftar di sistem
          </div>
        </div>

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
              KATERING AKTIF
            </span>
            <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>
            {activeCount}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Tersedia untuk form input baru
          </div>
        </div>

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
              KATERING NONAKTIF
            </span>
            <XCircle size={18} style={{ color: "var(--text-muted)" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-muted)" }}>
            {inactiveCount}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Disimpan untuk riwayat laporan
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: 24 }}>
        {/* Search & Filter Toolbar */}
        <div
          className="catering-toolbar"
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
              minWidth: 280,
              flex: "1 1 300px",
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
              placeholder="Cari nama katering..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{
                width: "100%",
                paddingLeft: 36,
                height: 44,
                fontSize: 13,
              }}
            />
          </div>

          {/* Status Filter Segmented Control */}
          <div
            className="catering-toolbar-filter"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              Status:
            </span>
            <div className="segmented-control" role="group" aria-label="Filter status katering">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "active", label: "Aktif" },
                  { id: "inactive", label: "Nonaktif" },
                ] as const
              ).map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`segmented-control-btn ${isActive ? "active" : ""}`}
                    onClick={() => setStatusFilter(tab.id)}
                    aria-pressed={isActive}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            <RefreshCw
              size={24}
              className="spin-icon"
              style={{ animation: "spin 1s linear infinite", marginBottom: 12 }}
            />
            <p style={{ fontSize: 13.5, margin: 0 }}>Memuat daftar katering...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            style={{
              padding: 24,
              borderRadius: 6,
              backgroundColor: "var(--red-bg)",
              color: "var(--red)",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <AlertCircle size={24} style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 700, margin: 0 }}>{error}</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={fetchCaterings}
              style={{ marginTop: 12, fontSize: 12 }}
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Table Content */}
        {!loading && !error && (
          <>
            {filteredCaterings.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                {caterings.length === 0 ? (
                  <>
                    <Building2
                      size={40}
                      style={{ color: "var(--text-muted)", marginBottom: 12 }}
                    />
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "var(--text)",
                        margin: "0 0 6px 0",
                      }}
                    >
                      Belum ada katering yang terdaftar.
                    </h3>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        maxWidth: 420,
                        margin: "0 auto 20px auto",
                      }}
                    >
                      Silakan klik tombol di bawah untuk menambahkan katering pertama Anda.
                    </p>
                    <button
                      type="button"
                      className="btn btn-solid"
                      onClick={openAddModal}
                      style={{ fontSize: 13, padding: "8px 18px" }}
                    >
                      <Plus size={16} /> Tambah Katering
                    </button>
                  </>
                ) : (
                  <>
                    <Search
                      size={36}
                      style={{ color: "var(--text-muted)", marginBottom: 12 }}
                    />
                    <h3
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text)",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Katering yang dicari tidak ditemukan.
                    </h3>
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
                      Coba ganti kata kunci pencarian atau sesuaikan filter status.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 800,
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
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          width: 52,
                          textAlign: "center",
                        }}
                      >
                        NO
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "left",
                        }}
                      >
                        NAMA KATERING
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "left",
                          width: 140,
                        }}
                      >
                        WARNA
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "left",
                          width: 130,
                        }}
                      >
                        BENTUK
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "center",
                          width: 130,
                        }}
                        title="Grup Reward & Punishment (A / B)"
                      >
                        GRUP R&P
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "center",
                          width: 110,
                        }}
                      >
                        STATUS
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "center",
                          width: 130,
                        }}
                      >
                        TERDAFTAR
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--text)",
                          textAlign: "center",
                          width: 280,
                        }}
                      >
                        AKSI
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCaterings.map((cat, idx) => {
                      const shapeName =
                        CATERING_SHAPE_LABELS[cat.bentuk as CateringShape] || "Bundar";
                      const colorCfg = CATERING_COLOR_CONFIG[cat.warna as CateringColor];
                      const colorLabel = colorCfg ? colorCfg.label : cat.warna;
                      // Prioritas display color: color_hex (jika ada) -> fallback preset config hex -> default #3B82F6
                      const displayColorHex =
                        cat.color_hex && /^#[0-9A-Fa-f]{6}$/.test(cat.color_hex)
                          ? cat.color_hex
                          : colorCfg
                          ? colorCfg.hex
                          : "#3B82F6";
                      const isCustomColor = Boolean(cat.color_hex);
                      const isInactive = !cat.is_active;

                      return (
                        <tr
                          key={cat.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            opacity: isInactive ? 0.65 : 1,
                            transition: "background-color 0.15s ease",
                          }}
                        >
                          {/* No: rata tengah */}
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "center",
                              color: "var(--text-muted)",
                              fontSize: 12.5,
                              fontWeight: 500,
                              verticalAlign: "middle",
                            }}
                          >
                            {idx + 1}
                          </td>

                          {/* Nama Katering: rata kiri */}
                          <td style={{ padding: "11px 14px", textAlign: "left", verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: "50%",
                                  backgroundColor: displayColorHex,
                                  display: "inline-block",
                                  flexShrink: 0,
                                  boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                                }}
                                title={`Warna: ${displayColorHex}`}
                                aria-hidden="true"
                              />
                              <span>{cat.nama}</span>
                            </div>
                            {isInactive && (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  marginTop: 2,
                                  marginLeft: 17,
                                }}
                              >
                                (Nonaktif)
                              </span>
                            )}
                          </td>

                          {/* Warna: rata kiri, format sederhana "● Merah" */}
                          <td style={{ padding: "11px 14px", textAlign: "left", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                color: "var(--text)",
                                fontSize: 12.5,
                                fontWeight: 500,
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  backgroundColor: displayColorHex,
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                                aria-hidden="true"
                              />
                              <span>
                                {isCustomColor ? (
                                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                                    {cat.color_hex}
                                  </span>
                                ) : (
                                  colorLabel
                                )}
                              </span>
                            </span>
                          </td>

                          {/* Bentuk: rata kiri, format sederhana icon + label */}
                          <td style={{ padding: "11px 14px", textAlign: "left", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                color: "var(--text)",
                                fontSize: 12.5,
                                fontWeight: 500,
                              }}
                            >
                              <CateringShapeBadge
                                shape={cat.bentuk}
                                color={displayColorHex}
                                size={12}
                                border={false}
                              />
                              <span>{shapeName}</span>
                            </span>
                          </td>

                          {/* Grup R&P: rata tengah */}
                          <td style={{ padding: "11px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            {cat.reward_punishment_group === "A" ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                                  color: "#2563EB",
                                  border: "1px solid rgba(59, 130, 246, 0.25)",
                                }}
                              >
                                Grup A
                              </span>
                            ) : cat.reward_punishment_group === "B" ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  color: "#059669",
                                  border: "1px solid rgba(16, 185, 129, 0.25)",
                                }}
                              >
                                Grup B
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: "var(--text-muted)",
                                  backgroundColor: "var(--border, #f1f5f9)",
                                }}
                              >
                                Belum Ditentukan
                              </span>
                            )}
                          </td>

                          {/* Status: rata tengah, badge compact dengan titik status */}
                          <td style={{ padding: "11px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            <span
                              className={`catering-status-badge ${
                                cat.is_active ? "status-aktif" : "status-nonaktif"
                              }`}
                            >
                              <span className="status-dot" aria-hidden="true" />
                              <span>{cat.is_active ? "Aktif" : "Nonaktif"}</span>
                            </span>
                          </td>

                          {/* Terdaftar: rata tengah */}
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "center",
                              color: "var(--text-secondary)",
                              fontSize: 12.5,
                              verticalAlign: "middle",
                            }}
                          >
                            {formatDate(cat.created_at)}
                          </td>

                          {/* Aksi: rata tengah */}
                          <td style={{ padding: "11px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              {/* Pilih / Ubah Warna Button */}
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setColorPickerCatering(cat)}
                                title="Ubah warna kustom katering"
                                style={{
                                  height: 28,
                                  padding: "0 8px",
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  borderRadius: 4,
                                  borderColor: "var(--border)",
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: displayColorHex,
                                    display: "inline-block",
                                  }}
                                  aria-hidden="true"
                                />
                                <span>Warna</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => openEditModal(cat)}
                                title="Edit data katering"
                                style={{
                                  height: 28,
                                  padding: "0 8px",
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 4,
                                }}
                              >
                                <Edit2 size={12} />
                                <span>Edit</span>
                              </button>

                              {/* Toggle Status Button */}
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() =>
                                  setStatusDialogData({
                                    catering: cat,
                                    targetStatus: !cat.is_active,
                                  })
                                }
                                disabled={statusSubmitting && statusDialogData?.catering.id === cat.id}
                                title={
                                  cat.is_active
                                    ? "Nonaktifkan katering"
                                    : "Aktifkan katering"
                                }
                                style={{
                                  height: 28,
                                  padding: "0 8px",
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 4,
                                  color: cat.is_active ? "#b45309" : "#15803d",
                                  borderColor: "var(--border)",
                                  opacity:
                                    statusSubmitting && statusDialogData?.catering.id === cat.id ? 0.6 : 1,
                                  cursor:
                                    statusSubmitting && statusDialogData?.catering.id === cat.id
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {statusSubmitting && statusDialogData?.catering.id === cat.id ? (
                                  <RefreshCw
                                    size={12}
                                    className="spin-icon"
                                    style={{ animation: "spin 1s linear infinite" }}
                                  />
                                ) : (
                                  <Power size={12} />
                                )}
                                <span>
                                  {statusSubmitting && statusDialogData?.catering.id === cat.id
                                    ? "Memproses..."
                                    : cat.is_active
                                    ? "Nonaktifkan"
                                    : "Aktifkan"}
                                </span>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => openDeleteModal(cat)}
                                title="Hapus permanen katering"
                                style={{
                                  height: 28,
                                  padding: "0 8px",
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 4,
                                  color: "var(--red, #dc2626)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL FORM: TAMBAH / EDIT KATERING */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !formSubmitting) closeModal();
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 540,
              padding: "28px 28px 24px",
              borderRadius: 8,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
              animation: "scaleUp 0.15s ease-out",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "var(--red)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {modalMode === "add" ? "Tambah Katering Baru" : "Edit Data Katering"}
                </span>
                <h2
                  id="modal-title"
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    margin: "2px 0 0 0",
                    color: "var(--text)",
                  }}
                >
                  {modalMode === "add" ? "Form Katering Baru" : `Edit: ${selectedCatering?.nama}`}
                </h2>
              </div>
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={closeModal}
                disabled={formSubmitting}
                aria-label="Tutup modal"
                style={{ width: 32, height: 32 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 6,
                  backgroundColor: "var(--red-bg)",
                  color: "var(--red)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit}>
              {/* Field: Nama Katering */}
              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="catering-nama-input"
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 6,
                  }}
                >
                  Nama Katering <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  id="catering-nama-input"
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="Contoh: ANEKA RASA"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  disabled={formSubmitting}
                  className="input-field"
                  style={{
                    width: "100%",
                    height: 40,
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                />
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    margin: "4px 0 0 0",
                  }}
                >
                  Minimal 2 karakter. Duplikasi nama (termasuk variasi huruf besar/kecil &amp; spasi) akan dicegah otomatis.
                </p>
              </div>

              {/* Field: Warna (Named Color Selector) */}
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Pilihan Warna Identifikasi <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))",
                    gap: 8,
                  }}
                >
                  {AVAILABLE_COLORS.map((colKey) => {
                    const cfg = CATERING_COLOR_CONFIG[colKey];
                    const isSelected = !formColorHex && formWarna === colKey;
                    return (
                      <button
                        key={colKey}
                        type="button"
                        onClick={() => {
                          setFormWarna(colKey);
                          setFormColorHex(null);
                        }}
                        disabled={formSubmitting}
                        style={{
                          padding: "8px 6px",
                          borderRadius: 6,
                          border: isSelected
                            ? "2px solid var(--text)"
                            : "1px solid var(--border)",
                          backgroundColor: isSelected
                            ? "var(--bg-subtle, #f3f4f6)"
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 2px 5px rgba(0,0,0,0.1)" : "none",
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            backgroundColor: cfg.hex,
                            display: "inline-block",
                            border: "1px solid rgba(0,0,0,0.2)",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? "var(--text)" : "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Info & tombol kustom warna di dalam modal edit/tambah */}
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: formColorHex || CATERING_COLOR_CONFIG[formWarna]?.hex || "#3B82F6",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "#334155" }}>
                      Warna aktif:{" "}
                      <strong>
                        {formColorHex ? `Kustom (${formColorHex})` : CATERING_COLOR_CONFIG[formWarna]?.label}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setColorPickerCatering({
                        id: selectedCatering ? selectedCatering.id : 0,
                        nama: formNama || "Pratinjau Katering",
                        warna: formWarna,
                        color_hex: formColorHex,
                        bentuk: formBentuk,
                        is_active: true,
                      });
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      color: "#2563EB",
                      cursor: "pointer",
                    }}
                  >
                    Buka Color Picker
                  </button>
                </div>
              </div>

              {/* Field: Bentuk */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Pilihan Bentuk Visual <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 12,
                  }}
                >
                  {AVAILABLE_SHAPES.map((shape) => {
                    const isSelected = formBentuk === shape;
                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setFormBentuk(shape)}
                        disabled={formSubmitting}
                        style={{
                          padding: "12px 10px",
                          borderRadius: 6,
                          border: isSelected
                            ? "2px solid var(--red)"
                            : "1px solid var(--border)",
                          backgroundColor: isSelected
                            ? "var(--red-bg, rgba(220, 38, 38, 0.06))"
                            : "var(--bg-subtle, transparent)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <CateringShapeBadge
                          shape={shape}
                          color={formColorHex || formWarna}
                          size="md"
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? "var(--red)" : "var(--text-secondary)",
                          }}
                        >
                          {CATERING_SHAPE_LABELS[shape]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field: Grup Reward & Punishment (R&P) */}
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="catering-rpgroup-select"
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Grup Reward & Punishment (R&P)
                </label>
                <select
                  id="catering-rpgroup-select"
                  value={formRPGroup}
                  onChange={(e) => setFormRPGroup(e.target.value as "A" | "B" | "")}
                  disabled={formSubmitting}
                  className="input-field"
                  style={{
                    width: "100%",
                    height: 40,
                    fontSize: 13,
                    borderRadius: 6,
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--bg, #ffffff)",
                    color: "var(--text)",
                  }}
                >
                  <option value="">Belum Ditentukan (Unset)</option>
                  <option value="A">Grup A</option>
                  <option value="B">Grup B</option>
                </select>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginTop: 5,
                    marginBottom: 0,
                  }}
                >
                  Penetapan grup default katering untuk evaluasi Reward & Punishment bulanan.
                </p>
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 6,
                  backgroundColor: "var(--bg-subtle, #f9fafb)",
                  border: "1px dashed var(--border)",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--text-muted)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    LIVE PREVIEW
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    <CateringShapeBadge
                      shape={formBentuk}
                      color={formColorHex || formWarna}
                      size="lg"
                      shadow
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--text)",
                        }}
                      >
                        {formNama.trim() || "Nama Katering"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {CATERING_SHAPE_LABELS[formBentuk] || "Bundar"} • Warna {CATERING_COLOR_CONFIG[formWarna]?.label}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: "rgba(22, 163, 74, 0.12)",
                      color: "#16a34a",
                    }}
                  >
                    AKTIF
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeModal}
                  disabled={formSubmitting}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-solid"
                  disabled={formSubmitting}
                  style={{
                    padding: "8px 20px",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {formSubmitting && (
                    <RefreshCw
                      size={14}
                      className="spin-icon"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  )}
                  <span>
                    {modalMode === "add"
                      ? formSubmitting
                        ? "Menyimpan..."
                        : "Simpan Katering"
                      : formSubmitting
                      ? "Menyimpan Perubahan..."
                      : "Simpan Perubahan"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DIALOG KONFIRMASI STATUS AKTIF / NONAKTIF */}
      {/* ============================================================ */}
      {statusDialogData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !statusSubmitting)
              setStatusDialogData(null);
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 460,
              padding: "24px 24px 20px",
              borderRadius: 8,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              animation: "scaleUp 0.15s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: statusDialogData.targetStatus
                    ? "rgba(22, 163, 74, 0.12)"
                    : "rgba(217, 119, 6, 0.12)",
                  color: statusDialogData.targetStatus ? "#16a34a" : "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Power size={20} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    margin: "0 0 6px 0",
                    color: "var(--text)",
                  }}
                >
                  {statusDialogData.targetStatus
                    ? "Aktifkan Katering Ini?"
                    : "Nonaktifkan Katering Ini?"}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {statusDialogData.targetStatus ? (
                    <>
                      Katering <strong>{statusDialogData.catering.nama}</strong> akan dapat dipilih kembali pada seluruh form input data baru.
                    </>
                  ) : (
                    <>
                      Katering <strong>{statusDialogData.catering.nama}</strong> tidak akan muncul pada pilihan form input baru, namun data dan laporan historis yang sudah ada tetap aman dan tidak akan terhapus.
                    </>
                  )}
                </p>
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
                className="btn btn-outline"
                onClick={() => setStatusDialogData(null)}
                disabled={statusSubmitting}
                style={{ padding: "8px 16px", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-solid"
                onClick={handleConfirmStatusToggle}
                disabled={statusSubmitting}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  backgroundColor: statusDialogData.targetStatus
                    ? "#16a34a"
                    : "#d97706",
                  borderColor: statusDialogData.targetStatus
                    ? "#16a34a"
                    : "#d97706",
                }}
              >
                {statusSubmitting
                  ? "Memproses..."
                  : statusDialogData.targetStatus
                  ? "Aktifkan"
                  : "Nonaktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL KONFIRMASI HAPUS PERMANEN & IMPACT BREAKDOWN */}
      {/* ============================================================ */}
      {/* Unified ConfirmDeleteModal */}
      <ConfirmDeleteModal
        isOpen={!!deleteModalCatering}
        title="Hapus Katering Secara Permanen?"
        itemName={deleteModalCatering ? `Katering "${deleteModalCatering.nama}"` : undefined}
        description={
          deleteModalCatering ? (
            <span>
              Katering <strong>“{deleteModalCatering.nama}”</strong> dan seluruh riwayat data yang terkait akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </span>
          ) : undefined
        }
        impactWarning={
          deleteImpactLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={14} className="spin-icon" style={{ animation: "spin 1s linear infinite" }} />
              <span>Menghitung seluruh riwayat data terkait...</span>
            </div>
          ) : deleteImpactError ? (
            <div>
              <div style={{ color: "var(--red)", marginBottom: 6 }}>{deleteImpactError}</div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleRetryLoadImpact}
                style={{ padding: "3px 10px", fontSize: 11 }}
              >
                Coba Lagi
              </button>
            </div>
          ) : deleteImpact ? (
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
                Total Data Terhubung:{" "}
                <span style={{ color: "var(--red)" }}>
                  {deleteImpact.total_related_records} catatan
                </span>
              </div>
              {deleteImpact.total_related_records > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 10px",
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  {Object.entries(deleteImpact.breakdown)
                    .filter(([_, count]) => count > 0)
                    .map(([key, count]) => (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          borderBottom: "1px dotted var(--border)",
                          paddingBottom: 2,
                        }}
                      >
                        <span>{IMPACT_LABELS[key] || key}:</span>
                        <strong style={{ color: "var(--text)" }}>{count}</strong>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Tidak ada data riwayat atau laporan yang terhubung dengan katering ini.
                </div>
              )}
            </div>
          ) : null
        }
        confirmText="Hapus Permanen"
        cancelText="Batal"
        loadingText="Menghapus..."
        isLoading={deleteSubmitting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={closeDeleteModal}
      />

      {/* ============================================================ */}
      {/* MODAL KUSTOMISASI WARNA KATERING */}
      {/* ============================================================ */}
      {colorPickerCatering && (
        <CateringColorPickerModal
          isOpen={Boolean(colorPickerCatering)}
          onClose={() => setColorPickerCatering(null)}
          cateringName={colorPickerCatering.nama}
          initialColorHex={colorPickerCatering.color_hex}
          onSave={async (newColorHex) => {
            // Jika dipanggil dari dalam modal tambah/edit (colorPickerCatering.id === 0 atau isModalOpen)
            if (isModalOpen) {
              setFormColorHex(newColorHex);
              showToast(
                newColorHex
                  ? `Warna kustom ${newColorHex} dipilih.`
                  : "Warna direset ke default.",
                "success"
              );
              return;
            }

            try {
              await updateCatering(colorPickerCatering.id, {
                color_hex: newColorHex,
              });
              showToast(
                newColorHex
                  ? `Warna kustom untuk ${colorPickerCatering.nama} berhasil diperbarui.`
                  : `Warna kustom untuk ${colorPickerCatering.nama} berhasil direset ke default.`,
                "success"
              );
              await fetchCaterings();
            } catch (err: any) {
              showToast(err?.message || "Gagal menyimpan warna katering.", "error");
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
