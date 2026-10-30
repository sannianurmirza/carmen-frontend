"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Star,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Layers,
  Plus,
  ChevronLeft,
  Utensils,
  ChevronDown,
} from "lucide-react";
import {
  Catering,
  getCatering,
  createKelayakanEntry,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import KelayakanLegendCard, { RATING_DESCRIPTIONS, RatingCategoryType } from "@/components/KelayakanLegendCard";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";
import { formatPercentID } from "@/lib/formatters";

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MENU_CATEGORIES = [
  { id: "nasi", label: "Nasi", icon: "🍚", kelayakanKey: "nasi_kelayakan", rasaKey: "nasi_rasa" },
  { id: "lauk", label: "Lauk", icon: "🍗", kelayakanKey: "lauk_kelayakan", rasaKey: "lauk_rasa" },
  { id: "sayur", label: "Sayur", icon: "🥦", kelayakanKey: "sayur_kelayakan", rasaKey: "sayur_rasa" },
  { id: "sambal", label: "Sambal", icon: "🌶️", kelayakanKey: "sambal_kelayakan", rasaKey: "sambal_rasa" },
  { id: "kerupuk", label: "Kerupuk", icon: "🥨", kelayakanKey: "kerupuk_kelayakan", rasaKey: "kerupuk_rasa" },
  { id: "buah", label: "Buah", icon: "🍎", kelayakanKey: "buah_kelayakan", rasaKey: "buah_rasa" },
] as const;

type RatingState = {
  nasi_kelayakan: number;
  nasi_rasa: number;
  lauk_kelayakan: number;
  lauk_rasa: number;
  sayur_kelayakan: number;
  sayur_rasa: number;
  sambal_kelayakan: number;
  sambal_rasa: number;
  kerupuk_kelayakan: number;
  kerupuk_rasa: number;
  buah_kelayakan: number;
  buah_rasa: number;
  kondisi_rantang: number;
};

const INITIAL_RATINGS: RatingState = {
  nasi_kelayakan: 0,
  nasi_rasa: 0,
  lauk_kelayakan: 0,
  lauk_rasa: 0,
  sayur_kelayakan: 0,
  sayur_rasa: 0,
  sambal_kelayakan: 0,
  sambal_rasa: 0,
  kerupuk_kelayakan: 0,
  kerupuk_rasa: 0,
  buah_kelayakan: 0,
  buah_rasa: 0,
  kondisi_rantang: 0,
};

const KELAYAKAN_CRITERIA: { key: keyof RatingState; label: string }[] = [
  { key: "nasi_kelayakan", label: "Kelayakan Nasi" },
  { key: "nasi_rasa", label: "Rasa Nasi" },
  { key: "lauk_kelayakan", label: "Kelayakan Lauk" },
  { key: "lauk_rasa", label: "Rasa Lauk" },
  { key: "sayur_kelayakan", label: "Kelayakan Sayur" },
  { key: "sayur_rasa", label: "Rasa Sayur" },
  { key: "sambal_kelayakan", label: "Kelayakan Sambal" },
  { key: "sambal_rasa", label: "Rasa Sambal" },
  { key: "kerupuk_kelayakan", label: "Kelayakan Kerupuk" },
  { key: "kerupuk_rasa", label: "Rasa Kerupuk" },
  { key: "buah_kelayakan", label: "Kelayakan Buah" },
  { key: "buah_rasa", label: "Rasa Buah" },
  { key: "kondisi_rantang", label: "Kondisi Rantang" },
];

type DraftEntry = {
  id: string;
  ratings: RatingState;
};

interface CenteredSelectProps {
  value: string | number;
  placeholder: string;
  options: { value: string | number; label: string }[];
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

function CenteredSelect({ value, placeholder, options, onChange, style }: CenteredSelectProps) {
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 38,
        border: "1px solid #cbd5e1",
        borderRadius: "var(--radius-sm, 4px)",
        background: "var(--card, #ffffff)",
        padding: "0 28px",
        fontSize: 13.5,
        fontWeight: 400,
        color: "#64748b",
        textAlign: "center",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <span
        style={{
          width: "100%",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 400,
          color: "#64748b",
          display: "block",
        }}
      >
        {displayLabel}
      </span>
      <ChevronDown size={14} style={{ position: "absolute", right: 14, color: "#64748b", pointerEvents: "none" }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  max = 5,
  readOnly = false,
  type = "kelayakan",
}: {
  value: number;
  onChange?: (val: number) => void;
  max?: number;
  readOnly?: boolean;
  type?: RatingCategoryType;
}) {
  const [hoverVal, setHoverVal] = useState<number | null>(null);

  const getLabel = (star: number) => {
    const desc = RATING_DESCRIPTIONS[type]?.[star];
    if (desc) {
      return `${star} (${desc})`;
    }
    return `Bintang ${star}`;
  };

  const activeVal = hoverVal !== null ? hoverVal : value;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
            const isFilled = star <= activeVal;
            const desc = RATING_DESCRIPTIONS[type]?.[star] || "";
            return (
              <button
                key={star}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!readOnly && onChange) {
                    onChange(star);
                  }
                }}
                onMouseEnter={() => !readOnly && setHoverVal(star)}
                onMouseLeave={() => !readOnly && setHoverVal(null)}
                disabled={readOnly}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 4px",
                  margin: 0,
                  cursor: readOnly ? "default" : "pointer",
                  transition: "transform 0.12s ease",
                  transform: !readOnly && activeVal === star ? "scale(1.15)" : "scale(1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  touchAction: "manipulation",
                }}
                title={`Bintang ${star}: ${desc}`}
                aria-label={`Rating ${star} star - ${desc}`}
              >
                <Star
                  size={20}
                  fill={isFilled ? "#f59e0b" : "transparent"}
                  color={isFilled ? "#f59e0b" : "var(--text-muted)"}
                  strokeWidth={1.75}
                  style={{ pointerEvents: "none" }}
                />
              </button>
            );
          })}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: activeVal > 0 ? (activeVal >= 4 ? "#15803d" : activeVal === 3 ? "#d97706" : "#dc2626") : "var(--text-muted)",
            textAlign: "right",
          }}
        >
          {activeVal > 0 ? getLabel(activeVal) : "Belum diisi"}
        </span>
      </div>
    </div>
  );
}

