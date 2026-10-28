"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  Plus,
  RotateCcw,
  Pencil,
  X,
  AlertCircle,
  Search,
  Check,
  Clock,
  User as UserIcon,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  StandarBerat,
  getStandarBeratSettings,
  createJenisMasakanStandardWeights,
  upsertStandarBeratCell,
  deleteStandarBeratSettings,
  deleteStandarBeratCell,
  deleteJenisMasakanStandardWeights,
} from "@/lib/api";

// Canonical ordered list of Jenis Masakan as per the original Excel matrix
const CANONICAL_JENIS_MASAKAN = [
  "KERINGAN (LALAPAN, URAP-URAP, PECEL)",
  "KERINGAN TUMIS (OSENG, CAPJAY, MIE)",
  "SAYUR BERKELUWEK (RAWON)",
  "SAYUR BERSANTAN",
  "SAYUR TIDAK BERSANTAN",
  "MIE AYAM",
  "GADO-GADO",
  "NASI GORENG",
  "NASI KUNING",
];

// Canonical ordered list of Item Roles as per the original Excel matrix
const CANONICAL_ITEM_ROLES = [
  "NASI/MIE",
  "LONTONG",
  "SAYUR",
  "LAUK UTAMA",
  "LAUK PENDAMPING 1",
  "LAUK PENDAMPING 2",
  "BUAH",
  "KERUPUK/PANGSIT GORENG",
  "SAMBAL",
  "SAOS/KECAP MIE AYAM",
  "BUMBU GADO-GADO",
  "BUMBU URAP-URAP",
  "BUMBU/SAMBAL PECEL",
  "BUMBU LAIN-LAIN",
  "PUDING",
  "LAUK PENDAMPING 1 & 2",
];

interface CellEditState {
  jenis_masakan: string;
  item_role: string;
  current_weight: number | null;
  record?: StandarBerat | null;
}

