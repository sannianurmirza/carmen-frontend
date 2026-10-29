"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Award,
  Calendar,
  Clock,
  Download,
  RefreshCw,
  CheckCircle2,
  Lock,
  Plus,
  AlertCircle,
  Users,
  Utensils,
  FileSpreadsheet,
  Save,
  Loader2,
  X,
  Edit2,
  SlidersHorizontal,
  History,
  Trash2,
  Eye,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import AccessDenied from "@/components/AccessDenied";
import { normalizeRole } from "@/lib/permissions";
import {
  RewardPunishmentPeriodListItem,
  RewardPunishmentPeriodDetail,
  RewardPunishmentItem,
  getRewardPunishmentPeriodsApi,
  createRewardPunishmentPeriodApi,
  getRewardPunishmentPeriodDetailApi,
  syncRewardPunishmentPeriodApi,
  updateRewardPunishmentItemApi,
  updateRewardPunishmentShiftApi,
  finalizeRewardPunishmentPeriodApi,
  triggerRewardPunishmentExcelDownload,
  updateRewardPunishmentPeriodApi,
  deleteRewardPunishmentPeriodApi,
  getCatering,
  updateCatering,
  Catering,
} from "@/lib/api";

export default function RewardPunishmentView({ initialTab = "detail" }: { initialTab?: "detail" | "riwayat" }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "staff";

  // Tab State: "detail" (Perhitungan & Evaluasi) vs "riwayat" (Riwayat Periode)
  const [activeTab, setActiveTab] = useState<"detail" | "riwayat">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // State
  const [periods, setPeriods] = useState<RewardPunishmentPeriodListItem[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<"A" | "B">("A");
  const [detail, setDetail] = useState<RewardPunishmentPeriodDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  // History Tab & Filter State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyFilterStatus, setHistoryFilterStatus] = useState<"ALL" | "DRAFT" | "FINAL">("ALL");
  const [historyFilterYear, setHistoryFilterYear] = useState<string>("ALL");
  const [historyPage, setHistoryPage] = useState<number>(1);
  const historyPageSize = 10;

  // Edit Period Modal State
  const [showEditPeriodModal, setShowEditPeriodModal] = useState<boolean>(false);
  const [editingPeriod, setEditingPeriod] = useState<RewardPunishmentPeriodListItem | null>(null);
  const [savingEditPeriod, setSavingEditPeriod] = useState<boolean>(false);
  const [editDateError, setEditDateError] = useState<string>("");
  const [editPeriodForm, setEditPeriodForm] = useState<{
    nama_periode: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    target_bulan_berikutnya: string;
    catatan: string;
    keterangan: string;
  }>({
    nama_periode: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    target_bulan_berikutnya: "",
    catatan: "",
    keterangan: "",
  });

  // Delete Period State
  const [deletingPeriod, setDeletingPeriod] = useState<RewardPunishmentPeriodListItem | null>(null);
  const [isDeletingPeriod, setIsDeletingPeriod] = useState<boolean>(false);

  const [mobileActiveVendor, setMobileActiveVendor] = useState<Record<string, number>>({
    Pagi: 0,
    Malam: 0,
  });

  // Caterings Master for Group Assignment
  const [allCaterings, setAllCaterings] = useState<Catering[]>([]);
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [groupAssignments, setGroupAssignments] = useState<Record<number, "A" | "B" | "">>({});
  const [savingGroups, setSavingGroups] = useState<boolean>(false);

  // Edit State
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemEditForm, setItemEditForm] = useState<{
    reward: number;
    order_minmax: number;
    aktual_order: number;
    catatan: string;
    sanksi_kebersihan: number;
  }>({
    reward: 0,
    order_minmax: 0,
    aktual_order: 0,
    catatan: "",
    sanksi_kebersihan: 0,
  });
  const [savingItem, setSavingItem] = useState<boolean>(false);

  // Modal Create Period
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [dateValidationError, setDateValidationError] = useState<string>("");
  const [createForm, setCreateForm] = useState<{
    nama_periode: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    target_bulan_berikutnya: string;
    default_karyawan_pagi: string;
    default_karyawan_malam: string;
    catatan: string;
  }>({
    nama_periode: "",
    tanggal_mulai: "2026-09-20",
    tanggal_selesai: "2026-10-19",
    target_bulan_berikutnya: "November 2026",
    default_karyawan_pagi: "",
    default_karyawan_malam: "",
    catatan: "",
  });

  // Indonesian Date Helpers
  const MONTH_NAMES_INDO = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const MONTH_SHORT_INDO = [
    "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  const formatDateIndo = (dateStr: string): string => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0])) return dateStr;
    const [y, m, d] = parts;
    return `${d} ${MONTH_SHORT_INDO[m] || ""} ${y}`;
  };

  const derivePeriodRangeLabel = (startStr: string, endStr: string): string => {
    if (!startStr || !endStr) return "";
    const sParts = startStr.split("-").map(Number);
    const eParts = endStr.split("-").map(Number);
    if (sParts.length < 3 || eParts.length < 3) return "";
    const [sy, sm, sd] = sParts;
    const [ey, em, ed] = eParts;
    return `${sd} ${MONTH_SHORT_INDO[sm]} ${sy} s/d ${ed} ${MONTH_SHORT_INDO[em]} ${ey}`;
  };

  const deriveNextMonthLabel = (endStr: string): string => {
    if (!endStr) return "";
    const parts = endStr.split("-").map(Number);
    if (parts.length < 2) return "";
    const [ey, em] = parts;
    if (em === 12) {
      return `${MONTH_NAMES_INDO[1]} ${ey + 1}`;
    }
    return `${MONTH_NAMES_INDO[em + 1] || ""} ${ey}`;
  };

  const handleStartDateChange = (val: string) => {
    setCreateForm((prev) => {
      const next = { ...prev, tanggal_mulai: val };
      if (next.tanggal_selesai && val > next.tanggal_selesai) {
        setDateValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      } else {
        setDateValidationError("");
      }
      return next;
    });
  };

  const handleEndDateChange = (val: string) => {
    setCreateForm((prev) => {
      const next = { ...prev, tanggal_selesai: val };
      if (prev.tanggal_mulai && val < prev.tanggal_mulai) {
        setDateValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      } else {
        setDateValidationError("");
        const nextMonth = deriveNextMonthLabel(val);
        if (nextMonth && (!prev.target_bulan_berikutnya || prev.target_bulan_berikutnya.includes("2026") || prev.target_bulan_berikutnya.includes("2027"))) {
          next.target_bulan_berikutnya = nextMonth;
        }
      }
      return next;
    });
  };

  // Modal Finalize
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);

  // Load Active Caterings
  const loadCaterings = useCallback(async () => {
    try {
      const data = await getCatering({ activeOnly: true });
      setAllCaterings(data);
    } catch (err: any) {
      console.error("Gagal memuat daftar katering:", err);
    }
  }, []);

  useEffect(() => {
    loadCaterings();
  }, [loadCaterings]);

  // Load Periods
  const loadPeriods = useCallback(async (selectId?: number) => {
    setLoading(true);
    try {
      const data = await getRewardPunishmentPeriodsApi();
      setPeriods(data);
      if (data.length > 0) {
        // Prefer 'Agustus 2026' if present, or first
        const aug = data.find((p) => p.nama_periode === "Agustus 2026");
        const defaultChoice = aug ? aug.id : data[0].id;
        const idToSelect = selectId || (selectedPeriodId && data.some((p) => p.id === selectedPeriodId) ? selectedPeriodId : defaultChoice);
        setSelectedPeriodId(idToSelect);
      } else {
        setSelectedPeriodId(null);
        setDetail(null);
      }
    } catch (err: any) {
      showToast(err.message || "Gagal memuat daftar periode", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, showToast]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  // Load Detail
  const loadDetail = useCallback(async (periodId: number, group: "A" | "B") => {
    try {
      const data = await getRewardPunishmentPeriodDetailApi(periodId, group);
      setDetail(data);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat detail evaluasi", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedPeriodId) {
      loadDetail(selectedPeriodId, selectedGroup);
    }
  }, [selectedPeriodId, selectedGroup, loadDetail]);

  const activePeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId);
  }, [periods, selectedPeriodId]);

  const isFinal = activePeriod?.status === "FINAL";

  // Counts for Group A and Group B
  const groupACount = useMemo(() => {
    const list = allCaterings.filter((c) => c.reward_punishment_group === "A");
    if (list.length > 0) return list.length;
    return detail?.shifts?.Pagi?.items?.length || 3;
  }, [allCaterings, detail]);

  const groupBCount = useMemo(() => {
    const list = allCaterings.filter((c) => c.reward_punishment_group === "B");
    if (list.length > 0) return list.length;
    return 3;
  }, [allCaterings]);

  // Open Group Modal
  const openGroupModal = () => {
    const initial: Record<number, "A" | "B" | ""> = {};
    allCaterings.forEach((c) => {
      initial[c.id] = (c.reward_punishment_group as "A" | "B") || "";
    });
    setGroupAssignments(initial);
    setShowGroupModal(true);
  };

  // Save Group Assignments
  const saveGroupAssignments = async () => {
    setSavingGroups(true);
    try {
      const changed = allCaterings.filter((c) => {
        const oldVal = c.reward_punishment_group || "";
        const newVal = groupAssignments[c.id] ?? oldVal;
        return newVal !== oldVal;
      });

      for (const c of changed) {
        const val = groupAssignments[c.id];
        await updateCatering(c.id, {
          reward_punishment_group: (val === "" ? null : val) as "A" | "B" | null,
        });
      }

      showToast("Pengaturan grup katering berhasil disimpan.", "success");
      setShowGroupModal(false);
      await loadCaterings();
      if (selectedPeriodId) {
        await loadDetail(selectedPeriodId, selectedGroup);
      }
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan grup katering", "error");
    } finally {
      setSavingGroups(false);
    }
  };

  // Handle Sync
  const handleSync = async () => {
    if (!selectedPeriodId || isFinal) return;
    setSyncing(true);
    try {
      const res = await syncRewardPunishmentPeriodApi(selectedPeriodId);
      showToast(res.message || "Sinkronisasi data operasional berhasil", "success");
      await loadDetail(selectedPeriodId, selectedGroup);
    } catch (err: any) {
      showToast(err.message || "Gagal melakukan sinkronisasi", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Handle Finalize
  const handleFinalize = async () => {
    if (!selectedPeriodId || !isAdmin || isFinal) return;
    setFinalizing(true);
    try {
      const res = await finalizeRewardPunishmentPeriodApi(selectedPeriodId);
      showToast(res.message || "Periode evaluasi berhasil difinalisasi", "success");
      setShowFinalizeModal(false);
      await loadPeriods(selectedPeriodId);
      await loadDetail(selectedPeriodId, selectedGroup);
    } catch (err: any) {
      showToast(err.message || "Gagal memfinalisasi periode", "error");
    } finally {
      setFinalizing(false);
    }
  };

  // Handle Download Excel
  const handleDownloadExcel = async () => {
    if (!selectedPeriodId || !activePeriod) return;
    setDownloading(true);
    try {
      await triggerRewardPunishmentExcelDownload(selectedPeriodId, activePeriod.nama_periode);
      showToast("File Excel berhasil diunduh.", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal mengunduh file Excel", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Handle Create Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.tanggal_mulai || !createForm.tanggal_selesai) {
      showToast("Tanggal mulai dan tanggal selesai wajib diisi", "error");
      return;
    }
    if (createForm.tanggal_selesai < createForm.tanggal_mulai) {
      showToast("Tanggal selesai tidak boleh sebelum tanggal mulai", "error");
      setDateValidationError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    setCreating(true);
    try {
      const autoName = derivePeriodRangeLabel(createForm.tanggal_mulai, createForm.tanggal_selesai);
      const autoTarget = deriveNextMonthLabel(createForm.tanggal_selesai);
      const finalName = createForm.nama_periode.trim() || autoName;
      const finalTarget = createForm.target_bulan_berikutnya.trim() || autoTarget;

      const payload = {
        nama_periode: finalName,
        tanggal_mulai: createForm.tanggal_mulai,
        tanggal_selesai: createForm.tanggal_selesai,
        target_bulan_berikutnya: finalTarget,
        catatan: createForm.catatan ? createForm.catatan.trim() : undefined,
        default_karyawan_pagi: createForm.default_karyawan_pagi.trim()
          ? parseFloat(createForm.default_karyawan_pagi)
          : null,
        default_karyawan_malam: createForm.default_karyawan_malam.trim()
          ? parseFloat(createForm.default_karyawan_malam)
          : null,
      };
      const res = await createRewardPunishmentPeriodApi(payload);
      showToast(res.message || "Periode evaluasi berhasil dibuat", "success");
      setShowCreateModal(false);
      await loadPeriods(res.period_id);
    } catch (err: any) {
      showToast(err.message || "Gagal membuat periode evaluasi", "error");
    } finally {
      setCreating(false);
    }
  };

  // Open Edit Period Modal
  const handleOpenEditPeriod = (p: RewardPunishmentPeriodListItem) => {
    setEditingPeriod(p);
    setEditPeriodForm({
      nama_periode: p.nama_periode || "",
      tanggal_mulai: p.tanggal_mulai || "",
      tanggal_selesai: p.tanggal_selesai || "",
      target_bulan_berikutnya: p.target_bulan_berikutnya || "",
      catatan: p.catatan || "",
      keterangan: p.keterangan || "",
    });
    setEditDateError("");
    setShowEditPeriodModal(true);
  };

  const handleEditStartDateChange = (val: string) => {
    setEditPeriodForm((prev) => {
      const next = { ...prev, tanggal_mulai: val };
      if (next.tanggal_selesai && val > next.tanggal_selesai) {
        setEditDateError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      } else {
        setEditDateError("");
      }
      return next;
    });
  };

  const handleEditEndDateChange = (val: string) => {
    setEditPeriodForm((prev) => {
      const next = { ...prev, tanggal_selesai: val };
      if (prev.tanggal_mulai && val < prev.tanggal_mulai) {
        setEditDateError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      } else {
        setEditDateError("");
        const nextMonth = deriveNextMonthLabel(val);
        if (nextMonth && (!prev.target_bulan_berikutnya || prev.target_bulan_berikutnya.includes("2026") || prev.target_bulan_berikutnya.includes("2027"))) {
          next.target_bulan_berikutnya = nextMonth;
        }
      }
      return next;
    });
  };

  const handleSaveEditPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;
    if (editPeriodForm.tanggal_selesai < editPeriodForm.tanggal_mulai) {
      setEditDateError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    setSavingEditPeriod(true);
    try {
      await updateRewardPunishmentPeriodApi(editingPeriod.id, {
        nama_periode: editPeriodForm.nama_periode.trim(),
        tanggal_mulai: editPeriodForm.tanggal_mulai,
        tanggal_selesai: editPeriodForm.tanggal_selesai,
        target_bulan_berikutnya: editPeriodForm.target_bulan_berikutnya.trim(),
        catatan: editPeriodForm.catatan ? editPeriodForm.catatan.trim() : undefined,
        keterangan: editPeriodForm.keterangan ? editPeriodForm.keterangan.trim() : undefined,
      });
      showToast("Periode evaluasi berhasil diperbarui.", "success");
      setShowEditPeriodModal(false);
      const updatedId = editingPeriod.id;
      setEditingPeriod(null);
      await loadPeriods(updatedId);
      if (selectedPeriodId === updatedId) {
        await loadDetail(updatedId, selectedGroup);
      }
    } catch (err: any) {
      showToast(err.message || "Gagal memperbarui periode evaluasi", "error");
    } finally {
      setSavingEditPeriod(false);
    }
  };

  // Confirm Delete Period
  const handleConfirmDeletePeriod = async () => {
    if (!deletingPeriod) return;
    setIsDeletingPeriod(true);
    try {
      await deleteRewardPunishmentPeriodApi(deletingPeriod.id);
      showToast(`Periode '${deletingPeriod.nama_periode}' berhasil dihapus.`, "success");
      const deletedId = deletingPeriod.id;
      setDeletingPeriod(null);

      const updatedList = await getRewardPunishmentPeriodsApi();
      setPeriods(updatedList);
      if (selectedPeriodId === deletedId) {
        if (updatedList.length > 0) {
          setSelectedPeriodId(updatedList[0].id);
        } else {
          setSelectedPeriodId(null);
          setDetail(null);
        }
      }
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus periode evaluasi", "error");
    } finally {
      setIsDeletingPeriod(false);
    }
  };

  // Filtered Periods for History Tab & Page
  const filteredHistoryPeriods = useMemo(() => {
    let result = periods;

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.nama_periode.toLowerCase().includes(q) ||
          (p.target_bulan_berikutnya && p.target_bulan_berikutnya.toLowerCase().includes(q)) ||
          p.tanggal_mulai.includes(q) ||
          p.tanggal_selesai.includes(q) ||
          p.status.toLowerCase().includes(q) ||
          (p.catatan && p.catatan.toLowerCase().includes(q)) ||
          (p.keterangan && p.keterangan.toLowerCase().includes(q))
      );
    }

    if (historyFilterStatus !== "ALL") {
      result = result.filter((p) => p.status === historyFilterStatus);
    }

    if (historyFilterYear !== "ALL") {
      result = result.filter(
        (p) =>
          (p.tanggal_mulai && p.tanggal_mulai.startsWith(historyFilterYear)) ||
          (p.tanggal_selesai && p.tanggal_selesai.startsWith(historyFilterYear)) ||
          (p.target_bulan_berikutnya && p.target_bulan_berikutnya.includes(historyFilterYear))
      );
    }

    return result;
  }, [periods, historySearch, historyFilterStatus, historyFilterYear]);

  const totalHistoryPages = Math.ceil(filteredHistoryPeriods.length / historyPageSize) || 1;
  const paginatedHistoryPeriods = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistoryPeriods.slice(start, start + historyPageSize);
  }, [filteredHistoryPeriods, historyPage, historyPageSize]);

  const historyStats = useMemo(() => {
    const total = periods.length;
    const finalCount = periods.filter((p) => p.status === "FINAL").length;
    const draftCount = periods.filter((p) => p.status === "DRAFT").length;
    const active = periods.find((p) => p.id === selectedPeriodId);
    return {
      total,
      finalCount,
      draftCount,
      activeName: active ? active.nama_periode : "Belum dipilih",
    };
  }, [periods, selectedPeriodId]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    periods.forEach((p) => {
      if (p.tanggal_mulai && p.tanggal_mulai.length >= 4) years.add(p.tanggal_mulai.slice(0, 4));
      if (p.tanggal_selesai && p.tanggal_selesai.length >= 4) years.add(p.tanggal_selesai.slice(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [periods]);

  // Edit item inline
  const startEditItem = (item: RewardPunishmentItem) => {
    if (isFinal || !canEdit) return;
    setEditingItemId(item.id);
    setItemEditForm({
      reward: item.reward,
      order_minmax: item.order_minmax || 0,
      aktual_order: item.aktual_order || 0,
      catatan: item.catatan || "",
      sanksi_kebersihan: item.sanksi_kebersihan || 0,
    });
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
  };

  const saveEditItem = async (itemId: number) => {
    if (!selectedPeriodId) return;
    setSavingItem(true);
    try {
      await updateRewardPunishmentItemApi(selectedPeriodId, itemId, {
        reward: Number(itemEditForm.reward),
        order_minmax: Number(itemEditForm.order_minmax),
        aktual_order: Number(itemEditForm.aktual_order),
        catatan: itemEditForm.catatan,
        sanksi_kebersihan: Number(itemEditForm.sanksi_kebersihan),
      });
      showToast("Data baris katering berhasil disimpan.", "success");
      setEditingItemId(null);
      await loadDetail(selectedPeriodId, selectedGroup);
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan perubahan baris katering", "error");
    } finally {
      setSavingItem(false);
    }
  };

  // Update shift header
  const handleUpdateShiftKaryawan = async (
    shiftId: number | undefined,
    currentKaryawan: number | null | undefined
  ) => {
    if (!shiftId || isFinal || !canEdit || !selectedPeriodId) return;
    const initialVal =
      currentKaryawan !== null && currentKaryawan !== undefined ? String(currentKaryawan) : "";
    const newVal = prompt(
      "Masukkan jumlah karyawan untuk shift ini (kosongkan untuk belum diisi):",
      initialVal
    );
    if (newVal === null) return;
    const trimmed = newVal.trim();
    const parsed = trimmed === "" ? null : parseFloat(trimmed);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      showToast("Jumlah karyawan harus angka positif valid", "error");
      return;
    }
    try {
      await updateRewardPunishmentShiftApi(selectedPeriodId, shiftId, {
        jumlah_karyawan: parsed,
      });
      showToast(
        parsed !== null
          ? "Jumlah karyawan shift berhasil diperbarui."
          : "Jumlah karyawan direset (belum diisi).",
        "success"
      );
      await loadDetail(selectedPeriodId, selectedGroup);
    } catch (err: any) {
      showToast(err.message || "Gagal memperbarui header shift", "error");
    }
  };

  const formatNumber = (val: number | null | undefined, decimals = 0) => {
    if (val === null || val === undefined || isNaN(val)) return "-";
    return val.toLocaleString("id-ID", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPercent = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return "-";
    return (
      (val * 100).toLocaleString("id-ID", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + "%"
    );
  };

  if (user && normalizeRole(user.role) === "approver") {
    return <AccessDenied returnUrl="/" />;
  }

  return (
    <div className="rp-container">
      {/* 1. Header Section: Clean, restrained, no breadcrumb chain, only LAPORAN */}
      <div className="rp-header-row">
        <div className="rp-title-block">
          <span className="rp-header-tag">LAPORAN</span>
          <h1 className="rp-title">Evaluasi Reward & Punishment Katering</h1>
        </div>

        {/* Global Action Group: Primary -> Secondary -> Final */}
        <div className="rp-action-group">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus size={15} />
              <span>Periode Baru</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab("riwayat");
              if (typeof window !== "undefined") {
                window.history.replaceState(null, "", "/reward-punishment/riwayat");
              }
            }}
            className="btn btn-secondary"
            title="Buka riwayat seluruh periode laporan evaluasi"
          >
            <History size={15} />
            <span>Riwayat Periode ({periods.length})</span>
          </button>

          {selectedPeriodId && (
            <>
              {canEdit && !isFinal && (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-secondary"
                  title="Sinkronkan data operasional"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  <span>{syncing ? "Menyinkronkan..." : "Sinkronkan Operasional"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={downloading}
                className="btn btn-secondary"
                title="Unduh laporan Excel (.xlsx)"
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                <span>{downloading ? "Mengunduh..." : "Unduh Excel"}</span>
              </button>

              {isAdmin && !isFinal && (
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(true)}
                  className="btn btn-finalize"
                  title="Finalisasi periode evaluasi (Kunci data permanen)"
                >
                  <CheckCircle2 size={15} />
                  <span>Finalisasi Evaluasi</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation: Styled identical to Komplain page tabs */}
      <div
        role="tablist"
        aria-label="Navigasi Reward & Punishment"
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
          id="tab-detail-rp"
          aria-controls="panel-detail-rp"
          aria-selected={activeTab === "detail"}
          onClick={() => {
            setActiveTab("detail");
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/reward-punishment");
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: activeTab === "detail" ? 700 : 600,
            color: activeTab === "detail" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
            backgroundColor: activeTab === "detail" ? "rgba(143, 26, 37, 0.05)" : "transparent",
            border: "none",
            borderBottom:
              activeTab === "detail"
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
          <Award size={16} strokeWidth={activeTab === "detail" ? 2.3 : 1.8} />
          <span>Evaluasi &amp; Perhitungan</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-riwayat-rp"
          aria-controls="panel-riwayat-rp"
          aria-selected={activeTab === "riwayat"}
          onClick={() => {
            setActiveTab("riwayat");
            loadPeriods();
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/reward-punishment/riwayat");
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
          <span>Riwayat Periode</span>
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
            {periods.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DETAIL EVALUASI & PERHITUNGAN */}
      {/* ========================================================================= */}
      {activeTab === "detail" && (
        <div id="panel-detail-rp" role="tabpanel" aria-labelledby="tab-detail-rp" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 2. Compact Flat Toolbar: Period Selector, Status, Group Selector & Atur Grup Katering */}
          <div className="rp-toolbar-card">
        {/* Left: Period Selector & Status */}
        <div className="rp-toolbar-left">
          <label className="rp-toolbar-label">Periode Evaluasi:</label>
          {loading ? (
            <div className="rp-loading-pulse" />
          ) : periods.length === 0 ? (
            <span className="rp-empty-text">Belum ada periode evaluasi.</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <select
                value={selectedPeriodId || ""}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
                className="rp-select"
              >
                {periods.map((p) => {
                  const rangeLabel = `${formatDateIndo(p.tanggal_mulai)} s/d ${formatDateIndo(p.tanggal_selesai)}`;
                  const isNamedByRange = p.nama_periode.includes("s/d");
                  const optionText = isNamedByRange
                    ? `${p.nama_periode} — [${p.status}]`
                    : `${p.nama_periode} (${rangeLabel}) — [${p.status}]`;
                  return (
                    <option key={p.id} value={p.id}>
                      {optionText}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("riwayat");
                  if (typeof window !== "undefined") {
                    window.history.replaceState(null, "", "/reward-punishment/riwayat");
                  }
                }}
                className="btn-history-trigger"
                title="Kelola & tinjau riwayat seluruh periode evaluasi"
              >
                <History size={13} />
                <span>Riwayat Periode ({periods.length})</span>
              </button>
            </div>
          )}

          {activePeriod && (
            <div className="rp-status-badges-group" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className={`rp-status-badge ${isFinal ? "status-final" : "status-draft"}`}>
                {isFinal ? <Lock size={12} /> : <Clock size={12} />}
                <span>{activePeriod.status}</span>
              </span>
              <span
                className={`rp-source-badge ${
                  activePeriod.punishment_source_status === "FINAL" ? "source-final" : "source-preview"
                }`}
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: activePeriod.punishment_source_status === "FINAL" ? "#ecfdf5" : "#fffbeb",
                  color: activePeriod.punishment_source_status === "FINAL" ? "#047857" : "#b45309",
                  border: `1px solid ${activePeriod.punishment_source_status === "FINAL" ? "#a7f3d0" : "#fde68a"}`
                }}
                title={
                  activePeriod.punishment_source_status === "FINAL"
                    ? "Sumber sanksi Punishment telah berstatus FINAL"
                    : "Sumber sanksi Punishment berstatus DRAFT / PREVIEW (belum final)"
                }
              >
                <span>Sumber: {activePeriod.punishment_source_status || (isFinal ? "FINAL" : "DRAFT / PREVIEW")}</span>
              </span>
            </div>
          )}
        </div>

        {/* Right: Clean Group A / Group B Selector + Atur Grup Katering */}
        <div className="rp-toolbar-right">
          <div className="rp-group-tabs">
            <button
              type="button"
              onClick={() => setSelectedGroup("A")}
              className={`rp-tab-btn ${selectedGroup === "A" ? "active" : ""}`}
            >
              <span className="tab-name">GRUP A</span>
              <span className="tab-count">{groupACount} katering</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup("B")}
              className={`rp-tab-btn ${selectedGroup === "B" ? "active" : ""}`}
            >
              <span className="tab-name">GRUP B</span>
              <span className="tab-count">{groupBCount} katering</span>
            </button>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={openGroupModal}
              className="btn btn-atur-grup"
              title="Atur penugasan grup untuk setiap katering aktif"
            >
              <SlidersHorizontal size={13} />
              <span>Atur Grup Katering</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Subtle Compact Formula Strip: Minimal inline notice without large warning box */}
      <div className="rp-formula-strip rp-formula-inline-bar">
        <span className="formula-lbl">Formula:</span>
        <span className="formula-calc">Hasil Perhitungan = Jml Order Berjalan + Total Sanksi + Reward</span>
      </div>

      {/* 4. Shift Tables - Excel-like Vertical Evaluation Matrix */}
      {detail ? (
        <div className="rp-shifts-container">
          {(["Pagi", "Malam"] as const).map((shiftKey) => {
            const shiftData = detail.shifts[shiftKey];
            const isPagi = shiftKey === "Pagi";

            return (
              <div key={shiftKey} className="rp-shift-card">
                {/* Header Bar: Refined layout with breathing space */}
                <div className="rp-shift-header">
                  <div className="shift-title-block">
                    <div className="shift-title-row">
                      <span className={`shift-dot ${isPagi ? "dot-pagi" : "dot-malam"}`} />
                      <h2 className="shift-title">
                        SHIFT {shiftKey.toUpperCase()} — GRUP {selectedGroup}
                      </h2>
                    </div>
                    <span className="shift-count">{shiftData.items.length} katering</span>
                  </div>

                  <div className="shift-meta-row">
                    <div className="shift-stat-item">
                      <div className="stat-label-row">
                        <span className="stat-label">Jml Karyawan</span>
                        <span className="badge-tag badge-source-input" title="Source Input: Input operasional headcount shift">Source Input</span>
                      </div>
                      <div className="stat-val-wrap">
                        {shiftData.jumlah_karyawan !== null && shiftData.jumlah_karyawan !== undefined ? (
                          <span className="stat-val font-num">
                            {formatNumber(shiftData.jumlah_karyawan)}
                          </span>
                        ) : (
                          <span className="stat-val stat-val-empty">Belum diisi</span>
                        )}
                        {canEdit && !isFinal && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateShiftKaryawan(
                                shiftData.shift_id || shiftData.id,
                                shiftData.jumlah_karyawan
                              )
                            }
                            className="btn-edit-karyawan"
                          >
                            {shiftData.jumlah_karyawan !== null && shiftData.jumlah_karyawan !== undefined
                              ? "Ubah"
                              : "Isi"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="shift-stat-divider" />

                    <div className="shift-stat-item">
                      <div className="stat-label-row">
                        <span className="stat-label">Total Order</span>
                        <span className="badge-tag badge-auto" title="Auto Calculated: Total Order Shift">Auto</span>
                      </div>
                      <span className="stat-val font-num">
                        {formatNumber(shiftData.jumlah_order_total)}
                      </span>
                    </div>

                    <div className="shift-stat-divider" />

                    <div className="shift-summary-inline">
                      <span className="summary-item">
                        <span className="summary-lbl">Total Sanksi:</span>
                        <span className="summary-val text-red font-num">
                          {formatNumber(shiftData.items.reduce((acc, it) => acc + it.total_sanksi, 0))}
                        </span>
                      </span>
                      <span className="summary-sep">•</span>
                      <span className="summary-item">
                        <span className="summary-lbl">Reward:</span>
                        <span className="summary-val text-amber font-num">
                          {formatNumber(shiftData.items.reduce((acc, it) => acc + it.reward, 0))}
                        </span>
                      </span>
                      <span className="summary-sep">•</span>
                      <span className="summary-item">
                        <span className="summary-lbl">Hasil:</span>
                        <span className="summary-val text-blue font-num font-bold">
                          {formatNumber(shiftData.items.reduce((acc, it) => acc + it.hasil_perhitungan, 0), 2)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop: Vertical Evaluation Matrix (Metrics as Rows, Caterings as Columns) */}
                <div className="rp-matrix-desktop">
                  <div className="rp-table-scroll">
                    <table className="rp-vertical-table">
                      <thead>
                        <tr>
                          <th className="th-komponen sticky-col-header">KOMPONEN EVALUASI</th>
                          {shiftData.items.map((item) => (
                            <th key={item.id} className="th-vendor">
                              <div className="vendor-th-content">
                                <span
                                  className="catering-color-dot"
                                  style={{ backgroundColor: item.catering_warna || "#3B82F6" }}
                                />
                                <span className="vendor-th-name">{item.catering_nama}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* A. ORDER BERJALAN */}
                        <tr className="section-header-row">
                          <td colSpan={1 + shiftData.items.length} className="section-header-cell">
                            A. ORDER BERJALAN
                          </td>
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Jumlah Order Berjalan</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: sum(daily order) / distinct operational dates">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num">
                              {formatNumber(item.jumlah_order_berjalan, 2)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>% Order</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: = Row 9 / Row 11">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num">
                              {formatPercent(item.prosentase_order)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Performa</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Performance Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num">
                              {item.performa_katering !== null && item.performa_katering !== undefined
                                ? `${formatNumber(item.performa_katering, 2)}%`
                                : "-"}
                            </td>
                          ))}
                        </tr>

                        {/* B. SANKSI */}
                        <tr className="section-header-row">
                          <td colSpan={1 + shiftData.items.length} className="section-header-cell">
                            B. SANKSI
                          </td>
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Terlambat</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Punishment Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num col-dim">
                              {item.sanksi_terlambat > 0 ? formatNumber(item.sanksi_terlambat) : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Kelayakan</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Punishment Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num col-dim">
                              {item.sanksi_kelayakan > 0 ? formatNumber(item.sanksi_kelayakan) : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Kalori</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Punishment Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num col-dim">
                              {item.sanksi_kalori > 0 ? formatNumber(item.sanksi_kalori) : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Komplain</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Punishment Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num col-dim">
                              {item.sanksi_komplain > 0 ? formatNumber(item.sanksi_komplain) : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Audit</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot: Laporan Punishment Bulanan">Snapshot</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num col-dim">
                              {item.sanksi_audit > 0 ? formatNumber(item.sanksi_audit) : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr className="row-sanksi-kebersihan">
                          <td className="td-komponen sticky-col-cell cell-sanksi-label">
                            <div className="komponen-title-with-badge">
                              <span>Kebersihan</span>
                              <span className="badge-tag badge-unconfirmed" title="Aturan R&P Kebersihan Belum Terkonfirmasi (Unconfirmed)">Unconfirmed</span>
                              {canEdit && !isFinal && <span className="manual-badge">Input</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">
                              Formula belum terkonfirmasi; penyesuaian manual manajemen.
                            </div>
                          </td>
                          {shiftData.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <td key={item.id} className="td-val font-num cell-sanksi">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={itemEditForm.sanksi_kebersihan}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        sanksi_kebersihan: Math.max(0, parseFloat(e.target.value) || 0),
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditItem(item.id);
                                      if (e.key === "Escape") cancelEditItem();
                                    }}
                                    className="matrix-input input-reward"
                                    placeholder="0"
                                  />
                                ) : (
                                  <span
                                    className={canEdit && !isFinal ? "interactive-val" : ""}
                                    onClick={() => canEdit && !isFinal && startEditItem(item)}
                                    title={canEdit && !isFinal ? "Klik untuk edit sanksi kebersihan" : undefined}
                                  >
                                    {item.sanksi_kebersihan > 0 ? formatNumber(item.sanksi_kebersihan) : "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="row-total-sanksi">
                          <td className="td-komponen sticky-col-cell font-bold cell-sanksi-label">
                            <div className="komponen-title-with-badge">
                              <span>Total Sanksi</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: = Terlambat + Kelayakan + Kalori + Komplain + Audit + Kebersihan">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num font-bold cell-sanksi">
                              {formatNumber(item.total_sanksi)}
                            </td>
                          ))}
                        </tr>

                        {/* C. PENYESUAIAN */}
                        <tr className="section-header-row">
                          <td colSpan={1 + shiftData.items.length} className="section-header-cell">
                            C. PENYESUAIAN
                          </td>
                        </tr>
                        <tr className="row-reward">
                          <td className="td-komponen sticky-col-cell font-bold cell-reward-label">
                            <div className="komponen-title-with-badge">
                              <span>Reward</span>
                              <span className="badge-tag badge-decision" title="Business Decision: Penetapan rapat koordinasi / kebijakan manajemen">Decision</span>
                              <span className="badge-tag badge-unconfirmed" title="Aturan Formula Otomatis Reward Belum Terkonfirmasi (Unconfirmed)">Unconfirmed</span>
                              {canEdit && !isFinal && <span className="manual-badge">Input</span>}
                            </div>
                            <div className="text-[10px] text-amber-900/80 font-normal mt-0.5 leading-tight">
                              Aturan otomatis belum terkonfirmasi; keputusan bisnis manajemen.
                            </div>
                          </td>
                          {shiftData.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <td key={item.id} className="td-val font-num cell-reward">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={itemEditForm.reward}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        reward: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditItem(item.id);
                                      if (e.key === "Escape") cancelEditItem();
                                    }}
                                    className="matrix-input input-reward"
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    className={canEdit && !isFinal ? "interactive-val" : ""}
                                    onClick={() => canEdit && !isFinal && startEditItem(item)}
                                    title={canEdit && !isFinal ? "Klik untuk edit" : undefined}
                                  >
                                    {formatNumber(item.reward)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* D. HASIL */}
                        <tr className="section-header-row">
                          <td colSpan={1 + shiftData.items.length} className="section-header-cell">
                            D. HASIL
                          </td>
                        </tr>
                        <tr className="row-hasil">
                          <td className="td-komponen sticky-col-cell font-bold cell-hasil-label">
                            <div className="komponen-title-with-badge">
                              <span>Hasil Perhitungan</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: = Order Berjalan + Total Sanksi + Reward">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num font-bold cell-hasil">
                              {formatNumber(item.hasil_perhitungan, 2)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>% Order Berikutnya</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: = Hasil Perhitungan / Total Order Shift">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num">
                              {formatPercent(item.prosentase_order_berikutnya)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Perkiraan Order</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated: = % Order Berikutnya * Jumlah Karyawan">Auto</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => (
                            <td key={item.id} className="td-val font-num">
                              {item.perkiraan_order !== null && item.perkiraan_order !== undefined
                                ? formatNumber(item.perkiraan_order, 2)
                                : "-"}
                            </td>
                          ))}
                        </tr>
                        <tr className="row-manual">
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Order Min / Max</span>
                              <span className="badge-tag badge-unconfirmed" title="Aturan Batas Min/Max Belum Terkonfirmasi (Unconfirmed)">Unconfirmed</span>
                              {canEdit && !isFinal && <span className="manual-badge">Input</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">
                              Aturan batas belum terkonfirmasi; nilai literal/input.
                            </div>
                          </td>
                          {shiftData.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <td key={item.id} className="td-val font-num">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={itemEditForm.order_minmax}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        order_minmax: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditItem(item.id);
                                      if (e.key === "Escape") cancelEditItem();
                                    }}
                                    className="matrix-input"
                                  />
                                ) : (
                                  <span
                                    className={canEdit && !isFinal ? "interactive-val" : ""}
                                    onClick={() => canEdit && !isFinal && startEditItem(item)}
                                    title={canEdit && !isFinal ? "Klik untuk edit" : undefined}
                                  >
                                    {item.order_minmax ? formatNumber(item.order_minmax) : "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="row-aktual">
                          <td className="td-komponen sticky-col-cell font-bold cell-aktual-label">
                            <div className="komponen-title-with-badge">
                              <span>Aktual Order</span>
                              <span className="badge-tag badge-decision" title="Business Decision: Penetapan alokasi kuota final manajemen">Decision</span>
                              <span className="badge-tag badge-unconfirmed" title="Aturan Derivasi Aktual Order Belum Terkonfirmasi (Unconfirmed)">Unconfirmed</span>
                              {canEdit && !isFinal && <span className="manual-badge">Input</span>}
                            </div>
                            <div className="text-[10px] text-emerald-900/80 font-normal mt-0.5 leading-tight">
                              Alokasi PT JAI / keputusan bisnis manajemen.
                            </div>
                          </td>
                          {shiftData.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <td key={item.id} className="td-val font-num cell-aktual">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={itemEditForm.aktual_order}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        aktual_order: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditItem(item.id);
                                      if (e.key === "Escape") cancelEditItem();
                                    }}
                                    className="matrix-input input-aktual"
                                  />
                                ) : (
                                  <span
                                    className={canEdit && !isFinal ? "interactive-val" : ""}
                                    onClick={() => canEdit && !isFinal && startEditItem(item)}
                                    title={canEdit && !isFinal ? "Klik untuk edit" : undefined}
                                  >
                                    {item.aktual_order ? formatNumber(item.aktual_order) : "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* E. CATATAN */}
                        <tr className="section-header-row">
                          <td colSpan={1 + shiftData.items.length} className="section-header-cell">
                            E. CATATAN
                          </td>
                        </tr>
                        <tr>
                          <td className="td-komponen sticky-col-cell">
                            <div className="komponen-title-with-badge">
                              <span>Catatan</span>
                              <span className="badge-tag badge-source-input" title="Source Input: Catatan operasional">Input</span>
                            </div>
                          </td>
                          {shiftData.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <td key={item.id} className="td-val td-catatan">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={itemEditForm.catatan}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        catatan: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditItem(item.id);
                                      if (e.key === "Escape") cancelEditItem();
                                    }}
                                    className="matrix-input-text"
                                    placeholder="Catatan..."
                                  />
                                ) : (
                                  <span
                                    className={`text-catatan ${canEdit && !isFinal ? "interactive-val" : ""}`}
                                    onClick={() => canEdit && !isFinal && startEditItem(item)}
                                    title={canEdit && !isFinal ? "Klik untuk edit" : undefined}
                                  >
                                    {item.catatan || "-"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* AKSI ROW AT BOTTOM (IF EDITABLE) */}
                        {canEdit && !isFinal && (
                          <tr className="row-actions-bottom">
                            <td className="td-komponen sticky-col-cell font-bold">Aksi</td>
                            {shiftData.items.map((item) => {
                              const isEditing = editingItemId === item.id;
                              return (
                                <td key={item.id} className="td-val td-action-cell">
                                  {isEditing ? (
                                    <div className="action-pill-group justify-end">
                                      <button
                                        type="button"
                                        onClick={() => saveEditItem(item.id)}
                                        disabled={savingItem}
                                        className="btn-pill btn-pill-save"
                                      >
                                        {savingItem ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                                        <span>Simpan</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditItem}
                                        className="btn-pill btn-pill-cancel"
                                      >
                                        <X size={11} />
                                        <span>Batal</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => startEditItem(item)}
                                      className="btn-pill btn-pill-edit"
                                    >
                                      <Edit2 size={11} />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View: Stacked Metric Cards with Catering Selector */}
                <div className="rp-matrix-mobile">
                  {/* Catering Selector Tabs */}
                  <div className="mobile-vendor-tabs">
                    {shiftData.items.map((item, idx) => {
                      const activeIdx = mobileActiveVendor[shiftKey] ?? 0;
                      const isSelected = activeIdx === idx;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setMobileActiveVendor((prev) => ({ ...prev, [shiftKey]: idx }))
                          }
                          className={`mobile-vendor-tab-btn ${isSelected ? "active" : ""}`}
                        >
                          <span
                            className="catering-color-dot"
                            style={{ backgroundColor: item.catering_warna || "#3B82F6" }}
                          />
                          <span className="vendor-tab-name">{item.catering_nama}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Catering Metric Stack */}
                  {(() => {
                    const activeIdx = mobileActiveVendor[shiftKey] ?? 0;
                    const item = shiftData.items[activeIdx] || shiftData.items[0];
                    if (!item) return null;
                    const isEditing = editingItemId === item.id;

                    return (
                      <div className="mobile-vendor-card">
                        <div className="mobile-vendor-header">
                          <div className="mobile-vendor-title">
                            <span
                              className="catering-color-dot-lg"
                              style={{ backgroundColor: item.catering_warna || "#3B82F6" }}
                            />
                            <div>
                              <h3 className="mobile-vname">{item.catering_nama}</h3>
                              <span className="mobile-vshift">Shift {shiftKey} • Grup {selectedGroup}</span>
                            </div>
                          </div>
                          {canEdit && !isFinal && (
                            <div className="mobile-vendor-actions">
                              {isEditing ? (
                                <div className="action-pill-group">
                                  <button
                                    type="button"
                                    onClick={() => saveEditItem(item.id)}
                                    disabled={savingItem}
                                    className="btn-pill btn-pill-save"
                                  >
                                    {savingItem ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    <span>Simpan</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditItem}
                                    className="btn-pill btn-pill-cancel"
                                  >
                                    <X size={12} />
                                    <span>Batal</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditItem(item)}
                                  className="btn-pill btn-pill-edit"
                                >
                                  <Edit2 size={12} />
                                  <span>Edit Data</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Section A: Order Berjalan */}
                        <div className="mobile-section">
                          <div className="mobile-section-title">A. ORDER BERJALAN</div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">Jumlah Order Berjalan</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num">{formatNumber(item.jumlah_order_berjalan, 2)}</span>
                          </div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">% Order</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num">{formatPercent(item.prosentase_order)}</span>
                          </div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">Performa</span>
                              <span className="badge-tag badge-snapshot" title="Source Snapshot">Snapshot</span>
                            </div>
                            <span className="m-val font-num">
                              {item.performa_katering !== null && item.performa_katering !== undefined
                                ? `${formatNumber(item.performa_katering, 2)}%`
                                : "-"}
                            </span>
                          </div>
                        </div>

                        {/* Section B: Sanksi */}
                        <div className="mobile-section">
                          <div className="mobile-section-title">B. SANKSI</div>
                          <div className="mobile-metric-grid">
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Terlambat</span>
                                <span className="badge-tag badge-snapshot">Snapshot</span>
                              </div>
                              <span className="m-subval font-num">{item.sanksi_terlambat > 0 ? formatNumber(item.sanksi_terlambat) : "-"}</span>
                            </div>
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Kelayakan</span>
                                <span className="badge-tag badge-snapshot">Snapshot</span>
                              </div>
                              <span className="m-subval font-num">{item.sanksi_kelayakan > 0 ? formatNumber(item.sanksi_kelayakan) : "-"}</span>
                            </div>
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Kalori</span>
                                <span className="badge-tag badge-snapshot">Snapshot</span>
                              </div>
                              <span className="m-subval font-num">{item.sanksi_kalori > 0 ? formatNumber(item.sanksi_kalori) : "-"}</span>
                            </div>
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Komplain</span>
                                <span className="badge-tag badge-snapshot">Snapshot</span>
                              </div>
                              <span className="m-subval font-num">{item.sanksi_komplain > 0 ? formatNumber(item.sanksi_komplain) : "-"}</span>
                            </div>
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Audit</span>
                                <span className="badge-tag badge-snapshot">Snapshot</span>
                              </div>
                              <span className="m-subval font-num">{item.sanksi_audit > 0 ? formatNumber(item.sanksi_audit) : "-"}</span>
                            </div>
                            <div className="m-submetric">
                              <div className="m-sublabel-wrap">
                                <span className="m-sublabel">Kebersihan</span>
                                <span className="badge-tag badge-unconfirmed">Unconfirmed</span>
                              </div>
                              <span className="m-subval font-num">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={itemEditForm.sanksi_kebersihan}
                                    onChange={(e) =>
                                      setItemEditForm({
                                        ...itemEditForm,
                                        sanksi_kebersihan: Math.max(0, parseFloat(e.target.value) || 0),
                                      })
                                    }
                                    className="matrix-input input-reward"
                                    placeholder="0"
                                  />
                                ) : (
                                  item.sanksi_kebersihan > 0 ? formatNumber(item.sanksi_kebersihan) : "-"
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="mobile-metric-row mobile-row-sanksi">
                            <div className="m-label-wrap">
                              <span className="m-label font-bold">Total Sanksi</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num font-bold text-red">{formatNumber(item.total_sanksi)}</span>
                          </div>
                        </div>

                        {/* Section C: Penyesuaian */}
                        <div className="mobile-section">
                          <div className="mobile-section-title">C. PENYESUAIAN</div>
                          <div className="mobile-metric-row mobile-row-reward">
                            <div className="m-label-wrap">
                              <span className="m-label font-bold">Reward</span>
                              <span className="badge-tag badge-decision" title="Business Decision">Decision</span>
                              <span className="badge-tag badge-unconfirmed" title="Unconfirmed Rule">Unconfirmed</span>
                            </div>
                            <span className="m-val font-num">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={itemEditForm.reward}
                                  onChange={(e) =>
                                    setItemEditForm({
                                      ...itemEditForm,
                                      reward: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="matrix-input input-reward"
                                />
                              ) : (
                                <span className="font-bold text-amber">{formatNumber(item.reward)}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Section D: Hasil */}
                        <div className="mobile-section">
                          <div className="mobile-section-title">D. HASIL</div>
                          <div className="mobile-metric-row mobile-row-hasil">
                            <div className="m-label-wrap">
                              <span className="m-label font-bold">Hasil Perhitungan</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num font-bold text-blue">{formatNumber(item.hasil_perhitungan, 2)}</span>
                          </div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">% Order Berikutnya</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num">{formatPercent(item.prosentase_order_berikutnya)}</span>
                          </div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">Perkiraan Order</span>
                              <span className="badge-tag badge-auto" title="Auto Calculated">Auto</span>
                            </div>
                            <span className="m-val font-num">
                              {item.perkiraan_order !== null && item.perkiraan_order !== undefined
                                ? formatNumber(item.perkiraan_order, 2)
                                : "-"}
                            </span>
                          </div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">Order Min / Max</span>
                              <span className="badge-tag badge-unconfirmed" title="Unconfirmed Rule">Unconfirmed</span>
                            </div>
                            <span className="m-val font-num">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={itemEditForm.order_minmax}
                                  onChange={(e) =>
                                    setItemEditForm({
                                      ...itemEditForm,
                                      order_minmax: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="matrix-input"
                                />
                              ) : (
                                item.order_minmax ? formatNumber(item.order_minmax) : "-"
                              )}
                            </span>
                          </div>
                          <div className="mobile-metric-row mobile-row-aktual">
                            <div className="m-label-wrap">
                              <span className="m-label font-bold">Aktual Order</span>
                              <span className="badge-tag badge-decision" title="Business Decision">Decision</span>
                              <span className="badge-tag badge-unconfirmed" title="Unconfirmed Rule">Unconfirmed</span>
                            </div>
                            <span className="m-val font-num">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={itemEditForm.aktual_order}
                                  onChange={(e) =>
                                    setItemEditForm({
                                      ...itemEditForm,
                                      aktual_order: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="matrix-input input-aktual"
                                />
                              ) : (
                                <span className="font-bold text-green">{item.aktual_order ? formatNumber(item.aktual_order) : "-"}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Section E: Catatan */}
                        <div className="mobile-section">
                          <div className="mobile-section-title">E. CATATAN</div>
                          <div className="mobile-metric-row">
                            <div className="m-label-wrap">
                              <span className="m-label">Catatan</span>
                              <span className="badge-tag badge-source-input" title="Source Input">Input</span>
                            </div>
                            <div className="m-val-full">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={itemEditForm.catatan}
                                  onChange={(e) =>
                                    setItemEditForm({
                                      ...itemEditForm,
                                      catatan: e.target.value,
                                    })
                                  }
                                  className="matrix-input-text"
                                  placeholder="Catatan evaluasi..."
                                />
                              ) : (
                                <span className="text-catatan">{item.catatan || "-"}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rp-empty-state">
          <Award className="icon-empty" size={44} />
          <h3 className="empty-title">Belum ada data evaluasi yang dipilih</h3>
          <p className="empty-desc">
            Pilih periode evaluasi di atas atau buat periode evaluasi baru untuk memulai perhitungan.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus size={15} />
              <span>Buat Periode Baru</span>
            </button>
          )}
        </div>
      )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RIWAYAT PERIODE REWARD & PUNISHMENT */}
      {/* ========================================================================= */}
      {activeTab === "riwayat" && (
        <div id="panel-riwayat-rp" role="tabpanel" aria-labelledby="tab-riwayat-rp" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Summary Stat Cards */}
          <div className="history-stat-grid">
            <div className="history-stat-card">
              <div className="hstat-icon-wrap icon-total">
                <History size={20} />
              </div>
              <div className="hstat-content">
                <span className="hstat-label">Total Periode Tercatat</span>
                <span className="hstat-value">{historyStats.total}</span>
              </div>
            </div>

            <div className="history-stat-card">
              <div className="hstat-icon-wrap icon-final">
                <Lock size={20} />
              </div>
              <div className="hstat-content">
                <span className="hstat-label">Periode Final (Terkunci)</span>
                <span className="hstat-value">{historyStats.finalCount}</span>
              </div>
            </div>

            <div className="history-stat-card">
              <div className="hstat-icon-wrap icon-draft">
                <Clock size={20} />
              </div>
              <div className="hstat-content">
                <span className="hstat-label">Periode Draft (Aktif)</span>
                <span className="hstat-value">{historyStats.draftCount}</span>
              </div>
            </div>

            <div className="history-stat-card">
              <div className="hstat-icon-wrap icon-active">
                <Award size={20} />
              </div>
              <div className="hstat-content">
                <span className="hstat-label">Periode Sedang Dibuka</span>
                <span className="hstat-value text-ellipsis" title={historyStats.activeName}>
                  {historyStats.activeName}
                </span>
              </div>
            </div>
          </div>

          {/* Filters & Actions Card */}
          <div className="history-filter-card">
            <div className="history-filter-row">
              {/* Search */}
              <div className="history-search-wrap">
                <Search size={16} className="history-search-icon" />
                <input
                  type="text"
                  placeholder="Cari nama periode, rentang tanggal, atau target bulan..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="history-filter-search"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch("");
                      setHistoryPage(1);
                    }}
                    className="history-search-clear"
                    title="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="history-filter-select-wrap">
                <label className="history-filter-label">Status:</label>
                <select
                  value={historyFilterStatus}
                  onChange={(e) => {
                    setHistoryFilterStatus(e.target.value as "ALL" | "DRAFT" | "FINAL");
                    setHistoryPage(1);
                  }}
                  className="history-filter-select"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="FINAL">FINAL (Terkunci)</option>
                  <option value="DRAFT">DRAFT (Dalam Proses)</option>
                </select>
              </div>

              {/* Year Filter */}
              {availableYears.length > 0 && (
                <div className="history-filter-select-wrap">
                  <label className="history-filter-label">Tahun:</label>
                  <select
                    value={historyFilterYear}
                    onChange={(e) => {
                      setHistoryFilterYear(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="history-filter-select"
                  >
                    <option value="ALL">Semua Tahun</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Tahun {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset filter button */}
              {(historySearch || historyFilterStatus !== "ALL" || historyFilterYear !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch("");
                    setHistoryFilterStatus("ALL");
                    setHistoryFilterYear("ALL");
                    setHistoryPage(1);
                  }}
                  className="btn btn-secondary history-btn-reset"
                  title="Reset seluruh filter"
                >
                  <RefreshCw size={13} />
                  <span>Reset</span>
                </button>
              )}

              {/* Action: Create New Period */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary history-btn-create"
                >
                  <Plus size={15} />
                  <span>Buat Periode Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="history-table-card">
            {filteredHistoryPeriods.length === 0 ? (
              <div className="history-empty-state">
                <History size={40} className="history-empty-icon" />
                <h4 className="history-empty-title">Tidak ada periode evaluasi yang sesuai</h4>
                <p className="history-empty-desc">
                  {historySearch || historyFilterStatus !== "ALL" || historyFilterYear !== "ALL"
                    ? "Coba ubah kata kunci pencarian atau reset filter untuk menampilkan kembali data."
                    : "Belum ada periode reward & punishment yang tercatat di sistem."}
                </p>
                {(historySearch || historyFilterStatus !== "ALL" || historyFilterYear !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch("");
                      setHistoryFilterStatus("ALL");
                      setHistoryFilterYear("ALL");
                      setHistoryPage(1);
                    }}
                    className="btn btn-secondary"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="history-table-wrapper">
                  <table className="history-dedicated-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: "center" }}>NO</th>
                        <th style={{ minWidth: 220 }}>NAMA PERIODE</th>
                        <th style={{ minWidth: 200 }}>RENTANG EVALUASI</th>
                        <th style={{ minWidth: 140 }}>TARGET BULAN</th>
                        <th style={{ width: 120 }}>STATUS</th>
                        <th style={{ width: 150 }}>SUMBER PUNISHMENT</th>
                        <th style={{ minWidth: 180 }}>CATATAN / KETERANGAN</th>
                        <th style={{ minWidth: 260, textAlign: "right" }}>AKSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistoryPeriods.map((p, idx) => {
                        const isCurrent = selectedPeriodId === p.id;
                        const isFinalStatus = p.status === "FINAL";
                        const rowNumber = (historyPage - 1) * historyPageSize + idx + 1;
                        return (
                          <tr key={p.id} className={isCurrent ? "row-current" : ""}>
                            <td style={{ textAlign: "center", color: "#64748b", fontWeight: 700 }}>
                              {rowNumber}
                            </td>
                            <td>
                              <div className="history-cell-name">
                                <span className="history-period-name">{p.nama_periode}</span>
                                {isCurrent && (
                                  <span className="badge-active-tag">Sedang Dibuka</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="history-date-range">
                                <Calendar size={13} style={{ color: "var(--red-dark, #8f1a25)", flexShrink: 0 }} />
                                <span>{formatDateIndo(p.tanggal_mulai)} s/d {formatDateIndo(p.tanggal_selesai)}</span>
                              </div>
                            </td>
                            <td>
                              <span className="history-target-month">{p.target_bulan_berikutnya || "—"}</span>
                            </td>
                            <td>
                              <span className={`rp-status-badge ${isFinalStatus ? "status-final" : "status-draft"}`}>
                                {isFinalStatus ? <Lock size={11} /> : <Clock size={11} />}
                                <span>{p.status}</span>
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  backgroundColor: p.punishment_source_status === "FINAL" ? "#ecfdf5" : "#fffbeb",
                                  color: p.punishment_source_status === "FINAL" ? "#047857" : "#b45309",
                                  border: `1px solid ${p.punishment_source_status === "FINAL" ? "#a7f3d0" : "#fde68a"}`
                                }}
                              >
                                {p.punishment_source_status}
                              </span>
                            </td>
                            <td>
                              <span className="history-cell-notes">{p.catatan || p.keterangan || "—"}</span>
                            </td>
                            <td>
                              <div className="action-pill-group justify-end">
                                <button
                                  type="button"
                                  className="btn-pill btn-pill-view"
                                  onClick={() => {
                                    setSelectedPeriodId(p.id);
                                    setActiveTab("detail");
                                    if (typeof window !== "undefined") {
                                      window.history.replaceState(null, "", "/reward-punishment");
                                    }
                                    showToast(`Membuka evaluasi periode '${p.nama_periode}'`, "info");
                                  }}
                                  title="Lihat detail evaluasi & perhitungan periode ini"
                                >
                                  <Eye size={12} />
                                  <span>Lihat Detail</span>
                                </button>

                                {canEdit && (
                                  <button
                                    type="button"
                                    className="btn-pill btn-pill-edit"
                                    onClick={() => handleOpenEditPeriod(p)}
                                    title="Edit rentang tanggal dan nama periode"
                                  >
                                    <Edit2 size={12} />
                                    <span>Edit</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn-pill btn-pill-excel"
                                  onClick={() => triggerRewardPunishmentExcelDownload(p.id, p.nama_periode)}
                                  title="Unduh laporan Excel (.xlsx)"
                                >
                                  <FileSpreadsheet size={12} />
                                  <span>Excel</span>
                                </button>

                                {canEdit && (p.status !== "FINAL" || isAdmin) && (
                                  <button
                                    type="button"
                                    className="btn-pill btn-pill-delete"
                                    onClick={() => setDeletingPeriod(p)}
                                    title="Hapus periode evaluasi ini"
                                  >
                                    <Trash2 size={12} />
                                    <span>Hapus</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="history-table-footer">
                  <div className="history-table-info">
                    Menampilkan <strong>{paginatedHistoryPeriods.length}</strong> dari <strong>{filteredHistoryPeriods.length}</strong> periode
                    {filteredHistoryPeriods.length !== periods.length && ` (disaring dari total ${periods.length} periode)`}
                  </div>
                  {totalHistoryPages > 1 && (
                    <div className="history-pagination-btns">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                        disabled={historyPage === 1}
                        className="btn-page-nav"
                      >
                        Sebelumnya
                      </button>
                      <div className="history-page-numbers">
                        {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((pg) => (
                          <button
                            key={pg}
                            type="button"
                            onClick={() => setHistoryPage(pg)}
                            className={`btn-page-number ${historyPage === pg ? "active" : ""}`}
                          >
                            {pg}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((prev) => Math.min(prev + 1, totalHistoryPages))}
                        disabled={historyPage === totalHistoryPages}
                        className="btn-page-nav"
                      >
                        Berikutnya
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. Modal Atur Grup Katering */}
      {showGroupModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-group-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h3 className="modal-title">Atur Grup Reward & Punishment</h3>
                <p className="modal-subtitle-minimal">Pilih grup untuk setiap katering aktif.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-group">
              <table className="group-assignment-table">
                <thead>
                  <tr>
                    <th>Katering</th>
                    <th style={{ width: "160px" }}>Grup</th>
                  </tr>
                </thead>
                <tbody>
                  {allCaterings.map((c) => (
                    <tr key={c.id}>
                      <td className="c-name-col">
                        <span
                          className="catering-color-dot"
                          style={{ backgroundColor: c.color_hex || "#3B82F6" }}
                        />
                        <span className="c-name-text">{c.nama}</span>
                      </td>
                      <td className="c-select-col">
                        <select
                          value={groupAssignments[c.id] ?? (c.reward_punishment_group || "")}
                          onChange={(e) =>
                            setGroupAssignments((prev) => ({
                              ...prev,
                              [c.id]: e.target.value as "A" | "B" | "",
                            }))
                          }
                          className="group-assign-select"
                        >
                          <option value="A">Grup A</option>
                          <option value="B">Grup B</option>
                          <option value="">Belum Ditentukan</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {allCaterings.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center text-muted py-4">
                        Tidak ada katering aktif ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="btn btn-secondary"
                disabled={savingGroups}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveGroupAssignments}
                disabled={savingGroups}
                className="btn btn-primary"
              >
                {savingGroups && <Loader2 size={14} className="animate-spin" />}
                <span>{savingGroups ? "Menyimpan..." : "Simpan Perubahan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Create Period */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">
                <Plus size={18} className="text-red" />
                <span>Buat Periode Evaluasi Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">TANGGAL MULAI *</label>
                  <input
                    type="date"
                    required
                    value={createForm.tanggal_mulai}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className={`form-input ${dateValidationError ? "border-red" : ""}`}
                  />
                  <span className="form-date-hint">
                    {formatDateIndo(createForm.tanggal_mulai)}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">TANGGAL SELESAI *</label>
                  <input
                    type="date"
                    required
                    value={createForm.tanggal_selesai}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className={`form-input ${dateValidationError ? "border-red" : ""}`}
                  />
                  <span className="form-date-hint">
                    {formatDateIndo(createForm.tanggal_selesai)}
                  </span>
                </div>
              </div>

              {dateValidationError && (
                <div className="form-date-error">
                  <AlertCircle size={14} />
                  <span>{dateValidationError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Nama Periode <span className="label-dimmed">(Opsional / Otomatis)</span>
                </label>
                <input
                  type="text"
                  placeholder={derivePeriodRangeLabel(createForm.tanggal_mulai, createForm.tanggal_selesai) || "Rentang tanggal evaluasi"}
                  value={createForm.nama_periode}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, nama_periode: e.target.value })
                  }
                  className="form-input"
                />
                <span className="form-hint-sub">
                  Rentang tanggal otoritatif: <strong>{derivePeriodRangeLabel(createForm.tanggal_mulai, createForm.tanggal_selesai)}</strong>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Target Bulan Berikutnya *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: November 2026"
                  value={createForm.target_bulan_berikutnya}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      target_bulan_berikutnya: e.target.value,
                    })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Jml Karyawan Pagi (Opsional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Kosongkan jika belum ada"
                    value={createForm.default_karyawan_pagi}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        default_karyawan_pagi: e.target.value,
                      })
                    }
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jml Karyawan Malam (Opsional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Kosongkan jika belum ada"
                    value={createForm.default_karyawan_malam}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        default_karyawan_malam: e.target.value,
                      })
                    }
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan bila ada..."
                  value={createForm.catatan}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, catatan: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  <span>{creating ? "Membuat..." : "Simpan Periode"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal Finalize */}
      {showFinalizeModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-sm">
            <div className="finalize-header">
              <div className="finalize-icon-box">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="modal-title">Konfirmasi Finalisasi Evaluasi</h3>
                <p className="modal-sub">
                  Periode: <strong>{activePeriod?.nama_periode}</strong>
                </p>
              </div>
            </div>

            <div className="finalize-warning">
              <p className="warning-heading">
                <AlertCircle size={14} /> Perhatian:
              </p>
              <p>
                Setelah periode berstatus <strong>FINAL</strong>, seluruh data kalkulasi, nilai reward, porsi aktual, dan parameter karyawan akan <u>dikunci permanen</u>. Data tidak dapat disinkronkan ulang atau diedit kembali.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={finalizing}
                className="btn btn-finalize"
              >
                {finalizing && <Loader2 size={14} className="animate-spin" />}
                <span>{finalizing ? "Memproses..." : "Ya, Finalisasi Sekarang"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Histori Periode moved to dedicated tab view & page */}

      {/* 9. Modal Edit Periode */}
      {showEditPeriodModal && editingPeriod && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !savingEditPeriod) { setShowEditPeriodModal(false); setEditingPeriod(null); } }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">
                <Edit2 size={18} style={{ color: "var(--red, #b3212f)" }} />
                <span>Edit Info Periode Evaluasi</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowEditPeriodModal(false); setEditingPeriod(null); }}
                className="btn-close-modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditPeriod} className="modal-form">
              <div className="form-group">
                <label className="form-label">NAMA PERIODE *</label>
                <input
                  type="text"
                  required
                  value={editPeriodForm.nama_periode}
                  onChange={(e) =>
                    setEditPeriodForm({ ...editPeriodForm, nama_periode: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">TANGGAL MULAI *</label>
                  <input
                    type="date"
                    required
                    value={editPeriodForm.tanggal_mulai}
                    onChange={(e) => handleEditStartDateChange(e.target.value)}
                    className={`form-input ${editDateError ? "border-red" : ""}`}
                  />
                  <span className="form-date-hint">
                    {formatDateIndo(editPeriodForm.tanggal_mulai)}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">TANGGAL SELESAI *</label>
                  <input
                    type="date"
                    required
                    value={editPeriodForm.tanggal_selesai}
                    onChange={(e) => handleEditEndDateChange(e.target.value)}
                    className={`form-input ${editDateError ? "border-red" : ""}`}
                  />
                  <span className="form-date-hint">
                    {formatDateIndo(editPeriodForm.tanggal_selesai)}
                  </span>
                </div>
              </div>

              {editDateError && (
                <div className="form-date-error">
                  <AlertCircle size={14} />
                  <span>{editDateError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">TARGET BULAN BERIKUTNYA *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: November 2026"
                  value={editPeriodForm.target_bulan_berikutnya}
                  onChange={(e) =>
                    setEditPeriodForm({ ...editPeriodForm, target_bulan_berikutnya: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan bila ada..."
                  value={editPeriodForm.catatan}
                  onChange={(e) =>
                    setEditPeriodForm({ ...editPeriodForm, catatan: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan / Deskripsi</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan evaluasi bila ada..."
                  value={editPeriodForm.keterangan}
                  onChange={(e) =>
                    setEditPeriodForm({ ...editPeriodForm, keterangan: e.target.value })
                  }
                  className="form-input"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { setShowEditPeriodModal(false); setEditingPeriod(null); }}
                  className="btn btn-secondary"
                  disabled={savingEditPeriod}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEditPeriod}
                  className="btn btn-primary"
                >
                  {savingEditPeriod && <Loader2 size={14} className="animate-spin" />}
                  <span>{savingEditPeriod ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Modal Konfirmasi Hapus Periode */}
      {deletingPeriod && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !isDeletingPeriod) setDeletingPeriod(null); }}>
          <div className="modal-card modal-sm">
            <div className="finalize-header">
              <div className="finalize-icon-box" style={{ background: "#fee2e2", color: "#dc2626" }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="modal-title" style={{ color: "#b91c1c" }}>Konfirmasi Hapus Periode</h3>
                <p className="modal-sub">
                  Periode: <strong>{deletingPeriod.nama_periode}</strong>
                </p>
              </div>
            </div>

            <div className="finalize-warning" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
              <p className="warning-heading" style={{ color: "#b91c1c" }}>
                <AlertCircle size={14} /> Peringatan:
              </p>
              <p style={{ margin: 0 }}>
                Apakah Anda yakin ingin menghapus periode laporan <strong>{deletingPeriod.nama_periode}</strong> ({formatDateIndo(deletingPeriod.tanggal_mulai)} s/d {formatDateIndo(deletingPeriod.tanggal_selesai)})?
                Seluruh kalkulasi reward, penalti, dan penyesuaian order pada periode ini akan dihapus secara permanen.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeletingPeriod(null)}
                className="btn btn-secondary"
                disabled={isDeletingPeriod}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePeriod}
                disabled={isDeletingPeriod}
                className="btn"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isDeletingPeriod && <Loader2 size={14} className="animate-spin" />}
                <span>{isDeletingPeriod ? "Menghapus..." : "Ya, Hapus Periode"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Scoped Enterprise Styling */}
      <style jsx>{`
        .rp-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: var(--text, #0f172a);
          font-family: inherit;
        }

        /* 1. Header Row */
        .rp-header-row {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .rp-header-row {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .rp-action-group {
            flex-wrap: wrap;
            justify-content: flex-end;
          }
        }

        .rp-title-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rp-header-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1;
        }

        .rp-title {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
          color: var(--text, #0f172a);
          line-height: 1.25;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        @media (max-width: 640px) {
          .rp-title {
            font-size: 18px;
          }
        }

        .rp-action-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: all 140ms ease;
          border: 1px solid transparent;
          line-height: 1;
          white-space: nowrap;
        }
        .btn-primary {
          background: var(--red, #b3212f);
          color: #ffffff;
        }
        .btn-primary:hover {
          background: var(--red-dark, #8f1a25);
        }
        .btn-secondary {
          background: #ffffff;
          color: #334155;
          border-color: var(--border-strong, #cbd5e1);
        }
        .btn-secondary:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #94a3b8;
        }
        .btn-finalize {
          background: #10b981;
          color: #ffffff;
        }
        .btn-finalize:hover {
          background: #059669;
        }
        .btn-atur-grup {
          background: #ffffff;
          color: #334155;
          border: 1px solid var(--border-strong, #cbd5e1);
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .btn-atur-grup:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 2. Compact Flat Toolbar */
        .rp-toolbar-card {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 10px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }
        @media (min-width: 960px) {
          .rp-toolbar-card {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .rp-toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .rp-toolbar-label {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text-secondary, #475569);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .rp-select {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text, #0f172a);
          background: #ffffff;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 6px;
          padding: 6px 10px;
          outline: none;
          cursor: pointer;
          max-width: 440px;
        }
        @media (max-width: 640px) {
          .rp-select {
            max-width: 100%;
            width: 100%;
          }
          .rp-toolbar-left {
            width: 100%;
          }
        }
        .rp-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        .rp-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 800;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .status-draft {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        .status-final {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .rp-toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (min-width: 960px) {
          .rp-toolbar-right {
            flex-wrap: nowrap;
            flex-shrink: 0;
          }
        }

        .rp-group-tabs {
          display: flex;
          align-items: center;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 6px;
          border: 1px solid var(--border, #e2e8f0);
        }
        .rp-tab-btn {
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 5px 12px;
          border: none;
          background: transparent;
          color: #475569;
          border-radius: 4px;
          cursor: pointer;
          transition: all 120ms ease;
          white-space: nowrap;
        }
        .tab-name {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .tab-count {
          font-size: 10.5px;
          font-weight: 500;
          color: #64748b;
        }
        .rp-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }
        .rp-tab-btn.active .tab-count {
          color: #0f172a;
          font-weight: 600;
        }

        /* 3. Subtle Inline Formula Notice */
        .rp-formula-inline-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;
          padding: 2px 4px;
        }
        .formula-lbl {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .formula-calc {
          font-family: monospace, sans-serif;
          font-weight: 600;
          color: #334155;
          background: #f8fafc;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        /* 4. Shift Cards & Vertical Matrix */
        .rp-shifts-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .rp-shift-card {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .rp-shift-header {
          background: #f8fafc;
          border-bottom: 1px solid var(--border, #e2e8f0);
          padding: 12px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 900px) {
          .rp-shift-header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .shift-title-block {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .shift-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .shift-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }
        .dot-pagi {
          background: #f59e0b;
        }
        .dot-malam {
          background: #6366f1;
        }
        .shift-title {
          font-size: 14.5px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.01em;
          color: #0f172a;
        }
        .shift-count {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .shift-meta-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .shift-stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }
        .stat-label {
          color: #64748b;
          font-weight: 500;
        }
        .stat-val-wrap {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .stat-val {
          font-weight: 700;
          color: #0f172a;
        }
        .stat-val-empty {
          color: var(--red, #dc2626);
          font-style: italic;
          font-weight: 600;
        }
        .btn-edit-karyawan {
          color: var(--red, #b3212f);
          font-weight: 700;
          font-size: 11px;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          padding: 0 0 0 2px;
        }
        .shift-stat-divider {
          width: 1px;
          height: 14px;
          background: #cbd5e1;
        }
        .shift-summary-inline {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
          color: #475569;
        }
        .summary-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .summary-lbl {
          color: #64748b;
        }
        .summary-val {
          font-weight: 700;
        }
        .summary-sep {
          color: #cbd5e1;
        }

        /* Desktop Table Matrix */
        .rp-matrix-desktop {
          display: block;
        }
        .rp-matrix-mobile {
          display: none;
        }
        @media (max-width: 680px) {
          .rp-matrix-desktop {
            display: none;
          }
          .rp-matrix-mobile {
            display: block;
          }
        }

        .rp-table-scroll {
          overflow-x: auto;
          width: 100%;
        }

        .rp-vertical-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
          table-layout: fixed;
        }

        /* Sticky Left Column (Komponen Evaluasi) */
        .th-komponen,
        .td-komponen {
          position: sticky;
          left: 0;
          z-index: 5;
          width: 240px;
          min-width: 220px;
          max-width: 260px;
          border-right: 1.5px solid var(--border-strong, #cbd5e1);
          padding: 9px 14px;
          font-weight: 600;
          box-shadow: 2px 0 3px rgba(0, 0, 0, 0.02);
        }
        .sticky-col-header {
          background: #f1f5f9 !important;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          z-index: 6;
          border-bottom: 1.5px solid var(--border-strong, #cbd5e1);
        }
        .sticky-col-cell {
          background: #ffffff;
          color: #0f172a;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }

        /* Vendor Headers: Clean, bold, without repetitive edit buttons */
        .th-vendor {
          padding: 10px 14px;
          background: #f8fafc;
          border-bottom: 1.5px solid var(--border-strong, #cbd5e1);
          border-right: 1px solid var(--border, #e2e8f0);
          text-align: right;
        }
        .vendor-th-content {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
        }
        .vendor-th-name {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        /* Data Cells: Consistent padding, right-aligned numbers */
        .td-val {
          padding: 8px 14px;
          text-align: right;
          border-bottom: 1px solid var(--border, #e2e8f0);
          border-right: 1px solid var(--border, #e2e8f0);
          white-space: nowrap;
          background: #ffffff;
        }
        .rp-vertical-table tr:hover td:not(.section-header-cell):not(.cell-sanksi):not(.cell-reward):not(.cell-hasil):not(.cell-aktual) {
          background: #f8fafc;
        }
        .td-catatan {
          text-align: left;
          white-space: normal;
        }

        /* Section Separator Rows */
        .section-header-row td {
          background: #f1f5f9 !important;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-top: 1.5px solid var(--border-strong, #cbd5e1);
          border-bottom: 1px solid var(--border-strong, #cbd5e1);
        }

        /* Visual Emphasis Rows */
        .row-total-sanksi td {
          background: #fef2f2 !important;
          color: #991b1b;
        }
        .cell-sanksi-label {
          background: #fef2f2 !important;
          color: #991b1b !important;
        }
        .cell-sanksi {
          background: #fef2f2 !important;
          color: #b91c1c !important;
        }

        .row-reward td {
          background: #fffbeb !important;
          color: #92400e;
        }
        .cell-reward-label {
          background: #fffbeb !important;
          color: #92400e !important;
        }
        .cell-reward {
          background: #fffbeb !important;
          color: #b45309 !important;
        }

        .row-hasil td {
          background: #eff6ff !important;
          color: #1e3a8a;
          border-top: 1.5px solid #bfdbfe;
          border-bottom: 1.5px solid #bfdbfe;
          font-size: 13px;
        }
        .cell-hasil-label {
          background: #eff6ff !important;
          color: #1e40af !important;
          font-weight: 800 !important;
        }
        .cell-hasil {
          background: #eff6ff !important;
          color: #1e40af !important;
          font-weight: 800 !important;
        }

        .row-aktual td {
          background: #f0fdf4 !important;
          color: #166534;
        }
        .cell-aktual-label {
          background: #f0fdf4 !important;
          color: #166534 !important;
        }
        .cell-aktual {
          background: #f0fdf4 !important;
          color: #15803d !important;
        }

        /* Manual Input & Badges */
        .komponen-title-with-badge {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .manual-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 5px;
          border-radius: 4px;
          background: #e2e8f0;
          color: #475569;
          letter-spacing: 0.03em;
        }
        .badge-tag {
          display: inline-flex;
          align-items: center;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          padding: 1.5px 5px;
          border-radius: 4px;
          white-space: nowrap;
          line-height: 1.1;
        }
        .badge-auto {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .badge-snapshot {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
        }
        .badge-decision {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .badge-unconfirmed {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }
        .badge-source-input {
          background: #f3e8ff;
          color: #6b21a8;
          border: 1px solid #e9d5ff;
        }
        .stat-label-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .m-label-wrap,
        .m-sublabel-wrap {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }
        .interactive-val {
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: all 120ms;
        }
        .interactive-val:hover {
          background: rgba(0, 0, 0, 0.06);
          text-decoration: underline;
        }
        .text-catatan {
          color: #475569;
          font-size: 11.5px;
        }

        .matrix-input {
          width: 100%;
          max-width: 110px;
          font-family: monospace, sans-serif;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 6px;
          border: 1.5px solid var(--border-strong, #cbd5e1);
          border-radius: 4px;
          text-align: right;
          outline: none;
          background: #ffffff;
        }
        .matrix-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }
        .input-reward {
          border-color: #f59e0b;
          background: #fffdf5;
          color: #92400e;
        }
        .input-aktual {
          border-color: #10b981;
          background: #f0fdf4;
          color: #15803d;
        }
        .matrix-input-text {
          width: 100%;
          font-size: 12px;
          padding: 4px 8px;
          border: 1.5px solid var(--border-strong, #cbd5e1);
          border-radius: 4px;
          outline: none;
          background: #ffffff;
        }
        .matrix-input-text:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        /* Action Pill Buttons */
        .action-pill-group {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .justify-end {
          justify-content: flex-end;
        }
        .btn-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 4px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 120ms ease;
        }
        .btn-pill-edit {
          background: #ffffff;
          color: #334155;
          border-color: #cbd5e1;
        }
        .btn-pill-edit:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }
        .btn-pill-save {
          background: #10b981;
          color: #ffffff;
        }
        .btn-pill-save:hover {
          background: #059669;
        }
        .btn-pill-cancel {
          background: #f1f5f9;
          color: #475569;
          border-color: #cbd5e1;
        }
        .btn-pill-cancel:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .row-actions-bottom td {
          background: #f8fafc;
          border-top: 1.5px solid var(--border-strong, #cbd5e1);
          padding: 7px 14px;
        }

        /* Font & Number Utilities */
        .font-num {
          font-family: monospace, sans-serif;
          font-size: 12.5px;
        }
        .col-dim {
          color: #94a3b8;
        }
        .font-bold {
          font-weight: 800;
        }
        .text-red {
          color: #b91c1c;
        }
        .text-amber {
          color: #b45309;
        }
        .text-blue {
          color: #1e40af;
        }
        .text-green {
          color: #15803d;
        }

        .catering-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .catering-color-dot-lg {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Mobile View */
        .mobile-vendor-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 8px 12px;
          background: #f8fafc;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .mobile-vendor-tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--border-strong, #cbd5e1);
          background: #ffffff;
          color: #475569;
          white-space: nowrap;
          cursor: pointer;
        }
        .mobile-vendor-tab-btn.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }
        .mobile-vendor-card {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mobile-vendor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .mobile-vendor-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mobile-vname {
          margin: 0;
          font-size: 14.5px;
          font-weight: 800;
        }
        .mobile-vshift {
          font-size: 11px;
          color: #64748b;
        }
        .mobile-section {
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 6px;
          overflow: hidden;
          background: #ffffff;
        }
        .mobile-section-title {
          background: #f1f5f9;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .mobile-metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 12px;
        }
        .mobile-metric-row:last-child {
          border-bottom: none;
        }
        .m-label {
          color: #475569;
          font-size: 12px;
        }
        .m-val {
          font-size: 12px;
          font-weight: 700;
        }
        .m-val-full {
          width: 100%;
          margin-top: 4px;
        }
        .mobile-metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 8px 12px;
          background: #fafafa;
          border-bottom: 1px solid #f1f5f9;
        }
        .m-submetric {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
        }
        .m-sublabel {
          color: #64748b;
        }
        .m-subval {
          font-weight: 600;
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9999;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          width: 100%;
          max-width: 520px;
          overflow: hidden;
          border: 1px solid var(--border, #e2e8f0);
        }
        .modal-group-card {
          max-width: 460px;
        }
        .modal-sm {
          max-width: 400px;
          padding: 18px;
        }
        .modal-header {
          background: #f8fafc;
          border-bottom: 1px solid var(--border, #e2e8f0);
          padding: 12px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .modal-title {
          font-size: 14px;
          font-weight: 800;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #0f172a;
        }
        .modal-subtitle-minimal {
          font-size: 11.5px;
          color: #64748b;
          margin: 0;
        }
        .btn-close-modal {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .btn-close-modal:hover {
          color: #0f172a;
        }

        /* Group Assignment Table */
        .modal-body-group {
          padding: 12px 18px;
          max-height: 480px;
          overflow-y: auto;
        }
        .group-assignment-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .group-assignment-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          letter-spacing: 0.04em;
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-strong, #cbd5e1);
        }
        .group-assignment-table td {
          padding: 8px 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .c-name-col {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: #0f172a;
        }
        .c-name-text {
          font-size: 12.5px;
        }
        .group-assign-select {
          width: 100%;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 8px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 4px;
          background: #ffffff;
          outline: none;
        }
        .group-assign-select:focus {
          border-color: #3b82f6;
        }

        .modal-form {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #475569;
        }
        .form-input {
          font-size: 13px;
          padding: 7px 10px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 5px;
          font-family: inherit;
        }
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-date-hint {
          font-size: 11px;
          color: #0369a1;
          font-weight: 600;
          margin-top: 2px;
        }
        .form-date-error {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .label-dimmed {
          font-weight: 400;
          color: #64748b;
          text-transform: none;
        }
        .form-hint-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .border-red {
          border-color: #ef4444 !important;
        }
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 18px;
          border-top: 1px solid var(--border, #e2e8f0);
          background: #f8fafc;
        }

        .finalize-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .finalize-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #d1fae5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .modal-sub {
          font-size: 12px;
          color: #475569;
          margin: 2px 0 0 0;
        }
        .finalize-warning {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 10px;
          font-size: 12px;
          color: #92400e;
          line-height: 1.45;
        }
        .warning-heading {
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 4px;
          margin: 0 0 4px 0;
        }

        .rp-empty-state {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
        }
        :global(.icon-empty) {
          color: #cbd5e1;
          margin-bottom: 10px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }
        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .history-table th {
          background: #f8fafc;
          border-bottom: 1.5px solid var(--border-strong, #cbd5e1);
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .history-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .history-table tr:hover td {
          background: #f8fafc;
        }
        .history-table tr.row-current td {
          background: #f0fdf4;
        }
        .badge-active-tag {
          font-size: 10px;
          font-weight: 700;
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
          border-radius: 4px;
          padding: 1px 6px;
          margin-left: 6px;
          display: inline-block;
        }
        .btn-pill-view {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .btn-pill-view:hover {
          background: #dbeafe;
          color: #1e40af;
        }
        .btn-pill-delete {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        .btn-pill-delete:hover {
          background: #fee2e2;
          color: #991b1b;
        }
        .btn-pill-excel {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .btn-pill-excel:hover {
          background: #dcfce7;
          color: #166534;
        }
        .btn-history-trigger {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          font-size: 11.5px;
          font-weight: 700;
          border-radius: 6px;
          background: #f8fafc;
          color: #334155;
          border: 1px solid var(--border-strong, #cbd5e1);
          cursor: pointer;
          transition: all 120ms ease;
          white-space: nowrap;
        }
        .btn-history-trigger:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        .history-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        .history-stat-card {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .hstat-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .icon-total {
          background: rgba(59, 130, 246, 0.1);
          color: #2563eb;
        }
        .icon-final {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }
        .icon-draft {
          background: rgba(245, 158, 11, 0.1);
          color: #d97706;
        }
        .icon-active {
          background: rgba(143, 26, 37, 0.1);
          color: var(--red-dark, #8f1a25);
        }
        .hstat-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .hstat-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .hstat-value {
          font-size: 18px;
          font-weight: 800;
          color: var(--text, #0f172a);
          margin-top: 2px;
          line-height: 1.2;
        }
        .text-ellipsis {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .history-filter-card {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 14px 18px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .history-filter-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }
        .history-search-wrap {
          position: relative;
          flex: 1;
          min-width: 240px;
        }
        .history-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }
        .history-filter-search {
          width: 100%;
          height: 38px;
          padding: 0 34px 0 36px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          color: #0f172a;
          background: #ffffff;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .history-filter-search:focus {
          border-color: var(--red-dark, #8f1a25);
          box-shadow: 0 0 0 2px rgba(143, 26, 37, 0.1);
        }
        .history-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
        }
        .history-search-clear:hover {
          color: #475569;
        }
        .history-filter-select-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .history-filter-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-muted, #64748b);
          white-space: nowrap;
        }
        .history-filter-select {
          height: 38px;
          padding: 0 10px;
          border: 1px solid var(--border-strong, #cbd5e1);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }
        .history-filter-select:focus {
          border-color: var(--red-dark, #8f1a25);
        }
        .history-btn-reset {
          height: 38px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }
        .history-btn-create {
          height: 38px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin-left: auto;
        }
        .history-table-card {
          background: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .history-table-wrapper {
          overflow-x: auto;
        }
        .history-dedicated-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .history-dedicated-table thead th {
          background: #f8fafc;
          padding: 12px 16px;
          text-align: left;
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .history-dedicated-table tbody tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 120ms ease;
        }
        .history-dedicated-table tbody tr:hover {
          background: #f8fafc;
        }
        .history-dedicated-table tbody tr.row-current {
          background: rgba(143, 26, 37, 0.035);
        }
        .history-dedicated-table tbody tr.row-current td:first-child {
          border-left: 3px solid var(--red-dark, #8f1a25);
        }
        .history-dedicated-table tbody td {
          padding: 13px 16px;
          vertical-align: middle;
        }
        .history-cell-name {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .history-period-name {
          font-weight: 700;
          font-size: 13.5px;
          color: #0f172a;
        }
        .history-date-range {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #334155;
          font-weight: 500;
          font-size: 12.5px;
          white-space: nowrap;
        }
        .history-target-month {
          font-weight: 600;
          color: #0f172a;
          font-size: 13px;
          white-space: nowrap;
        }
        .history-cell-notes {
          font-size: 12.5px;
          color: #64748b;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .history-table-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 12px 18px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .history-table-info {
          font-size: 12.5px;
          color: #64748b;
        }
        .history-pagination-btns {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-page-nav {
          height: 32px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 120ms ease;
        }
        .btn-page-nav:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .btn-page-nav:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .history-page-numbers {
          display: flex;
          gap: 4px;
        }
        .btn-page-number {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 120ms ease;
        }
        .btn-page-number:hover:not(.active) {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .btn-page-number.active {
          background: var(--red-dark, #8f1a25);
          color: #ffffff;
          border-color: var(--red-dark, #8f1a25);
        }
        .history-empty-state {
          padding: 48px 24px;
          text-align: center;
          color: #64748b;
        }
        .history-empty-icon {
          color: #cbd5e1;
          margin: 0 auto 12px;
        }
        .history-empty-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px;
        }
        .history-empty-desc {
          font-size: 13px;
          margin: 0 auto 16px;
          max-width: 480px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
