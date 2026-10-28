"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  History,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  X,
  Info,
  Check,
  Search,
  Camera,
  FileCheck,
  Sparkles,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { useCaterings } from "@/hooks/useCaterings";
import {
  getAuditKriteria,
  createAuditEntryV1,
  getAuditEntryDetail,
  deleteAuditEntryV1,
  addAuditFinding,
  deleteAuditFinding,
  finalizeAuditEntry,
  getAuditFindingPhotoUrl,
  AuditKriteriaItem,
  AuditEntryItemResponse,
  AuditFindingItem,
} from "@/lib/api";
import { CateringSelect } from "@/components/CateringSelect";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import AuditSubnav from "@/components/AuditSubnav";
import ProtectedImage from "@/components/ProtectedImage";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { formatDisplayDate } from "@/lib/audit";

interface UnsavedFindingDraft {
  keterangan: string;
  photos: File[];
  previews: string[];
  saving: boolean;
  error?: string | null;
}

interface ExtendedKriteriaItem extends AuditKriteriaItem {
  indexInCategory: number;
}

interface CategoryGroup {
  sisi: "A" | "B";
  sisiLabel: string;
  kategori: string;
  items: ExtendedKriteriaItem[];
}

// Helper to clean spaced category names for display (e.g. "B A H A N" -> "BAHAN")
const formatCategoryDisplay = (kat: string): string => {
  if (!kat) return "";
  if (/^([A-Za-z]\s+)+[A-Za-z]$/.test(kat.trim())) {
    return kat.replace(/\s+/g, "");
  }
  return kat.trim();
};

