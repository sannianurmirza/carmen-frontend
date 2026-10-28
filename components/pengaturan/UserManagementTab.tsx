"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  RotateCcw,
  Power,
  X,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
  CheckCircle2,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  AuthUser,
  getUsersApi,
  createUserApi,
  updateUserStatusApi,
  resetUserPasswordApi,
  resetUserSignatureApi,
} from "@/lib/api";

export default function UserManagementTab() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");

  // Modal Tambah User
  const [showAddModal, setShowAddModal] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [usernameBaru, setUsernameBaru] = useState("");
  const [emailBaru, setEmailBaru] = useState("");
  const [roleBaru, setRoleBaru] = useState<"admin" | "staff" | "approver">("staff");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");
  const [showPassBaru, setShowPassBaru] = useState(false);
  const [showConfirmBaru, setShowConfirmBaru] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal Reset Password
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetResetUser, setTargetResetUser] = useState<AuthUser | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [resetConfirmVal, setResetConfirmVal] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [showResetConfirmPass, setShowResetConfirmPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessPassword, setResetSuccessPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Modal Konfirmasi Toggle Status
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatusUser, setTargetStatusUser] = useState<AuthUser | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Modal Lihat QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [targetQrUser, setTargetQrUser] = useState<AuthUser | null>(null);

  // Modal Reset QR
  const [showResetQrModal, setShowResetQrModal] = useState(false);
  const [targetResetQrUser, setTargetResetQrUser] = useState<AuthUser | null>(null);
  const [resetQrNote, setResetQrNote] = useState("");
  const [resetQrLoading, setResetQrLoading] = useState(false);
  const [resetQrError, setResetQrError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsersApi();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "admin") {
      loadUsers();
    }
  }, [currentUser]);

  if (currentUser?.role !== "admin") {
    return null;
  }

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading) return;

    const trimmedNama = namaBaru.trim();
    const trimmedUsername = usernameBaru.trim();
    const trimmedEmail = emailBaru.trim().toLowerCase();

    if (!trimmedNama || !trimmedUsername || !passwordBaru) {
      setAddError("Nama lengkap, username, dan password wajib diisi.");
      return;
    }

    if (roleBaru === "approver" && !trimmedEmail) {
      setAddError("Email wajib diisi untuk role Approver.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAddError("Format email tidak valid.");
      return;
    }

    if (passwordBaru.length < 12) {
      setAddError("Password minimal 12 karakter.");
      return;
    }

    if (passwordBaru !== konfirmasiPasswordBaru) {
      setAddError("Konfirmasi password tidak cocok.");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const created = await createUserApi({
        nama: trimmedNama,
        username: trimmedUsername,
        email: trimmedEmail || undefined,
        role: roleBaru,
        password: passwordBaru,
        confirm_password: konfirmasiPasswordBaru,
      });

      showToast({
        type: "success",
        title: "Pengguna Ditambahkan",
        message: `Pengguna '${created.username}' (${created.role}) berhasil dibuat.`,
      });

      setShowAddModal(false);
      setNamaBaru("");
      setUsernameBaru("");
      setEmailBaru("");
      setRoleBaru("staff");
      setPasswordBaru("");
      setKonfirmasiPasswordBaru("");
      loadUsers();
    } catch (err: any) {
      setAddError(err.message || "Gagal menambahkan pengguna.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenResetModal = (u: AuthUser) => {
    setTargetResetUser(u);
    setResetError(null);
    setResetPasswordVal("");
    setResetConfirmVal("");
    setShowResetPass(false);
    setShowResetConfirmPass(false);
    setResetSuccessPassword(null);
    setCopied(false);
    setShowResetModal(true);
  };

  const handleCloseResetModal = () => {
    if (resetLoading) return;
    setShowResetModal(false);
    setTargetResetUser(null);
    setResetPasswordVal("");
    setResetConfirmVal("");
    setShowResetPass(false);
    setShowResetConfirmPass(false);
    setResetError(null);
    setResetSuccessPassword(null);
    setCopied(false);
  };

  const handleGeneratePassword = () => {
    const charsetUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude ambiguous I, O
    const charsetLower = "abcdefghijkmnpqrstuvwxyz"; // exclude ambiguous l, o
    const charsetDigits = "23456789"; // exclude ambiguous 0, 1
    const charsetSymbols = "!@#$%^&*()_+=";
    const allChars = charsetUpper + charsetLower + charsetDigits + charsetSymbols;

    const length = 16;
    const randomBytes = new Uint32Array(length);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 1000000000);
      }
    }

    const pwd: string[] = [
      charsetUpper[randomBytes[0] % charsetUpper.length],
      charsetLower[randomBytes[1] % charsetLower.length],
      charsetDigits[randomBytes[2] % charsetDigits.length],
      charsetSymbols[randomBytes[3] % charsetSymbols.length],
    ];

    for (let i = 4; i < length; i++) {
      pwd.push(allChars[randomBytes[i] % allChars.length]);
    }

    // Fisher-Yates shuffle
    for (let i = length - 1; i > 0; i--) {
      const j = randomBytes[i] % (i + 1);
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }

    const generated = pwd.join("");
    setResetPasswordVal(generated);
    setResetConfirmVal(generated);
    setShowResetPass(true);
    setShowResetConfirmPass(true);
    setResetError(null);
  };

  const handleCopyPassword = async () => {
    if (!resetSuccessPassword) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resetSuccessPassword);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = resetSuccessPassword;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast({
        type: "success",
        title: "Tersalin",
        message: "Password baru berhasil disalin ke clipboard.",
      });
    } catch {
      showToast({
        type: "warning",
        title: "Gagal Menyalin",
        message: "Silakan salin teks password secara manual.",
      });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading || !targetResetUser) return;

    const trimmedPassword = resetPasswordVal;
    const trimmedConfirm = resetConfirmVal;

    if (!trimmedPassword || !trimmedConfirm) {
      setResetError("Semua field password wajib diisi.");
      return;
    }

    if (trimmedPassword.length < 12) {
      setResetError("Password baru minimal 12 karakter.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setResetError("Konfirmasi password tidak cocok.");
      return;
    }

    setResetLoading(true);
    setResetError(null);

    try {
      const res = await resetUserPasswordApi(targetResetUser.id, {
        new_password: trimmedPassword,
        confirm_password: trimmedConfirm,
      });

      // Tampilkan password baru satu kali di kotak konfirmasi modal
      setResetSuccessPassword(trimmedPassword);
      setResetPasswordVal("");
      setResetConfirmVal("");

      showToast({
        type: "success",
        title: "Password Direset",
        message: res.message || `Password user '${targetResetUser.username}' berhasil direset. Sesi lama user telah dicabut.`,
      });
    } catch (err: any) {
      setResetError(err.message || "Gagal mereset password pengguna.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleStatusConfirm = async () => {
    if (!targetStatusUser || statusLoading) return;

    setStatusLoading(true);
    setStatusError(null);

    try {
      const updated = await updateUserStatusApi(
        targetStatusUser.id,
        !targetStatusUser.is_active
      );

      showToast({
        type: "success",
        title: "Status Diperbarui",
        message: `Akun '${updated.username}' sekarang ${
          updated.is_active ? "Aktif" : "Nonaktif"
        }.`,
      });

      setShowStatusModal(false);
      setTargetStatusUser(null);
      loadUsers();
    } catch (err: any) {
      setStatusError(err.message || "Gagal memperbarui status pengguna.");
    } finally {
      setStatusLoading(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* Tab Header Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
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
            <Users size={20} color="#8f1a25" />
            <span>Kelola Pengguna Sistem</span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-muted, #64748b)",
            }}
          >
            Kelola akun pengguna internal, hak akses peran, status aktif, dan reset password.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            backgroundColor: "#8f1a25",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            transition: "background 140ms ease",
          }}
        >
          <UserPlus size={16} />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {error && (
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
            marginBottom: 20,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs: Aktif (default), Semua, Nonaktif */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            border: "1px solid",
            borderColor: statusFilter === "active" ? "#8f1a25" : "var(--border, #e2e8f0)",
            backgroundColor: statusFilter === "active" ? "#8f1a25" : "var(--card-bg, #ffffff)",
            color: statusFilter === "active" ? "#ffffff" : "var(--text, #334155)",
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
        >
          Pengguna Aktif ({users.filter((u) => u.is_active).length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            border: "1px solid",
            borderColor: statusFilter === "all" ? "#8f1a25" : "var(--border, #e2e8f0)",
            backgroundColor: statusFilter === "all" ? "#8f1a25" : "var(--card-bg, #ffffff)",
            color: statusFilter === "all" ? "#ffffff" : "var(--text, #334155)",
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
        >
          Semua Pengguna ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("inactive")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            border: "1px solid",
            borderColor: statusFilter === "inactive" ? "#8f1a25" : "var(--border, #e2e8f0)",
            backgroundColor: statusFilter === "inactive" ? "#8f1a25" : "var(--card-bg, #ffffff)",
            color: statusFilter === "inactive" ? "#ffffff" : "var(--text, #334155)",
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
        >
          Nonaktif ({users.filter((u) => !u.is_active).length})
        </button>
      </div>

      {/* Tabel Pengguna */}
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
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 50, textAlign: "center" }}>
                  NO
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>
                  NAMA LENGKAP
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>
                  USERNAME
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)" }}>
                  EMAIL
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 140 }}>
                  ROLE
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 110, textAlign: "center" }}>
                  STATUS
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 170 }}>
                  TERAKHIR LOGIN
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 200, textAlign: "center" }}>
                  QR TANDA TANGAN
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text, #334155)", width: 180, textAlign: "center" }}>
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : (() => {
                const filteredUsers = users.filter((u) => {
                  if (statusFilter === "active") return u.is_active;
                  if (statusFilter === "inactive") return !u.is_active;
                  return true;
                });
                if (filteredUsers.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                        Tidak ada pengguna pada filter ini.
                      </td>
                    </tr>
                  );
                }
                return filteredUsers.map((u, idx) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: "1px solid var(--border, #f1f5f9)",
                      backgroundColor: idx % 2 === 0 ? "transparent" : "var(--table-zebra, rgba(0,0,0,0.01))",
                    }}
                  >
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text, #0f172a)" }}>
                      {u.nama}
                      {u.id === currentUser?.id && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: "2px 6px",
                            backgroundColor: "rgba(59, 130, 246, 0.1)",
                            color: "#2563eb",
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          Anda
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {u.username}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text, #0f172a)", fontSize: 12.5 }}>
                      {u.email || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>-</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {u.role === "admin" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: "rgba(143, 26, 37, 0.08)",
                            color: "#8f1a25",
                            borderRadius: 4,
                          }}
                        >
                          <ShieldCheck size={12} />
                          <span>Admin</span>
                        </span>
                      ) : u.role === "approver" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            color: "#059669",
                            borderRadius: 4,
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Approver</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: "rgba(59, 130, 246, 0.08)",
                            color: "#2563eb",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: 4,
                          }}
                        >
                          <Shield size={12} />
                          <span>Staff</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.is_active ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: "rgba(34, 197, 94, 0.1)",
                            color: "#16a34a",
                            borderRadius: 4,
                          }}
                        >
                          Aktif
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: "rgba(100, 116, 139, 0.12)",
                            color: "#64748b",
                            borderRadius: 4,
                          }}
                        >
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12 }}>
                      {formatDateTime(u.last_login_at)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        {u.signature?.has_signature && u.signature?.is_active ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "rgba(34, 197, 94, 0.1)",
                              color: "#16a34a",
                              borderRadius: 4,
                            }}
                          >
                            Aktif
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "rgba(100, 116, 139, 0.1)",
                              color: "#64748b",
                              borderRadius: 4,
                            }}
                          >
                            Belum Dibuat
                          </span>
                        )}

                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetQrUser(u);
                              setShowQrModal(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "4px 8px",
                              fontSize: 10.5,
                              fontWeight: 600,
                              backgroundColor: "#ffffff",
                              color: "#1e293b",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                            title="Lihat QR Tanda Tangan"
                          >
                            <QrCode size={12} />
                            <span>Lihat QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTargetResetQrUser(u);
                              setResetQrNote("");
                              setResetQrError(null);
                              setShowResetQrModal(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "4px 8px",
                              fontSize: 10.5,
                              fontWeight: 600,
                              backgroundColor: "rgba(143, 26, 37, 0.06)",
                              color: "#8f1a25",
                              border: "1px solid rgba(143, 26, 37, 0.25)",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                            title="Reset QR Tanda Tangan"
                          >
                            <RefreshCw size={11} />
                            <span>Reset QR</span>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenResetModal(u)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: "var(--bg-main, #f1f5f9)",
                            color: "var(--text, #334155)",
                            border: "1px solid var(--border, #cbd5e1)",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          title="Reset Password Pengguna"
                        >
                          <RotateCcw size={12} />
                          <span>Reset Password</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetStatusUser(u);
                            setStatusError(null);
                            setShowStatusModal(true);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: u.is_active
                              ? "rgba(220, 38, 38, 0.08)"
                              : "rgba(34, 197, 94, 0.08)",
                            color: u.is_active ? "#dc2626" : "#16a34a",
                            border: `1px solid ${
                              u.is_active
                                ? "rgba(220, 38, 38, 0.25)"
                                : "rgba(34, 197, 94, 0.25)"
                            }`,
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          title={u.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                        >
                          <Power size={12} />
                          <span>{u.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah User */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !addLoading && setShowAddModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              padding: "24px 22px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 id="add-user-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                Tambah Pengguna Baru
              </h3>
              <button
                type="button"
                onClick={() => !addLoading && setShowAddModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted, #94a3b8)", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  backgroundColor: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  borderRadius: 6,
                  color: "#dc2626",
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={namaBaru}
                  onChange={(e) => setNamaBaru(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  disabled={addLoading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    backgroundColor: "var(--input-bg, #ffffff)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={usernameBaru}
                  onChange={(e) => setUsernameBaru(e.target.value)}
                  placeholder="Contoh: budi_santoso"
                  disabled={addLoading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    backgroundColor: "var(--input-bg, #ffffff)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Email {roleBaru === "approver" ? <span style={{ color: "#dc2626" }}>* (Wajib untuk Approver)</span> : <span style={{ color: "var(--text-muted, #64748b)", fontWeight: 400 }}>(Opsional)</span>}
                </label>
                <input
                  type="email"
                  value={emailBaru}
                  onChange={(e) => setEmailBaru(e.target.value)}
                  placeholder="Contoh: approver@perusahaan.com"
                  disabled={addLoading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    backgroundColor: "var(--input-bg, #ffffff)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Role Akun
                </label>
                <select
                  value={roleBaru}
                  onChange={(e) => setRoleBaru(e.target.value as "admin" | "staff" | "approver")}
                  disabled={addLoading}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    backgroundColor: "var(--input-bg, #ffffff)",
                    color: "var(--text, #0f172a)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                >
                  <option value="staff">Staff (Staf Operasional)</option>
                  <option value="approver">Approver (Pejabat Approval)</option>
                  <option value="admin">Admin (Administrator Sistem)</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Password Baru
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassBaru ? "text" : "password"}
                    value={passwordBaru}
                    onChange={(e) => setPasswordBaru(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    disabled={addLoading}
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 12px",
                      fontSize: 13,
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      backgroundColor: "var(--input-bg, #ffffff)",
                      color: "var(--text, #0f172a)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassBaru(!showPassBaru)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 2,
                    }}
                  >
                    {showPassBaru ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                  Konfirmasi Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmBaru ? "text" : "password"}
                    value={konfirmasiPasswordBaru}
                    onChange={(e) => setKonfirmasiPasswordBaru(e.target.value)}
                    placeholder="Ulangi password"
                    disabled={addLoading}
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 12px",
                      fontSize: 13,
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: 6,
                      backgroundColor: "var(--input-bg, #ffffff)",
                      color: "var(--text, #0f172a)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmBaru(!showConfirmBaru)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 2,
                    }}
                  >
                    {showConfirmBaru ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => !addLoading && setShowAddModal(false)}
                  disabled={addLoading}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "var(--bg-main, #f1f5f9)",
                    color: "var(--text, #334155)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: addLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: addLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {addLoading ? "Menyimpan..." : "Simpan Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showResetModal && targetResetUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={handleCloseResetModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              padding: "24px 22px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={18} color="#8f1a25" />
                <h3 id="reset-password-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                  Reset Password Pengguna
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseResetModal}
                style={{ background: "transparent", border: "none", color: "var(--text-muted, #94a3b8)", cursor: "pointer", padding: 4 }}
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            {resetSuccessPassword ? (
              /* Tampilan Konfirmasi Satu Kali (One-Time Display) */
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: "rgba(34, 197, 94, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={20} color="#16a34a" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                      Password Baru Berhasil Dibuat
                    </h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "var(--text-muted, #64748b)" }}>
                      Pengguna: <strong style={{ fontFamily: "monospace" }}>{targetResetUser.username}</strong> ({targetResetUser.nama})
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--bg-main, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)", marginBottom: 8 }}>
                    Password baru berhasil dibuat:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        backgroundColor: "var(--card-bg, #ffffff)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: 6,
                        color: "var(--text, #0f172a)",
                        wordBreak: "break-all",
                        userSelect: "all",
                      }}
                    >
                      {resetSuccessPassword}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        backgroundColor: copied ? "#16a34a" : "var(--card-bg, #ffffff)",
                        color: copied ? "#ffffff" : "var(--text, #334155)",
                        border: `1px solid ${copied ? "#16a34a" : "var(--border, #cbd5e1)"}`,
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        whiteSpace: "nowrap",
                      }}
                      title="Salin Password ke Clipboard"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? "Tersalin!" : "Salin"}</span>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "rgba(234, 179, 8, 0.08)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#854d0e",
                    lineHeight: 1.5,
                    marginBottom: 18,
                  }}
                >
                  ⚠ <strong>Penting:</strong> Salin atau catat password ini sekarang. Demi privasi dan keamanan, password tidak disimpan dalam bentuk teks biasa dan tidak akan ditampilkan lagi setelah jendela ini ditutup.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleCloseResetModal}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "#8f1a25",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              /* Form Reset Password */
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-main, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "var(--text-muted, #64748b)" }}>
                    User: <strong style={{ color: "var(--text, #0f172a)", fontFamily: "monospace" }}>{targetResetUser.username}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    disabled={resetLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 8px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      backgroundColor: "rgba(143, 26, 37, 0.08)",
                      color: "#8f1a25",
                      border: "1px solid rgba(143, 26, 37, 0.25)",
                      borderRadius: 4,
                      cursor: resetLoading ? "not-allowed" : "pointer",
                    }}
                    title="Buat password acak yang aman secara otomatis"
                  >
                    <KeyRound size={13} />
                    <span>Generate Password</span>
                  </button>
                </div>

                {resetError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 12px",
                      backgroundColor: "rgba(220, 38, 38, 0.08)",
                      border: "1px solid rgba(220, 38, 38, 0.3)",
                      borderRadius: 6,
                      color: "#dc2626",
                      fontSize: 12.5,
                      marginBottom: 14,
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{resetError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPasswordSubmit}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                      New Password:
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showResetPass ? "text" : "password"}
                        value={resetPasswordVal}
                        onChange={(e) => setResetPasswordVal(e.target.value)}
                        placeholder="Minimal 12 karakter"
                        disabled={resetLoading}
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          fontSize: 13,
                          border: "1px solid var(--border, #cbd5e1)",
                          borderRadius: 6,
                          backgroundColor: "var(--input-bg, #ffffff)",
                          color: "var(--text, #0f172a)",
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPass(!showResetPass)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 2,
                        }}
                        title={showResetPass ? "Sembunyikan password" : "Lihat password"}
                      >
                        {showResetPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text, #334155)", marginBottom: 5 }}>
                      Confirm Password:
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showResetConfirmPass ? "text" : "password"}
                        value={resetConfirmVal}
                        onChange={(e) => setResetConfirmVal(e.target.value)}
                        placeholder="Ulangi password baru"
                        disabled={resetLoading}
                        style={{
                          width: "100%",
                          padding: "8px 36px 8px 12px",
                          fontSize: 13,
                          border: "1px solid var(--border, #cbd5e1)",
                          borderRadius: 6,
                          backgroundColor: "var(--input-bg, #ffffff)",
                          color: "var(--text, #0f172a)",
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetConfirmPass(!showResetConfirmPass)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 2,
                        }}
                        title={showResetConfirmPass ? "Sembunyikan password" : "Lihat password"}
                      >
                        {showResetConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      onClick={handleCloseResetModal}
                      disabled={resetLoading}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "var(--bg-main, #f1f5f9)",
                        color: "var(--text, #334155)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: resetLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#8f1a25",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: resetLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {resetLoading ? "Mereset..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Toggle Status */}
      {showStatusModal && targetStatusUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-toggle-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !statusLoading && setShowStatusModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
              padding: "24px 22px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="status-toggle-title"
              style={{
                margin: "0 0 10px 0",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text, #0f172a)",
              }}
            >
              {targetStatusUser.is_active ? "Nonaktifkan Akun?" : "Aktifkan Akun?"}
            </h3>

            <p style={{ margin: "0 0 18px 0", fontSize: 13, color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
              Apakah Anda yakin ingin {targetStatusUser.is_active ? "menonaktifkan" : "mengaktifkan"} akun <strong>{targetStatusUser.nama}</strong> ({targetStatusUser.username})?
              {targetStatusUser.is_active && " Pengguna tidak akan dapat masuk ke sistem setelah dinonaktifkan."}
            </p>

            {statusError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  backgroundColor: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  borderRadius: 6,
                  color: "#dc2626",
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{statusError}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => !statusLoading && setShowStatusModal(false)}
                disabled={statusLoading}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "var(--bg-main, #f1f5f9)",
                  color: "var(--text, #334155)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: statusLoading ? "not-allowed" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleToggleStatusConfirm}
                disabled={statusLoading}
                style={{
                  padding: "8px 16px",
                  backgroundColor: targetStatusUser.is_active ? "#dc2626" : "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: statusLoading ? "not-allowed" : "pointer",
                }}
              >
                {statusLoading ? "Memproses..." : targetStatusUser.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Lihat QR Tanda Tangan */}
      {showQrModal && targetQrUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <QrCode size={18} color="#8f1a25" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  QR Tanda Tangan Pengguna
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px", textAlign: "center" }}>
              <div
                style={{
                  width: 200,
                  height: 200,
                  margin: "0 auto 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: 12,
                  backgroundColor: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/catering-ir/api/users/${targetQrUser.id}/signature/qr-image`}
                  alt={`QR Tanda Tangan ${targetQrUser.nama}`}
                  width={176}
                  height={176}
                  style={{ objectFit: "contain", borderRadius: 6 }}
                  onError={(e) => {
                    (e.target as any).style.display = 'none';
                  }}
                />
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                {targetQrUser.nama}
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b", textTransform: "capitalize", marginBottom: 12 }}>
                {targetQrUser.role} &bull; {targetQrUser.email || targetQrUser.username}
              </div>

              <div
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  color: "#16a34a",
                  marginBottom: 16,
                }}
              >
                Tanda Tangan Aktif & Sah
              </div>

              <p
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 11.5,
                  color: "#64748b",
                  lineHeight: 1.45,
                  backgroundColor: "#f8fafc",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  textAlign: "left",
                }}
              >
                QR ini merupakan identitas tanda tangan digital permanen milik pengguna. QR yang sama disematkan pada seluruh dokumen yang disetujui pengguna ini.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset QR Tanda Tangan (Admin Only) */}
      {showResetQrModal && targetResetQrUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => !resetQrLoading && setShowResetQrModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RefreshCw size={18} color="#8f1a25" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Konfirmasi Reset QR Tanda Tangan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !resetQrLoading && setShowResetQrModal(false)}
                disabled={resetQrLoading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: resetQrLoading ? "not-allowed" : "pointer",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                Apakah Anda yakin ingin mereset QR Tanda Tangan untuk pengguna <strong>{targetResetQrUser.nama}</strong> ({targetResetQrUser.username})?
              </p>

              <div
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "#92400e",
                  lineHeight: 1.45,
                  marginBottom: 16,
                }}
              >
                <strong>Dampak Tindakan Reset:</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                  <li>Tanda tangan QR lama akan dinonaktifkan untuk pengesahan baru.</li>
                  <li>Token identitas permanen baru akan diterbitkan untuk persetujuan mendatang.</li>
                  <li>Dokumen yang telah disetujui sebelumnya tetap sah dan tidak berubah.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Catatan Alasan Reset (Opsional)
                </label>
                <input
                  type="text"
                  value={resetQrNote}
                  onChange={(e) => setResetQrNote(e.target.value)}
                  placeholder="Contoh: Pembaruan kunci perangkat / rotasi keamanan rutin"
                  disabled={resetQrLoading}
                  style={{
                    width: "100%",
                    height: 38,
                    fontSize: 13,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {resetQrError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.3)",
                    borderRadius: 6,
                    color: "#dc2626",
                    fontSize: 12.5,
                    marginBottom: 14,
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{resetQrError}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => !resetQrLoading && setShowResetQrModal(false)}
                  disabled={resetQrLoading}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: resetQrLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (resetQrLoading) return;
                    setResetQrLoading(true);
                    setResetQrError(null);
                    try {
                      await resetUserSignatureApi(targetResetQrUser.id, resetQrNote);
                      showToast({
                        type: "success",
                        title: "QR Tanda Tangan Direset",
                        message: `QR Tanda Tangan untuk '${targetResetQrUser.nama}' berhasil diperbarui.`,
                      });
                      setShowResetQrModal(false);
                      setTargetResetQrUser(null);
                      loadUsers();
                    } catch (err: any) {
                      setResetQrError(err.message || "Gagal mereset QR Tanda Tangan.");
                    } finally {
                      setResetQrLoading(false);
                    }
                  }}
                  disabled={resetQrLoading}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: resetQrLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {resetQrLoading ? "Mereset..." : "Ya, Reset QR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