export default function InputKelayakanPage() {
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [loadingCaterings, setLoadingCaterings] = useState(true);

  const [cateringId, setCateringId] = useState<number | "">("");
  const [tanggal, setTanggal] = useState<string>(todayISO());
  const [shift, setShift] = useState<"Pagi" | "Malam">("Pagi");

  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([
    { id: "draft-1", ratings: { ...INITIAL_RATINGS } },
  ]);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { showToast, showSuccess, showError } = useToast();
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<{ id: string; draftIndex: number } | null>(null);

  useEffect(() => {
    getCatering({ activeOnly: true })
      .then((data) => {
        setCaterings(data);
      })
      .catch(() => setErrorMsg("Gagal memuat daftar katering."))
      .finally(() => setLoadingCaterings(false));
  }, []);

  const updateDraftRating = (draftId: string, field: keyof RatingState, value: number) => {
    setDraftEntries((prev) =>
      prev.map((item) =>
        item.id === draftId
          ? { ...item, ratings: { ...item.ratings, [field]: value } }
          : item
      )
    );
  };

  const handleAddEntryRow = () => {
    const newId = `draft-${Date.now()}`;
    setDraftEntries((prev) => [...prev, { id: newId, ratings: { ...INITIAL_RATINGS } }]);
  };

  const handleRemoveDraftRow = (draftId: string) => {
    const target = draftEntries.find((d) => d.id === draftId);
    const hasFilledRatings = target && Object.values(target.ratings).some((val) => val > 0);
    if (hasFilledRatings && target) {
      const idx = draftEntries.findIndex((d) => d.id === draftId) + 1;
      setDeleteDraftTarget({ id: draftId, draftIndex: idx });
    } else {
      setDraftEntries((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== draftId) : prev));
    }
  };

  const getDraftStats = (ratings: RatingState) => {
    const total = Object.values(ratings).reduce((acc, v) => acc + v, 0);
    const score = total > 0 ? Math.round((total / 65) * 100 * 100) / 100 : 0;
    const isComplete = Object.values(ratings).every((v) => v >= 1 && v <= 5);
    return { total, score, isComplete };
  };

  const isHeaderValid = Boolean(cateringId && tanggal && shift);

  const handleSaveSingleEntry = async (draftId: string) => {
    setErrorMsg(null);
    const missing: string[] = [];
    if (!cateringId) missing.push("Nama Katering");
    if (!tanggal) missing.push("Tanggal");
    if (!shift) missing.push("Shift");

    const target = draftEntries.find((d) => d.id === draftId);
    if (target) {
      const missingCriteria: string[] = [];
      KELAYAKAN_CRITERIA.forEach((crit) => {
        const key = crit.key as keyof RatingState;
        if (!target.ratings[key] || target.ratings[key] < 1) {
          missingCriteria.push(crit.label);
        }
      });
      if (missingCriteria.length > 0) {
        if (missingCriteria.length === 13) {
          missing.push("Seluruh 13 Penilaian Kelayakan Menu");
        } else {
          missing.push(`Penilaian: ${missingCriteria.join(", ")}`);
        }
      }
    }

    if (missing.length > 0) {
      showToast({
        type: "error",
        title: "Field Wajib Belum Diisi",
        fields: missing,
      });
      return;
    }

    setSubmittingId(draftId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await createKelayakanEntry({
        catering_id: Number(cateringId),
        tanggal,
        shift,
        ...target!.ratings,
      });

      setSuccessMsg("Entri kelayakan berhasil disimpan!");
      showSuccess("Entri kelayakan berhasil disimpan!");

      if (draftEntries.length > 1) {
        setDraftEntries((prev) => prev.filter((d) => d.id !== draftId));
      } else {
        setDraftEntries([{ id: "draft-1", ratings: { ...INITIAL_RATINGS } }]);
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Gagal menyimpan entri kelayakan.";
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSaveAllEntries = async () => {
    setErrorMsg(null);
    const missing: string[] = [];
    if (!cateringId) missing.push("Nama Katering");
    if (!tanggal) missing.push("Tanggal");
    if (!shift) missing.push("Shift");

    const validDrafts = draftEntries.filter((d) => getDraftStats(d.ratings).isComplete);
    if (validDrafts.length === 0) {
      missing.push("Kelengkapan 13 Nilai pada Entri Kelayakan");
    }

    if (missing.length > 0) {
      showToast({
        type: "error",
        title: "Field Wajib Belum Diisi",
        fields: missing,
      });
      return;
    }

    setSubmittingAll(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      for (const draft of validDrafts) {
        await createKelayakanEntry({
          catering_id: Number(cateringId),
          tanggal,
          shift,
          ...draft.ratings,
        });
      }

      setSuccessMsg(`${validDrafts.length} entri kelayakan berhasil disimpan!`);
      showSuccess(`${validDrafts.length} entri kelayakan berhasil disimpan!`);
      setDraftEntries([{ id: "draft-1", ratings: { ...INITIAL_RATINGS } }]);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Gagal menyimpan entri kelayakan.";
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setSubmittingAll(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header Row with Breadcrumbs on Left and HeaderMetaBoxes on Right */}
      <div className="page-head-row" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link
              href="/kelayakan"
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
              KELAYAKAN
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              INPUT
            </span>
          </div>
          <h1 className="page-title">Input Penilaian Kelayakan</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="error-box" style={{ marginBottom: 20 }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--green-bg)",
            color: "var(--green)",
            border: "1px solid var(--green)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {/* Panduan Keterangan Kategori Penilaian Bintang */}
      <KelayakanLegendCard defaultExpanded={true} />

      {/* Panel Data Utama Katering & Tanggal */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div
          className="panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Utensils size={16} />
            <span>Data Utama Katering &amp; Tanggal</span>
          </div>

          <button
            type="button"
            onClick={handleAddEntryRow}
            style={{
              background: "none",
              border: "none",
              color: "var(--red)",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Tambah Entri Kelayakan
          </button>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label>NAMA KATERING</label>
              <CenteredSelect
                value={cateringId}
                placeholder="Pilih Katering"
                options={caterings.map((c) => ({ value: c.id, label: c.nama }))}
                onChange={(val) => setCateringId(val ? Number(val) : "")}
              />
            </div>

            <div>
              <label>TANGGAL</label>
              <IndoDatePicker
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>

            <div>
              <label>SHIFT</label>
              <div
                style={{
                  display: "flex",
                  height: 38,
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShift("Pagi")}
                  style={{
                    flex: 1,
                    background: shift === "Pagi" ? "var(--red)" : "var(--card)",
                    color: shift === "Pagi" ? "#ffffff" : "var(--text)",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 13,
                    transition: "all 0.15s ease",
                  }}
                >
                  Pagi
                </button>
                <button
                  type="button"
                  onClick={() => setShift("Malam")}
                  style={{
                    flex: 1,
                    background: shift === "Malam" ? "#1c1b1a" : "var(--card)",
                    color: shift === "Malam" ? "#ffffff" : "var(--text)",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 13,
                    transition: "all 0.15s ease",
                  }}
                >
                  Malam
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render each Draft Entry */}
      {draftEntries.map((draft, entryIdx) => {
        const { total, score, isComplete } = getDraftStats(draft.ratings);
        const isSavingThis = submittingId === draft.id;
        const canSaveThis = isHeaderValid && isComplete;

        return (
          <div
            key={draft.id}
            style={{
              marginBottom: 32,
              border: draftEntries.length > 1 ? "1px solid var(--border-strong)" : "none",
              borderRadius: "var(--radius)",
              padding: draftEntries.length > 1 ? 16 : 0,
              background: draftEntries.length > 1 ? "var(--card)" : "transparent",
            }}
          >
            {draftEntries.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                  ENTRI KELAYAKAN #{entryIdx + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDraftRow(draft.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--red)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Trash2 size={15} />
                  Hapus Draft Entri Ini
                </button>
              </div>
            )}

            {/* 6 Category Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
                marginBottom: 16,
              }}
            >
              {MENU_CATEGORIES.map((cat) => (
                <div key={cat.id} className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-header" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <span>Kategori: {cat.label}</span>
                  </div>

                  <div className="panel-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>KELAYAKAN MENU &amp; PORSI</label>
                      <StarRating
                        type="kelayakan"
                        value={draft.ratings[cat.kelayakanKey]}
                        onChange={(v) => updateDraftRating(draft.id, cat.kelayakanKey, v)}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>KUALITAS RASA</label>
                      <StarRating
                        type="rasa"
                        value={draft.ratings[cat.rasaKey]}
                        onChange={(v) => updateDraftRating(draft.id, cat.rasaKey, v)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 1 Additional Panel: Kondisi Rantang */}
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🍱</span>
                <span>Kondisi Rantang</span>
              </div>

              <div className="panel-body" style={{ padding: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>KONDISI RANTANG &amp; KEBERSIHAN WADAH</label>
                <StarRating
                  type="rantang"
                  value={draft.ratings.kondisi_rantang}
                  onChange={(v) => updateDraftRating(draft.id, "kondisi_rantang", v)}
                />
              </div>
            </div>

            {/* Individual Draft Save Bar if multiple drafts */}
            {draftEntries.length > 1 && (
              <div
                style={{
                  background: "var(--sidebar-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Total: {total}/65
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                    Score: {formatPercentID(score, 2)}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={() => handleSaveSingleEntry(draft.id)}
                  disabled={!canSaveThis || isSavingThis}
                  style={{ height: 36, fontSize: 11.5 }}
                >
                  {isSavingThis ? "Menyimpan..." : "Simpan Entri Ini"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Sticky Bottom Summary Bar */}
      <div
        style={{
          position: "sticky",
          bottom: 20,
          zIndex: 20,
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          padding: "16px 24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {draftEntries.length === 1 ? (
          (() => {
            const { total, score, isComplete } = getDraftStats(draftEntries[0].ratings);
            const canSaveSingle = isHeaderValid && isComplete;

            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Total Nilai
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
                      {total} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>/ 65</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Score Presentase
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--red)" }}>
                      {formatPercentID(score, 2)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Status Form
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: canSaveSingle ? "var(--green)" : "var(--amber)" }}>
                      {!isHeaderValid
                        ? "Pilih Katering"
                        : isComplete
                        ? "✓ Siap Disimpan"
                        : "Belum Lengkap (13 Nilai)"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={() => handleSaveSingleEntry(draftEntries[0].id)}
                  disabled={!canSaveSingle || submittingId === draftEntries[0].id}
                  style={{ height: 42, padding: "0 28px", fontSize: 13 }}
                >
                  {submittingId ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Entri Ini"
                  )}
                </button>
              </>
            );
          })()
        ) : (
          <>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {draftEntries.length} Draft Entri Kelayakan
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {!isHeaderValid
                  ? "Pilih Katering terlebih dahulu"
                  : "Siap disimpan per entri"}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-solid"
              onClick={handleSaveAllEntries}
              disabled={!isHeaderValid || submittingAll || !draftEntries.some((d) => getDraftStats(d.ratings).isComplete)}
              style={{ height: 42, padding: "0 28px", fontSize: 13 }}
            >
              {submittingAll ? "Menyimpan Semua..." : "Simpan Semua Entri"}
            </button>
          </>
        )}
      </div>

      {/* Confirm Delete Draft Entry Modal */}
      <ConfirmDeleteModal
        isOpen={deleteDraftTarget !== null}
        title="Hapus Draft Penilaian?"
        itemName={deleteDraftTarget ? `Draft Entri #${deleteDraftTarget.draftIndex}` : undefined}
        description="Apakah Anda yakin ingin menghapus draft entri penilaian ini? Pilihan nilai kriteria yang sudah Anda isi pada draft ini akan dihapus dari form."
        confirmText="Hapus Draft"
        cancelText="Batal"
        onConfirm={() => {
          if (deleteDraftTarget) {
            setDraftEntries((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== deleteDraftTarget.id) : prev));
            setDeleteDraftTarget(null);
          }
        }}
        onClose={() => setDeleteDraftTarget(null)}
      />
    </div>
  );
}
