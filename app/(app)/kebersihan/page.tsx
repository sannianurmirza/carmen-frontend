"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Check,
  Building2,
  Lock,
  Save,
  ShieldCheck,
  FileText,
  X,
} from "lucide-react";
import {
  Catering,
  getCatering,
  KondisiKebersihan,
  KebersihanDailyAssessment,
  getKebersihanDailyAssessmentApi,
  upsertKebersihanDailyAssessmentApi,
  getKebersihanDailyListApi,
  exportKebersihanExcelApi,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import IndoDatePicker from "@/components/IndoDatePicker";


// Definitions matching reference
const PHYS_OPTIONS: Record<
  KondisiKebersihan,
  { label: string; points: number; desc: string }
> = {
  bersih: {
    label: "Bersih & Rapi",
    points: 10,
    desc: "Area meja makan, lantai, dan penyajian bersih, rapi, dan higienis.",
  },
  tidak_rapi: {
    label: "Tidak Rapi / Kurang Bersih",
    points: 8,
    desc: "Peralatan atau meja makan kurang tertata, sedikit ceceran atau debu.",
  },
  kotor: {
    label: "Kotor / Bau",
    points: 6,
    desc: "Lantai/meja berminyak, sisa makanan berserakan, atau sanitasi buruk.",
  },
};

const DISCIPLINE_RULES = [
  {
    key: "pelanggaran_rantang_tidak_langsung_masuk_mobil",
    title: "Rantang tidak langsung masuk mobil",
    desc: "Rantang bekas makanan dilarang diletakkan berlama-lama di area kantin dan wajib langsung masuk mobil pengangkut.",
  },
  {
    key: "pelanggaran_buka_pilah_rantang_sisa_di_jai",
    title: "Buka & pilah rantang sisa di area JAI",
    desc: "Petugas katering dilarang keras membuka, memilah, atau membuang sisa makanan di lingkungan PT JAI.",
  },
  {
    key: "pelanggaran_memberi_makan_kucing",
    title: "Memberi makan kucing di area kantin / pabrik",
    desc: "Dilarang memberi makan hewan liar (kucing) untuk menjaga higienitas dan mencegah kontaminasi biologis.",
  },
] as const;

function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function computeLiveScore(
  kondisi: KondisiKebersihan,
  hasViolation: boolean
): number {
  if (hasViolation) return 4.0;
  if (kondisi === "bersih") return 10.0;
  if (kondisi === "tidak_rapi") return 8.0;
  if (kondisi === "kotor") return 6.0;
  return 10.0;
}

export default function KebersihanKantinPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const isAdmin = user?.role === "admin";

  // Tab State: "daily" | "hist"
  const [activeTab, setActiveTab] = useState<"daily" | "hist">("daily");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportKebersihanExcel = async () => {
    setIsExportingExcel(true);
    try {
      const { blob, filename } = await exportKebersihanExcelApi();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Laporan Kebersihan Kantin berhasil diunduh.", "success");
    } catch (err: any) {
      showToast(err?.message || "Gagal mengunduh laporan Kebersihan.", "error");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Dynamic live clock in header

  const [liveNow, setLiveNow] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const timePart = now
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(".", ":");
      setLiveNow(`${datePart} • ${timePart}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter Bar State
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const [dateVal, setDateVal] = useState<string>(() => {
    return searchParams.get("tanggal") || todayIso;
  });
  const [shiftVal, setShiftVal] = useState<"Pagi" | "Malam">(() => {
    const s = searchParams.get("shift");
    return s === "Malam" ? "Malam" : "Pagi";
  });
  const [cateringIdVal, setCateringIdVal] = useState<number | null>(() => {
    const c = searchParams.get("catering_id");
    return c ? parseInt(c, 10) : null;
  });

  // Caterings Master Data
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [loadingCaterings, setLoadingCaterings] = useState<boolean>(true);

  useEffect(() => {
    getCatering({ activeOnly: true })
      .then((cats) => {
        setCaterings(cats);
        if (cats.length > 0 && cateringIdVal === null) {
          setCateringIdVal(cats[0].id);
        }
      })
      .catch((err) => console.error("Gagal memuat katering:", err))
      .finally(() => setLoadingCaterings(false));
  }, []);

  // Current Assessment Form State
  const [existingRecord, setExistingRecord] =
    useState<KebersihanDailyAssessment | null>(null);
  const [loadingRecord, setLoadingRecord] = useState<boolean>(false);

  const [kondisi, setKondisi] = useState<KondisiKebersihan>("bersih");
  const [rantangMobil, setRantangMobil] = useState<boolean>(false);
  const [bukaPilah, setBukaPilah] = useState<boolean>(false);
  const [makanKucing, setMakanKucing] = useState<boolean>(false);
  const [catatan, setCatatan] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Daily Shift List State (for Ringkasan Katering)
  const [dailyShiftRecords, setDailyShiftRecords] = useState<
    KebersihanDailyAssessment[]
  >([]);
  const [loadingShiftList, setLoadingShiftList] = useState<boolean>(false);

  // History Tab State (Rekapitulasi Riwayat Periode)
  const [historyRecords, setHistoryRecords] = useState<
    KebersihanDailyAssessment[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Confirmation Modal for Finalization
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);

  // Load Daily Shift List (for table below form)
  const loadDailyShiftList = useCallback(async () => {
    if (!dateVal || !shiftVal) return;
    setLoadingShiftList(true);
    try {
      const list = await getKebersihanDailyListApi({
        tanggal: dateVal,
        shift: shiftVal,
      });
      setDailyShiftRecords(list);
    } catch (err: any) {
      console.error("Gagal memuat daftar kebersihan shift:", err);
    } finally {
      setLoadingShiftList(false);
    }
  }, [dateVal, shiftVal]);

  useEffect(() => {
    loadDailyShiftList();
  }, [loadDailyShiftList]);

  // Load specific single assessment for (cateringIdVal, dateVal, shiftVal)
  const loadAssessment = useCallback(async () => {
    if (!cateringIdVal || !dateVal || !shiftVal) {
      setExistingRecord(null);
      return;
    }
    setLoadingRecord(true);
    try {
      const rec = await getKebersihanDailyAssessmentApi(
        cateringIdVal,
        dateVal,
        shiftVal
      );
      setExistingRecord(rec);
      if (rec) {
        setKondisi(rec.kondisi_kebersihan || "bersih");
        setRantangMobil(
          Boolean(rec.pelanggaran_rantang_tidak_langsung_masuk_mobil)
        );
        setBukaPilah(Boolean(rec.pelanggaran_buka_pilah_rantang_sisa_di_jai));
        setMakanKucing(Boolean(rec.pelanggaran_memberi_makan_kucing));
        setCatatan(rec.catatan || "");
      } else {
        // Reset to clean blank
        setKondisi("bersih");
        setRantangMobil(false);
        setBukaPilah(false);
        setMakanKucing(false);
        setCatatan("");
      }
    } catch (err: any) {
      console.error("Gagal memuat assessment harian:", err);
      showToast(err?.message || "Gagal memuat penilaian harian.", "error");
    } finally {
      setLoadingRecord(false);
    }
  }, [cateringIdVal, dateVal, shiftVal, showToast]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  // Load History Records (Tab 2)
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const list = await getKebersihanDailyListApi();
      // Filter for finalized records or all persisted records
      const finalized = list.filter((r) => r.status === "final");
      setHistoryRecords(finalized.length > 0 ? finalized : list);
    } catch (err: any) {
      console.error("Gagal memuat riwayat periode:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "hist") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Derived state
  const isFinal = existingRecord?.status === "final";
  const statusKey: "none" | "draft" | "final" = existingRecord
    ? existingRecord.status
    : "none";

  const statusLabel =
    statusKey === "final"
      ? "Final"
      : statusKey === "draft"
      ? "Draft"
      : "Belum Dinilai";

  const selectedCatering = useMemo(
    () => caterings.find((c) => c.id === cateringIdVal) || null,
    [caterings, cateringIdVal]
  );

  const violationCount =
    (rantangMobil ? 1 : 0) + (bukaPilah ? 1 : 0) + (makanKucing ? 1 : 0);
  const hasViolation = violationCount > 0;
  const currentLiveScore = computeLiveScore(kondisi, hasViolation);

  // Map of daily records by catering_id for shift summary table
  const shiftRecordsMap = useMemo(() => {
    const map = new Map<number, KebersihanDailyAssessment>();
    for (const r of dailyShiftRecords) {
      map.set(r.catering_id, r);
    }
    return map;
  }, [dailyShiftRecords]);

  // Save / Finalize Handler
  const handleSave = async (st: "draft" | "final") => {
    if (!cateringIdVal) {
      showToast("Pilih katering terlebih dahulu.", "warning");
      return;
    }
    if (isFinal) {
      showToast("Penilaian yang sudah Final terkunci dan tidak dapat diubah.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await upsertKebersihanDailyAssessmentApi({
        catering_id: cateringIdVal,
        tanggal: dateVal,
        shift: shiftVal,
        kondisi_kebersihan: kondisi,
        pelanggaran_rantang_tidak_langsung_masuk_mobil: rantangMobil,
        pelanggaran_buka_pilah_rantang_sisa_di_jai: bukaPilah,
        pelanggaran_memberi_makan_kucing: makanKucing,
        catatan: catatan.trim() || null,
        status: st,
      });

      showToast(
        st === "final"
          ? "Penilaian harian berhasil difinalisasi."
          : "Penilaian harian berhasil disimpan sebagai draft.",
        "success"
      );

      setShowFinalizeModal(false);
      await Promise.all([loadAssessment(), loadDailyShiftList(), loadHistory()]);
    } catch (err: any) {
      showToast(err?.message || "Gagal menyimpan penilaian.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadAssessment(), loadDailyShiftList()]);
    showToast("Data diperbarui.", "info");
  };

  const handleSelectCateringFromTable = (catId: number) => {
    setCateringIdVal(catId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="kebersihan-module">
      <style>{`
        .kebersihan-module {
          --bg: var(--content-bg, #f7f8fa);
          --surface: var(--card, #fff);
          --ink: var(--text, #111827);
          --ink2: var(--text-secondary, #5b6472);
          --ink3: var(--text-muted, #9aa1ae);
          --line: var(--border, #e5e7eb);
          --hover: var(--border-subtle, #f4f6f9);
          --band: var(--border-subtle, #f3f5f8);
          --brand: var(--red, #b01e2f);
          --brand-ink: #fff;
          --brand-soft: var(--red-bg, #fbe9eb);
          --wait: var(--amber, #b45309);
          --wait-bg: var(--amber-bg, #fef3dc);
          --ok: var(--green, #15803d);
          --ok-bg: var(--green-bg, #e1f5e8);
          --no: #c0262d;
          --no-bg: #fde8e8;
          --blue: #2557d6;
          --blue-bg: #e7eefc;
          --shadow: 0 1px 2px rgba(17,24,39,.05), 0 10px 24px -14px rgba(17,24,39,.14);
          max-width: 1180px;
          margin: 0 auto;
          padding: 10px 8px 64px;
        }

        .kebersihan-module .ph {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .kebersihan-module .eyebrow {
          font-size: 12.5px;
          font-weight: 800;
          letter-spacing: .12em;
          color: var(--brand);
        }
        .kebersihan-module .pt {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          min-width: 0;
        }
        .kebersihan-module .big {
          flex: none;
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: var(--brand-soft);
          color: var(--brand);
          display: grid;
          place-items: center;
        }
        .kebersihan-module h1 {
          margin: 2px 0 4px;
          font-size: clamp(24px, 3.2vw, 32px);
          font-weight: 800;
          letter-spacing: -.01em;
          line-height: 1.15;
          color: var(--ink);
        }
        .kebersihan-module .sub {
          margin: 0;
          color: var(--ink2);
          max-width: 65ch;
          font-size: 14.5px;
        }
        .kebersihan-module .date-badge {
          display: flex;
          align-items: center;
          gap: 9px;
          height: 40px;
          padding: 0 14px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--surface);
          font-weight: 700;
          font-size: 14px;
          white-space: nowrap;
          color: var(--ink);
        }
        .kebersihan-module .date-badge svg {
          width: 17px;
          height: 17px;
          color: var(--brand);
        }

        .kebersihan-module .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 22px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .kebersihan-module .tab {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 14px 16px;
          border: 0;
          background: none;
          color: var(--ink2);
          font-weight: 700;
          font-size: 14px;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .kebersihan-module .tab:hover {
          color: var(--ink);
        }
        .kebersihan-module .tab[aria-selected="true"] {
          color: var(--brand);
          border-color: var(--brand);
        }
        .kebersihan-module .tab svg {
          width: 18px;
          height: 18px;
        }

        .kebersihan-module .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow: var(--shadow);
          margin-bottom: 22px;
          overflow: hidden;
        }
        .kebersihan-module .fl {
          display: grid;
          grid-template-columns: 200px minmax(0, 1fr) 240px auto;
          gap: 18px;
          align-items: end;
          padding: 20px 24px;
        }
        .kebersihan-module .f {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        .kebersihan-module .f > label,
        .kebersihan-module .lab {
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: normal;
          color: var(--ink2);
          text-transform: none !important;
          margin-bottom: 0;
        }
        .kebersihan-module .f input,
        .kebersihan-module .f select,
        .kebersihan-module .f textarea {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          outline: 0;
          transition: border-color .15s, box-shadow .15s;
          font-size: 14.5px;
        }
        .kebersihan-module .f select {
          appearance: none;
          -webkit-appearance: none;
          font-weight: 600;
          padding-right: 40px;
          background: var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa1ae' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center/18px;
        }
        .kebersihan-module .f textarea {
          height: 92px;
          padding: 12px 14px;
          resize: vertical;
        }
        .kebersihan-module .f input:focus,
        .kebersihan-module .f select:focus,
        .kebersihan-module .f textarea:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px var(--brand-soft);
        }
        .kebersihan-module .f textarea:disabled,
        .kebersihan-module .f input:disabled,
        .kebersihan-module .f select:disabled {
          background: var(--bg);
          color: var(--ink2);
          cursor: not-allowed;
        }

        .kebersihan-module .seg {
          display: flex;
          gap: 4px;
          padding: 4px;
          height: 46px;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 10px;
        }
        .kebersihan-module .seg button {
          flex: 1;
          border: 0;
          background: none;
          border-radius: 7px;
          font-weight: 700;
          color: var(--ink2);
          cursor: pointer;
          font-size: 14px;
          transition: background .15s, color .15s, box-shadow .15s;
        }
        .kebersihan-module .seg button[aria-pressed="true"] {
          background: var(--surface);
          color: var(--brand);
          box-shadow: 0 1px 3px rgba(17,24,39,.14);
        }

        .kebersihan-module .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          height: 46px;
          padding: 0 20px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          font-weight: 700;
          font-size: 14px;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color .15s, filter .15s, background .15s;
        }
        .kebersihan-module .btn:hover {
          border-color: var(--ink3);
        }
        .kebersihan-module .btn.primary {
          background: var(--brand);
          border-color: var(--brand);
          color: var(--brand-ink);
        }
        .kebersihan-module .btn.primary:hover {
          filter: brightness(1.1);
        }
        .kebersihan-module .btn.sm {
          height: 36px;
          padding: 0 14px;
          font-size: 13.5px;
        }
        .kebersihan-module .btn:disabled {
          opacity: .45;
          cursor: not-allowed;
          filter: none;
        }

        .kebersihan-module .ch {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          padding: 22px 26px;
          border-bottom: 1px solid var(--line);
        }
        .kebersihan-module .ch h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          text-transform: none !important;
          letter-spacing: normal;
          color: var(--ink);
        }
        .kebersihan-module .ch p {
          margin: 2px 0 0;
          color: var(--ink2);
          font-size: 14px;
          font-weight: 400;
          text-transform: none;
        }
        .kebersihan-module .pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 28px;
          padding: 0 11px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          border: 1px solid currentColor;
          text-transform: none;
        }
        .kebersihan-module .pill::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }
        .kebersihan-module .s-none { background: var(--band); color: var(--ink2); }
        .kebersihan-module .s-draft { background: var(--wait-bg); color: var(--wait); }
        .kebersihan-module .s-final { background: var(--ok-bg); color: var(--ok); }

        .kebersihan-module .sec {
          padding: 22px 26px;
          border-bottom: 1px solid var(--line);
        }
        .kebersihan-module .sh2 {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .kebersihan-module .sh2 h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: var(--ink);
          text-transform: none;
        }
        .kebersihan-module .sh2 span {
          font-size: 13px;
          color: var(--ink2);
          font-weight: 400;
          text-transform: none;
        }
        .kebersihan-module .sh2 .w {
          color: var(--wait);
          display: flex;
          gap: 6px;
          align-items: center;
          font-weight: 600;
          text-transform: none;
        }
        .kebersihan-module .sh2 .w svg {
          width: 15px;
          height: 15px;
        }

        .kebersihan-module .opts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .kebersihan-module label.opt,
        .kebersihan-module label.ck,
        .kebersihan-module .opt,
        .kebersihan-module .ck {
          text-transform: none !important;
          font-weight: 400 !important;
          letter-spacing: normal !important;
          margin-bottom: 0 !important;
        }
        .kebersihan-module .opt {
          position: relative;
          display: block;
          padding: 16px 16px 16px 50px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--surface);
          cursor: pointer;
          transition: border-color .15s, background .15s;
          text-transform: none !important;
          font-weight: 400 !important;
        }
        .kebersihan-module .opt:hover {
          border-color: var(--ink3);
        }
        .kebersihan-module .opt input {
          position: absolute;
          opacity: 0;
        }
        .kebersihan-module .opt i {
          position: absolute;
          left: 16px;
          top: 18px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--ink3);
        }
        .kebersihan-module .opt i::after {
          content: "";
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: var(--brand);
          opacity: 0;
          transition: opacity .15s;
        }
        .kebersihan-module .opt .t {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
          text-transform: none !important;
        }
        .kebersihan-module .opt b {
          font-size: 15px;
          line-height: 1.3;
          color: var(--ink);
          font-weight: 700 !important;
          text-transform: none !important;
          letter-spacing: normal !important;
        }
        .kebersihan-module .opt .p {
          font-size: 13px;
          font-weight: 700 !important;
          color: var(--ink2);
          white-space: nowrap;
          text-transform: none !important;
          letter-spacing: normal !important;
        }
        .kebersihan-module .opt small {
          display: block;
          margin-top: 4px;
          font-size: 13px;
          color: var(--ink2) !important;
          line-height: 1.45;
          text-transform: none !important;
          font-weight: 400 !important;
          letter-spacing: normal !important;
        }
        .kebersihan-module .opt.selected,
        .kebersihan-module .opt:has(input:checked) {
          border-color: var(--brand);
          background: var(--brand-soft);
        }
        .kebersihan-module .opt.selected i,
        .kebersihan-module .opt:has(input:checked) i {
          border-color: var(--brand);
        }
        .kebersihan-module .opt.selected i::after,
        .kebersihan-module .opt:has(input:checked) i::after {
          opacity: 1;
        }
        .kebersihan-module .opt.selected b,
        .kebersihan-module .opt.selected .p,
        .kebersihan-module .opt:has(input:checked) b,
        .kebersihan-module .opt:has(input:checked) .p {
          color: var(--brand);
        }
        .kebersihan-module .opt.dis {
          cursor: default;
          opacity: .75;
        }

        .kebersihan-module .chk {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
        }
        .kebersihan-module .ck {
          position: relative;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 14px 18px;
          cursor: pointer;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
          transition: background .15s;
          text-transform: none !important;
          font-weight: 400 !important;
        }
        .kebersihan-module .ck:last-child {
          border-bottom: 0;
        }
        .kebersihan-module .ck:hover {
          background: var(--hover);
        }
        .kebersihan-module .ck input {
          position: absolute;
          opacity: 0;
        }
        .kebersihan-module .ck i {
          flex: none;
          width: 22px;
          height: 22px;
          margin-top: 1px;
          border-radius: 6px;
          border: 2px solid var(--ink3);
          display: grid;
          place-items: center;
          background: var(--surface);
          transition: background .15s, border-color .15s;
        }
        .kebersihan-module .ck i svg {
          width: 14px;
          height: 14px;
          stroke-width: 3;
          color: #fff;
          opacity: 0;
          transition: opacity .15s;
        }
        .kebersihan-module .ck b {
          display: block;
          font-size: 15px;
          line-height: 1.35;
          color: var(--ink);
          font-weight: 700 !important;
          text-transform: none !important;
          letter-spacing: normal !important;
        }
        .kebersihan-module .ck small {
          display: block;
          margin-top: 2px;
          font-size: 13px;
          color: var(--ink2) !important;
          line-height: 1.45;
          text-transform: none !important;
          font-weight: 400 !important;
          letter-spacing: normal !important;
        }
        .kebersihan-module .ck.checked,
        .kebersihan-module .ck:has(input:checked) {
          background: var(--no-bg);
        }
        .kebersihan-module .ck.checked i,
        .kebersihan-module .ck:has(input:checked) i {
          background: var(--no);
          border-color: var(--no);
        }
        .kebersihan-module .ck.checked i svg,
        .kebersihan-module .ck:has(input:checked) i svg {
          opacity: 1;
        }
        .kebersihan-module .ck.checked b,
        .kebersihan-module .ck:has(input:checked) b {
          color: var(--no);
        }
        .kebersihan-module .ck.dis {
          cursor: default;
        }

        .kebersihan-module .sum {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin: 22px 26px 0;
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid var(--line);
          border-left: 4px solid var(--ok);
          background: var(--ok-bg);
        }
        .kebersihan-module .sum.bad {
          border-left-color: var(--no);
          background: var(--no-bg);
        }
        .kebersihan-module .sum.mid {
          border-left-color: var(--wait);
          background: var(--wait-bg);
        }
        .kebersihan-module .sum .m {
          font-size: 14px;
          color: var(--ink);
          font-weight: 400 !important;
          text-transform: none !important;
        }
        .kebersihan-module .sum .m b {
          font-size: 12px;
          letter-spacing: .08em;
          margin-right: 8px;
          font-weight: 800;
          color: var(--ok);
          text-transform: uppercase;
        }
        .kebersihan-module .sum.bad .m b { color: var(--no); }
        .kebersihan-module .sum.mid .m b { color: var(--wait); }

        .kebersihan-module .sc {
          font-weight: 600;
          font-size: 14px;
          color: var(--ink2);
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .kebersihan-module .sc strong {
          font-size: 34px;
          line-height: 1;
          font-weight: 800;
          color: var(--ok);
        }
        .kebersihan-module .sum.bad .sc strong { color: var(--no); }
        .kebersihan-module .sum.mid .sc strong { color: var(--wait); }

        .kebersihan-module .act {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          padding: 20px 26px 24px;
        }

        .kebersihan-module .th {
          padding: 22px 26px 16px;
        }
        .kebersihan-module .th h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: var(--ink);
        }
        .kebersihan-module .th p {
          margin: 2px 0 0;
          color: var(--ink2);
          font-size: 14px;
        }
        .kebersihan-module .cols,
        .kebersihan-module .row {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) 140px minmax(0, 1.3fr) minmax(0, 1.3fr) 90px 150px;
          gap: 16px;
          align-items: center;
          padding: 0 26px;
        }
        .kebersihan-module .cols {
          height: 44px;
          background: var(--band);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .1em;
          color: var(--ink2);
        }
        .kebersihan-module .row {
          min-height: 62px;
          border-bottom: 1px solid var(--line);
          cursor: pointer;
          background: var(--surface);
          transition: background .15s;
        }
        .kebersihan-module .row:last-child {
          border-bottom: 0;
        }
        .kebersihan-module .row:hover {
          background: var(--hover);
        }
        .kebersihan-module .row.cur {
          background: var(--brand-soft);
        }
        .kebersihan-module .kn {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          text-transform: none !important;
          min-width: 0;
          color: var(--ink);
        }
        .kebersihan-module .kn svg {
          color: var(--ink3);
          width: 18px;
          height: 18px;
        }
        .kebersihan-module .row.cur .kn {
          color: var(--brand);
        }
        .kebersihan-module .row.cur .kn svg {
          color: var(--brand);
        }
        .kebersihan-module .v {
          color: var(--ink);
          font-size: 14px;
          font-weight: 600;
        }
        .kebersihan-module .v.z {
          color: var(--ink3);
          font-weight: 400;
        }
        .kebersihan-module .lbl {
          display: none;
        }
        .kebersihan-module .row .a {
          justify-self: end;
        }
        .kebersihan-module .sk {
          font-weight: 800;
          font-size: 15px;
          font-variant-numeric: tabular-nums;
          color: var(--ink);
        }

        .kebersihan-module .hist .cols,
        .kebersihan-module .hist .row {
          grid-template-columns: minmax(0, 1.2fr) 100px minmax(0, 1.3fr) minmax(0, 1.4fr) minmax(0, 1.3fr) 90px;
          cursor: default;
        }
        .kebersihan-module .empty {
          padding: 56px 20px;
          text-align: center;
          color: var(--ink2);
        }
        .kebersihan-module .empty b {
          display: block;
          color: var(--ink);
          font-size: 17px;
          margin-bottom: 4px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1180px) {
          .kebersihan-module .fl {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kebersihan-module .fl .rf {
            grid-column: 1 / -1;
          }
          /* Allow condition cards to wrap into 2 + 1 layout at 125% zoom */
          .kebersihan-module .opts {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
        }
        @media (max-width: 720px) {
          .kebersihan-module .opts {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 900px) {
          .kebersihan-module .cols {
            display: none;
          }
          .kebersihan-module .row,
          .kebersihan-module .hist .row {
            grid-template-columns: 1fr auto;
            grid-template-areas: "k s" "f f" "d d" "sc a";
            gap: 6px 12px;
            padding: 16px 18px;
            cursor: pointer;
          }
          .kebersihan-module .hist .row {
            grid-template-areas: "k s" "f f" "d d" "dt dt";
          }
          .kebersihan-module .row > .kn { grid-area: k; }
          .kebersihan-module .row > .st { grid-area: s; justify-self: end; }
          .kebersihan-module .row > .vf { grid-area: f; }
          .kebersihan-module .row > .vd { grid-area: d; }
          .kebersihan-module .row > .sk { grid-area: sc; }
          .kebersihan-module .row > .a { grid-area: a; }
          .kebersihan-module .row > .dt { grid-area: dt; }
          .kebersihan-module .lbl {
            display: inline;
            color: var(--ink3);
            font-size: 13px;
            margin-right: 6px;
            font-weight: 500;
          }
        }
        @media (max-width: 620px) {
          .kebersihan-module .fl {
            grid-template-columns: 1fr;
            padding: 16px;
          }
          .kebersihan-module .date-badge {
            display: none;
          }
          .kebersihan-module .sec {
            padding: 18px 16px;
          }
          .kebersihan-module .ch {
            padding: 18px 16px;
          }
          .kebersihan-module .sum {
            margin: 18px 16px 0;
          }
          .kebersihan-module .act {
            padding: 16px;
          }
          .kebersihan-module .act .btn {
            flex: 1;
          }
          .kebersihan-module .th {
            padding: 18px 16px 14px;
          }
          .kebersihan-module .ch h2 {
            font-size: 19px;
          }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="ph">
        <div className="pt">
          <span className="big">
            <Sparkles />
          </span>
          <div>
            <div className="eyebrow">PENILAIAN &amp; AUDIT</div>
            <h1>Kebersihan Kantin &amp; Kedisiplinan</h1>
            <p className="sub">
              Penilaian harian sanitasi kantin dan kepatuhan kedisiplinan katering per shift operasional.
            </p>
          </div>
        </div>
        <div className="date-badge">
          <Calendar />
          <span>{liveNow || "Memuat..."}</span>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs" role="tablist">
        <button
          className="tab"
          role="tab"
          aria-selected={activeTab === "daily"}
          onClick={() => setActiveTab("daily")}
        >
          <Calendar />
          <span>Penilaian Harian (Operasional Shift)</span>
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={activeTab === "hist"}
          onClick={() => setActiveTab("hist")}
        >
          <FileText />
          <span>Rekapitulasi Riwayat Periode</span>
        </button>
      </div>

      {/* TAB 1: PENILAIAN HARIAN (OPERASIONAL SHIFT) */}
      {activeTab === "daily" && (
        <div id="v-daily">
          {/* DAILY FILTER BAR */}
          <section className="card">
            <div className="fl">
              <div className="f">
                <label htmlFor="date">Tanggal Penilaian</label>
                <IndoDatePicker
                  id="date"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                />
              </div>

              <div className="f">
                <label htmlFor="kat">Pilih Katering</label>
                <select
                  id="kat"
                  value={cateringIdVal || ""}
                  onChange={(e) => setCateringIdVal(Number(e.target.value))}
                  disabled={loadingCaterings}
                >
                  {caterings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="f">
                <span className="lab">Shift Operasional</span>
                <div className="seg" id="shift">
                  <button
                    type="button"
                    aria-pressed={shiftVal === "Pagi"}
                    onClick={() => setShiftVal("Pagi")}
                  >
                    Pagi
                  </button>
                  <button
                    type="button"
                    aria-pressed={shiftVal === "Malam"}
                    onClick={() => setShiftVal("Malam")}
                  >
                    Malam
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn rf"
                id="refresh"
                onClick={handleRefresh}
                disabled={loadingRecord || loadingShiftList}
              >
                <RefreshCw className={loadingRecord ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </section>

          {/* MAIN ASSESSMENT CARD */}
          <section className="card" id="form">
            {/* CARD HEADER */}
            <div className="ch">
              <div>
                <h2>{selectedCatering ? selectedCatering.nama : "Katering"}</h2>
                <p>
                  {formatDateIndonesian(dateVal)} • Shift {shiftVal}
                </p>
              </div>
              <span className={`pill s-${statusKey}`}>
                Status: {statusLabel}
              </span>
            </div>

            {/* SECTION 1: KONDISI FISIK SANITASI */}
            <div className="sec">
              <div className="sh2">
                <h3>1. Kondisi Fisik Sanitasi Kantin</h3>
                <span>Pilih salah satu kondisi meja, lantai &amp; penyajian</span>
              </div>
              <div className="opts">
                {(
                  Object.keys(PHYS_OPTIONS) as KondisiKebersihan[]
                ).map((optKey) => {
                  const opt = PHYS_OPTIONS[optKey];
                  const isSelected = kondisi === optKey;
                  return (
                    <label
                      key={optKey}
                      className={`opt ${isSelected ? "selected" : ""} ${
                        isFinal ? "dis" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="phys"
                        value={optKey}
                        checked={isSelected}
                        disabled={isFinal}
                        onChange={() => setKondisi(optKey)}
                      />
                      <i></i>
                      <span className="t">
                        <b>{opt.label}</b>
                        <span className="p">{opt.points} Poin</span>
                      </span>
                      <small>{opt.desc}</small>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: KEPATUHAN KEDISIPLINAN */}
            <div className="sec">
              <div className="sh2">
                <h3>2. Kepatuhan Kedisiplinan Katering (Rev. 04/PK/JAI/IV/2018)</h3>
                <span className="w">
                  <AlertTriangle />
                  Jika ada pelanggaran, skor otomatis diturunkan ke 4.0 poin
                </span>
              </div>
              <div className="chk">
                {DISCIPLINE_RULES.map((rule) => {
                  const isChecked =
                    rule.key ===
                    "pelanggaran_rantang_tidak_langsung_masuk_mobil"
                      ? rantangMobil
                      : rule.key === "pelanggaran_buka_pilah_rantang_sisa_di_jai"
                      ? bukaPilah
                      : makanKucing;

                  const handleChange = (checked: boolean) => {
                    if (isFinal) return;
                    if (
                      rule.key ===
                      "pelanggaran_rantang_tidak_langsung_masuk_mobil"
                    ) {
                      setRantangMobil(checked);
                    } else if (
                      rule.key === "pelanggaran_buka_pilah_rantang_sisa_di_jai"
                    ) {
                      setBukaPilah(checked);
                    } else {
                      setMakanKucing(checked);
                    }
                  };

                  return (
                    <label
                      key={rule.key}
                      className={`ck ${isChecked ? "checked" : ""} ${
                        isFinal ? "dis" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isFinal}
                        onChange={(e) => handleChange(e.target.checked)}
                      />
                      <i>
                        <Check />
                      </i>
                      <span>
                        <b>{rule.title}</b>
                        <small>{rule.desc}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: CATATAN TAMBAHAN (OPSIONAL) */}
            <div className="sec" style={{ borderBottom: 0, paddingBottom: 0 }}>
              <div className="sh2">
                <h3>3. Catatan Tambahan (Opsional)</h3>
              </div>
              <div className="f">
                <textarea
                  id="note"
                  placeholder="Tuliskan catatan singkat jika ada temuan khusus pada shift ini…"
                  disabled={isFinal}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>
            </div>

            {/* SCORE SUMMARY PANEL */}
            <div
              className={`sum ${
                hasViolation ? "bad" : currentLiveScore < 10 ? "mid" : ""
              }`}
            >
              <div className="m">
                <b>
                  {hasViolation ? "ADA PELANGGARAN" : "KONDISI DISIPLIN"}
                </b>
                {hasViolation
                  ? `${violationCount} pelanggaran disiplin, skor diturunkan ke maksimal 4.0.`
                  : `${PHYS_OPTIONS[kondisi].label}, tidak ada pelanggaran disiplin (skor maksimal ${PHYS_OPTIONS[kondisi].points}.0).`}
              </div>
              <div className="sc">
                Skor Kebersihan{" "}
                <strong>{currentLiveScore.toFixed(1)}</strong> / 10
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="act">
              {isFinal ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--ink2)",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  <Lock style={{ width: "16px", height: "16px", color: "var(--ok)" }} />
                  <span>Penilaian telah difinalisasi dan terkunci (read-only).</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    id="draft"
                    disabled={submitting || loadingRecord}
                    onClick={() => handleSave("draft")}
                  >
                    <Save style={{ width: "17px", height: "17px" }} />
                    <span>{submitting ? "Menyimpan..." : "Simpan Draft"}</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      className="btn primary"
                      id="final"
                      disabled={submitting || loadingRecord}
                      onClick={() => setShowFinalizeModal(true)}
                    >
                      <ShieldCheck style={{ width: "17px", height: "17px" }} />
                      <span>Finalisasi</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* DAILY CATERING SUMMARY TABLE */}
          <section className="card" id="sumcard">
            <div className="th">
              <h2>
                Ringkasan Katering ({formatDateIndonesian(dateVal)} • Shift {shiftVal})
              </h2>
              <p>
                Daftar seluruh katering operasional. Klik katering untuk mengisi atau meninjau penilaian di atas.
              </p>
            </div>

            <div className="cols">
              <span>KATERING</span>
              <span>STATUS</span>
              <span>KONDISI FISIK</span>
              <span>KEDISIPLINAN</span>
              <span>SKOR</span>
              <span></span>
            </div>

            {caterings.map((c) => {
              const rec = shiftRecordsMap.get(c.id);
              const rowStatus = rec ? rec.status : "none";
              const isCurrent = c.id === cateringIdVal;
              const hasRec = Boolean(rec);

              const rowPhys = rec ? PHYS_OPTIONS[rec.kondisi_kebersihan]?.label : "–";
              const rowViolCount = rec
                ? (rec.pelanggaran_rantang_tidak_langsung_masuk_mobil ? 1 : 0) +
                  (rec.pelanggaran_buka_pilah_rantang_sisa_di_jai ? 1 : 0) +
                  (rec.pelanggaran_memberi_makan_kucing ? 1 : 0)
                : 0;
              const rowDisc = rec
                ? rowViolCount > 0
                  ? `${rowViolCount} pelanggaran`
                  : "Patuh"
                : "–";
              const rowScore = rec
                ? computeLiveScore(rec.kondisi_kebersihan, rowViolCount > 0).toFixed(1)
                : "–";

              return (
                <div
                  key={c.id}
                  className={`row ${isCurrent ? "cur" : ""}`}
                  tabIndex={0}
                  onClick={() => handleSelectCateringFromTable(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSelectCateringFromTable(c.id);
                  }}
                >
                  <div className="kn">
                    <Building2 />
                    <span>{c.nama}</span>
                  </div>

                  <div className="st">
                    <span className={`pill s-${rowStatus}`}>
                      {rowStatus === "final"
                        ? "Final"
                        : rowStatus === "draft"
                        ? "Draft"
                        : "Belum Dinilai"}
                    </span>
                  </div>

                  <div className={`v vf ${hasRec ? "" : "z"}`}>
                    <span className="lbl">Kondisi fisik</span>
                    <span>{rowPhys}</span>
                  </div>

                  <div className={`v vd ${hasRec ? "" : "z"}`}>
                    <span className="lbl">Kedisiplinan</span>
                    <span>{rowDisc}</span>
                  </div>

                  <div className="sk">
                    {hasRec ? (
                      rowScore
                    ) : (
                      <span className="v z">–</span>
                    )}
                  </div>

                  <div className="a">
                    {isCurrent ? (
                      <button
                        type="button"
                        className="btn primary sm"
                        tabIndex={-1}
                      >
                        Sedang Dinilai
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn sm"
                        tabIndex={-1}
                      >
                        {rowStatus === "none" ? "Pilih Katering" : "Buka"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* TAB 2: REKAPITULASI RIWAYAT PERIODE */}
      {activeTab === "hist" && (
        <div id="v-hist">
          <section className="card hist" id="hist">
            <div className="th" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2>Rekapitulasi Riwayat Periode</h2>
                <p>
                  Penilaian yang sudah difinalisasi. Penilaian yang Anda finalisasi hari ini juga muncul di sini.
                </p>
              </div>
              <ExportExcelButton
                onClick={handleExportKebersihanExcel}
                isLoading={isExportingExcel}
                title="Export Excel"
              />
            </div>


            {loadingHistory ? (
              <div className="empty">
                <b>Memuat riwayat...</b>
                Mohon tunggu sejenak.
              </div>
            ) : historyRecords.length > 0 ? (
              <>
                <div className="cols">
                  <span>KATERING</span>
                  <span>SHIFT</span>
                  <span>TANGGAL</span>
                  <span>KONDISI FISIK</span>
                  <span>KEDISIPLINAN</span>
                  <span>SKOR</span>
                </div>

                {historyRecords.map((r) => {
                  const rViolCount =
                    (r.pelanggaran_rantang_tidak_langsung_masuk_mobil ? 1 : 0) +
                    (r.pelanggaran_buka_pilah_rantang_sisa_di_jai ? 1 : 0) +
                    (r.pelanggaran_memberi_makan_kucing ? 1 : 0);
                  const rScore = computeLiveScore(
                    r.kondisi_kebersihan,
                    rViolCount > 0
                  );

                  return (
                    <div key={r.id} className="row">
                      <div className="kn">
                        <Building2 />
                        <span>{r.catering_nama || `Katering #${r.catering_id}`}</span>
                      </div>

                      <div className="v st">
                        <span className="lbl">Shift</span>
                        <span>{r.shift}</span>
                      </div>

                      <div className="v dt">
                        <span className="lbl">Tanggal</span>
                        <span>{formatDateIndonesian(r.tanggal)}</span>
                      </div>

                      <div className="v vf">
                        <span className="lbl">Kondisi fisik</span>
                        <span>
                          {PHYS_OPTIONS[r.kondisi_kebersihan]?.label ||
                            r.kondisi_kebersihan}
                        </span>
                      </div>

                      <div className="v vd">
                        <span className="lbl">Kedisiplinan</span>
                        <span>
                          {rViolCount > 0
                            ? `${rViolCount} pelanggaran`
                            : "Patuh"}
                        </span>
                      </div>

                      <div className="sk">{rScore.toFixed(1)}</div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="empty">
                <b>Belum ada riwayat</b>
                Finalisasi penilaian untuk melihatnya di sini.
              </div>
            )}
          </section>
        </div>
      )}

      {/* CONFIRMATION MODAL: FINALISASI */}
      {showFinalizeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 12, 16, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "460px",
              width: "90%",
              border: "1px solid var(--line)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "var(--brand-soft)",
                    color: "var(--brand)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <ShieldCheck style={{ width: "20px", height: "20px" }} />
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "var(--ink)",
                  }}
                >
                  Konfirmasi Finalisasi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--ink3)",
                  padding: "4px",
                }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--ink2)",
              }}
            >
              Apakah Anda yakin ingin memfinalisasi penilaian kebersihan untuk{" "}
              <strong style={{ color: "var(--ink)" }}>
                {selectedCatering?.nama}
              </strong>{" "}
              (Shift {shiftVal}) pada{" "}
              <strong style={{ color: "var(--ink)" }}>
                {formatDateIndonesian(dateVal)}
              </strong>
              ?
            </p>

            <div
              style={{
                background: "var(--band)",
                padding: "12px 14px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "13px",
                color: "var(--ink2)",
                lineHeight: 1.45,
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "2px" }}>
                Perhatian:
              </span>
              Setelah difinalisasi, penilaian ini akan terkunci secara permanen (read-only) demi integritas audit dan riwayat operasional.
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setShowFinalizeModal(false)}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => handleSave("final")}
                disabled={submitting}
              >
                {submitting ? "Memproses..." : "Ya, Finalisasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
