"use client";

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  QrCode,
  Info,
  RefreshCw,
  Download,
  Upload,
  FileImage,
  X,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  changePasswordApi,
  getBaseUrl,
  getPublicUrl,
  getUserSignatureApi,
  replaceMySignatureQrApi,
  uploadMySignatureQrApi,
  updateMyProfileApi,
  UserSignatureInfo,
} from "@/lib/api";

export default function AccountSettingsTab() {
  const { user, refreshUser } = useAuth();
  const { showSuccess } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Modal State untuk Edit Profil Mandiri
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileNama, setProfileNama] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleOpenEditProfile = () => {
    if (!user) return;
    setProfileNama(user.nama || "");
    setProfileUsername(user.username || "");
    setProfileEmail(user.email || "");
    setProfileError(null);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNama.trim()) {
      setProfileError("Nama lengkap wajib diisi.");
      return;
    }
    if (!profileUsername.trim()) {
      setProfileError("Username wajib diisi.");
      return;
    }
    if (profileUsername.trim().length < 3) {
      setProfileError("Username minimal 3 karakter.");
      return;
    }

    setProfileSubmitting(true);
    setProfileError(null);

    try {
      await updateMyProfileApi({
        nama: profileNama.trim(),
        username: profileUsername.trim(),
        email: profileEmail.trim() || undefined,
      });

      showSuccess("Informasi profil akun Anda berhasil diperbarui.", "Profil Diperbarui");
      setIsEditProfileOpen(false);
      await refreshUser();
    } catch (err: any) {
      setProfileError(err?.message || "Gagal memperbarui profil.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const [signatureInfo, setSignatureInfo] = useState<UserSignatureInfo | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [qrTimestamp, setQrTimestamp] = useState<number>(Date.now());

  // Modal State untuk Ganti QR Tanda Tangan Mandiri (Self-Service)
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replacePassword, setReplacePassword] = useState("");
  const [replaceNote, setReplaceNote] = useState("");
  const [showReplacePassword, setShowReplacePassword] = useState(false);
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Modal State untuk Upload QR TTD Mandiri (Self-Service)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadFileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (user && (user.role === "approver" || user.role === "admin" || user.role === "staff")) {
      setSignatureLoading(true);
      getUserSignatureApi(user.id)
        .then((sig) => setSignatureInfo(sig))
        .catch(() => {})
        .finally(() => setSignatureLoading(false));
    }
  }, [user]);

  const handleOpenUploadModal = () => {
    setUploadFile(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }
    setUploadPreview(null);
    setUploadNote("");
    setUploadError(null);
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    if (uploadSubmitting) return;
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadNote("");
    setUploadError(null);
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Format file tidak didukung. Harap pilih gambar PNG, JPG, JPEG, atau WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran file gambar maksimal 5 MB.");
      return;
    }

    setUploadError(null);
    setUploadFile(file);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }
    setUploadPreview(URL.createObjectURL(file));
  };

  const handleConfirmUploadSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Silakan pilih file gambar QR/TTD terlebih dahulu.");
      return;
    }

    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const res = await uploadMySignatureQrApi(uploadFile, uploadNote);
      showSuccess(
        "QR / Tanda Tangan Anda berhasil diunggah dan diaktifkan.",
        "QR TTD Diperbarui"
      );
      setSignatureInfo(res.signature);
      setQrTimestamp(Date.now());
      handleCloseUploadModal();
    } catch (err: any) {
      setUploadError(err?.message || "Gagal mengunggah QR Tanda Tangan.");
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleOpenReplaceModal = () => {
    setReplacePassword("");
    setReplaceNote("");
    setReplaceError(null);
    setShowReplacePassword(false);
    setIsReplaceModalOpen(true);
  };

  const handleCloseReplaceModal = () => {
    if (replaceSubmitting) return;
    setIsReplaceModalOpen(false);
    setReplacePassword("");
    setReplaceNote("");
    setReplaceError(null);
  };

  const handleConfirmReplaceSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacePassword) {
      setReplaceError("Password saat ini wajib diisi untuk konfirmasi keamanan.");
      return;
    }
    setReplaceSubmitting(true);
    setReplaceError(null);
    try {
      const res = await replaceMySignatureQrApi(replacePassword, replaceNote);
      showSuccess(
        "QR tanda tangan berhasil diganti. QR baru akan digunakan untuk approval berikutnya. Dokumen yang sudah ditandatangani sebelumnya tidak berubah.",
        "Berhasil"
      );
      setIsReplaceModalOpen(false);
      setReplacePassword("");
      setReplaceNote("");
      setQrTimestamp(Date.now());
      if (user) {
        getUserSignatureApi(user.id)
          .then((sig) => setSignatureInfo(sig))
          .catch(() => {});
      }
    } catch (err: any) {
      const msg = err?.message || "Gagal mengganti QR tanda tangan. Pastikan password Anda benar.";
      setReplaceError(msg);
    } finally {
      setReplaceSubmitting(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleResetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setFormError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = "Password saat ini wajib diisi.";
    }

    if (!newPassword) {
      errors.newPassword = "Password baru wajib diisi.";
    } else if (newPassword.length < 12) {
      errors.newPassword = "Password baru minimal 12 karakter.";
    } else if (currentPassword && newPassword === currentPassword) {
      errors.newPassword = "Password baru tidak boleh sama dengan password lama.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Konfirmasi password wajib diisi.";
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = "Konfirmasi password baru tidak cocok.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Tampilkan notifikasi keberhasilan sesuai ketentuan
      showSuccess(
        "Password berhasil diperbarui. Silakan masuk kembali.",
        "Berhasil"
      );

      // Bersihkan form
      handleResetForm();

      // Alihkan pengguna ke /login dan ganti history agar tidak bisa kembali via Back
      setTimeout(() => {
        window.location.replace(getPublicUrl("/login"));
      }, 400);
    } catch (err: any) {
      const msg = err?.message || "Gagal memperbarui password. Silakan coba lagi.";
      if (msg.includes("minimal 12 karakter")) {
        setFieldErrors((prev) => ({
          ...prev,
          newPassword: "Password baru minimal 12 karakter.",
        }));
      } else if (msg.includes("tidak boleh sama")) {
        setFieldErrors((prev) => ({
          ...prev,
          newPassword: "Password baru tidak boleh sama dengan password lama.",
        }));
      } else if (msg.includes("tidak cocok")) {
        setFieldErrors((prev) => ({
          ...prev,
          confirmPassword: "Konfirmasi password baru tidak cocok.",
        }));
      } else if (msg.includes("saat ini tidak sesuai")) {
        setFieldErrors((prev) => ({
          ...prev,
          currentPassword: "Password saat ini tidak sesuai.",
        }));
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 780 }}>
      {/* Primary Page Heading */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: "0 0 4px 0",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text, #0f172a)",
            letterSpacing: "-0.01em",
          }}
        >
          Akun Saya
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--text-muted, #64748b)",
          }}
        >
          Kelola profil pengguna dan pembaruan password keamanan akun Anda.
        </p>
      </div>

      {/* Card 1: Informasi Akun */}
      <section
        style={{
          backgroundColor: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
        aria-label="Informasi Akun"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Avatar Inisial */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: user?.role === "admin" ? "#8f1a25" : "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.05em",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
            }}
            aria-hidden="true"
          >
            {getInitials(user?.nama)}
          </div>

          {/* Data Akun */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  {user?.nama || "Pengguna"}
                </h2>
                {/* Badge Role */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    backgroundColor:
                      user?.role === "admin"
                        ? "rgba(143, 26, 37, 0.08)"
                        : "rgba(37, 99, 235, 0.08)",
                    color: user?.role === "admin" ? "#8f1a25" : "#1d4ed8",
                    border:
                      user?.role === "admin"
                        ? "1px solid rgba(143, 26, 37, 0.2)"
                        : "1px solid rgba(37, 99, 235, 0.2)",
                    textTransform: "uppercase",
                  }}
                >
                  <Shield size={12} />
                  <span>
                    {user?.role === "admin"
                      ? "Administrator"
                      : user?.role === "approver"
                      ? "Approver"
                      : "Staff Operasional"}
                  </span>
                </span>
                {/* Badge Status */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    color: "#047857",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>Aktif</span>
                </span>
              </div>

              {/* Tombol Edit Profil */}
              <button
                type="button"
                onClick={handleOpenEditProfile}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: "rgba(143, 26, 37, 0.08)",
                  color: "#8f1a25",
                  border: "1px solid rgba(143, 26, 37, 0.25)",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
                title="Edit Nama Lengkap, Username, dan Email"
              >
                <Pencil size={13} />
                <span>Edit Profil</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--text-muted, #64748b)",
                }}
              >
                Username: <strong style={{ color: "var(--text, #334155)", fontFamily: "monospace" }}>{user?.username || "-"}</strong>
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--text-muted, #64748b)",
                }}
              >
                Email: <strong style={{ color: "var(--text, #334155)" }}>{user?.email || "-"}</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Card 1.5: Tanda Tangan Elektronik */}
      {(user?.role === "approver" || user?.role === "admin" || user?.role === "staff" || signatureInfo?.has_signature) && (
        <section
          style={{
            backgroundColor: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
          aria-label="Tanda Tangan Elektronik"
        >
          <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border, #f1f5f9)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <QrCode size={19} color="#8f1a25" />
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text, #0f172a)",
                }}
              >
                Tanda Tangan Elektronik
              </h3>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--text-muted, #64748b)",
              }}
            >
              Identitas tanda tangan elektronik permanen Anda untuk menyetujui dokumen laporan di sistem CARMEN.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            {/* QR Preview Box */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 12,
                  border: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "#ffffff",
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                {signatureLoading ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Memuat QR...</div>
                ) : (
                  <img
                    id="my-signature-qr-preview"
                    src={`${getBaseUrl()}/users/${user?.id}/signature/qr-image?t=${qrTimestamp}`}
                    alt="QR Tanda Tangan Saya"
                    width={130}
                    height={130}
                    style={{ objectFit: "contain", borderRadius: 4 }}
                    onError={(e) => {
                      console.warn("Gagal memuat gambar QR Tanda Tangan", e);
                    }}
                  />
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text, #334155)" }}>
                QR Tanda Tangan Saya
              </div>
            </div>

            {/* Explanation and Security details */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    color: "#059669",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>Status: Aktif</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  (Satu Pengguna = Satu QR Aktif)
                </span>
              </div>

              <p
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  color: "var(--text, #334155)",
                  lineHeight: 1.5,
                }}
              >
                QR ini terpasang secara otomatis pada lembar dokumen Excel saat Anda menyetujui laporan. Anda dapat mengunggah gambar QR/TTD Anda sendiri atau membuat ulang secara mandiri.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  backgroundColor: "rgba(143, 26, 37, 0.05)",
                  border: "1px solid rgba(143, 26, 37, 0.15)",
                  fontSize: 12,
                  color: "#8f1a25",
                  lineHeight: 1.4,
                  marginBottom: 16,
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Keamanan Terjamin: Pengunggahan atau penggantian QR menghasilkan token baru dan tidak mengubah dokumen yang telah disetujui sebelumnya.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  id="btn-open-upload-qr"
                  type="button"
                  onClick={handleOpenUploadModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(2, 132, 199, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#0369a1")}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#0284c7")}
                >
                  <Upload size={14} />
                  <span>Upload QR TTD</span>
                </button>

                <button
                  id="btn-open-replace-qr"
                  type="button"
                  onClick={handleOpenReplaceModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(143, 26, 37, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#72141d")}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#8f1a25")}
                >
                  <RefreshCw size={14} />
                  <span>Ganti QR Tanda Tangan</span>
                </button>

                <a
                  id="btn-download-qr"
                  href={`${getBaseUrl()}/users/${user?.id}/signature/qr-image?t=${qrTimestamp}`}
                  download={`QR_Signature_${user?.username || 'carmen'}.png`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 500,
                    backgroundColor: "var(--card-bg, #ffffff)",
                    color: "var(--text, #334155)",
                    border: "1px solid var(--border, #cbd5e1)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#f8fafc")}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                >
                  <Download size={13} />
                  <span>Unduh QR</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Confirmation Modal: Ganti QR Tanda Tangan */}
      {isReplaceModalOpen && (
        <div
          id="modal-replace-qr"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-replace-qr-title"
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
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "#ffffff",
              borderRadius: 14,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: "rgba(143, 26, 37, 0.1)",
                    color: "#8f1a25",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <RefreshCw size={16} />
                </div>
                <h3
                  id="modal-replace-qr-title"
                  style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}
                >
                  Ganti QR Tanda Tangan?
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseReplaceModal}
                disabled={replaceSubmitting}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmReplaceSignature} style={{ padding: "20px 22px" }}>
              {/* Notice Box */}
              <div
                style={{
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12.5,
                  color: "#1e40af",
                  lineHeight: 1.5,
                  marginBottom: 18,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "#2563eb" }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    QR lama tidak akan digunakan untuk approval baru.
                  </div>
                  <div>
                    Dokumen yang sudah ditandatangani sebelumnya tidak akan berubah.
                  </div>
                </div>
              </div>

              {replaceError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: "#991b1b",
                    marginBottom: 16,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{replaceError}</span>
                </div>
              )}

              {/* Password Saat Ini (Re-authentication) */}
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="input-replace-password"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Password Saat Ini <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="input-replace-password"
                    type={showReplacePassword ? "text" : "password"}
                    value={replacePassword}
                    onChange={(e) => setReplacePassword(e.target.value)}
                    placeholder="Masukkan password akun Anda"
                    required
                    disabled={replaceSubmitting}
                    style={{
                      width: "100%",
                      padding: "9px 38px 9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13.5,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowReplacePassword(!showReplacePassword)}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#64748b",
                      padding: 2,
                      display: "flex",
                    }}
                  >
                    {showReplacePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                  Diperlukan untuk memverifikasi bahwa Anda adalah pemilik sah akun ini.
                </div>
              </div>

              {/* Catatan / Alasan Penggantian (Opsional) */}
              <div style={{ marginBottom: 22 }}>
                <label
                  htmlFor="input-replace-note"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Alasan Penggantian (Opsional)
                </label>
                <input
                  id="input-replace-note"
                  type="text"
                  value={replaceNote}
                  onChange={(e) => setReplaceNote(e.target.value)}
                  placeholder="Contoh: Pembaruan kunci tanda tangan rutin"
                  disabled={replaceSubmitting}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 12,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  id="btn-cancel-replace-modal"
                  type="button"
                  onClick={handleCloseReplaceModal}
                  disabled={replaceSubmitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  id="btn-submit-replace-qr"
                  type="submit"
                  disabled={replaceSubmitting || !replacePassword}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: replaceSubmitting ? "#cbd5e1" : "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    cursor: replaceSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 3px rgba(143, 26, 37, 0.3)",
                  }}
                >
                  {replaceSubmitting ? "Memproses..." : "Konfirmasi Ganti QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Upload QR TTD */}
      {isUploadModalOpen && (
        <div
          id="modal-upload-qr"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-upload-qr-title"
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
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              backgroundColor: "#ffffff",
              borderRadius: 14,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: "rgba(2, 132, 199, 0.1)",
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Upload size={18} />
                </div>
                <div>
                  <h3
                    id="modal-upload-qr-title"
                    style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}
                  >
                    Upload QR / Tanda Tangan
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Unggah file gambar QR atau TTD resmi Anda
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={uploadSubmitting}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  borderRadius: 6,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmUploadSignature} style={{ padding: "20px 22px" }}>
              {/* Notice Box */}
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12.5,
                  color: "#166534",
                  lineHeight: 1.5,
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2, color: "#16a34a" }} />
                <div>
                  Gambar QR / TTD yang diunggah akan otomatis disimpan dan disematkan pada lembar dokumen Excel saat Anda menyetujui laporan.
                </div>
              </div>

              {/* Upload Drop Zone / Input */}
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 8,
                  }}
                >
                  Pilih File Gambar <span style={{ color: "#dc2626" }}>*</span>
                </label>

                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadFileChange}
                  style={{ display: "none" }}
                  id="input-upload-qr-file"
                />

                {!uploadPreview ? (
                  <div
                    onClick={() => uploadFileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: 10,
                      padding: "28px 16px",
                      textAlign: "center",
                      backgroundColor: "#f8fafc",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#0284c7";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#f0f9ff";
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        backgroundColor: "rgba(2, 132, 199, 0.1)",
                        color: "#0284c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 10px",
                      }}
                    >
                      <Upload size={22} />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                      Klik untuk memilih file gambar
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Format didukung: PNG, JPG, JPEG, WEBP (Maksimal 5 MB)
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: 14,
                      backgroundColor: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 8,
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadPreview}
                        alt="Preview TTD"
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {uploadFile?.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : ""}
                      </div>
                      <button
                        type="button"
                        onClick={() => uploadFileInputRef.current?.click()}
                        style={{
                          marginTop: 8,
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          backgroundColor: "#ffffff",
                          color: "#0284c7",
                          border: "1px solid #0284c7",
                          cursor: "pointer",
                        }}
                      >
                        Ganti Gambar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Catatan / Keterangan (Opsional) */}
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="input-upload-note"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Keterangan (Opsional)
                </label>
                <input
                  id="input-upload-note"
                  type="text"
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  placeholder="Contoh: Tanda tangan resmi approval catering 2026"
                  disabled={uploadSubmitting}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Error Message */}
              {uploadError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    marginBottom: 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 14,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  id="btn-cancel-upload-modal"
                  type="button"
                  onClick={handleCloseUploadModal}
                  disabled={uploadSubmitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  id="btn-submit-upload-qr"
                  type="submit"
                  disabled={uploadSubmitting || !uploadFile}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: uploadSubmitting || !uploadFile ? "#cbd5e1" : "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    cursor: uploadSubmitting || !uploadFile ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 3px rgba(2, 132, 199, 0.3)",
                  }}
                >
                  <Upload size={14} />
                  <span>{uploadSubmitting ? "Mengunggah..." : "Simpan & Aktifkan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Profil Mandiri */}
      {isEditProfileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-profile-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !profileSubmitting && setIsEditProfileOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 12,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
              padding: "24px 24px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: "rgba(143, 26, 37, 0.1)",
                    color: "#8f1a25",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pencil size={16} />
                </div>
                <h3
                  id="modal-edit-profile-title"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                  }}
                >
                  Edit Profil Saya
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !profileSubmitting && setIsEditProfileOpen(false)}
                disabled={profileSubmitting}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #94a3b8)",
                  cursor: profileSubmitting ? "not-allowed" : "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {profileError && (
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
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text, #334155)",
                    marginBottom: 6,
                  }}
                >
                  Nama Lengkap <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileNama}
                  onChange={(e) => setProfileNama(e.target.value)}
                  placeholder="Nama Lengkap"
                  disabled={profileSubmitting}
                  style={{
                    width: "100%",
                    height: 38,
                    fontSize: 13,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border, #cbd5e1)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text, #334155)",
                    marginBottom: 6,
                  }}
                >
                  Username <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  placeholder="Username untuk login"
                  disabled={profileSubmitting}
                  style={{
                    width: "100%",
                    height: 38,
                    fontSize: 13,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border, #cbd5e1)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text, #334155)",
                    marginBottom: 6,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="Alamat email aktif"
                  disabled={profileSubmitting}
                  style={{
                    width: "100%",
                    height: 38,
                    fontSize: 13,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border, #cbd5e1)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text, #334155)",
                    marginBottom: 6,
                  }}
                >
                  Peran Akun (Role)
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-main, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "var(--text-muted, #64748b)",
                  }}
                >
                  {user?.role === "admin"
                    ? "Administrator (Akses Penuh)"
                    : user?.role === "approver"
                    ? "Approver (Penyetuju)"
                    : "Staff Operasional GA"}
                </div>
                <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "var(--text-muted, #64748b)" }}>
                  Peran akun hanya dapat diubah oleh Administrator sistem.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => !profileSubmitting && setIsEditProfileOpen(false)}
                  disabled={profileSubmitting}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "var(--bg-main, #f1f5f9)",
                    color: "var(--text, #334155)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: profileSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: profileSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {profileSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card 2: Keamanan Akun (Ganti Password) */}
      <section
        style={{
          backgroundColor: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 12,
          padding: "28px 32px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
        aria-label="Keamanan Akun"
      >
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border, #f1f5f9)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <KeyRound size={19} color="#8f1a25" />
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text, #0f172a)",
              }}
            >
              Keamanan Akun
            </h3>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-muted, #64748b)",
            }}
          >
            Perbarui password untuk menjaga keamanan akun Anda.
          </p>
        </div>

        {/* Global Form Error Alert */}
        {formError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 20,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Field 1: Password Saat Ini */}
          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="current-password"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text, #334155)",
                marginBottom: 6,
              }}
            >
              Password Saat Ini
            </label>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <Lock size={17} />
              </div>
              <input
                id="current-password"
                name="currentPassword"
                type={showCurrentPass ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                  if (formError) setFormError(null);
                }}
                placeholder="Masukkan password saat ini"
                autoComplete="current-password"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  height: 44,
                  fontSize: 14,
                  backgroundColor: "var(--input-bg, #ffffff)",
                  color: "var(--text, #0f172a)",
                  border: fieldErrors.currentPassword
                    ? "1px solid #dc2626"
                    : "1px solid var(--border, #cbd5e1)",
                  borderRadius: 8,
                  padding: "0 44px 0 42px",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 140ms ease, box-shadow 140ms ease",
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass((prev) => !prev)}
                aria-label={showCurrentPass ? "Sembunyikan password saat ini" : "Tampilkan password saat ini"}
                title={showCurrentPass ? "Sembunyikan" : "Tampilkan"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
              >
                {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.currentPassword && (
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: 12.5,
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <AlertCircle size={14} />
                <span>{fieldErrors.currentPassword}</span>
              </p>
            )}
          </div>

          {/* Field 2: Password Baru */}
          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="new-password"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text, #334155)",
                marginBottom: 6,
              }}
            >
              Password Baru
            </label>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <Lock size={17} />
              </div>
              <input
                id="new-password"
                name="newPassword"
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                  if (formError) setFormError(null);
                }}
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  height: 44,
                  fontSize: 14,
                  backgroundColor: "var(--input-bg, #ffffff)",
                  color: "var(--text, #0f172a)",
                  border: fieldErrors.newPassword
                    ? "1px solid #dc2626"
                    : "1px solid var(--border, #cbd5e1)",
                  borderRadius: 8,
                  padding: "0 44px 0 42px",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 140ms ease, box-shadow 140ms ease",
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPass((prev) => !prev)}
                aria-label={showNewPass ? "Sembunyikan password baru" : "Tampilkan password baru"}
                title={showNewPass ? "Sembunyikan" : "Tampilkan"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
              >
                {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.newPassword ? (
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: 12.5,
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <AlertCircle size={14} />
                <span>{fieldErrors.newPassword}</span>
              </p>
            ) : (
              <span
                style={{
                  display: "block",
                  margin: "6px 0 0 0",
                  fontSize: 12,
                  color: "var(--text-muted, #64748b)",
                }}
              >
                Kebijakan keamanan: minimal 12 karakter dan tidak sama dengan password lama.
              </span>
            )}
          </div>

          {/* Field 3: Konfirmasi Password Baru */}
          <div style={{ marginBottom: 28 }}>
            <label
              htmlFor="confirm-password"
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text, #334155)",
                marginBottom: 6,
              }}
            >
              Konfirmasi Password Baru
            </label>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <Lock size={17} />
              </div>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                  if (formError) setFormError(null);
                }}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  height: 44,
                  fontSize: 14,
                  backgroundColor: "var(--input-bg, #ffffff)",
                  color: "var(--text, #0f172a)",
                  border: fieldErrors.confirmPassword
                    ? "1px solid #dc2626"
                    : "1px solid var(--border, #cbd5e1)",
                  borderRadius: 8,
                  padding: "0 44px 0 42px",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 140ms ease, box-shadow 140ms ease",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass((prev) => !prev)}
                aria-label={showConfirmPass ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                title={showConfirmPass ? "Sembunyikan" : "Tampilkan"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
              >
                {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: 12.5,
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <AlertCircle size={14} />
                <span>{fieldErrors.confirmPassword}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 8,
            }}
          >
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 42,
                padding: "0 22px",
                backgroundColor: "#8f1a25",
                color: "#ffffff",
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.75 : 1,
                transition: "background 140ms ease",
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      border: "2px solid #ffffff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Password</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetForm}
              disabled={isSubmitting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 42,
                padding: "0 18px",
                backgroundColor: "transparent",
                color: "var(--text-muted, #64748b)",
                fontSize: 13.5,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border, #cbd5e1)",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "background 140ms ease, color 140ms ease",
              }}
            >
              <RotateCcw size={15} />
              <span>Reset Form</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