export default function InputAuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError, showWarning } = useToast();
  const { caterings: activeCaterings, loading: cateringsLoading } = useCaterings({ activeOnly: true });
  const { caterings: allCaterings } = useCaterings({ activeOnly: false });
  const caterings = activeCaterings.length > 0 ? activeCaterings : allCaterings;

  // 1. Master Kriteria
  const [allKriteria, setAllKriteria] = useState<AuditKriteriaItem[]>([]);
  const [loadingKriteria, setLoadingKriteria] = useState<boolean>(true);

  // 2. Form Identitas Audit (sebelum draft aktif)
  const [cateringId, setCateringId] = useState<string>("");
  const [tanggal, setTanggal] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [catatanUmum, setCatatanUmum] = useState<string>("");
  const [creatingAudit, setCreatingAudit] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<"catering" | "tanggal" | null>(null);

  // 3. State Audit Aktif (Draft atau Final)
  const [activeAudit, setActiveAudit] = useState<AuditEntryItemResponse | null>(null);
  const [loadingActiveAudit, setLoadingActiveAudit] = useState<boolean>(false);
  const [findingsList, setFindingsList] = useState<AuditFindingItem[]>([]);

  // 4. State Unsaved Findings per Kriteria ID
  // key: kriteria_id
  const [unsavedFindings, setUnsavedFindings] = useState<Record<number, UnsavedFindingDraft>>({});

  // 5. Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "A" | "B" | "findings">("all");

  // 6. Modals
  const [isNoFindingsModalOpen, setIsNoFindingsModalOpen] = useState<boolean>(false);
  const [finalizingNoFindings, setFinalizingNoFindings] = useState<boolean>(false);

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState<boolean>(false);
  const [finalizingAudit, setFinalizingAudit] = useState<boolean>(false);

  const [findingToDelete, setFindingToDelete] = useState<{
    findingId: number;
    material: string;
    kriteriaId: number;
  } | null>(null);
  const [deletingFinding, setDeletingFinding] = useState<boolean>(false);

  const [isDeleteDraftModalOpen, setIsDeleteDraftModalOpen] = useState<boolean>(false);
  const [deletingDraft, setDeletingDraft] = useState<boolean>(false);

  // 7. Lightbox Pratinjau Foto
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Keyboard accessibility (Escape key to close modals/lightbox)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewPhotoUrl) {
          setPreviewPhotoUrl(null);
        } else if (findingToDelete && !deletingFinding) {
          setFindingToDelete(null);
        } else if (isNoFindingsModalOpen && !finalizingNoFindings) {
          setIsNoFindingsModalOpen(false);
        } else if (isFinalizeModalOpen && !finalizingAudit) {
          setIsFinalizeModalOpen(false);
        } else if (isDeleteDraftModalOpen && !deletingDraft) {
          setIsDeleteDraftModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    previewPhotoUrl,
    findingToDelete,
    deletingFinding,
    isNoFindingsModalOpen,
    finalizingNoFindings,
    isFinalizeModalOpen,
    finalizingAudit,
    isDeleteDraftModalOpen,
    deletingDraft,
  ]);

  // Muat Master Kriteria Audit
  useEffect(() => {
    let isMounted = true;
    async function loadMasterKriteria() {
      try {
        setLoadingKriteria(true);
        const res = await getAuditKriteria();
        if (isMounted) {
          setAllKriteria(res.all || []);
        }
      } catch (err: any) {
        if (isMounted) {
          showError("Gagal memuat daftar kriteria audit: " + (err?.message || ""));
        }
      } finally {
        if (isMounted) {
          setLoadingKriteria(false);
        }
      }
    }
    loadMasterKriteria();
    return () => {
      isMounted = false;
    };
  }, [showError]);

  // Resume Draft jika ada parameter ?id=...
  useEffect(() => {
    const auditIdParam = searchParams.get("id");
    if (!auditIdParam) return;

    let isMounted = true;
    async function resumeDraft(id: number) {
      try {
        setLoadingActiveAudit(true);
        const detail = await getAuditEntryDetail(id);
        if (isMounted && detail) {
          setActiveAudit(detail);
          setFindingsList(detail.findings || []);
          setCateringId(String(detail.catering_id));
          setTanggal(detail.tanggal);
          setCatatanUmum(detail.catatan_umum || "");
        }
      } catch (err: any) {
        if (isMounted) {
          showError("Gagal memuat draft audit yang dipilih: " + (err?.message || ""));
        }
      } finally {
        if (isMounted) {
          setLoadingActiveAudit(false);
        }
      }
    }

    const idNum = Number(auditIdParam);
    if (!isNaN(idNum) && idNum > 0) {
      resumeDraft(idNum);
    }
    return () => {
      isMounted = false;
    };
  }, [searchParams, showError]);

  // Map saved findings by kriteria id
  const savedFindingsMap = useMemo(() => {
    const map = new Map<number, AuditFindingItem[]>();
    for (const f of findingsList) {
      const list = map.get(f.audit_kriteria_id) || [];
      list.push(f);
      map.set(f.audit_kriteria_id, list);
    }
    return map;
  }, [findingsList]);

  // Group all criteria by Sisi and Kategori
  const groupedCategories = useMemo<CategoryGroup[]>(() => {
    const groups: CategoryGroup[] = [];
    const map = new Map<string, ExtendedKriteriaItem[]>();

    for (const k of allKriteria) {
      const sisi = (k.sisi || "A").toUpperCase() as "A" | "B";
      const kat = k.kategori || "UMUM";
      const key = `${sisi}:::${kat}`;

      if (!map.has(key)) {
        map.set(key, []);
      }
      const list = map.get(key)!;
      list.push({
        ...k,
        sisi,
        indexInCategory: list.length + 1,
      });
    }

    for (const [key, items] of map.entries()) {
      const [sisiStr, kategori] = key.split(":::");
      const sisi = sisiStr as "A" | "B";
      groups.push({
        sisi,
        sisiLabel: sisi === "A" ? "Form A (Sisi A)" : "Form B (Sisi B)",
        kategori,
        items,
      });
    }

    return groups;
  }, [allKriteria]);

  // Unique violated criteria count
  const violatedCriteriaCount = useMemo(() => {
    return new Set(findingsList.map((f) => f.audit_kriteria_id)).size;
  }, [findingsList]);

  // Check if any unsaved finding form is open
  const hasUnsavedRows = Object.keys(unsavedFindings).length > 0;

  // Filtered categories based on Search Query and Sisi/Findings Tab
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return groupedCategories
      .map((group) => {
        // Tab filter
        if (filterTab === "A" && group.sisi !== "A") return null;
        if (filterTab === "B" && group.sisi !== "B") return null;

        // Filter items
        const matchingItems = group.items.filter((item) => {
          const hasSaved = savedFindingsMap.has(item.id);
          const hasUnsaved = Boolean(unsavedFindings[item.id]);

          if (filterTab === "findings" && !hasSaved && !hasUnsaved) {
            return false;
          }

          if (!q) return true;

          const matchMat = (item.material || "").toLowerCase().includes(q);
          const matchDesk = (item.deskripsi || "").toLowerCase().includes(q);
          const matchKat = (item.kategori || "").toLowerCase().includes(q);
          const matchNo = String(item.indexInCategory) === q || `#${item.id}` === q;

          return matchMat || matchDesk || matchKat || matchNo;
        });

        if (matchingItems.length === 0) return null;

        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((g): g is CategoryGroup => g !== null);
  }, [groupedCategories, filterTab, searchQuery, savedFindingsMap, unsavedFindings]);

  // Action: Mulai Audit Baru (Draft Creation)
  const handleStartAudit = async () => {
    if (!cateringId) {
      setValidationError("catering");
      showWarning("Silakan pilih Katering rekanan terlebih dahulu.");
      if (typeof document !== "undefined") {
        document.getElementById("select-catering")?.focus();
      }
      return;
    }
    if (!tanggal) {
      setValidationError("tanggal");
      showWarning("Silakan tentukan Tanggal pelaksanaan audit.");
      if (typeof document !== "undefined") {
        document.getElementById("input-tanggal-audit")?.focus();
      }
      return;
    }
    setValidationError(null);

    try {
      setCreatingAudit(true);
      const res = await createAuditEntryV1({
        catering_id: Number(cateringId),
        tanggal,
        catatan_umum: catatanUmum.trim() || undefined,
      });

      setActiveAudit(res);
      setFindingsList([]);
      setUnsavedFindings({});
      showSuccess(`Draft audit untuk ${res.catering_nama} berhasil dibuat. Silakan periksa checklist kriteria.`);

      router.replace(`/audit/input?id=${res.id}`);
    } catch (err: any) {
      if (err?.status === 503 || (typeof err?.message === "string" && err.message.includes("503"))) {
        showError("Fitur Audit Temuan V1 belum aktif di server. Hubungi administrator sistem.");
      } else {
        showError(err?.message || "Gagal membuat draft audit baru.");
      }
    } finally {
      setCreatingAudit(false);
    }
  };

  // Action: Toggle Mark ✕ on Criterion
  const handleToggleMark = (k: AuditKriteriaItem) => {
    if (activeAudit?.status === "final") return;

    // 1. If already saved in backend, offer delete confirm
    const saved = savedFindingsMap.get(k.id);
    if (saved && saved.length > 0) {
      setFindingToDelete({
        findingId: saved[0].id,
        material: k.material || k.deskripsi,
        kriteriaId: k.id,
      });
      return;
    }

    // 2. If row is currently open unsaved, toggle off (cancel)
    if (unsavedFindings[k.id]) {
      handleCancelUnsaved(k.id);
      return;
    }

    // 3. Open unsaved form for this criterion
    setUnsavedFindings((prev) => ({
      ...prev,
      [k.id]: {
        keterangan: "",
        photos: [],
        previews: [],
        saving: false,
        error: null,
      },
    }));
  };

  // Action: Photo selection on a row
  const handleRowPhotosChange = (kriteriaId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    const validFiles: File[] = [];
    for (const f of files) {
      if (!allowedTypes.includes(f.type.toLowerCase())) {
        showWarning(`File "${f.name}" ditolak. Hanya format JPG, JPEG, PNG, dan WEBP yang didukung.`);
        continue;
      }
      if (f.size > maxSize) {
        showWarning(`File "${f.name}" ditolak karena melebihi 5MB.`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    setUnsavedFindings((prev) => {
      const current = prev[kriteriaId] || { keterangan: "", photos: [], previews: [], saving: false };
      const combined = [...current.photos, ...validFiles].slice(0, 10);
      if (current.photos.length + validFiles.length > 10) {
        showWarning("Maksimal 10 foto bukti per temuan.");
      }
      const newPreviews = combined.map((f) => URL.createObjectURL(f));
      return {
        ...prev,
        [kriteriaId]: {
          ...current,
          photos: combined,
          previews: newPreviews,
          error: null,
        },
      };
    });

    e.target.value = "";
  };

  // Action: Remove photo from unsaved row
  const handleRowRemovePhoto = (kriteriaId: number, indexToRemove: number) => {
    setUnsavedFindings((prev) => {
      const current = prev[kriteriaId];
      if (!current) return prev;
      if (current.previews[indexToRemove]) {
        URL.revokeObjectURL(current.previews[indexToRemove]);
      }
      const updatedPhotos = current.photos.filter((_, idx) => idx !== indexToRemove);
      const updatedPreviews = current.previews.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        [kriteriaId]: {
          ...current,
          photos: updatedPhotos,
          previews: updatedPreviews,
        },
      };
    });
  };

  // Action: Cancel unsaved form on row
  const handleCancelUnsaved = (kriteriaId: number) => {
    const draft = unsavedFindings[kriteriaId];
    if (draft) {
      draft.previews.forEach((url) => URL.revokeObjectURL(url));
    }
    setUnsavedFindings((prev) => {
      const next = { ...prev };
      delete next[kriteriaId];
      return next;
    });
  };

  // Action: Simpan Temuan Row to Backend
  const handleSaveRowFinding = async (k: AuditKriteriaItem) => {
    if (!activeAudit) return;
    const draft = unsavedFindings[k.id];
    if (!draft) return;

    const cleanKeterangan = draft.keterangan.trim();
    if (!cleanKeterangan) {
      setUnsavedFindings((prev) => ({
        ...prev,
        [k.id]: { ...prev[k.id], error: "Keterangan temuan wajib diisi." },
      }));
      return;
    }

    if (draft.photos.length === 0) {
      setUnsavedFindings((prev) => ({
        ...prev,
        [k.id]: { ...prev[k.id], error: "Foto bukti wajib ditambahkan untuk temuan ini." },
      }));
      return;
    }

    try {
      setUnsavedFindings((prev) => ({
        ...prev,
        [k.id]: { ...prev[k.id], saving: true, error: null },
      }));

      const formData = new FormData();
      formData.append("audit_kriteria_id", String(k.id));
      formData.append("keterangan", cleanKeterangan);
      draft.photos.forEach((file) => {
        formData.append("photos", file);
      });

      await addAuditFinding(activeAudit.id, formData);

      // Cleanup preview URLs
      draft.previews.forEach((url) => URL.revokeObjectURL(url));

      // Remove from unsaved
      setUnsavedFindings((prev) => {
        const next = { ...prev };
        delete next[k.id];
        return next;
      });

      // Refresh detail audit
      const updatedDetail = await getAuditEntryDetail(activeAudit.id);
      setActiveAudit(updatedDetail);
      setFindingsList(updatedDetail.findings || []);

      showSuccess(`Temuan untuk kriteria "${k.material || k.deskripsi}" berhasil disimpan.`);
    } catch (err: any) {
      setUnsavedFindings((prev) => ({
        ...prev,
        [k.id]: {
          ...prev[k.id],
          saving: false,
          error: err?.message || "Gagal menyimpan temuan. Periksa koneksi dan file foto.",
        },
      }));
    }
  };

  // Action: Confirm Delete Saved Finding
  const handleConfirmDeleteFinding = async () => {
    if (!activeAudit || !findingToDelete) return;
    try {
      setDeletingFinding(true);
      await deleteAuditFinding(activeAudit.id, findingToDelete.findingId);
      const updatedDetail = await getAuditEntryDetail(activeAudit.id);
      setActiveAudit(updatedDetail);
      setFindingsList(updatedDetail.findings || []);
      showSuccess(`Temuan kriteria "${findingToDelete.material}" berhasil dihapus.`);
      setFindingToDelete(null);
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus temuan.");
    } finally {
      setDeletingFinding(false);
    }
  };

  // Action: Finalize Guard
  const handleAttemptFinalize = (isNoFindings: boolean) => {
    if (hasUnsavedRows) {
      showWarning("Ada temuan yang belum disimpan. Lengkapi foto dan keterangan lalu klik Simpan Temuan, atau batalkan tanda ✕ terlebih dahulu.");
      return;
    }
    if (isNoFindings) {
      setIsNoFindingsModalOpen(true);
    } else {
      setIsFinalizeModalOpen(true);
    }
  };

  // Action: Finalisasi Audit Tanpa Temuan
  const handleFinalizeNoFindings = async () => {
    if (!activeAudit) return;
    try {
      setFinalizingNoFindings(true);
      const res = await finalizeAuditEntry(activeAudit.id, true);
      setActiveAudit(res);
      setIsNoFindingsModalOpen(false);
      showSuccess("Audit berhasil diselesaikan tanpa temuan (Nilai: 100.00%).");
      router.push("/audit/riwayat");
    } catch (err: any) {
      showError(err?.message || "Gagal menyelesaikan audit tanpa temuan.");
    } finally {
      setFinalizingNoFindings(false);
    }
  };

  // Action: Finalisasi Audit Dengan Temuan
  const handleFinalizeWithFindings = async () => {
    if (!activeAudit) return;
    try {
      setFinalizingAudit(true);
      const res = await finalizeAuditEntry(activeAudit.id, false);
      setActiveAudit(res);
      setIsFinalizeModalOpen(false);
      showSuccess(`Audit berhasil difinalisasi dengan ${findingsList.length} temuan.`);
      router.push("/audit/riwayat");
    } catch (err: any) {
      showError(err?.message || "Gagal memfinalisasi audit.");
    } finally {
      setFinalizingAudit(false);
    }
  };

  // Action: Hapus Draft Audit
  const handleDeleteDraft = async () => {
    if (!activeAudit) return;
    try {
      setDeletingDraft(true);
      await deleteAuditEntryV1(activeAudit.id);
      showSuccess("Draft audit berhasil dihapus.");
      setIsDeleteDraftModalOpen(false);
      setActiveAudit(null);
      setFindingsList([]);
      setUnsavedFindings({});
      router.replace("/audit");
    } catch (err: any) {
      showError(err?.message || "Gagal menghapus draft audit.");
    } finally {
      setDeletingDraft(false);
    }
  };

  const isFinal = activeAudit?.status === "final";
  const hasSavedFindings = findingsList.length > 0;
  const currentScoreDisplay = activeAudit?.nilai_audit !== undefined
    ? Number(activeAudit.nilai_audit).toFixed(2)
    : "100.00";
  const totalMaxPoints = (activeAudit?.maksimum_sisi_a || 510) + (activeAudit?.maksimum_sisi_b || 650);
  const totalEarnedPoints = (activeAudit?.nilai_sisi_a !== undefined && activeAudit?.nilai_sisi_b !== undefined)
    ? Math.round(activeAudit.nilai_sisi_a + activeAudit.nilai_sisi_b)
    : totalMaxPoints;

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px 60px" }}>
      {/* Head / Breadcrumbs */}
      <div className="page-head-row" style={{ marginBottom: "20px" }}>
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
              INPUT AUDIT
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
            Input Audit Dapur
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Pemeriksaan kebersihan dan kelayakan dapur katering. Kriteria default sesuai standar; tandai ✕ hanya pada kriteria yang tidak sesuai.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/audit/riwayat"
            className="btn-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12.5px",
              padding: "7px 14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <History size={14} />
            <span>Lihat Riwayat Audit</span>
          </Link>
          <HeaderMetaBoxes />
        </div>
      </div>

      {/* Subnavigation Tabs */}
      <AuditSubnav activeTab="input" />

      {/* Loading state saat resume draft */}
      {loadingActiveAudit && (
        <div
          style={{
            padding: "40px",
            backgroundColor: "var(--card)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 600 }}>Memuat sesi audit...</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SEBELUM DRAFT AKTIF: FORM IDENTITAS AUDIT                              */}
      {/* ========================================================================= */}
      {!activeAudit && !loadingActiveAudit && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Petunjuk Penggunaan Cepat */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "var(--text)" }}>
              <Sparkles size={16} style={{ color: "var(--red)" }} />
              <strong style={{ fontSize: "13.5px" }}>Alur Pemeriksaan Cepat di Lapangan</strong>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "var(--sidebar-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0 }}>
                  1
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "12px", color: "var(--text)", marginBottom: "2px" }}>Mulai Draft Audit</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>Pilih katering rekanan dan tanggal, lalu klik &quot;Mulai Audit&quot;.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "var(--sidebar-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0 }}>
                  2
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "12px", color: "var(--text)", marginBottom: "2px" }}>54 Kriteria Otomatis Tampil</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>Seluruh kriteria langsung terlihat dalam bentuk checklist visual terstruktur.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "var(--red-bg)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0 }}>
                  ✕
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "12px", color: "var(--text)", marginBottom: "2px" }}>Tandai ✕ Jika Bermasalah</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>Item sesuai tidak perlu dicentang. Hanya tandai ✕ jika ditemukan ketidaksesuaian.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "rgba(22, 163, 74, 0.12)", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0 }}>
                  ✓
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "12px", color: "var(--text)", marginBottom: "2px" }}>Finalisasi Cepat</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>Jika 0 temuan, selesaikan langsung tanpa temuan untuk perolehan nilai 100%.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Identitas */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  backgroundColor: "var(--red-bg)",
                  color: "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "15px",
                }}
              >
                1
              </div>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Identitas &amp; Jadwal Audit Fisik</h2>
                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  Tentukan katering rekanan dan tanggal pelaksanaan audit untuk membuka formulir checklist 54 kriteria.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
                marginBottom: "18px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  KATERING <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <CateringSelect
                  id="select-catering"
                  caterings={caterings}
                  value={cateringId}
                  onChange={(val) => {
                    setCateringId(val);
                    if (validationError === "catering") setValidationError(null);
                  }}
                  context="input"
                  placeholder={cateringsLoading ? "Memuat katering rekanan..." : "Pilih Katering Rekanan"}
                  disabled={creatingAudit || cateringsLoading}
                  style={
                    validationError === "catering"
                      ? { outline: "2px solid var(--red)", borderRadius: "8px" }
                      : undefined
                  }
                />
                {validationError === "catering" && (
                  <p style={{ margin: "5px 0 0 0", fontSize: "11.5px", color: "var(--red)", fontWeight: 600 }}>
                    ⚠️ Silakan pilih katering rekanan terlebih dahulu.
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  TANGGAL AUDIT <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  id="input-tanggal-audit"
                  type="date"
                  value={tanggal}
                  onChange={(e) => {
                    setTanggal(e.target.value);
                    if (validationError === "tanggal") setValidationError(null);
                  }}
                  disabled={creatingAudit}
                  style={{
                    width: "100%",
                    height: "38px",
                    borderRadius: "6px",
                    border: validationError === "tanggal" ? "2px solid var(--red)" : "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    color: "var(--text)",
                    padding: "0 12px",
                    fontSize: "13px",
                    fontWeight: 500,
                    outline: "none",
                  }}
                />
                {validationError === "tanggal" && (
                  <p style={{ margin: "5px 0 0 0", fontSize: "11.5px", color: "var(--red)", fontWeight: 600 }}>
                    ⚠️ Silakan tentukan tanggal pelaksanaan audit.
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                }}
              >
                CATATAN UMUM AUDIT (OPSIONAL)
              </label>
              <textarea
                value={catatanUmum}
                onChange={(e) => setCatatanUmum(e.target.value)}
                placeholder="Contoh: Audit berkala shift siang didampingi supervisor katering..."
                disabled={creatingAudit}
                rows={2}
                style={{
                  width: "100%",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  color: "var(--text)",
                  padding: "10px 12px",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                id="btn-mulai-audit"
                onClick={handleStartAudit}
                disabled={creatingAudit}
                title={
                  !cateringId
                    ? "Pilih katering rekanan terlebih dahulu"
                    : !tanggal
                    ? "Tentukan tanggal audit terlebih dahulu"
                    : "Mulai sesi audit baru"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "var(--red)",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: "6px",
                  fontSize: "13.5px",
                  fontWeight: 700,
                  cursor: creatingAudit ? "not-allowed" : "pointer",
                  opacity: creatingAudit ? 0.7 : 1,
                  boxShadow: "0 1px 3px rgba(220, 38, 38, 0.25)",
                  transition: "opacity 0.15s ease",
                }}
              >
                {creatingAudit ? (
                  <>
                    <div className="spinner-sm" /> Membuka Sesi Audit...
                  </>
                ) : (
                  <>
                    <span>Mulai Audit</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KETIKA DRAFT / AUDIT AKTIF: CHECKLIST 54 KRITERIA LANGSUNG TERLIHAT    */}
      {/* ========================================================================= */}
      {activeAudit && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Header Metadata Audit Sesi Aktif */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: isFinal ? "rgba(22, 163, 74, 0.12)" : "rgba(234, 179, 8, 0.12)",
                    color: isFinal ? "#15803d" : "#b45309",
                    border: isFinal ? "1px solid #86efac" : "1px solid #fde047",
                  }}
                >
                  {isFinal ? "STATUS: FINAL" : "SESI DRAFT AKTIF"}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  ID #{activeAudit.id}
                </span>
              </div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                {activeAudit.catering_nama}
              </h2>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                Pelaksanaan: <strong>{formatDisplayDate(activeAudit.tanggal)}</strong>
                {activeAudit.catatan_umum && ` • "${activeAudit.catatan_umum}"`}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {!isFinal ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteDraftModalOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12.5px",
                    color: "#dc2626",
                    backgroundColor: "#fff1f2",
                    border: "1px solid #fecdd3",
                    padding: "7px 12px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Hapus Draft</span>
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAudit(null);
                      setFindingsList([]);
                      setUnsavedFindings({});
                      router.replace("/audit/input");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12.5px",
                      backgroundColor: "var(--card)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                      padding: "7px 14px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} /> Buat Audit Baru
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SUMMARY BAR & PRIMARY FINALIZATION ACTION */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            {/* Simple KPI Summary (Total Kriteria: 54 | Temuan: X | Estimasi Nilai: XX.XX) */}
            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Total Kriteria
                </span>
                <span style={{ fontSize: "19px", fontWeight: 800, color: "var(--text)" }}>
                  {allKriteria.length || 54}
                </span>
              </div>

              <div style={{ width: "1px", height: "30px", backgroundColor: "var(--border)" }} />

              <div>
                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Temuan Lapangan
                </span>
                <span
                  style={{
                    fontSize: "19px",
                    fontWeight: 800,
                    color: findingsList.length > 0 ? "var(--red)" : "var(--green)",
                  }}
                >
                  {findingsList.length}{" "}
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                    ({violatedCriteriaCount} kriteria)
                  </span>
                </span>
              </div>

              <div style={{ width: "1px", height: "30px", backgroundColor: "var(--border)" }} />

              <div>
                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Nilai Audit
                </span>
                <span
                  style={{
                    fontSize: "19px",
                    fontWeight: 800,
                    color: Number(currentScoreDisplay) >= 80 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {currentScoreDisplay}%
                </span>
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  Total Poin: {totalEarnedPoints} / {totalMaxPoints}
                </span>
              </div>
            </div>

            {/* Tombol Aksi Finalisasi */}
            {!isFinal && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {!hasSavedFindings ? (
                  <button
                    type="button"
                    onClick={() => handleAttemptFinalize(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "var(--green)",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(22, 163, 74, 0.25)",
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Selesaikan Audit Tanpa Temuan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAttemptFinalize(false)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "var(--red)",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(220, 38, 38, 0.25)",
                    }}
                  >
                    <FileCheck size={16} />
                    <span>Finalisasi Audit ({findingsList.length} Temuan)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Banner Audit Final Read-Only */}
          {isFinal && (
            <div
              style={{
                backgroundColor: activeAudit.is_tanpa_temuan ? "var(--green-bg)" : "var(--red-bg)",
                border: activeAudit.is_tanpa_temuan ? "1px solid #86efac" : "1px solid #fca5a5",
                borderRadius: "var(--radius)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: activeAudit.is_tanpa_temuan ? "#16a34a" : "var(--red)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {activeAudit.is_tanpa_temuan ? <CheckCircle size={20} /> : <FileCheck size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: "14px", color: activeAudit.is_tanpa_temuan ? "#15803d" : "#b91c1c" }}>
                  {activeAudit.is_tanpa_temuan
                    ? "Audit Selesai Tanpa Temuan (Skor 100.00%)"
                    : `Audit Final Terkunci dengan ${findingsList.length} Temuan (Skor: ${currentScoreDisplay}%)`}
                </strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                  Formulir checklist di bawah ini dalam mode pratinjau (read-only) sesuai snapshot resmi saat finalisasi.
                </p>
              </div>
            </div>
          )}

          {/* FILTER & PENCARIAN KRITERIA */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {/* Search Bar */}
              <div style={{ position: "relative", flex: "1 1 280px" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari material, kriteria, atau kegiatan/proses..."
                  style={{
                    width: "100%",
                    height: "36px",
                    paddingLeft: "34px",
                    paddingRight: searchQuery ? "32px" : "12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--bg-subtle, #f8fafc)",
                    fontSize: "12.5px",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Bersihkan pencarian"
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      backgroundColor: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 2,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tabs: Semua | Form A | Form B | Temuan */}
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  padding: "2px",
                  gap: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  style={{
                    border: "none",
                    backgroundColor: filterTab === "all" ? "var(--card)" : "transparent",
                    color: filterTab === "all" ? "var(--text)" : "var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: filterTab === "all" ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: filterTab === "all" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Semua ({allKriteria.length || 54})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("A")}
                  style={{
                    border: "none",
                    backgroundColor: filterTab === "A" ? "var(--card)" : "transparent",
                    color: filterTab === "A" ? "var(--text)" : "var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: filterTab === "A" ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: filterTab === "A" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Form A (27)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("B")}
                  style={{
                    border: "none",
                    backgroundColor: filterTab === "B" ? "var(--card)" : "transparent",
                    color: filterTab === "B" ? "var(--text)" : "var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: filterTab === "B" ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: filterTab === "B" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  Form B (27)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("findings")}
                  style={{
                    border: "none",
                    backgroundColor: filterTab === "findings" ? "var(--red)" : "transparent",
                    color: filterTab === "findings" ? "#ffffff" : "var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: filterTab === "findings" ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: filterTab === "findings" ? "0 1px 2px rgba(220,38,38,0.2)" : "none",
                  }}
                >
                  Temuan ({findingsList.length})
                </button>
              </div>
            </div>

            {/* Quick Category Navigation Pills */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "2px",
              }}
            >
              {groupedCategories.map((group) => {
                const groupKey = `cat-${group.sisi}-${group.kategori}`;
                const hasViolated = group.items.some((it) => savedFindingsMap.has(it.id) || unsavedFindings[it.id]);

                return (
                  <a
                    key={groupKey}
                    href={`#${groupKey}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "normal",
                      borderRadius: "4px",
                      backgroundColor: hasViolated ? "var(--red-bg)" : "var(--bg-subtle, #f8fafc)",
                      color: hasViolated ? "var(--red)" : "var(--text-muted)",
                      border: hasViolated ? "1px solid rgba(220, 38, 38, 0.2)" : "1px solid var(--border)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ letterSpacing: "normal" }}>
                      {group.sisi} · {formatCategoryDisplay(group.kategori)}
                    </span>
                    {hasViolated && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "var(--red)",
                        }}
                      />
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* CHECKLIST KRITERIA AKTUAL (54 KRITERIA) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {filteredCategories.length === 0 ? (
              <div
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <Info size={24} style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 600 }}>
                  Tidak ada kriteria yang sesuai dengan filter atau kata kunci pencarian.
                </p>
              </div>
            ) : (
              filteredCategories.map((group) => {
                const groupAnchor = `cat-${group.sisi}-${group.kategori}`;
                const catFindings = group.items.filter((it) => savedFindingsMap.has(it.id));

                return (
                  <div
                    key={groupAnchor}
                    id={groupAnchor}
                    style={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    {/* Header Kelompok Kategori */}
                    <div
                      style={{
                        padding: "12px 18px",
                        backgroundColor: "var(--bg-subtle, #f8fafc)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: group.sisi === "A" ? "#eff6ff" : "#faf5ff",
                            color: group.sisi === "A" ? "#1d4ed8" : "#7e22ce",
                            border: group.sisi === "A" ? "1px solid #bfdbfe" : "1px solid #e9d5ff",
                          }}
                        >
                          {group.sisiLabel}
                        </span>
                        <h3 style={{ fontSize: "14.5px", fontWeight: 800, margin: 0, color: "var(--text)", letterSpacing: "normal" }}>
                          {formatCategoryDisplay(group.kategori)}
                        </h3>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
                          {group.items.length} Kriteria
                        </span>
                        {catFindings.length > 0 && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--red)",
                              backgroundColor: "var(--red-bg)",
                              border: "1px solid rgba(220, 38, 38, 0.2)",
                              borderRadius: "12px",
                              padding: "1px 8px",
                            }}
                          >
                            {catFindings.length} Temuan
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ============================================================= */}
                    {/* DESKTOP VIEW: TABEL CHECKLIST                                 */}
                    {/* ============================================================= */}
                    <div className="audit-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "#fafbfc" }}>
                            <th style={{ width: "50px", padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>
                              NO
                            </th>
                            <th style={{ width: "190px", padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>
                              MATERIAL
                            </th>
                            <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>
                              KEGIATAN / PROSES
                            </th>
                            <th style={{ width: "70px", padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>
                              POINT
                            </th>
                            <th style={{ width: "160px", padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>
                              STATUS / TEMUAN
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((k) => {
                            const saved = savedFindingsMap.get(k.id);
                            const isSaved = Boolean(saved && saved.length > 0);
                            const unsavedDraft = unsavedFindings[k.id];
                            const isUnsaved = Boolean(unsavedDraft);
                            const isViolated = isSaved || isUnsaved;

                            return (
                              <tr
                                key={`row-${k.id}`}
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                  backgroundColor: isViolated ? "rgba(239, 68, 68, 0.04)" : "#ffffff",
                                  borderLeft: isViolated ? "3px solid var(--red)" : "3px solid transparent",
                                  transition: "background-color 0.15s ease",
                                }}
                              >
                                {/* No */}
                                <td style={{ padding: "12px 14px", textAlign: "center", fontSize: "12.5px", fontWeight: 700, color: isViolated ? "var(--red)" : "var(--text-muted)" }}>
                                  {k.indexInCategory}
                                </td>

                                {/* Material */}
                                <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                                  {k.material || "-"}
                                </td>

                                {/* Kegiatan / Proses & Inline Expandable */}
                                <td style={{ padding: "12px 14px", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                  <div>{k.deskripsi}</div>

                                  {/* DETAIL TEMUAN TERSIMPAN (INLINE) */}
                                  {isSaved && saved && (
                                    <div
                                      style={{
                                        marginTop: "10px",
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        backgroundColor: "var(--red-bg)",
                                        border: "1px solid rgba(220, 38, 38, 0.2)",
                                      }}
                                    >
                                      {saved.map((f, fIdx) => (
                                        <div key={f.id || fIdx} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                            <div>
                                              <span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                Catatan Temuan:
                                              </span>
                                              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>
                                                {f.keterangan}
                                              </p>
                                            </div>

                                            {!isFinal && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setFindingToDelete({
                                                    findingId: f.id,
                                                    material: k.material || k.deskripsi,
                                                    kriteriaId: k.id,
                                                  })
                                                }
                                                title="Hapus temuan ini"
                                                aria-label={`Hapus temuan kriteria ${k.material || k.deskripsi}`}
                                                style={{
                                                  border: "none",
                                                  backgroundColor: "transparent",
                                                  color: "#dc2626",
                                                  cursor: "pointer",
                                                  padding: "3px",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                }}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </div>

                                          {/* Foto Bukti Tersimpan */}
                                          {f.photos && f.photos.length > 0 && (
                                            <div>
                                              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                                                Foto Bukti ({f.photos.length}):
                                              </span>
                                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                {f.photos.map((p) => {
                                                  const pUrl = p.url || getAuditFindingPhotoUrl(p.id);
                                                  return (
                                                    <button
                                                      key={p.id}
                                                      type="button"
                                                      onClick={() => setPreviewPhotoUrl(pUrl)}
                                                      title="Klik untuk memperbesar"
                                                      aria-label="Lihat foto bukti ukuran penuh"
                                                      style={{
                                                        width: "48px",
                                                        height: "48px",
                                                        borderRadius: "4px",
                                                        overflow: "hidden",
                                                        border: "1px solid var(--border)",
                                                        cursor: "pointer",
                                                        padding: 0,
                                                        backgroundColor: "#000",
                                                      }}
                                                    >
                                                      <ProtectedImage
                                                        src={pUrl}
                                                        alt="Foto Bukti Temuan"
                                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                      />
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* DETAIL FORM INPUT TEMUAN BARU (EXPANDED KETIKA ✕ DIKLIK) */}
                                  {isUnsaved && unsavedDraft && (
                                    <div
                                      style={{
                                        marginTop: "12px",
                                        padding: "14px",
                                        borderRadius: "6px",
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #fca5a5",
                                        boxShadow: "0 2px 4px rgba(220, 38, 38, 0.08)",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                                        <AlertTriangle size={15} style={{ color: "var(--red)" }} />
                                        <strong style={{ fontSize: "12.5px", color: "var(--red)" }}>
                                          Pencatatan Temuan: {k.material || k.deskripsi}
                                        </strong>
                                      </div>

                                      {/* Keterangan Temuan */}
                                      <div style={{ marginBottom: "10px" }}>
                                        <label
                                          style={{
                                            display: "block",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            color: "var(--text-muted)",
                                            marginBottom: "4px",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Keterangan Temuan <span style={{ color: "var(--red)" }}>*</span>
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={unsavedDraft.keterangan}
                                          onChange={(e) =>
                                            setUnsavedFindings((prev) => ({
                                              ...prev,
                                              [k.id]: { ...prev[k.id], keterangan: e.target.value, error: null },
                                            }))
                                          }
                                          placeholder="Deskripsikan ketidaksesuaian yang ditemukan di lapangan..."
                                          disabled={unsavedDraft.saving}
                                          style={{
                                            width: "100%",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            backgroundColor: "var(--card)",
                                            color: "var(--text)",
                                            padding: "8px 10px",
                                            fontSize: "12.5px",
                                            fontFamily: "inherit",
                                            outline: "none",
                                            resize: "vertical",
                                          }}
                                        />
                                      </div>

                                      {/* Foto Bukti */}
                                      <div style={{ marginBottom: "12px" }}>
                                        <label
                                          style={{
                                            display: "block",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            color: "var(--text-muted)",
                                            marginBottom: "4px",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Foto Bukti Fisik <span style={{ color: "var(--red)" }}>* (Wajib minimal 1 foto)</span>
                                        </label>

                                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                          <label
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "6px",
                                              fontSize: "12px",
                                              fontWeight: 600,
                                              padding: "6px 12px",
                                              borderRadius: "5px",
                                              border: "1px solid var(--border)",
                                              backgroundColor: "var(--bg-subtle, #f8fafc)",
                                              color: "var(--text)",
                                              cursor: unsavedDraft.saving ? "not-allowed" : "pointer",
                                            }}
                                          >
                                            <Camera size={14} />
                                            <span>Ambil / Unggah Foto</span>
                                            <input
                                              type="file"
                                              accept="image/jpeg,image/jpg,image/png,image/webp"
                                              multiple
                                              disabled={unsavedDraft.saving}
                                              onChange={(e) => handleRowPhotosChange(k.id, e)}
                                              style={{ display: "none" }}
                                            />
                                          </label>

                                          {/* Previews */}
                                          {unsavedDraft.previews.map((prevUrl, pIdx) => (
                                            <div
                                              key={pIdx}
                                              style={{
                                                position: "relative",
                                                width: "48px",
                                                height: "48px",
                                                borderRadius: "4px",
                                                overflow: "hidden",
                                                border: "1px solid var(--border)",
                                              }}
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={prevUrl}
                                                alt={`Pratinjau ${pIdx + 1}`}
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleRowRemovePhoto(k.id, pIdx)}
                                                disabled={unsavedDraft.saving}
                                                aria-label="Hapus foto ini"
                                                style={{
                                                  position: "absolute",
                                                  top: 2,
                                                  right: 2,
                                                  width: "16px",
                                                  height: "16px",
                                                  borderRadius: "50%",
                                                  backgroundColor: "rgba(0,0,0,0.6)",
                                                  color: "#ffffff",
                                                  border: "none",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  cursor: "pointer",
                                                  padding: 0,
                                                }}
                                              >
                                                <X size={10} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Error notice jika ada */}
                                      {unsavedDraft.error && (
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#dc2626",
                                            marginBottom: "10px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {unsavedDraft.error}
                                        </div>
                                      )}

                                      {/* Action buttons */}
                                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                        <button
                                          type="button"
                                          onClick={() => handleCancelUnsaved(k.id)}
                                          disabled={unsavedDraft.saving}
                                          style={{
                                            padding: "6px 14px",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            borderRadius: "4px",
                                            border: "1px solid var(--border)",
                                            backgroundColor: "#ffffff",
                                            color: "var(--text-secondary)",
                                            cursor: unsavedDraft.saving ? "not-allowed" : "pointer",
                                          }}
                                        >
                                          Batal
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveRowFinding(k)}
                                          disabled={unsavedDraft.saving}
                                          style={{
                                            padding: "6px 14px",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            borderRadius: "4px",
                                            border: "none",
                                            backgroundColor: "var(--red)",
                                            color: "#ffffff",
                                            cursor: unsavedDraft.saving ? "not-allowed" : "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                          }}
                                        >
                                          {unsavedDraft.saving ? (
                                            <>
                                              <div className="spinner-sm" /> Menyimpan...
                                            </>
                                          ) : (
                                            <>
                                              <Check size={14} /> Simpan Temuan
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* Point */}
                                <td style={{ padding: "12px 14px", textAlign: "center", fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      backgroundColor: "var(--bg-subtle, #f8fafc)",
                                      border: "1px solid var(--border)",
                                      fontSize: "11.5px",
                                    }}
                                  >
                                    {k.point}
                                  </span>
                                </td>

                                {/* Status / Temuan Control */}
                                <td style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>
                                  {isFinal ? (
                                    isSaved ? (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          color: "#b91c1c",
                                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                                          border: "1px solid #fca5a5",
                                          padding: "3px 8px",
                                          borderRadius: "4px",
                                        }}
                                      >
                                        ✕ Tidak Sesuai
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          display: "inline-block",
                                          fontSize: "11.5px",
                                          fontWeight: 600,
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        Sesuai
                                      </span>
                                    )
                                  ) : isSaved ? (
                                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleMark(k)}
                                        aria-label={`Temuan tersimpan untuk kriteria ${k.material || k.deskripsi}. Klik untuk menghapus.`}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "5px",
                                          padding: "5px 10px",
                                          borderRadius: "5px",
                                          backgroundColor: "var(--red)",
                                          color: "#ffffff",
                                          border: "none",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                                        }}
                                      >
                                        ✕ Temuan Tersimpan
                                      </button>
                                    </div>
                                  ) : isUnsaved ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleMark(k)}
                                      aria-label={`Batalkan tanda tidak sesuai untuk kriteria ${k.material || k.deskripsi}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "5px 10px",
                                        borderRadius: "5px",
                                        backgroundColor: "#fff1f2",
                                        color: "var(--red)",
                                        border: "1px solid #fecdd3",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✕ Tidak Sesuai
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleMark(k)}
                                      aria-label={`Tandai kriteria ${k.material || k.deskripsi} sebagai tidak sesuai`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--border)",
                                        backgroundColor: "#ffffff",
                                        color: "var(--text-muted)",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: 800,
                                        transition: "all 0.15s ease",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--red)";
                                        e.currentTarget.style.color = "var(--red)";
                                        e.currentTarget.style.backgroundColor = "var(--red-bg)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--border)";
                                        e.currentTarget.style.color = "var(--text-muted)";
                                        e.currentTarget.style.backgroundColor = "#ffffff";
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ============================================================= */}
                    {/* MOBILE VIEW: CARD-BASED CHECKLIST (< 768px)                   */}
                    {/* ============================================================= */}
                    <div className="audit-mobile-cards" style={{ display: "none", flexDirection: "column" }}>
                      {group.items.map((k) => {
                        const saved = savedFindingsMap.get(k.id);
                        const isSaved = Boolean(saved && saved.length > 0);
                        const unsavedDraft = unsavedFindings[k.id];
                        const isUnsaved = Boolean(unsavedDraft);
                        const isViolated = isSaved || isUnsaved;

                        return (
                          <div
                            key={`m-card-${k.id}`}
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid var(--border)",
                              backgroundColor: isViolated ? "rgba(239, 68, 68, 0.04)" : "#ffffff",
                              borderLeft: isViolated ? "3px solid var(--red)" : "3px solid transparent",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "normal" }}>
                                {formatCategoryDisplay(group.kategori)} · No. {k.indexInCategory}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "10px",
                                  padding: "1px 6px",
                                }}
                              >
                                {k.point} Poin
                              </span>
                            </div>

                            <strong style={{ display: "block", fontSize: "14px", color: "var(--text)", marginBottom: "4px" }}>
                              {k.material || "-"}
                            </strong>

                            <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                              {k.deskripsi}
                            </p>

                            {/* Status Control Button */}
                            {!isFinal ? (
                              isSaved ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMark(k)}
                                  aria-label={`Temuan tersimpan untuk ${k.material || k.deskripsi}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    width: "100%",
                                    padding: "7px 12px",
                                    borderRadius: "6px",
                                    backgroundColor: "var(--red)",
                                    color: "#ffffff",
                                    border: "none",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ✕ Temuan Tersimpan
                                </button>
                              ) : isUnsaved ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMark(k)}
                                  aria-label={`Batalkan tanda tidak sesuai untuk ${k.material || k.deskripsi}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    width: "100%",
                                    padding: "7px 12px",
                                    borderRadius: "6px",
                                    backgroundColor: "#fff1f2",
                                    color: "var(--red)",
                                    border: "1px solid #fecdd3",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ✕ Tidak Sesuai (Klik untuk Batal)
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMark(k)}
                                  aria-label={`Tandai kriteria ${k.material || k.deskripsi} sebagai tidak sesuai`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    width: "100%",
                                    padding: "7px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    backgroundColor: "#ffffff",
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  <span>✕ Tandai Tidak Sesuai</span>
                                </button>
                              )
                            ) : (
                              <div>
                                {isSaved ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      backgroundColor: "rgba(239,68,68,0.12)",
                                      color: "#b91c1c",
                                      border: "1px solid #fca5a5",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    ✕ Tidak Sesuai
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Sesuai
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Saved Details Mobile */}
                            {isSaved && saved && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "10px",
                                  borderRadius: "6px",
                                  backgroundColor: "var(--red-bg)",
                                  border: "1px solid rgba(220, 38, 38, 0.2)",
                                }}
                              >
                                {saved.map((f, fIdx) => (
                                  <div key={f.id || fIdx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                      <div>
                                        <span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--red)" }}>
                                          Catatan Temuan:
                                        </span>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text)" }}>
                                          {f.keterangan}
                                        </p>
                                      </div>
                                      {!isFinal && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setFindingToDelete({
                                              findingId: f.id,
                                              material: k.material || k.deskripsi,
                                              kriteriaId: k.id,
                                            })
                                          }
                                          style={{
                                            border: "none",
                                            backgroundColor: "transparent",
                                            color: "#dc2626",
                                            cursor: "pointer",
                                            padding: "2px",
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>

                                    {f.photos && f.photos.length > 0 && (
                                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                        {f.photos.map((p) => {
                                          const pUrl = p.url || getAuditFindingPhotoUrl(p.id);
                                          return (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => setPreviewPhotoUrl(pUrl)}
                                              style={{
                                                width: "44px",
                                                height: "44px",
                                                borderRadius: "4px",
                                                overflow: "hidden",
                                                border: "1px solid var(--border)",
                                                cursor: "pointer",
                                                padding: 0,
                                              }}
                                            >
                                              <ProtectedImage
                                                src={pUrl}
                                                alt="Foto Bukti"
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                              />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Unsaved Form Mobile */}
                            {isUnsaved && unsavedDraft && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "12px",
                                  borderRadius: "6px",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #fca5a5",
                                }}
                              >
                                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                                  KETERANGAN TEMUAN *
                                </label>
                                <textarea
                                  rows={2}
                                  value={unsavedDraft.keterangan}
                                  onChange={(e) =>
                                    setUnsavedFindings((prev) => ({
                                      ...prev,
                                      [k.id]: { ...prev[k.id], keterangan: e.target.value, error: null },
                                    }))
                                  }
                                  placeholder="Deskripsikan temuan..."
                                  disabled={unsavedDraft.saving}
                                  style={{
                                    width: "100%",
                                    borderRadius: "5px",
                                    border: "1px solid var(--border)",
                                    padding: "6px 8px",
                                    fontSize: "12px",
                                    outline: "none",
                                    marginBottom: "8px",
                                  }}
                                />

                                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                                  FOTO BUKTI * (MIN. 1 FOTO)
                                </label>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
                                  <label
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "11.5px",
                                      padding: "5px 10px",
                                      borderRadius: "4px",
                                      border: "1px solid var(--border)",
                                      backgroundColor: "var(--bg-subtle, #f8fafc)",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Camera size={13} />
                                    <span>Pilih Foto</span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/jpg,image/png,image/webp"
                                      multiple
                                      disabled={unsavedDraft.saving}
                                      onChange={(e) => handleRowPhotosChange(k.id, e)}
                                      style={{ display: "none" }}
                                    />
                                  </label>
                                  {unsavedDraft.previews.map((prevUrl, pIdx) => (
                                    <div
                                      key={pIdx}
                                      style={{
                                        position: "relative",
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "4px",
                                        overflow: "hidden",
                                        border: "1px solid var(--border)",
                                      }}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={prevUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      <button
                                        type="button"
                                        onClick={() => handleRowRemovePhoto(k.id, pIdx)}
                                        style={{
                                          position: "absolute",
                                          top: 1,
                                          right: 1,
                                          width: "14px",
                                          height: "14px",
                                          borderRadius: "50%",
                                          backgroundColor: "rgba(0,0,0,0.6)",
                                          color: "#fff",
                                          border: "none",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          padding: 0,
                                        }}
                                      >
                                        <X size={8} />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {unsavedDraft.error && (
                                  <div style={{ fontSize: "11.5px", color: "#dc2626", marginBottom: "8px", fontWeight: 600 }}>
                                    {unsavedDraft.error}
                                  </div>
                                )}

                                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelUnsaved(k.id)}
                                    disabled={unsavedDraft.saving}
                                    style={{
                                      padding: "5px 12px",
                                      fontSize: "11.5px",
                                      borderRadius: "4px",
                                      border: "1px solid var(--border)",
                                      backgroundColor: "#fff",
                                    }}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRowFinding(k)}
                                    disabled={unsavedDraft.saving}
                                    style={{
                                      padding: "5px 12px",
                                      fontSize: "11.5px",
                                      borderRadius: "4px",
                                      border: "none",
                                      backgroundColor: "var(--red)",
                                      color: "#fff",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {unsavedDraft.saving ? "Menyimpan..." : "Simpan"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: KONFIRMASI SELESAIKAN AUDIT TANPA TEMUAN (0 TEMUAN)               */}
      {/* ========================================================================= */}
      {isNoFindingsModalOpen && activeAudit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(22, 163, 74, 0.12)",
                  color: "var(--green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Selesaikan Audit Tanpa Temuan?
              </h3>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Pastikan seluruh kriteria telah diperiksa dan dinyatakan sesuai standar kebersihan dan kelayakan dapur.
            </p>

            <div
              style={{
                backgroundColor: "var(--bg-subtle, #f8fafc)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "12px 14px",
                marginBottom: "20px",
                fontSize: "12.5px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Katering:</span>
                <strong>{activeAudit.catering_nama}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Tanggal:</span>
                <strong>{formatDisplayDate(activeAudit.tanggal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Nilai Audit Akhir:</span>
                <strong style={{ color: "var(--green)" }}>100.00% (Penuh)</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsNoFindingsModalOpen(false)}
                disabled={finalizingNoFindings}
                style={{
                  padding: "9px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: finalizingNoFindings ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalizeNoFindings}
                disabled={finalizingNoFindings}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--green)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: finalizingNoFindings ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {finalizingNoFindings ? (
                  <>
                    <div className="spinner-sm" /> Menyelesaikan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Ya, Selesaikan Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KONFIRMASI FINALISASI DENGAN TEMUAN                              */}
      {/* ========================================================================= */}
      {isFinalizeModalOpen && activeAudit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "480px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(220, 38, 38, 0.12)",
                  color: "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileCheck size={22} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Finalisasi Audit Dapur
              </h3>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Audit akan difinalisasi secara resmi. Setelah final, snapshot seluruh kriteria akan dikunci dan data tidak dapat diubah kembali.
            </p>

            <div
              style={{
                backgroundColor: "var(--bg-subtle, #f8fafc)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "14px",
                marginBottom: "20px",
                fontSize: "12.5px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Katering:</span>
                <strong>{activeAudit.catering_nama}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Tanggal Pelaksanaan:</span>
                <strong>{formatDisplayDate(activeAudit.tanggal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Temuan Tercatat:</span>
                <strong style={{ color: "var(--red)" }}>
                  {findingsList.length} Temuan ({violatedCriteriaCount} kriteria)
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Estimasi Nilai Akhir:</span>
                <strong style={{ color: Number(currentScoreDisplay) >= 80 ? "var(--green)" : "var(--red)" }}>
                  {currentScoreDisplay}%
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                disabled={finalizingAudit}
                style={{
                  padding: "9px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: finalizingAudit ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalizeWithFindings}
                disabled={finalizingAudit}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--red)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: finalizingAudit ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {finalizingAudit ? (
                  <>
                    <div className="spinner-sm" /> Memfinalisasi...
                  </>
                ) : (
                  <>
                    <FileCheck size={16} /> Ya, Finalisasi Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KONFIRMASI HAPUS TEMUAN TERSIMPAN                                 */}
      {/* ========================================================================= */}
      {findingToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Hapus Temuan Ini?
              </h3>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Apakah Anda yakin ingin menghapus temuan untuk kriteria <strong>&quot;{findingToDelete.material}&quot;</strong>? Foto bukti dan deskripsi temuan akan dihapus secara permanen dari server.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setFindingToDelete(null)}
                disabled={deletingFinding}
                style={{
                  padding: "9px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: deletingFinding ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFinding}
                disabled={deletingFinding}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: deletingFinding ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {deletingFinding ? (
                  <>
                    <div className="spinner-sm" /> Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} /> Ya, Hapus Temuan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: KONFIRMASI HAPUS DRAFT AUDIT                                     */}
      {/* ========================================================================= */}
      {isDeleteDraftModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Hapus Draft Audit?
              </h3>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              Seluruh catatan dan foto temuan dalam sesi draft ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsDeleteDraftModalOpen(false)}
                disabled={deletingDraft}
                style={{
                  padding: "9px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: deletingDraft ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={deletingDraft}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: deletingDraft ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {deletingDraft ? (
                  <>
                    <div className="spinner-sm" /> Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} /> Ya, Hapus Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX PRATINJAU FOTO BUKTI UKURAN PENUH                                */}
      {/* ========================================================================= */}
      {previewPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewPhotoUrl(null)}
            aria-label="Tutup pratinjau foto"
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "85vh" }}>
            <ProtectedImage
              src={previewPhotoUrl}
              alt="Foto Bukti Temuan (Pratinjau Penuh)"
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              }}
            />
          </div>
        </div>
      )}

      {/* Scoped responsive styles for desktop vs mobile */}
      <style jsx>{`
        @media (max-width: 768px) {
          .audit-desktop-table {
            display: none !important;
          }
          .audit-mobile-cards {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .audit-desktop-table {
            display: block !important;
          }
          .audit-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