export default function WeightStandardTab() {
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const [items, setItems] = useState<StandarBerat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Cell Editor Modal State
  const [editCell, setEditCell] = useState<CellEditState | null>(null);
  const [cellWeightInput, setCellWeightInput] = useState<string>("");
  const [cellError, setCellError] = useState<string | null>(null);
  const [isSavingCell, setIsSavingCell] = useState<boolean>(false);

  // Add Jenis Masakan Modal State
  const [isAddJMOpen, setIsAddJMOpen] = useState<boolean>(false);
  const [newJMName, setNewJMName] = useState<string>("");
  const [newJMWeights, setNewJMWeights] = useState<Record<string, string>>({});
  const [addJMError, setAddJMError] = useState<string | null>(null);
  const [isSavingJM, setIsSavingJM] = useState<boolean>(false);

  // Delete Cell Confirmation Modal State
  interface DeleteCellTarget {
    jenis_masakan: string;
    item_role: string;
    standar: number | null;
    recordId?: number | null;
  }
  const [deleteCellTarget, setDeleteCellTarget] = useState<DeleteCellTarget | null>(null);
  const [isDeletingCell, setIsDeletingCell] = useState<boolean>(false);
  const [deleteCellError, setDeleteCellError] = useState<string | null>(null);

  // Delete Jenis Masakan Confirmation Modal State
  const [deleteJMTarget, setDeleteJMTarget] = useState<string | null>(null);
  const [isDeletingJM, setIsDeletingJM] = useState<boolean>(false);
  const [deleteJMError, setDeleteJMError] = useState<string | null>(null);

  const canEdit = user?.role === "admin" || user?.role === "staff" || user?.role === "user";

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getStandarBeratSettings();
      setItems(data);
    } catch (err: any) {
      setFetchError(err.message || "Gagal memuat master data standar berat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Columns: Unique Jenis Masakan preserving canonical order + any newly added
  const columns = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.jenis_masakan && it.is_active !== false) {
        set.add(it.jenis_masakan.trim());
      }
    });

    const existing = Array.from(set);
    const sorted: string[] = [];

    // First, append canonical categories if present
    CANONICAL_JENIS_MASAKAN.forEach((can) => {
      const found = existing.find((e) => e.toLowerCase() === can.toLowerCase());
      if (found && !sorted.includes(found)) {
        sorted.push(found);
      }
    });

    // Then append any newly created custom categories
    const others = existing
      .filter((e) => !sorted.some((s) => s.toLowerCase() === e.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    return [...sorted, ...others];
  }, [items]);

  // Rows: Unique Item Roles preserving canonical order + any additional
  const rows = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.item_role) {
        set.add(it.item_role.trim());
      }
    });

    const existing = Array.from(set);
    const sorted: string[] = [];

    // First, append canonical roles
    CANONICAL_ITEM_ROLES.forEach((can) => {
      const found = existing.find((e) => e.toLowerCase() === can.toLowerCase());
      if (found && !sorted.includes(found)) {
        sorted.push(found);
      }
    });

    // Then append any others present in data
    const others = existing
      .filter((e) => !sorted.some((s) => s.toLowerCase() === e.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    return [...sorted, ...others];
  }, [items]);

  // Filter rows if user types in search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => r.toLowerCase().includes(q));
  }, [rows, searchTerm]);

  // Lookup map: `${jenis_masakan.toLowerCase()}|||${item_role.toLowerCase()}` -> StandarBerat
  const gridMap = useMemo(() => {
    const map = new Map<string, StandarBerat>();
    items.forEach((it) => {
      if (it.is_active !== false) {
        const key = `${it.jenis_masakan.trim().toLowerCase()}|||${it.item_role.trim().toLowerCase()}`;
        map.set(key, it);
      }
    });
    return map;
  }, [items]);

  // =========================================================================
  // Cell Click & Edit Handlers
  // =========================================================================

  const handleCellClick = (jm: string, role: string) => {
    if (!canEdit) return;

    const key = `${jm.trim().toLowerCase()}|||${role.trim().toLowerCase()}`;
    const rec = gridMap.get(key) || null;
    const curWeight = rec && rec.berat_gram != null ? rec.berat_gram : null;

    setEditCell({
      jenis_masakan: jm,
      item_role: role,
      current_weight: curWeight,
      record: rec,
    });
    setCellWeightInput(curWeight !== null ? String(curWeight) : "");
    setCellError(null);
  };

  const handleCloseCellEdit = () => {
    if (isSavingCell) return;
    setEditCell(null);
    setCellWeightInput("");
    setCellError(null);
  };

  const handleSaveCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCell || isSavingCell) return;

    setCellError(null);
    const cleaned = cellWeightInput.trim().replace(",", ".");

    let targetWeight: number | null = null;
    if (cleaned !== "") {
      const num = parseFloat(cleaned);
      if (isNaN(num)) {
        setCellError("Standar berat harus berupa angka yang valid.");
        return;
      }
      if (num <= 0) {
        setCellError("Standar berat harus bernilai lebih besar dari 0.");
        return;
      }
      targetWeight = num;
    }

    setIsSavingCell(true);
    try {
      const result = await upsertStandarBeratCell({
        jenis_masakan: editCell.jenis_masakan,
        item_role: editCell.item_role,
        berat_gram: targetWeight,
      });

      // Update state locally
      if (targetWeight === null) {
        // Deactivated or cleared to null / '-'
        setItems((prev) =>
          prev.map((it) =>
            it.jenis_masakan.toLowerCase() === editCell.jenis_masakan.toLowerCase() &&
            it.item_role.toLowerCase() === editCell.item_role.toLowerCase()
              ? { ...it, is_active: false }
              : it
          )
        );
        showSuccess(
          `Standar berat untuk "${editCell.jenis_masakan} - ${editCell.item_role}" dikosongkan (-).`
        );
      } else if (result) {
        // Upserted record
        setItems((prev) => {
          const exists = prev.some((it) => it.id === result.id);
          if (exists) {
            return prev.map((it) => (it.id === result.id ? result : it));
          } else {
            return [...prev, result];
          }
        });
        showSuccess(
          `Standar berat "${result.jenis_masakan} - ${result.item_role}" berhasil disimpan menjadi ${result.berat_gram} g.`
        );
      }

      handleCloseCellEdit();
    } catch (err: any) {
      setCellError(err.message || "Gagal menyimpan perubahan standar berat.");
    } finally {
      setIsSavingCell(false);
    }
  };

  const handleClearCellToDash = async () => {
    if (!editCell || isSavingCell) return;
    setIsSavingCell(true);
    setCellError(null);
    try {
      await upsertStandarBeratCell({
        jenis_masakan: editCell.jenis_masakan,
        item_role: editCell.item_role,
        berat_gram: null,
      });

      setItems((prev) =>
        prev.map((it) =>
          it.jenis_masakan.toLowerCase() === editCell.jenis_masakan.toLowerCase() &&
          it.item_role.toLowerCase() === editCell.item_role.toLowerCase()
            ? { ...it, is_active: false }
            : it
        )
      );

      showSuccess(
        `Standar berat "${editCell.jenis_masakan} - ${editCell.item_role}" dikosongkan (-).`
      );
      handleCloseCellEdit();
    } catch (err: any) {
      setCellError(err.message || "Gagal mengosongkan sel.");
    } finally {
      setIsSavingCell(false);
    }
  };

  // =========================================================================
  // Delete Cell Confirmation Handlers
  // =========================================================================

  const handleOpenDeleteCell = (target: DeleteCellTarget) => {
    setDeleteCellTarget(target);
    setDeleteCellError(null);
  };

  const handleCloseDeleteCell = () => {
    if (isDeletingCell) return;
    setDeleteCellTarget(null);
    setDeleteCellError(null);
  };

  const handleConfirmDeleteCell = async () => {
    if (!deleteCellTarget || isDeletingCell) return;
    setIsDeletingCell(true);
    setDeleteCellError(null);
    try {
      if (deleteCellTarget.recordId) {
        await deleteStandarBeratSettings(deleteCellTarget.recordId);
      } else {
        await deleteStandarBeratCell(deleteCellTarget.jenis_masakan, deleteCellTarget.item_role);
      }

      // Mark cell as inactive locally so UI immediately shows "-"
      setItems((prev) =>
        prev.map((it) =>
          it.jenis_masakan.toLowerCase() === deleteCellTarget.jenis_masakan.toLowerCase() &&
          it.item_role.toLowerCase() === deleteCellTarget.item_role.toLowerCase()
            ? { ...it, is_active: false }
            : it
        )
      );

      showSuccess(
        `Standar berat "${deleteCellTarget.jenis_masakan} - ${deleteCellTarget.item_role}" berhasil dihapus (-).`
      );
      handleCloseDeleteCell();
      if (
        editCell &&
        editCell.jenis_masakan.toLowerCase() === deleteCellTarget.jenis_masakan.toLowerCase() &&
        editCell.item_role.toLowerCase() === deleteCellTarget.item_role.toLowerCase()
      ) {
        handleCloseCellEdit();
      }
    } catch (err: any) {
      setDeleteCellError(err.message || "Gagal menghapus standar berat.");
    } finally {
      setIsDeletingCell(false);
    }
  };

  // =========================================================================
  // Delete Entire Jenis Masakan Handlers
  // =========================================================================

  const handleOpenDeleteJM = (jm: string) => {
    setDeleteJMTarget(jm);
    setDeleteJMError(null);
  };

  const handleCloseDeleteJM = () => {
    if (isDeletingJM) return;
    setDeleteJMTarget(null);
    setDeleteJMError(null);
  };

  const handleConfirmDeleteJM = async () => {
    if (!deleteJMTarget || isDeletingJM) return;
    setIsDeletingJM(true);
    setDeleteJMError(null);
    try {
      await deleteJenisMasakanStandardWeights(deleteJMTarget);

      // Deactivate all rules under this jenis_masakan locally
      setItems((prev) =>
        prev.map((it) =>
          it.jenis_masakan.toLowerCase() === deleteJMTarget.toLowerCase()
            ? { ...it, is_active: false }
            : it
        )
      );

      showSuccess(
        `Jenis masakan "${deleteJMTarget}" beserta seluruh standar beratnya berhasil dihapus.`
      );
      handleCloseDeleteJM();
    } catch (err: any) {
      setDeleteJMError(err.message || "Gagal menghapus jenis masakan.");
    } finally {
      setIsDeletingJM(false);
    }
  };

  // =========================================================================
  // Add New Jenis Masakan Handlers
  // =========================================================================

  const handleOpenAddJM = () => {
    setNewJMName("");
    setNewJMWeights({});
    setAddJMError(null);
    setIsAddJMOpen(true);
  };

  const handleCloseAddJM = () => {
    if (isSavingJM) return;
    setIsAddJMOpen(false);
    setNewJMName("");
    setNewJMWeights({});
    setAddJMError(null);
  };

  const handleWeightInputChange = (role: string, val: string) => {
    setNewJMWeights((prev) => ({
      ...prev,
      [role]: val,
    }));
  };

  const handleSaveAddJM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingJM) return;

    setAddJMError(null);
    const cleanName = newJMName.trim().toUpperCase();

    if (!cleanName) {
      setAddJMError("Nama jenis masakan wajib diisi dan tidak boleh kosong.");
      return;
    }

    // Duplicate check
    const duplicate = columns.some(
      (c) => c.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setAddJMError(`Jenis masakan "${cleanName}" sudah terdaftar di master data.`);
      return;
    }

    // Process weights
    const validWeights: { item_role: string; berat_gram: number }[] = [];
    for (const role of rows) {
      const valStr = (newJMWeights[role] || "").trim().replace(",", ".");
      if (valStr === "") continue;

      const num = parseFloat(valStr);
      if (isNaN(num)) {
        setAddJMError(`Standar berat untuk "${role}" harus berupa angka yang valid.`);
        return;
      }
      if (num <= 0) {
        setAddJMError(`Standar berat untuk "${role}" harus bernilai lebih besar dari 0.`);
        return;
      }
      validWeights.push({ item_role: role, berat_gram: num });
    }

    if (validWeights.length === 0) {
      setAddJMError(
        "Minimal satu standar berat untuk bagian porsi harus diisi dan bernilai lebih dari 0."
      );
      return;
    }

    setIsSavingJM(true);
    try {
      const res = await createJenisMasakanStandardWeights({
        jenis_masakan: cleanName,
        weights: validWeights,
      });

      // Reload fresh data from backend
      await loadData();

      showSuccess(
        `Jenis masakan "${cleanName}" berhasil ditambahkan dengan ${res.count} standar berat porsi.`
      );
      handleCloseAddJM();
    } catch (err: any) {
      setAddJMError(err.message || "Gagal menyimpan jenis masakan baru.");
    } finally {
      setIsSavingJM(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString;
      return dt.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header Panel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 4px 0",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text, #0f172a)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              letterSpacing: "-0.01em",
            }}
          >
            <Scale size={20} color="#8f1a25" />
            <span>STANDAR BERAT</span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-muted, #64748b)",
            }}
          >
            Kelola standar berat berdasarkan jenis masakan dan bagian porsi.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAddJM}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                backgroundColor: "#8f1a25",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(143, 26, 37, 0.2)",
                transition: "all 140ms ease",
              }}
              title="Tambah Jenis Masakan Baru"
              aria-label="Tambah Jenis Masakan Baru"
            >
              <Plus size={15} />
              <span>Tambah Jenis Masakan</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              backgroundColor: "transparent",
              color: "var(--text, #334155)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 140ms ease",
            }}
            title="Muat Ulang Data"
            aria-label="Muat Ulang Data"
          >
            <RotateCcw size={14} className={loading ? "spin" : ""} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            backgroundColor: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            borderRadius: 6,
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Search Input Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 340,
          }}
        >
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted, #94a3b8)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Cari item / bagian porsi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px 0 36px",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--text, #0f172a)",
              backgroundColor: "var(--card-bg, #ffffff)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
              }}
              title="Hapus pencarian"
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: "var(--text-muted, #64748b)" }}>
          Menampilkan <strong>{columns.length}</strong> jenis masakan •{" "}
          <strong>{filteredRows.length}</strong> bagian porsi (item)
          {canEdit && (
            <span style={{ marginLeft: 8, color: "#8f1a25", fontWeight: 600 }}>
              (Klik sel untuk mengubah)
            </span>
          )}
        </div>
      </div>

      {/* Spreadsheet Matrix Table */}
      <div className="weight-matrix-container">
        <table className="weight-matrix-table">
          <thead>
            {/* Primary Header Row: ITEM + Jenis Masakan Names */}
            <tr>
              <th
                rowSpan={2}
                className="sticky-col-header"
                style={{ verticalAlign: "middle" }}
              >
                ITEM
              </th>
              {columns.map((jm) => (
                <th
                  key={jm}
                  style={{
                    minWidth: 140,
                    maxWidth: 195,
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span style={{ flex: 1, textAlign: "center" }}>{jm}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDeleteJM(jm);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "3px 4px",
                          borderRadius: 4,
                          cursor: "pointer",
                          color: "var(--text-muted, #64748b)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 120ms ease",
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#dc2626";
                          e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted, #64748b)";
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        title={`Hapus seluruh konfigurasi Jenis Masakan "${jm}"`}
                        aria-label={`Hapus Jenis Masakan ${jm}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>

            {/* Sub-Header Row: BERAT (gram) under each Jenis Masakan */}
            <tr>
              {columns.map((jm) => (
                <th key={`${jm}-sub`} className="sticky-header-sub">
                  BERAT (gram)
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{
                    padding: "36px 16px",
                    textAlign: "center",
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  Memuat matriks standar berat...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{
                    padding: "36px 16px",
                    textAlign: "center",
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  {searchTerm
                    ? `Tidak ada bagian porsi yang cocok dengan "${searchTerm}".`
                    : "Belum ada data standar berat."}
                </td>
              </tr>
            ) : (
              filteredRows.map((role) => {
                return (
                  <tr key={role}>
                    {/* Sticky Row Header: ITEM / item_role */}
                    <td className="sticky-col-cell">{role}</td>

                    {/* Data Cells per Jenis Masakan */}
                    {columns.map((jm) => {
                      const key = `${jm.trim().toLowerCase()}|||${role.trim().toLowerCase()}`;
                      const rec = gridMap.get(key);
                      const hasVal = rec && rec.berat_gram != null;
                      const weightNum = hasVal ? rec.berat_gram : null;

                      return (
                        <td
                          key={`${jm}-${role}`}
                          className="matrix-cell"
                          onClick={() => handleCellClick(jm, role)}
                          title={
                            canEdit
                              ? `${jm} • ${role}: ${
                                  hasVal ? `${weightNum} gram` : "-"
                                } (Klik untuk mengedit)`
                              : `${jm} • ${role}: ${
                                  hasVal ? `${weightNum} gram` : "-"
                                }`
                          }
                        >
                          {hasVal ? (
                            <span className="matrix-val-number">{weightNum}</span>
                          ) : (
                            <span className="matrix-val-dash">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* Cell Editor Modal Dialog                                                  */}
      {/* ========================================================================= */}
      {editCell && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-edit-cell"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCellEdit();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              animation: "fadeIn 120ms ease-out",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Scale size={18} color="#8f1a25" />
                <h2
                  id="modal-title-edit-cell"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Edit Standar Berat
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseCellEdit}
                disabled={isSavingCell}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isSavingCell ? "not-allowed" : "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCell}>
              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {cellError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      backgroundColor: "rgba(220, 38, 38, 0.08)",
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                      borderRadius: 6,
                      color: "#dc2626",
                      fontSize: 12.5,
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{cellError}</span>
                  </div>
                )}

                {/* Details Context Card */}
                <div
                  style={{
                    backgroundColor: "var(--bg-main, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 6,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)" }}>
                    Jenis Masakan:
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--text, #0f172a)",
                    }}
                  >
                    {editCell.jenis_masakan}
                  </div>

                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted, #64748b)",
                      marginTop: 4,
                    }}
                  >
                    Bagian Porsi (Item):
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#8f1a25",
                    }}
                  >
                    {editCell.item_role}
                  </div>
                </div>

                {/* Numeric Weight Input */}
                <div>
                  <label
                    htmlFor="standar-berat-input"
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Standar Berat (gram)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="standar-berat-input"
                      type="number"
                      step="any"
                      min="0.1"
                      value={cellWeightInput}
                      onChange={(e) => setCellWeightInput(e.target.value)}
                      placeholder="Masukkan berat atau kosongkan untuk (-)"
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 60px 0 12px",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: 6,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--text, #0f172a)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      autoFocus
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-muted, #64748b)",
                        pointerEvents: "none",
                      }}
                    >
                      gram
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted, #64748b)",
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    Isi angka &gt; 0, atau klik &quot;Kosongkan (-)&quot; untuk menghapus standar berat kombinasi ini.
                  </span>
                </div>

                {/* Audit Metadata if available */}
                {editCell.record && (editCell.record.updated_by || editCell.record.updated_at) && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted, #64748b)",
                      borderTop: "1px dashed var(--border, #e2e8f0)",
                      paddingTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Clock size={13} />
                    <span>
                      Terakhir diubah oleh{" "}
                      <strong>
                        {editCell.record.updater_name || "Petugas"}
                      </strong>{" "}
                      • {formatDateTime(editCell.record.updated_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-main, #f8fafc)",
                }}
              >
                <div>
                  {editCell.current_weight !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDeleteCell({
                          jenis_masakan: editCell.jenis_masakan,
                          item_role: editCell.item_role,
                          standar: editCell.current_weight,
                          recordId: editCell.record?.id,
                        })
                      }
                      disabled={isSavingCell}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 12px",
                        backgroundColor: "rgba(220, 38, 38, 0.08)",
                        color: "#dc2626",
                        border: "1px solid rgba(220, 38, 38, 0.3)",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isSavingCell ? "not-allowed" : "pointer",
                        transition: "all 140ms ease",
                      }}
                      title="Hapus kombinasi ini menjadi tanda (-)"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Standar</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleCloseCellEdit}
                    disabled={isSavingCell}
                    style={{
                      padding: "8px 14px",
                      backgroundColor: "transparent",
                      color: "var(--text, #475569)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: isSavingCell ? "not-allowed" : "pointer",
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCell}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "#8f1a25",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: isSavingCell ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 2px rgba(143, 26, 37, 0.2)",
                      opacity: isSavingCell ? 0.7 : 1,
                    }}
                  >
                    {isSavingCell ? "Menyimpan..." : "Simpan Standar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Add New Jenis Masakan Modal Dialog                                        */}
      {/* ========================================================================= */}
      {isAddJMOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-add-jm"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseAddJM();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              animation: "fadeIn 120ms ease-out",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={18} color="#8f1a25" />
                <h2
                  id="modal-title-add-jm"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Tambah Jenis Masakan Baru
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseAddJM}
                disabled={isSavingJM}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isSavingJM ? "not-allowed" : "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSaveAddJM}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flex: 1,
              }}
            >
              <div
                style={{
                  padding: "20px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  flex: 1,
                }}
              >
                {addJMError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      backgroundColor: "rgba(220, 38, 38, 0.08)",
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                      borderRadius: 6,
                      color: "#dc2626",
                      fontSize: 12.5,
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{addJMError}</span>
                  </div>
                )}

                {/* 1. Nama Jenis Masakan */}
                <div>
                  <label
                    htmlFor="add-jm-name-input"
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Nama Jenis Masakan <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="add-jm-name-input"
                    type="text"
                    required
                    value={newJMName}
                    onChange={(e) => setNewJMName(e.target.value)}
                    placeholder="Contoh: SOP, RAWON SPESIAL"
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 12px",
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text, #0f172a)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                    autoFocus
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted, #64748b)",
                      marginTop: 4,
                      display: "block",
                    }}
                  >
                    Kategori jenis masakan baru akan otomatis muncul sebagai kolom baru pada matriks dan pilihan Kalori Harian.
                  </span>
                </div>

                {/* 2. Weight Inputs Table */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--text, #334155)",
                      }}
                    >
                      Standar Berat per Bagian Porsi (gram)
                    </label>
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-muted, #64748b)",
                      }}
                    >
                      Kosongkan bagian porsi yang tidak berlaku (-)
                    </span>
                  </div>

                  <div
                    style={{
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: 6,
                      maxHeight: 280,
                      overflowY: "auto",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12.5,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: "var(--bg-main, #f8fafc)",
                            borderBottom: "1px solid var(--border, #e2e8f0)",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          <th
                            style={{
                              padding: "8px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "var(--text, #334155)",
                            }}
                          >
                            Bagian Porsi (Item)
                          </th>
                          <th
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontWeight: 600,
                              color: "var(--text, #334155)",
                              width: 140,
                            }}
                          >
                            Berat (gram)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((role) => (
                          <tr
                            key={role}
                            style={{
                              borderBottom: "1px solid var(--border, #f1f5f9)",
                            }}
                          >
                            <td
                              style={{
                                padding: "8px 12px",
                                fontWeight: 500,
                                color: "var(--text, #0f172a)",
                              }}
                            >
                              {role}
                            </td>
                            <td style={{ padding: "6px 12px", textAlign: "right" }}>
                              <input
                                type="number"
                                step="any"
                                min="0.1"
                                placeholder="-"
                                value={newJMWeights[role] || ""}
                                onChange={(e) =>
                                  handleWeightInputChange(role, e.target.value)
                                }
                                style={{
                                  width: 90,
                                  height: 32,
                                  padding: "0 8px",
                                  textAlign: "right",
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  border: "1px solid var(--border, #cbd5e1)",
                                  borderRadius: 4,
                                  backgroundColor: "#ffffff",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-main, #f8fafc)",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseAddJM}
                  disabled={isSavingJM}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "transparent",
                    color: "var(--text, #475569)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isSavingJM ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingJM}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isSavingJM ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(143, 26, 37, 0.2)",
                    opacity: isSavingJM ? 0.7 : 1,
                  }}
                >
                  {isSavingJM ? "Menyimpan..." : "Simpan Jenis Masakan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* Delete Cell Confirmation Modal Dialog                                     */}
      {/* ========================================================================= */}
      {deleteCellTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-delete-cell"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDeleteCell();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              animation: "fadeIn 120ms ease-out",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} color="#dc2626" />
                <h2
                  id="modal-title-delete-cell"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Hapus Standar Berat?
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteCell}
                disabled={isDeletingCell}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isDeletingCell ? "not-allowed" : "pointer",
                  padding: 4,
                }}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {deleteCellError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    borderRadius: 6,
                    color: "#dc2626",
                    fontSize: 12.5,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{deleteCellError}</span>
                </div>
              )}

              <div
                style={{
                  backgroundColor: "var(--bg-main, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: 6,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      fontSize: 12,
                      display: "block",
                    }}
                  >
                    Jenis Masakan:
                  </span>
                  <strong style={{ color: "var(--text, #0f172a)", fontSize: 13.5 }}>
                    {deleteCellTarget.jenis_masakan}
                  </strong>
                </div>
                <div>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      fontSize: 12,
                      display: "block",
                    }}
                  >
                    Item:
                  </span>
                  <strong style={{ color: "#8f1a25", fontSize: 13.5 }}>
                    {deleteCellTarget.item_role}
                  </strong>
                </div>
                <div>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      fontSize: 12,
                      display: "block",
                    }}
                  >
                    Standar:
                  </span>
                  <strong style={{ color: "var(--text, #0f172a)", fontSize: 13.5 }}>
                    {deleteCellTarget.standar !== null
                      ? `${deleteCellTarget.standar} gram`
                      : "-"}
                  </strong>
                </div>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: "var(--text-muted, #64748b)",
                  lineHeight: 1.5,
                }}
              >
                Data historis tidak akan diubah. Sel ini akan dikosongkan (-) dan tidak lagi digunakan sebagai standar untuk entri baru.
              </p>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 20px",
                borderTop: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
              }}
            >
              <button
                type="button"
                onClick={handleCloseDeleteCell}
                disabled={isDeletingCell}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ffffff",
                  color: "var(--text, #334155)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeletingCell ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCell}
                disabled={isDeletingCell}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeletingCell ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                  opacity: isDeletingCell ? 0.7 : 1,
                }}
              >
                {isDeletingCell ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Delete Jenis Masakan Confirmation Modal Dialog                            */}
      {/* ========================================================================= */}
      {deleteJMTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-delete-jm"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDeleteJM();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              animation: "fadeIn 120ms ease-out",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} color="#dc2626" />
                <h2
                  id="modal-title-delete-jm"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Hapus Jenis Masakan?
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteJM}
                disabled={isDeletingJM}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isDeletingJM ? "not-allowed" : "pointer",
                  padding: 4,
                }}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {deleteJMError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    borderRadius: 6,
                    color: "#dc2626",
                    fontSize: 12.5,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{deleteJMError}</span>
                </div>
              )}

              <div
                style={{
                  backgroundColor: "var(--bg-main, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: 6,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  <span
                    style={{
                      color: "var(--text-muted, #64748b)",
                      fontSize: 12,
                      display: "block",
                    }}
                  >
                    Jenis Masakan:
                  </span>
                  <strong style={{ color: "var(--text, #0f172a)", fontSize: 14 }}>
                    {deleteJMTarget}
                  </strong>
                </div>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: "var(--text-muted, #64748b)",
                  lineHeight: 1.5,
                }}
              >
                Tindakan ini akan menghapus/menonaktifkan seluruh standar berat untuk jenis masakan ini. Data historis tidak akan diubah.
              </p>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 20px",
                borderTop: "1px solid var(--border, #e2e8f0)",
                backgroundColor: "var(--bg-main, #f8fafc)",
              }}
            >
              <button
                type="button"
                onClick={handleCloseDeleteJM}
                disabled={isDeletingJM}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ffffff",
                  color: "var(--text, #334155)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeletingJM ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteJM}
                disabled={isDeletingJM}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeletingJM ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                  opacity: isDeletingJM ? 0.7 : 1,
                }}
              >
                {isDeletingJM ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
