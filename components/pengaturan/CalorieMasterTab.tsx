"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Utensils,
  Search,
  Pencil,
  Plus,
  X,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  CalorieStandardItem,
  getCalorieStandard,
  createCalorieStandard,
  updateCalorieStandard,
  deleteCalorieStandard,
} from "@/lib/api";

const PAGE_SIZE = 15;

export default function CalorieMasterTab() {
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const [items, setItems] = useState<CalorieStandardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [addNameInput, setAddNameInput] = useState<string>("");
  const [addCalorieInput, setAddCalorieInput] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Edit Modal State
  const [editItem, setEditItem] = useState<CalorieStandardItem | null>(null);
  const [editCalorieInput, setEditCalorieInput] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Modal State
  const [deleteItem, setDeleteItem] = useState<CalorieStandardItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = user?.role === "admin" || user?.role === "staff" || user?.role === "user";

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getCalorieStandard();
      setItems(data);
    } catch (err: any) {
      setFetchError(err.message || "Gagal memuat master data standar kalori.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        String(item.standar_kalori).includes(q)
    );
  }, [items, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  // Reset to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setAddNameInput("");
    setAddCalorieInput("");
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleCloseAdd = () => {
    if (isAdding) return;
    setIsAddOpen(false);
    setAddNameInput("");
    setAddCalorieInput("");
    setAddError(null);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) return;

    setAddError(null);
    const cleanName = addNameInput.trim();
    if (!cleanName) {
      setAddError("Nama makanan wajib diisi dan tidak boleh kosong.");
      return;
    }

    // Check duplicate client-side
    const duplicate = items.some(
      (it) => it.nama.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setAddError(`Makanan "${cleanName}" sudah terdaftar di master data.`);
      return;
    }

    const cleaned = addCalorieInput.trim().replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      setAddError("Standar kalori harus berupa angka yang valid.");
      return;
    }
    if (num <= 0) {
      setAddError("Standar kalori harus bernilai lebih besar dari 0.");
      return;
    }

    setIsAdding(true);
    try {
      const created = await createCalorieStandard({
        nama: cleanName,
        standar_kalori: num,
      });

      // Insert and sort items
      setItems((prev) => {
        const next = [...prev, created];
        next.sort((a, b) => a.nama.localeCompare(b.nama));
        return next;
      });

      showSuccess(`Makanan "${created.nama}" berhasil ditambahkan dengan standar kalori ${created.standar_kalori} kcal.`);
      handleCloseAdd();
    } catch (err: any) {
      setAddError(err.message || "Gagal menambahkan standar kalori baru.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenEdit = (item: CalorieStandardItem) => {
    setEditItem(item);
    setEditCalorieInput(String(item.standar_kalori));
    setEditError(null);
  };

  const handleCloseEdit = () => {
    if (isSaving) return;
    setEditItem(null);
    setEditCalorieInput("");
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || isSaving) return;

    setEditError(null);
    const cleaned = editCalorieInput.trim().replace(",", ".");
    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      setEditError("Standar kalori harus berupa angka yang valid.");
      return;
    }

    if (num <= 0) {
      setEditError("Standar kalori harus bernilai lebih besar dari 0.");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateCalorieStandard(editItem.id, {
        standar_kalori: num,
      });

      // Update state locally
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it))
      );

      showSuccess(`Standar kalori untuk "${updated.nama}" berhasil diperbarui menjadi ${updated.standar_kalori} kcal.`);
      handleCloseEdit();
    } catch (err: any) {
      setEditError(err.message || "Gagal menyimpan perubahan standar kalori.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (item: CalorieStandardItem) => {
    setDeleteItem(item);
    setDeleteError(null);
  };

  const handleCloseDelete = () => {
    if (isDeleting) return;
    setDeleteItem(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCalorieStandard(deleteItem.id);
      setItems((prev) => prev.filter((it) => it.id !== deleteItem.id));
      showSuccess(`Standar kalori untuk "${deleteItem.nama}" berhasil dihapus.`);
      handleCloseDelete();
    } catch (err: any) {
      setDeleteError(err.message || "Gagal menghapus standar kalori.");
    } finally {
      setIsDeleting(false);
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
            <Utensils size={20} color="#8f1a25" />
            <span>Standar Kalori</span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-muted, #64748b)",
            }}
          >
            Kelola nilai standar kalori untuk setiap makanan.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAdd}
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
              title="Tambah Makanan Baru"
              aria-label="Tambah Makanan Baru"
            >
              <Plus size={15} />
              <span>Tambah Makanan</span>
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
            maxWidth: 360,
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
            placeholder="Cari nama makanan atau kalori..."
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
          Menampilkan <strong>{filteredItems.length}</strong> referensi makanan
        </div>
      </div>

      {/* Compact Table */}
      <div
        style={{
          backgroundColor: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--bg-main, #f8fafc)",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <th
                  style={{
                    padding: "12px 14px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                    width: 44,
                    textAlign: "center",
                  }}
                >
                  NO
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                  }}
                >
                  NAMA MAKANAN
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                    width: 160,
                  }}
                >
                  STANDAR KALORI
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                    width: 100,
                    textAlign: "center",
                  }}
                >
                  STATUS
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                    width: 220,
                  }}
                >
                  TERAKHIR DIUBAH
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: "var(--text, #334155)",
                    width: 150,
                    textAlign: "center",
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
                    colSpan={6}
                    style={{
                      padding: "36px 16px",
                      textAlign: "center",
                      color: "var(--text-muted, #64748b)",
                    }}
                  >
                    Memuat data standar kalori...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "36px 16px",
                      textAlign: "center",
                      color: "var(--text-muted, #64748b)",
                    }}
                  >
                    {searchTerm
                      ? `Tidak ditemukan makanan dengan kata kunci "${searchTerm}".`
                      : "Belum ada data standar kalori."}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border, #f1f5f9)",
                        transition: "background-color 100ms ease",
                      }}
                      className="hover-row"
                    >
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          color: "var(--text-muted, #64748b)",
                          fontSize: 12,
                        }}
                      >
                        {rowNumber}
                      </td>
                      <td
                        style={{
                          padding: "11px 16px",
                          fontWeight: 600,
                          color: "var(--text, #0f172a)",
                        }}
                      >
                        {item.nama}
                      </td>
                      <td style={{ padding: "11px 16px", color: "var(--text, #334155)" }}>
                        <span style={{ fontWeight: 700, color: "#8f1a25" }}>
                          {item.standar_kalori}
                        </span>{" "}
                        <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)" }}>
                          kcal / 100g
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11.5,
                            fontWeight: 700,
                            backgroundColor: item.is_active
                              ? "rgba(220, 38, 38, 0.08)"
                              : "rgba(100, 116, 139, 0.1)",
                            color: item.is_active ? "#16a34a" : "#64748b",
                          }}
                        >
                          {item.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                        <div>{formatDateTime(item.updated_at)}</div>
                        {item.updater_name && (
                          <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>
                            Oleh: {item.updater_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "center" }}>
                        {canEdit && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 10px",
                                backgroundColor: "rgba(143, 26, 37, 0.08)",
                                color: "#8f1a25",
                                border: "1px solid rgba(143, 26, 37, 0.2)",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 120ms ease",
                              }}
                              title={`Edit Standar Kalori ${item.nama}`}
                              aria-label={`Edit Standar Kalori ${item.nama}`}
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(item)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 10px",
                                backgroundColor: "rgba(220, 38, 38, 0.08)",
                                color: "#dc2626",
                                border: "1px solid rgba(220, 38, 38, 0.2)",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 120ms ease",
                              }}
                              title={`Hapus Standar Kalori ${item.nama}`}
                              aria-label={`Hapus Standar Kalori ${item.nama}`}
                            >
                              <Trash2 size={13} />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              backgroundColor: "var(--bg-main, #f8fafc)",
              borderTop: "1px solid var(--border, #e2e8f0)",
              fontSize: 12.5,
              color: "var(--text-muted, #64748b)",
            }}
          >
            <div>
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--border, #cbd5e1)",
                  backgroundColor: currentPage <= 1 ? "transparent" : "#ffffff",
                  color: currentPage <= 1 ? "#94a3b8" : "var(--text, #334155)",
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={14} />
                <span>Sebelumnya</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--border, #cbd5e1)",
                  backgroundColor: currentPage >= totalPages ? "transparent" : "#ffffff",
                  color: currentPage >= totalPages ? "#94a3b8" : "var(--text, #334155)",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span>Selanjutnya</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal Dialog */}
      {editItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-kalori"
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
            if (e.target === e.currentTarget) handleCloseEdit();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
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
                <Flame size={18} color="#8f1a25" />
                <h2
                  id="modal-title-kalori"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Edit Standar Kalori
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSaving}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isSaving ? "not-allowed" : "pointer",
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
            <form onSubmit={handleSaveEdit}>
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {editError && (
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
                    <span>{editError}</span>
                  </div>
                )}

                {/* 1. Nama Makanan (Read-only) */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Nama Makanan
                  </label>
                  <input
                    type="text"
                    value={editItem.nama}
                    readOnly
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 12px",
                      backgroundColor: "var(--bg-main, #f8fafc)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "var(--text, #475569)",
                      boxSizing: "border-box",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                {/* 2. Standar Kalori (Editable numeric input) */}
                <div>
                  <label
                    htmlFor="standar-kalori-input"
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Standar Kalori <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="standar-kalori-input"
                      type="number"
                      step="any"
                      min="0.1"
                      required
                      value={editCalorieInput}
                      onChange={(e) => setEditCalorieInput(e.target.value)}
                      placeholder="Contoh: 302"
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 85px 0 12px",
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
                      kcal / 100g
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 4, display: "block" }}>
                    Masukkan nilai acuan kalori per 100 gram bahan makanan (&gt; 0).
                  </span>
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
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "transparent",
                    color: "var(--text, #475569)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isSaving ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(143, 26, 37, 0.2)",
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving ? "Menyimpan..." : "Simpan Standar Kalori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal Dialog */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-add-kalori"
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
            if (e.target === e.currentTarget) handleCloseAdd();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
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
                <Plus size={18} color="#8f1a25" />
                <h2
                  id="modal-title-add-kalori"
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Tambah Makanan Baru
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseAdd}
                disabled={isAdding}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isAdding ? "not-allowed" : "pointer",
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
            <form onSubmit={handleSaveAdd}>
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {addError && (
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
                    <span>{addError}</span>
                  </div>
                )}

                {/* 1. Nama Makanan */}
                <div>
                  <label
                    htmlFor="add-nama-makanan-input"
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Nama Makanan <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="add-nama-makanan-input"
                    type="text"
                    required
                    value={addNameInput}
                    onChange={(e) => setAddNameInput(e.target.value)}
                    placeholder="Contoh: Ikan Bakar Nila"
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 12px",
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "var(--text, #0f172a)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 4, display: "block" }}>
                    Nama makanan yang terdaftar akan langsung tersedia di pencarian Kalori Harian.
                  </span>
                </div>

                {/* 2. Standar Kalori (Numeric kcal / 100g) */}
                <div>
                  <label
                    htmlFor="add-standar-kalori-input"
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text, #334155)",
                      marginBottom: 6,
                    }}
                  >
                    Standar Kalori <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="add-standar-kalori-input"
                      type="number"
                      step="any"
                      min="0.1"
                      required
                      value={addCalorieInput}
                      onChange={(e) => setAddCalorieInput(e.target.value)}
                      placeholder="Contoh: 180"
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 85px 0 12px",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: 6,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--text, #0f172a)",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
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
                      kcal / 100g
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", marginTop: 4, display: "block" }}>
                    Nilai acuan kalori per 100 gram bahan makanan (&gt; 0).
                  </span>
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
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseAdd}
                  disabled={isAdding}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "transparent",
                    color: "var(--text, #475569)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isAdding ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: isAdding ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(143, 26, 37, 0.2)",
                    opacity: isAdding ? 0.7 : 1,
                  }}
                >
                  {isAdding ? "Menyimpan..." : "Simpan Makanan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title-delete-kalori"
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
            if (e.target === e.currentTarget && !isDeleting) handleCloseDelete();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
              border: "1px solid var(--border, #e2e8f0)",
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
                backgroundColor: "rgba(220, 38, 38, 0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "rgba(220, 38, 38, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#dc2626",
                  }}
                >
                  <Trash2 size={16} />
                </div>
                <h2
                  id="modal-title-delete-kalori"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Hapus Standar Kalori?
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDelete}
                disabled={isDeleting}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  padding: 4,
                }}
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {deleteError && (
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
                  <span>{deleteError}</span>
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
                  <span style={{ color: "var(--text-muted, #64748b)", fontSize: 12, display: "block" }}>Nama:</span>
                  <strong style={{ color: "var(--text, #0f172a)", fontSize: 14 }}>{deleteItem.nama}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted, #64748b)", fontSize: 12, display: "block" }}>Nilai:</span>
                  <strong style={{ color: "#8f1a25", fontSize: 13.5 }}>{deleteItem.standar_kalori} kcal / 100g</strong>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
                Data historis tidak akan diubah. Master data yang dihapus tidak akan lagi muncul pada entri baru.
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
                onClick={handleCloseDelete}
                disabled={isDeleting}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ffffff",
                  color: "var(--text, #334155)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeleting ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
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
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
