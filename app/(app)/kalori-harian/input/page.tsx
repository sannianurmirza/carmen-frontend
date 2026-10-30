"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Utensils,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Layers,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  Sparkles,
  Info,
  Lock,
} from "lucide-react";
import {
  Catering,
  BahanStandar,
  StandarBerat,
  CateringDailyOrder,
  getCatering,
  getBahanStandar,
  getStandarBerat,
  getJenisMasakan,
  createKaloriHarian,
  getCateringDailyOrderApi,
  upsertCateringDailyOrderApi,
  getActiveMenuForKaloriApi,
  ActiveMenuQueryResponse,
  getOperationalLockStatusApi,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";
import { formatNumberID, parseNumberID, isValidDecimalInput } from "@/lib/formatters";

const KATEGORI_LIST = ["Nasi", "Sayur", "Lauk", "Buah", "Lain-lain"] as const;

const ITEM_ROLES = [
  "NASI/MIE",
  "LONTONG",
  "SAYUR",
  "LAUK UTAMA",
  "LAUK PENDAMPING 1",
  "LAUK PENDAMPING 2",
  "LAUK PENDAMPING 1 & 2",
  "BUAH",
  "KERUPUK/PANGSIT GORENG",
  "SAMBAL",
  "SAOS/KECAP MIE AYAM",
  "BUMBU GADO-GADO",
  "BUMBU URAP-URAP",
  "BUMBU LAIN-LAIN",
  "PUDING",
];

const BUMBU_ITEM_ROLE = "BUMBU LAIN-LAIN";

export type IngredientDropdownOption =
  | {
      type: "ingredient";
      id: number | string;
      key: string;
      nama: string;
      label: string;
      standardKalori: number | null;
    }
  | {
      type: "preset";
      id: string;
      key: string;
      nama: string;
      label: string;
      standardKalori: null;
    };

interface IngredientRow {
  id: string;
  kategori: string;
  item_role: string;
  nama_bahan: string;
  standar_kalori: string | number;
  standar_berat: number | null;
  berat_aktual: string | number;
  notFoundInMaster?: boolean;
  b_val?: number;
  energi_val?: number;
  preset_name?: string | null;
  preset_max_b?: number | null;
}

export interface CalculatedIngredientRow extends IngredientRow {
  b_val: number;
  energi_val: number;
}

export interface RoleGroupCalculationResult {
  itemRole: string;
  roleStandardBerat: number | null;
  totalBeratAktual: number;
  totalB: number;
  totalEnergi: number;
  items: CalculatedIngredientRow[];
}

export interface CategoryCalculationResult {
  category: string;
  totalBeratAktual: number;
  totalB: number;
  totalEnergi: number;
  roleGroups: RoleGroupCalculationResult[];
  items: CalculatedIngredientRow[];
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDaysISO(baseISO: string, days: number): string {
  if (!baseISO) return todayISO();
  const parts = baseISO.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return todayISO();
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDec(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "-";
  const num = typeof val === "number" ? val : parseNumberID(String(val));
  if (num === null || isNaN(num)) return "-";
  return formatNumberID(num, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

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

function calculateCategory(
  category: string,
  catIngredients: IngredientRow[],
  jenisMasakan: string,
  standarBeratList: StandarBerat[]
): CategoryCalculationResult {
  if (catIngredients.length === 0) {
    return {
      category,
      totalBeratAktual: 0,
      totalB: 0,
      totalEnergi: 0,
      roleGroups: [],
      items: [],
    };
  }

  // 1. Group ingredients within category by Item Role (Section 10)
  const roleGroupMap = new Map<string, IngredientRow[]>();

  for (const row of catIngredients) {
    let role = row.item_role ? row.item_role.trim() : "";
    if (!role) {
      if (category === "Sayur") role = "SAYUR";
      else if (category === "Nasi") role = "NASI/MIE";
      else if (category === "Buah") role = "BUAH";
      else role = "LAUK UTAMA";
    }

    if (!roleGroupMap.has(role)) {
      roleGroupMap.set(role, []);
    }
    roleGroupMap.get(role)!.push(row);
  }

  const roleGroups: RoleGroupCalculationResult[] = [];
  let categoryTotalB = 0;
  let categoryTotalEnergi = 0;
  let categoryTotalBeratAktual = 0;
  const flatItems: CalculatedIngredientRow[] = [];

  // 2. Process each Item Role group independently (Section 10 & 11)
  for (const [role, roleIngredients] of roleGroupMap.entries()) {
    let roleStandardBerat: number | null = null;

    // Check if any row in this role group has standar_berat
    for (const row of roleIngredients) {
      if (row.standar_berat !== null && row.standar_berat !== undefined) {
        roleStandardBerat = row.standar_berat;
        break;
      }
    }

    if (roleStandardBerat === null && jenisMasakan && role) {
      const match = standarBeratList.find(
        (sb) =>
          sb.jenis_masakan.toLowerCase() === jenisMasakan.toLowerCase() &&
          sb.item_role.toLowerCase() === role.toLowerCase()
      );
      if (match) {
        roleStandardBerat = match.berat_gram;
      }
    }

    // Compute total Berat Aktual for this role group
    let groupBeratAktual = 0;
    for (const row of roleIngredients) {
      const act = Math.max(0, parseNumberID(row.berat_aktual) ?? 0);
      groupBeratAktual += act;
    }

    const calculatedRoleItems: CalculatedIngredientRow[] = roleIngredients.map((row) => ({
      ...row,
      item_role: role,
      b_val: 0,
      energi_val: 0,
    }));

    // 3. Priority Capping algorithm within this role group (Section 3 & 10)
    if (roleStandardBerat === null || groupBeratAktual <= roleStandardBerat) {
      // Condition A or missing Standard Berat: B = Berat Aktual for all in group (or capped by preset_max_b)
      for (const item of calculatedRoleItems) {
        const act = Math.max(0, parseNumberID(item.berat_aktual) ?? 0);
        if (item.preset_max_b !== undefined && item.preset_max_b !== null) {
          item.b_val = Math.min(act, item.preset_max_b);
        } else {
          item.b_val = act;
        }
      }
    } else {
      // Condition B: Capping required within this role group
      const indexed = calculatedRoleItems.map((item, idx) => ({
        item,
        originalIndex: idx,
        stdKalori: parseNumberID(item.standar_kalori) ?? 0,
        actBerat: Math.max(0, parseNumberID(item.berat_aktual) ?? 0),
      }));

      // Sort by Standard Kalori (A) descending; tie-breaker: originalIndex ascending
      indexed.sort((a, b) => {
        if (b.stdKalori !== a.stdKalori) {
          return b.stdKalori - a.stdKalori;
        }
        return a.originalIndex - b.originalIndex;
      });

      let capacityRemaining = roleStandardBerat;

      for (const entry of indexed) {
        if (entry.item.preset_max_b !== undefined && entry.item.preset_max_b !== null) {
          entry.item.b_val = Math.min(entry.actBerat, entry.item.preset_max_b);
        } else if (capacityRemaining >= entry.actBerat) {
          entry.item.b_val = entry.actBerat;
          capacityRemaining -= entry.actBerat;
        } else if (capacityRemaining > 0) {
          entry.item.b_val = capacityRemaining;
          capacityRemaining = 0;
        } else {
          entry.item.b_val = 0;
        }
      }
    }

    // 4. Compute Energy for each ingredient in group: (Standard Kalori / 100) * B
    let groupTotalB = 0;
    let groupTotalEnergi = 0;

    for (const item of calculatedRoleItems) {
      const stdKalori = parseNumberID(item.standar_kalori) ?? 0;
      item.energi_val = (stdKalori / 100) * item.b_val;
      groupTotalB += item.b_val;
      groupTotalEnergi += item.energi_val;
    }

    roleGroups.push({
      itemRole: role,
      roleStandardBerat,
      totalBeratAktual: groupBeratAktual,
      totalB: groupTotalB,
      totalEnergi: groupTotalEnergi,
      items: calculatedRoleItems,
    });

    categoryTotalB += groupTotalB;
    categoryTotalEnergi += groupTotalEnergi;
    categoryTotalBeratAktual += groupBeratAktual;
    flatItems.push(...calculatedRoleItems);
  }

  return {
    category,
    totalBeratAktual: categoryTotalBeratAktual,
    totalB: categoryTotalB,
    totalEnergi: categoryTotalEnergi,
    roleGroups,
    items: flatItems,
  };
}

export default function InputKaloriHarianPage() {
  // Master data state
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [bahanStandarList, setBahanStandarList] = useState<BahanStandar[]>([]);
  const [standarBeratList, setStandarBeratList] = useState<StandarBerat[]>([]);
  const [jenisMasakanList, setJenisMasakanList] = useState<string[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Constructed options for dropdown composition
  const regularIngredientOptions: IngredientDropdownOption[] = useMemo(() => {
    return bahanStandarList.map((b) => ({
      type: "ingredient" as const,
      id: b.id,
      key: `ingredient-${b.id}`,
      nama: b.nama,
      label: b.nama,
      standardKalori: b.standar_kalori,
    }));
  }, [bahanStandarList]);

  const bumbuOption: IngredientDropdownOption = useMemo(
    () => ({
      type: "preset" as const,
      id: "preset-bumbu",
      key: "preset-bumbu",
      nama: "Bumbu",
      label: "Bumbu",
      standardKalori: null,
    }),
    []
  );

  const getOptionsForCategory = (categoryName: string): IngredientDropdownOption[] => {
    const norm = categoryName.trim().toLowerCase();
    if (norm === "lain-lain") {
      return [bumbuOption, ...regularIngredientOptions];
    }
    return regularIngredientOptions;
  };

  // Daily Order State (Prerequisite for Kalori Input)
  const [dailyOrder, setDailyOrder] = useState<CateringDailyOrder | null>(null);
  const [loadingDailyOrder, setLoadingDailyOrder] = useState(false);
  const [inputJumlahOrder, setInputJumlahOrder] = useState<string>("");
  const [savingDailyOrder, setSavingDailyOrder] = useState(false);

  // Active Menu Plan State (CARMEN Phase 3: Source of Truth Menu)
  const [activeMenuInfo, setActiveMenuInfo] = useState<ActiveMenuQueryResponse | null>(null);
  const [loadingActiveMenu, setLoadingActiveMenu] = useState(false);

  // Operational Lock State (CARMEN Phase 3: Auto-lock when Monthly Report is FINAL)
  const [isPeriodLocked, setIsPeriodLocked] = useState<boolean>(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [loadingLockStatus, setLoadingLockStatus] = useState<boolean>(false);

  // Form State
  const [selectedCateringId, setSelectedCateringId] = useState<number | "">("");
  const [tanggal, setTanggal] = useState<string>(todayISO());
  const [shift, setShift] = useState<"Pagi" | "Malam">("Pagi");
  const [jenisMasakan, setJenisMasakan] = useState<string>("");
  const [namaMasakanNasi, setNamaMasakanNasi] = useState("");
  const [namaMasakanSayur, setNamaMasakanSayur] = useState("");

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);

  const [deleteIngredientTarget, setDeleteIngredientTarget] = useState<IngredientRow | null>(null);

  // Submission State
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { showToast, showSuccess, showError, showWarning } = useToast();
  const [saveSuccessResult, setSaveSuccessResult] = useState<{
    total_kalori: number;
    mencapai: boolean;
  } | null>(null);

  // Load Master Data on Mount
  useEffect(() => {
    async function loadMaster() {
      try {
        setLoadingMaster(true);
        const [cats, bs, sb, jm] = await Promise.all([
          getCatering({ activeOnly: true }),
          getBahanStandar(),
          getStandarBerat(),
          getJenisMasakan(),
        ]);
        setCaterings(cats);
        setBahanStandarList(bs);
        setStandarBeratList(sb);
        setJenisMasakanList(jm);
      } catch (err: any) {
        console.error("Gagal memuat master data:", err);
      } finally {
        setLoadingMaster(false);
      }
    }
    loadMaster();
  }, []);

  // Fetch Daily Order whenever selectedCateringId, tanggal, or shift changes
  useEffect(() => {
    let isCurrent = true;
    async function fetchDailyOrder() {
      if (!selectedCateringId || !tanggal || !shift) {
        setDailyOrder(null);
        setInputJumlahOrder("");
        return;
      }
      setLoadingDailyOrder(true);
      try {
        const order = await getCateringDailyOrderApi(Number(selectedCateringId), tanggal, shift);
        if (isCurrent) {
          setDailyOrder(order);
          setInputJumlahOrder(order ? String(order.jumlah_order) : "");
        }
      } catch (err) {
        console.error("Gagal memeriksa daily order:", err);
        if (isCurrent) {
          setDailyOrder(null);
          setInputJumlahOrder("");
        }
      } finally {
        if (isCurrent) {
          setLoadingDailyOrder(false);
        }
      }
    }
    fetchDailyOrder();
    return () => {
      isCurrent = false;
    };
  }, [selectedCateringId, tanggal, shift]);

  // Fetch Active Menu Plan whenever selectedCateringId, tanggal, or shift changes (CARMEN Phase 3)
  useEffect(() => {
    let isCurrent = true;
    async function fetchActiveMenu() {
      if (!selectedCateringId || !tanggal || !shift) {
        setActiveMenuInfo(null);
        return;
      }
      setLoadingActiveMenu(true);
      try {
        const menuRes = await getActiveMenuForKaloriApi(
          Number(selectedCateringId),
          tanggal,
          shift
        );
        if (isCurrent) {
          setActiveMenuInfo(menuRes);
        }
      } catch (err) {
        console.warn("Gagal memuat menu resmi aktif:", err);
        if (isCurrent) {
          setActiveMenuInfo(null);
        }
      } finally {
        if (isCurrent) {
          setLoadingActiveMenu(false);
        }
      }
    }
    fetchActiveMenu();
    return () => {
      isCurrent = false;
    };
  }, [selectedCateringId, tanggal, shift]);

  // Check Operational Lock Status whenever selectedCateringId or tanggal changes (CARMEN Phase 3)
  useEffect(() => {
    let isCurrent = true;
    async function checkLockStatus() {
      if (!selectedCateringId || !tanggal) {
        setIsPeriodLocked(false);
        setLockReason(null);
        return;
      }
      setLoadingLockStatus(true);
      try {
        const lockRes = await getOperationalLockStatusApi(Number(selectedCateringId), tanggal);
        if (isCurrent) {
          setIsPeriodLocked(lockRes.is_locked);
          setLockReason(lockRes.lock_reason || null);
        }
      } catch (err) {
        console.warn("Gagal memeriksa status penguncian operasional:", err);
      } finally {
        if (isCurrent) {
          setLoadingLockStatus(false);
        }
      }
    }
    checkLockStatus();
    return () => {
      isCurrent = false;
    };
  }, [selectedCateringId, tanggal]);

  // Handle Save / Update Daily Order
  const handleSaveDailyOrder = async () => {
    if (isPeriodLocked) {
      showError(lockReason || "Penyimpanan jumlah order ditolak karena periode laporan telah FINAL.");
      return;
    }
    if (!selectedCateringId) {
      showError("Pilih katering terlebih dahulu.");
      return;
    }
    if (!tanggal) {
      showError("Pilih tanggal terlebih dahulu.");
      return;
    }
    const parsedJumlah = parseInt(inputJumlahOrder, 10);
    if (isNaN(parsedJumlah) || parsedJumlah < 0) {
      showError("Jumlah order harus berupa angka bulat positif (>= 0).");
      return;
    }

    setSavingDailyOrder(true);
    try {
      const res = await upsertCateringDailyOrderApi({
        catering_id: Number(selectedCateringId),
        tanggal,
        shift,
        jumlah_order: parsedJumlah,
      });
      setDailyOrder(res);
      setInputJumlahOrder(String(res.jumlah_order));
      showSuccess(`Jumlah order ${res.shift} berhasil disimpan: ${res.jumlah_order} porsi.`);
    } catch (err: any) {
      showError(err.message || "Gagal menyimpan jumlah order.");
    } finally {
      setSavingDailyOrder(false);
    }
  };

  // Update standar_berat in ingredient rows when jenisMasakan changes
  useEffect(() => {
    setIngredients((prev) =>
      prev.map((row) => {
        const roleToUse =
          row.item_role || (row.kategori === "Sayur" ? "SAYUR" : row.kategori === "Buah" ? "BUAH" : "");
        if (!roleToUse || !jenisMasakan) return { ...row, item_role: roleToUse, standar_berat: null };
        const match = standarBeratList.find(
          (sb) =>
            sb.jenis_masakan.toLowerCase() === jenisMasakan.toLowerCase() &&
            sb.item_role.toLowerCase() === roleToUse.toLowerCase()
        );
        return {
          ...row,
          item_role: roleToUse,
          standar_berat: match ? match.berat_gram : null,
        };
      })
    );
  }, [jenisMasakan, standarBeratList]);

  // Handle adding new ingredient row to a category
  const handleAddIngredient = (kategori: string) => {
    let initialRole = "";
    if (kategori === "Sayur") initialRole = "SAYUR";
    if (kategori === "Buah") initialRole = "BUAH";

    let initialStdBerat: number | null = null;
    if (jenisMasakan && initialRole) {
      const match = standarBeratList.find(
        (sb) =>
          sb.jenis_masakan.toLowerCase() === jenisMasakan.toLowerCase() &&
          sb.item_role.toLowerCase() === initialRole.toLowerCase()
      );
      if (match) initialStdBerat = match.berat_gram;
    }

    const newRow: IngredientRow = {
      id: Math.random().toString(36).substring(2, 9),
      kategori,
      item_role: initialRole,
      nama_bahan: "",
      standar_kalori: "",
      standar_berat: initialStdBerat,
      berat_aktual: "",
      notFoundInMaster: false,
    };

    setIngredients((prev) => [...prev, newRow]);
  };

  // Handle adding Bumbu preset group (4 ingredients)
  const handleAddPresetBumbu = () => {
    if (ingredients.some((r) => r.preset_name === "bumbu")) {
      showWarning("Preset Bumbu sudah ditambahkan.");
      return;
    }

    const bumbuItems = [
      { nama: "Bawang Putih", stdKalori: 95, defaultBerat: 2, maxB: 2 },
      { nama: "Bawang Merah", stdKalori: 39, defaultBerat: 5, maxB: 5 },
      { nama: "Minyak Goreng", stdKalori: 902, defaultBerat: 10, maxB: 10 },
      { nama: "Gula Pasir", stdKalori: 364, defaultBerat: 5, maxB: 5 },
    ];

    const newRows: IngredientRow[] = bumbuItems.map((item) => ({
      id: Math.random().toString(36).substring(2, 9),
      kategori: "Lain-lain",
      item_role: BUMBU_ITEM_ROLE,
      nama_bahan: item.nama,
      standar_kalori: String(item.stdKalori),
      standar_berat: 22,
      berat_aktual: String(item.defaultBerat),
      preset_name: "bumbu",
      preset_max_b: item.maxB,
      notFoundInMaster: false,
    }));

    setIngredients((prev) => [...prev, ...newRows]);
  };

  // Handle removing an entire preset group
  const handleRemovePresetGroup = (presetName: string) => {
    setIngredients((prev) => prev.filter((r) => r.preset_name !== presetName));
  };

  // Handle updating ingredient row field
  const handleUpdateIngredient = (
    id: string,
    field: keyof IngredientRow,
    value: string | number
  ) => {
    const rawInput = String(value);
    const normalizedInput = rawInput.replace(/\s+/g, " ").trim().toLowerCase();

    if (field === "nama_bahan") {
      const targetRow = ingredients.find((r) => r.id === id);
      const isLainLain = targetRow ? targetRow.kategori === "Lain-lain" : false;

      // Check if user selected "Bumbu" preset in category Lain-lain
      if (isLainLain && normalizedInput === "bumbu") {
        if (ingredients.some((r) => r.preset_name === "bumbu")) {
          showWarning("Preset Bumbu sudah ditambahkan.");
          setIngredients((prev) => prev.filter((r) => r.id !== id));
          return;
        }

        setIngredients((prev) => prev.filter((r) => r.id !== id));
        handleAddPresetBumbu();
        return;
      }
    }

    setIngredients((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const updated = { ...row, [field]: value };

        // When nama_bahan is updated, lookup standard kalori automatically from master
        if (field === "nama_bahan") {
          const match = bahanStandarList.find(
            (b) => b.nama.replace(/\s+/g, " ").trim().toLowerCase() === normalizedInput
          );

          if (match) {
            updated.nama_bahan = match.nama;
            updated.standar_kalori = String(match.standar_kalori);
            updated.notFoundInMaster = false;
          } else {
            updated.standar_kalori = "";
            updated.notFoundInMaster = rawInput.trim().length > 0;
          }
        }

        // When item_role is updated, lookup standard berat
        if (field === "item_role") {
          const roleStr = String(value);
          if (jenisMasakan && roleStr) {
            const matchSb = standarBeratList.find(
              (sb) =>
                sb.jenis_masakan.toLowerCase() === jenisMasakan.toLowerCase() &&
                sb.item_role.toLowerCase() === roleStr.toLowerCase()
            );
            updated.standar_berat = matchSb ? matchSb.berat_gram : null;
          } else {
            updated.standar_berat = null;
          }
        }

        return updated;
      })
    );
  };

  // Handle removing ingredient row
  const handleRemoveIngredient = (id: string) => {
    const targetRow = ingredients.find((r) => r.id === id);
    const hasContent = Boolean(
      targetRow && (
        (typeof targetRow.nama_bahan === "string" && targetRow.nama_bahan.trim() !== "") ||
        (targetRow.berat_aktual !== "" && targetRow.berat_aktual !== 0 && targetRow.berat_aktual !== "0") ||
        (targetRow.standar_kalori !== "" && targetRow.standar_kalori !== 0 && targetRow.standar_kalori !== "0")
      )
    );
    if (hasContent && targetRow) {
      setDeleteIngredientTarget(targetRow);
    } else {
      setIngredients((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // Compute calculation results for all 5 categories
  const allCategoryResults = useMemo(() => {
    return KATEGORI_LIST.map((kat) => {
      const catIngredients = ingredients.filter((item) => item.kategori === kat);
      return calculateCategory(kat, catIngredients, jenisMasakan, standarBeratList);
    });
  }, [ingredients, jenisMasakan, standarBeratList]);

  // Total Daily Energy = sum of Total Energi across all categories & Item Role groups
  const totalKaloriHariIni = useMemo(() => {
    return allCategoryResults.reduce((sum, catRes) => sum + catRes.totalEnergi, 0);
  }, [allCategoryResults]);

  const statusMencapaiHariIni = totalKaloriHariIni >= 900;

  // Submit Form
  const handleSave = async () => {
    if (isPeriodLocked) {
      showError(lockReason || "Penyimpanan kalori harian ditolak karena periode laporan telah FINAL.");
      return;
    }
    setErrorMsg(null);
    const missing: string[] = [];
    if (!selectedCateringId) missing.push("Nama Katering");
    if (!tanggal) missing.push("Tanggal Pengiriman");
    if (!jenisMasakan) missing.push("Jenis Masakan");
    if (ingredients.length === 0) missing.push("Daftar Bahan Makanan (Minimal 1 Bahan)");

    for (let i = 0; i < ingredients.length; i++) {
      const row = ingredients[i];
      const rawName = row.nama_bahan.trim();
      if (!rawName) {
        missing.push(`Nama Bahan (Baris #${i + 1})`);
        continue;
      }

      // Validasi master data: nama bahan harus terdaftar di master Standar Kalori (BahanStandar)
      const normName = rawName.replace(/\s+/g, " ").toLowerCase();
      const match = bahanStandarList.find(
        (b) => b.nama.replace(/\s+/g, " ").trim().toLowerCase() === normName
      );
      if (!match) {
        missing.push(`Bahan "${rawName}" tidak ditemukan di master Standar Kalori (Baris #${i + 1})`);
      } else if (!row.standar_kalori || Number(row.standar_kalori) <= 0) {
        missing.push(`Standar kalori untuk "${rawName}" belum tersedia (Baris #${i + 1})`);
      }
    }

    if (missing.length > 0) {
      showToast({
        type: "error",
        title: "Validasi Gagal",
        fields: missing,
      });
      return;
    }

    try {
      setSaving(true);

      const payloadBahan = ingredients.map((r) => {
        const catRes = allCategoryResults.find((c) => c.category === r.kategori);
        const calcRow = catRes?.items.find((item) => item.id === r.id);
        const parsedAct = Math.max(0, parseNumberID(r.berat_aktual) ?? 0);
        const bVal = calcRow ? calcRow.b_val : parsedAct;

        const normName = r.nama_bahan.replace(/\s+/g, " ").trim().toLowerCase();
        const match = bahanStandarList.find(
          (b) => b.nama.replace(/\s+/g, " ").trim().toLowerCase() === normName
        );

        return {
          kategori: r.kategori,
          item_role: r.item_role || null,
          nama_bahan: match ? match.nama : r.nama_bahan.trim(),
          standar_kalori: match ? match.standar_kalori : (parseNumberID(r.standar_kalori) ?? 0),
          standar_berat: bVal,
          berat_aktual: parsedAct,
          preset_name: r.preset_name || null,
        };
      });

      const payload = {
        catering_id: Number(selectedCateringId),
        tanggal,
        shift,
        jenis_masakan: jenisMasakan || null,
        nama_masakan_nasi: namaMasakanNasi.trim() || null,
        nama_masakan_sayur: namaMasakanSayur.trim() || null,
        menu_plan_id: activeMenuInfo?.has_menu ? activeMenuInfo.menu_plan_id || null : null,
        menu_plan_version: activeMenuInfo?.has_menu ? activeMenuInfo.menu_plan_version || null : null,
        menu_components: activeMenuInfo?.has_menu && activeMenuInfo.components?.length > 0
          ? activeMenuInfo.components.join(" | ")
          : null,
        bahan: payloadBahan,
      };

      const res = await createKaloriHarian(payload);
      setSaveSuccessResult({
        total_kalori: res.total_kalori,
        mencapai: res.mencapai,
      });
      showSuccess(`Kalori harian berhasil disimpan! Total: ${res.total_kalori} kkal.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan kalori harian.");
      showError(err.message || "Gagal menyimpan kalori harian.");
    } finally {
      setSaving(false);
    }
  };

  // Action: Next day
  const handleNextDay = () => {
    setSaveSuccessResult(null);
    setErrorMsg(null);
    setIngredients([]);
    setTanggal((prev) => offsetDaysISO(prev, 1));
    setNamaMasakanNasi("");
    setNamaMasakanSayur("");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Link
              href="/kalori-harian"
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
              KALORI
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              INPUT
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Input Kalori</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Datalist for Autocomplete Nama Bahan */}
      <datalist id="bahan-list">
        {bahanStandarList.map((b) => (
          <option key={b.id} value={b.nama} />
        ))}
      </datalist>

      {/* LOCKED PERIOD WARNING BANNER (CARMEN Phase 3) */}
      {isPeriodLocked && (
        <div
          style={{
            marginBottom: 20,
            padding: "16px 20px",
            borderRadius: "var(--radius-md, 8px)",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            color: "var(--amber-900, #78350f)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Lock size={20} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e" }}>
              PERIODE TELAH FINAL — DATA TERKUNCI OTOMATIS
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
              {lockReason || "Data Kalori Harian dan Catering Daily Order untuk katering dan tanggal ini telah dikunci karena laporan bulanan terkait telah berstatus FINAL."}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#92400e", opacity: 0.9 }}>
              Seluruh data tetap dapat dilihat dan diaudit, namun penambahan, pengubahan, atau penghapusan data dinonaktifkan demi keaslian data historis.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: DATA PENGIRIMAN HARI INI (ORDER INPUT) */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={16} />
            <span style={{ fontWeight: 700 }}>LANGKAH 1: DATA PENGIRIMAN HARI INI</span>
          </div>
          {dailyOrder ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#15803d",
                background: "#dcfce7",
                padding: "2px 8px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <CheckCircle2 size={13} />
              Jumlah order tersimpan: {dailyOrder.jumlah_order} porsi
            </span>
          ) : (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#b45309",
                background: "#fef3c7",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              Order Belum Diisi
            </span>
          )}
        </div>
        <div className="panel-body">
          <div className="row cols-4" style={{ alignItems: "flex-end" }}>
            <div>
              <label>KATERING *</label>
              <CenteredSelect
                value={selectedCateringId}
                placeholder="Pilih Katering"
                options={caterings.map((c) => ({ value: c.id, label: c.nama }))}
                onChange={(val) => setSelectedCateringId(val ? Number(val) : "")}
              />
            </div>

            <div>
              <label>TANGGAL *</label>
              <IndoDatePicker
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>

            <div>
              <label>SHIFT *</label>
              <div className="shift-toggle">
                <button
                  type="button"
                  className={shift === "Pagi" ? "active-pagi" : ""}
                  onClick={() => setShift("Pagi")}
                >
                  Pagi
                </button>
                <button
                  type="button"
                  className={shift === "Malam" ? "active-malam" : ""}
                  onClick={() => setShift("Malam")}
                >
                  Malam
                </button>
              </div>
            </div>

            <div>
              <label>JUMLAH ORDER (PORSI) *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Contoh: 320"
                  value={inputJumlahOrder}
                  onChange={(e) => setInputJumlahOrder(e.target.value)}
                  disabled={loadingDailyOrder || !selectedCateringId || isPeriodLocked}
                  title={isPeriodLocked ? (lockReason || "Data terkunci karena laporan FINAL") : undefined}
                  style={{
                    flex: 1,
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveDailyOrder}
                  disabled={savingDailyOrder || loadingDailyOrder || !selectedCateringId || !inputJumlahOrder || isPeriodLocked}
                  title={isPeriodLocked ? (lockReason || "Data terkunci karena laporan FINAL") : undefined}
                  style={{
                    padding: "0 14px",
                    height: 38,
                    background: isPeriodLocked ? "var(--slate-500, #64748b)" : "var(--red, #e11d48)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-sm, 4px)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: savingDailyOrder || !selectedCateringId || !inputJumlahOrder || isPeriodLocked ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    opacity: savingDailyOrder || !selectedCateringId || !inputJumlahOrder || isPeriodLocked ? 0.6 : 1,
                  }}
                >
                  {isPeriodLocked ? "Terkunci (FINAL)" : savingDailyOrder ? "Menyimpan..." : dailyOrder ? "Perbarui Order" : "Simpan Order"}
                </button>
              </div>
            </div>
          </div>

          {!dailyOrder && (
            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 4,
                background: "#fffbeb",
                border: "1px solid #fef08a",
                color: "#92400e",
                fontSize: 12.5,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>⚠️ Isi jumlah order terlebih dahulu untuk melanjutkan input Kalori.</span>
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: DATA KALORI (Hanya aktif setelah jumlah order tersimpan) */}
      <div
        style={{
          opacity: dailyOrder ? 1 : 0.45,
          pointerEvents: dailyOrder ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      >
        {/* Header Controls Panel: Detail Masakan */}
        <div className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Utensils size={16} />
              <span>LANGKAH 2: DATA KALORI — {shift} ({tanggal})</span>
            </div>
            {activeMenuInfo?.has_menu && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#047857",
                  background: "#d1fae5",
                  border: "1px solid #a7f3d0",
                  padding: "2px 8px",
                  borderRadius: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={12} />
                Menu Resmi Terhubung
              </span>
            )}
          </div>
          <div className="panel-body">
            {/* CARMEN Phase 5: Banner Informasi Menu Resmi Bulanan */}
            {loadingActiveMenu ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#64748b",
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>Memeriksa ketersediaan menu bulanan resmi...</span>
              </div>
            ) : activeMenuInfo?.has_menu ? (
              <div
                style={{
                  marginBottom: 18,
                  padding: "12px 16px",
                  borderRadius: 6,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontWeight: 700, fontSize: 13 }}>
                    <BookOpen size={16} />
                    <span>
                      Menu Resmi — Rencana Menu Bulanan {activeMenuInfo.effective_menu_period || ""}, Versi {activeMenuInfo.menu_plan_version}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeMenuInfo.components || activeMenuInfo.components.length === 0) return;
                      // Deteksi nama nasi jika ada
                      const nasiItem = activeMenuInfo.items?.find((it) => (it.item_role || "").toUpperCase().includes("NASI"));
                      if (nasiItem?.menu_name && !namaMasakanNasi) {
                        setNamaMasakanNasi(nasiItem.menu_name);
                      }
                      // Deteksi nama sayur jika ada
                      const sayurItem = activeMenuInfo.items?.find((it) => (it.item_role || "").toUpperCase().includes("SAYUR"));
                      if (sayurItem?.menu_name && !namaMasakanSayur) {
                        setNamaMasakanSayur(sayurItem.menu_name);
                      }
                      showSuccess("Nama masakan disinkronkan dari rencana menu resmi!");
                    }}
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      padding: "4px 10px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Sparkles size={12} />
                    Gunakan Nama Masakan
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activeMenuInfo.items?.map((item, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 11.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        padding: "3px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <strong style={{ color: "#0f766e" }}>{item.item_role || `#${item.item_order}`}:</strong> {item.menu_name}
                    </span>
                  ))}
                </div>
              </div>
            ) : selectedCateringId ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "#fefce8",
                  border: "1px solid #fef08a",
                  color: "#854d0e",
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Info size={16} />
                <span>
                  Belum ada menu bulanan aktif untuk katering, tanggal, dan shift ini. Anda tetap dapat melakukan input manual.
                </span>
              </div>
            ) : null}

            <div className="row cols-3">
              <div>
                <label>JENIS MASAKAN *</label>
                <CenteredSelect
                  value={jenisMasakan}
                  placeholder="Pilih Jenis Masakan"
                  options={jenisMasakanList.map((jm) => ({ value: jm, label: jm }))}
                  onChange={(val) => setJenisMasakan(val)}
                />
              </div>

              <div>
                <label>NAMA MASAKAN (NASI)</label>
                <input
                  type="text"
                  placeholder="Mis. Nasi Putih / Nasi Uduk"
                  value={namaMasakanNasi}
                  onChange={(e) => setNamaMasakanNasi(e.target.value)}
                />
              </div>

              <div>
                <label>NAMA MASAKAN (SAYUR)</label>
                <input
                  type="text"
                  placeholder="Mis. Sayur Asem / Sup Ayam"
                  value={namaMasakanSayur}
                  onChange={(e) => setNamaMasakanSayur(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

      {/* Success Banner / Dialog after Save */}
      {saveSuccessResult && (
        <div className="panel" style={{ borderLeft: "4px solid var(--green)", background: "var(--green-bg)" }}>
          <div className="panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--green)", fontWeight: 700, fontSize: 15 }}>
                <CheckCircle2 size={20} />
                <span>Kalori Harian Berhasil Disimpan!</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Total Kalori: <strong>{formatDec(saveSuccessResult.total_kalori)} kkal</strong> &bull; Status:{" "}
                <span className={`pill ${saveSuccessResult.mencapai ? "status-approved" : "pill-combo"}`}>
                  {saveSuccessResult.mencapai ? "Mencapai (≥ 900 kkal)" : "Tidak Mencapai (< 900 kkal)"}
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline" onClick={handleNextDay}>
                Isi Hari Berikutnya (+1 Hari)
              </button>
              <Link
                href={`/kalori-harian/mingguan?catering_id=${selectedCateringId}&start=${offsetDaysISO(tanggal, -6)}&end=${tanggal}`}
                className="btn btn-solid"
              >
                Lihat Rekap Mingguan <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div className="error-box">{errorMsg}</div>}

      {/* 5 Categories of Ingredients */}
      {KATEGORI_LIST.map((kat) => {
        const catResult = allCategoryResults.find((c) => c.category === kat) || {
          category: kat,
          totalBeratAktual: 0,
          totalB: 0,
          totalEnergi: 0,
          roleGroups: [],
          items: [],
        };

        return (
          <div key={kat} className="panel">
            <div className="panel-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={15} />
                <span>Kategori: {kat}</span>
              </div>
              <button
                type="button"
                className="add-row-link"
                style={{ padding: 0 }}
                onClick={() => handleAddIngredient(kat)}
              >
                <Plus size={14} /> Tambah Bahan
              </button>
            </div>

            <datalist id={`bahan-list-${kat}`}>
              {getOptionsForCategory(kat).map((opt) => (
                <option key={opt.key} value={opt.nama} />
              ))}
            </datalist>

            <div className="panel-body" style={{ padding: catResult.items.length > 0 ? "12px 16px" : "16px 20px" }}>
              {(kat === "Nasi" || kat === "Sayur") && (
                <div style={{ marginBottom: 14 }}>
                  <label>NAMA MASAKAN</label>
                  <input
                    type="text"
                    placeholder={kat === "Nasi" ? "Contoh: Nasi Kuning" : "Contoh: Sayur Lodeh"}
                    value={kat === "Nasi" ? namaMasakanNasi : namaMasakanSayur}
                    onChange={(e) =>
                      kat === "Nasi"
                        ? setNamaMasakanNasi(e.target.value)
                        : setNamaMasakanSayur(e.target.value)
                    }
                    style={{ maxWidth: 400 }}
                  />
                </div>
              )}
              {catResult.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Belum ada bahan di kategori ini. Klik &quot;+ Tambah Bahan&quot; di kanan atas.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%", textAlign: "left" }}>NAMA BAHAN</th>
                      <th style={{ width: "15%", textAlign: "left" }}>ITEM ROLE</th>
                      <th style={{ width: "9%", textAlign: "center" }}>STD KALORI (A)</th>
                      <th style={{ width: "9%", textAlign: "center" }}>STANDARD BERAT</th>
                      <th style={{ width: "9%", textAlign: "center" }}>ACTUAL BERAT</th>
                      <th style={{ width: "8%", textAlign: "center" }}>TOTAL ACTUAL BERAT</th>
                      <th style={{ width: "9%", textAlign: "center" }}>BERAT MAXIMAL (B)</th>
                      <th style={{ width: "8%", textAlign: "center" }}>TOTAL BERAT</th>
                      <th style={{ width: "8%", textAlign: "center" }}>ENERGI (KKAL)</th>
                      <th style={{ width: "5%", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catResult.roleGroups.map((group) => {
                      const groupRowCount = group.items.length;
                      const stdBeratVal = group.roleStandardBerat;

                      return group.items.map((row, idx) => {
                        const isFirstRowInGroup = idx === 0;

                        return (
                          <tr key={row.id}>
                            <td style={{ textAlign: "left", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div className="ingredient-control">
                                  <input
                                    type="text"
                                    list={`bahan-list-${kat}`}
                                    placeholder="Ketik/Pilih nama bahan..."
                                    value={row.nama_bahan}
                                    onChange={(e) =>
                                      handleUpdateIngredient(row.id, "nama_bahan", e.target.value)
                                    }
                                  />
                                </div>
                                {row.notFoundInMaster && (
                                  <div className="ingredient-helper" style={{ marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: "var(--amber)", display: "block", fontWeight: 600 }}>
                                      ⚠ Data makanan tidak ditemukan di master Standar Kalori.
                                    </span>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                                      Hubungi admin/staff untuk memperbarui master Standar Kalori.
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: "left", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div className="ingredient-control">
                                  {kat === "Sayur" || kat === "Buah" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "100%",
                                        height: 38,
                                        background: "var(--border-subtle)",
                                        border: "1px solid var(--border-strong)",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {row.item_role || (kat === "Sayur" ? "SAYUR" : "BUAH")}
                                    </div>
                                  ) : (
                                    <CenteredSelect
                                      value={row.item_role || ""}
                                      placeholder="Pilih Role"
                                      options={ITEM_ROLES.map((role) => ({ value: role, label: role }))}
                                      onChange={(val) => handleUpdateIngredient(row.id, "item_role", val)}
                                    />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div
                                  className="ingredient-control"
                                  style={{
                                    justifyContent: "center",
                                    fontWeight: 600,
                                    color: row.standar_kalori && Number(row.standar_kalori) > 0 ? "var(--text)" : "var(--text-muted)",
                                    fontSize: 13,
                                  }}
                                >
                                  {row.standar_kalori !== "" && row.standar_kalori !== null && row.standar_kalori !== undefined && Number(row.standar_kalori) > 0
                                    ? formatDec(row.standar_kalori)
                                    : "-"}
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div
                                  className="ingredient-control"
                                  style={{ justifyContent: "center", fontWeight: 600, color: "var(--text-secondary)", fontSize: 13 }}
                                >
                                  {row.standar_berat !== null && row.standar_berat !== undefined
                                    ? `${formatDec(row.standar_berat)} g`
                                    : stdBeratVal !== null
                                      ? `${formatDec(stdBeratVal)} g`
                                      : "-"}
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div className="ingredient-control" style={{ justifyContent: "center" }}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    style={{ textAlign: "center" }}
                                    placeholder="0"
                                    value={row.berat_aktual ? String(row.berat_aktual) : ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (isValidDecimalInput(val)) {
                                        handleUpdateIngredient(row.id, "berat_aktual", val);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* TOTAL ACTUAL BERAT - Merged cell per group, placed right after ACTUAL BERAT */}
                            {isFirstRowInGroup && (
                              <td
                                rowSpan={groupRowCount}
                                style={{
                                  textAlign: "center",
                                  verticalAlign: "middle",
                                  fontWeight: 700,
                                  background: "var(--card)",
                                  borderLeft: "1px solid var(--border)",
                                  borderRight: "1px solid var(--border)",
                                }}
                              >
                                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 800 }}>
                                  {formatDec(group.totalBeratAktual)} g
                                </div>
                              </td>
                            )}

                            {/* BERAT MAXIMAL (B) - Per row cell */}
                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div
                                  className="ingredient-control"
                                  style={{ justifyContent: "center", fontWeight: 700, color: "var(--text)", fontSize: 13 }}
                                >
                                  {formatDec(row.b_val)} g
                                </div>
                              </div>
                            </td>

                            {/* TOTAL BERAT - Merged cell per group */}
                            {isFirstRowInGroup && (
                              <td
                                rowSpan={groupRowCount}
                                style={{
                                  textAlign: "center",
                                  verticalAlign: "middle",
                                  fontWeight: 800,
                                  color: "var(--red)",
                                  background: "var(--card)",
                                  borderRight: "1px solid var(--border)",
                                }}
                              >
                                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 800 }}>
                                  {formatDec(group.totalB)} g
                                </div>
                              </td>
                            )}

                            {/* Energi (KKAL) - per row, placed right after Total Berat, right before Delete */}
                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div
                                  className="ingredient-control"
                                  style={{ justifyContent: "center", fontWeight: 700, color: "var(--text)", fontSize: 13 }}
                                >
                                  {formatDec(row.energi_val)}
                                </div>
                              </div>
                            </td>

                            <td style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div className="ingredient-field">
                                <div className="ingredient-control" style={{ justifyContent: "center" }}>
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn-danger"
                                    title="Hapus baris"
                                    onClick={() => handleRemoveIngredient(row.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}

      {/* Bottom Total & Submit Bar */}
      <div
        className="panel"
        style={{
          marginTop: 24,
          position: "sticky",
          bottom: 20,
          zIndex: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          borderColor: "var(--border-strong)",
          background: "var(--card)",
        }}
      >
        <div className="panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                TOTAL KALORI HARI INI
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--red)", lineHeight: 1.1 }}>
                {formatDec(totalKaloriHariIni)}{" "}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>kkal</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>STATUS:</span>
              <span
                className={`pill ${statusMencapaiHariIni ? "status-approved" : "pill-combo"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                {statusMencapaiHariIni ? "Mencapai (≥ 900 kkal)" : "Tidak Mencapai (< 900 kkal)"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href="/kalori-harian"
              className="btn btn-outline"
            >
              <ArrowLeft size={14} /> Kembali ke Menu Kalori
            </Link>

            <button
              type="button"
              className="btn btn-solid"
              disabled={!dailyOrder || ingredients.length === 0 || saving || isPeriodLocked}
              title={isPeriodLocked ? (lockReason || "Data terkunci karena laporan bulanan telah FINAL") : undefined}
              style={isPeriodLocked ? { background: "var(--slate-500, #64748b)", cursor: "not-allowed", opacity: 0.7 } : undefined}
              onClick={handleSave}
            >
              {isPeriodLocked ? "Terkunci (FINAL)" : saving ? "Menyimpan..." : "Simpan Hari Ini"}
            </button>
          </div>
        </div>
      </div>
      </div>


      {/* Confirm Delete Ingredient Row Modal */}
      <ConfirmDeleteModal
        isOpen={deleteIngredientTarget !== null}
        title="Hapus Baris Bahan?"
        itemName={
          deleteIngredientTarget
            ? `Bahan: ${deleteIngredientTarget.nama_bahan || "(Bahan Tanpa Nama)"} — Kategori: ${deleteIngredientTarget.kategori}`
            : undefined
        }
        description="Apakah Anda yakin ingin menghapus baris bahan ini? Data berat dan standar kalori pada baris ini akan dihapus dari form."
        confirmText="Hapus Baris"
        cancelText="Batal"
        onConfirm={() => {
          if (deleteIngredientTarget) {
            setIngredients((prev) => prev.filter((r) => r.id !== deleteIngredientTarget.id));
            setDeleteIngredientTarget(null);
          }
        }}
        onClose={() => setDeleteIngredientTarget(null)}
      />
    </div>
  );
}
