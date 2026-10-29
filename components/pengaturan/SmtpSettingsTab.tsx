"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Server,
  ShieldCheck,
  KeyRound,
  Globe,
  CircleCheck,
  TriangleAlert,
  Loader2,
  Eye,
  EyeOff,
  Send,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getSmtpConfigApi,
  updateSmtpConfigApi,
  testSmtpApi,
  SmtpConfig,
  SmtpConfigUpdatePayload,
} from "@/lib/api";

type SecurityMode = "none" | "tls" | "ssl";

interface FormSnapshot {
  smtpHost: string;
  smtpPort: number | string;
  securityMode: SecurityMode;
  smtpUsername: string;
  emailSender: string;
  senderName: string;
  appUrl: string;
  isActive: boolean;
}

export default function SmtpSettingsTab() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Form states
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | string>(587);
  const [securityMode, setSecurityMode] = useState<SecurityMode>("tls");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [emailSender, setEmailSender] = useState("");
  const [senderName, setSenderName] = useState("PT JAI Catering Management");
  const [appUrl, setAppUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByNama, setUpdatedByNama] = useState<string | null>(null);

  // Baseline snapshot for tracking dirty state
  const baseSnapshotRef = useRef<FormSnapshot | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    smtpHost?: string;
    smtpPort?: string;
    emailSender?: string;
    appUrl?: string;
  }>({});

  // Inline test result banner state
  const [testResult, setTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  useEffect(() => {
    loadSmtpConfig();
  }, []);

  const loadSmtpConfig = async () => {
    setIsLoading(true);
    setTestResult({ status: "idle", message: "" });
    try {
      const cfg = await getSmtpConfigApi();
      const host = cfg.smtp_host || "";
      const port = cfg.smtp_port ?? 587;
      let sec: SecurityMode = "none";
      if (cfg.use_ssl) sec = "ssl";
      else if (cfg.use_tls) sec = "tls";

      const userStr = cfg.smtp_username || "";
      const sender = cfg.email_sender || "";
      const name = cfg.sender_name || "PT JAI Catering Management";
      const url = cfg.app_url || "";
      const active = cfg.is_active ?? true;

      setSmtpHost(host);
      setSmtpPort(port);
      setSecurityMode(sec);
      setSmtpUsername(userStr);
      setSmtpPassword("");
      setPasswordConfigured(cfg.smtp_password_configured);
      setClearPassword(false);
      setEmailSender(sender);
      setSenderName(name);
      setAppUrl(url);
      setIsActive(active);
      setUpdatedAt(cfg.updated_at || null);
      setUpdatedByNama(cfg.updated_by_nama || null);

      baseSnapshotRef.current = {
        smtpHost: host,
        smtpPort: port,
        securityMode: sec,
        smtpUsername: userStr,
        emailSender: sender,
        senderName: name,
        appUrl: url,
        isActive: active,
      };
    } catch (err: any) {
      showError(err?.message || "Gagal memuat konfigurasi SMTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // Determine dirty state against baseline snapshot
  const isDirty = (() => {
    if (!baseSnapshotRef.current) return false;
    const base = baseSnapshotRef.current;
    if (smtpHost !== base.smtpHost) return true;
    if (String(smtpPort) !== String(base.smtpPort)) return true;
    if (securityMode !== base.securityMode) return true;
    if (smtpUsername !== base.smtpUsername) return true;
    if (smtpPassword.length > 0) return true;
    if (clearPassword) return true;
    if (emailSender !== base.emailSender) return true;
    if (senderName !== base.senderName) return true;
    if (appUrl !== base.appUrl) return true;
    if (isActive !== base.isActive) return true;
    return false;
  })();

  const handleSecurityModeChange = (mode: SecurityMode) => {
    setSecurityMode(mode);
    const currentPortNum = Number(smtpPort);
    // Suggest standard ports only if current port is empty or matches standard defaults
    // Preserve custom internal ports like 2525, 8025, 5870
    if (!smtpPort || currentPortNum === 25 || currentPortNum === 587 || currentPortNum === 465) {
      if (mode === "none") setSmtpPort(25);
      else if (mode === "tls") setSmtpPort(587);
      else if (mode === "ssl") setSmtpPort(465);
    }
    if (fieldErrors.smtpPort) {
      setFieldErrors((prev) => ({ ...prev, smtpPort: undefined }));
    }
  };

  const handlePortChange = (val: string) => {
    setSmtpPort(val);
    const num = Number(val);
    if (num === 25) setSecurityMode("none");
    else if (num === 587) setSecurityMode("tls");
    else if (num === 465) setSecurityMode("ssl");
    if (fieldErrors.smtpPort) {
      setFieldErrors((prev) => ({ ...prev, smtpPort: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: {
      smtpHost?: string;
      smtpPort?: string;
      emailSender?: string;
      appUrl?: string;
    } = {};

    if (!smtpHost.trim()) {
      errors.smtpHost = "Host wajib diisi.";
    }

    const portNum = Number(smtpPort);
    if (!smtpPort || isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.smtpPort = "Masukkan port antara 1 dan 65535.";
    }

    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailSender.trim()) {
      errors.emailSender = "Email pengirim wajib diisi.";
    } else if (!emailPattern.test(emailSender.trim())) {
      errors.emailSender = "Masukkan alamat email yang valid.";
    }

    if (appUrl.trim()) {
      const cleanUrl = appUrl.trim();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        errors.appUrl = "App URL harus diawali dengan http:// atau https://";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      showError("Periksa kolom yang ditandai merah.");
      const errEl = document.querySelector(".smtp-field-group.has-error");
      if (errEl) {
        errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSaving(true);
    setTestResult({ status: "idle", message: "" });

    const payload: SmtpConfigUpdatePayload = {
      smtp_host: smtpHost.trim(),
      smtp_port: Number(smtpPort),
      smtp_username: smtpUsername.trim() || null,
      smtp_password: smtpPassword.trim() ? smtpPassword.trim() : null,
      clear_password: clearPassword,
      email_sender: emailSender.trim(),
      sender_name: senderName.trim() || null,
      use_tls: securityMode === "tls",
      use_ssl: securityMode === "ssl",
      app_url: appUrl.trim() || null,
      is_active: isActive,
    };

    try {
      const updated = await updateSmtpConfigApi(payload);
      setPasswordConfigured(updated.smtp_password_configured);
      setSmtpPassword("");
      setClearPassword(false);
      setUpdatedAt(updated.updated_at || null);
      setUpdatedByNama(updated.updated_by_nama || null);

      baseSnapshotRef.current = {
        smtpHost: updated.smtp_host,
        smtpPort: updated.smtp_port,
        securityMode: updated.use_ssl ? "ssl" : updated.use_tls ? "tls" : "none",
        smtpUsername: updated.smtp_username || "",
        emailSender: updated.email_sender,
        senderName: updated.sender_name || "PT JAI Catering Management",
        appUrl: updated.app_url || "",
        isActive: updated.is_active,
      };

      showSuccess("Konfigurasi SMTP berhasil disimpan.", "Tersimpan");
    } catch (err: any) {
      showError(err?.message || "Gagal menyimpan konfigurasi SMTP.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      showError("Lengkapi data server sebelum tes.");
      const errEl = document.querySelector(".smtp-field-group.has-error");
      if (errEl) {
        errEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsTesting(true);
    setTestResult({ status: "idle", message: "" });

    try {
      const result = await testSmtpApi({
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_username: smtpUsername.trim() || null,
        smtp_password: smtpPassword.trim() || null,
        clear_password: clearPassword,
        use_tls: securityMode === "tls",
        use_ssl: securityMode === "ssl",
        email_sender: emailSender.trim(),
        sender_name: senderName.trim() || null,
        test_recipient_email: user?.email || emailSender.trim() || null,
      });

      if (result.success) {
        const successMsg =
          result.message && result.message.trim()
            ? result.message
            : `Koneksi ke ${smtpHost.trim()}:${smtpPort} berhasil.`;
        setTestResult({
          status: "success",
          message: successMsg,
        });
        showSuccess(successMsg, "Uji Berhasil");
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        const errorMsg = result.message || "Koneksi SMTP gagal.";
        setTestResult({
          status: "error",
          message: errorMsg,
        });
        showError(errorMsg);
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || "Terjadi kesalahan saat menguji koneksi SMTP.";
      setTestResult({
        status: "error",
        message: errMsg,
      });
      showError(errMsg);
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const formatTimestamp = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const day = d.getDate();
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${year}, ${hours}.${minutes}`;
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 0",
          color: "var(--text-muted, #64748b)",
          fontSize: 13,
          gap: 10,
        }}
        id="smtp-loading"
      >
        <Loader2 size={18} className="animate-spin" />
        <span>Memuat konfigurasi SMTP...</span>
      </div>
    );
  }

  const formattedStamp = formatTimestamp(updatedAt);

  return (
    <div className="smtp-page-container" ref={containerRef} id="smtp-settings-container">
      {/* Page Header */}
      <div className="smtp-page-head">
        <div>
          <h1 className="smtp-page-title">SMTP</h1>
          <p className="smtp-page-subtitle">
            Atur email pengirim untuk notifikasi dan proses approval.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="smtp-stamp-badge" id="smtp-metadata-stamp">
            {formattedStamp ? (
              <>
                Terakhir diperbarui <b>{formattedStamp}</b>
                {updatedByNama ? ` oleh ${updatedByNama}` : ""}
              </>
            ) : (
              <span>Belum pernah dikonfigurasi</span>
            )}
          </div>
          <button
            type="button"
            className="smtp-action-btn primary"
            id="header-save-btn"
            onClick={() => handleSave()}
            disabled={isSaving || isTesting}
            style={{ height: 38, padding: "0 16px", fontSize: 13 }}
            title="Simpan konfigurasi SMTP ke sistem"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </div>

      {/* Result Banner above Form */}
      {testResult.status !== "idle" && (
        <div
          className={`smtp-result-banner ${
            testResult.status === "success" ? "success" : "error"
          }`}
          id="smtp-test-result-banner"
          role="alert"
        >
          {testResult.status === "success" ? (
            <CircleCheck size={18} style={{ flexShrink: 0 }} />
          ) : (
            <TriangleAlert size={18} style={{ flexShrink: 0 }} />
          )}
          <span id="smtp-test-result-message">
            {testResult.status === "error" && !testResult.message.startsWith("Koneksi SMTP gagal")
              ? `Koneksi SMTP gagal. ${testResult.message}`
              : testResult.message}
          </span>
        </div>
      )}

      {/* Single Main Form Card */}
      <form
        className="smtp-form-card"
        id="smtp-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty && !isSaving && !isTesting) {
            handleSave();
          }
        }}
        noValidate
      >
        {/* 1. SERVER SECTION */}
        <section className="smtp-form-section" id="smtp-section-server">
          <div className="smtp-section-header">
            <h3>
              <Server size={19} />
              Server
            </h3>
            <p className="smtp-section-desc">
              Alamat dan port server email yang dipakai untuk mengirim.
            </p>
          </div>
          <div className="smtp-fields-grid">
            {/* SMTP Host */}
            <div
              className={`smtp-field-group ${fieldErrors.smtpHost ? "has-error" : ""}`}
              id="f-host"
            >
              <label htmlFor="host" className="smtp-field-label">
                <span>
                  SMTP host <span className="smtp-required-star">*</span>
                </span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="host"
                  name="host"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value);
                    if (fieldErrors.smtpHost) {
                      setFieldErrors((prev) => ({ ...prev, smtpHost: undefined }));
                    }
                  }}
                  placeholder="mail.company.local"
                  autoComplete="off"
                  disabled={isSaving || isTesting}
                />
              </div>
              {fieldErrors.smtpHost && (
                <span className="smtp-field-error-msg">{fieldErrors.smtpHost}</span>
              )}
            </div>

            {/* SMTP Port */}
            <div
              className={`smtp-field-group ${fieldErrors.smtpPort ? "has-error" : ""}`}
              id="f-port"
            >
              <label htmlFor="port" className="smtp-field-label">
                <span>
                  SMTP port <span className="smtp-required-star">*</span>
                </span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="port"
                  name="port"
                  type="number"
                  min={1}
                  max={65535}
                  value={smtpPort}
                  onChange={(e) => handlePortChange(e.target.value)}
                  placeholder="587"
                  disabled={isSaving || isTesting}
                />
              </div>
              {fieldErrors.smtpPort ? (
                <span className="smtp-field-error-msg">{fieldErrors.smtpPort}</span>
              ) : (
                <span className="smtp-field-hint">Port umum: 25, 587, 465</span>
              )}
            </div>
          </div>
        </section>

        {/* 2. KEAMANAN KONEKSI SECTION */}
        <section className="smtp-form-section" id="smtp-section-security">
          <div className="smtp-section-header">
            <h3>
              <ShieldCheck size={19} />
              Keamanan koneksi
            </h3>
            <p className="smtp-section-desc">
              TLS dan SSL tidak bisa aktif bersamaan. Port akan menyesuaikan saat Anda memilih.
            </p>
          </div>
          <div
            className="smtp-security-options"
            role="radiogroup"
            aria-label="Keamanan koneksi"
          >
            {/* Tanpa enkripsi */}
            <label
              className={`smtp-security-card ${securityMode === "none" ? "selected" : ""}`}
              onClick={() => handleSecurityModeChange("none")}
            >
              <input
                type="radio"
                name="sec"
                value="none"
                checked={securityMode === "none"}
                onChange={() => handleSecurityModeChange("none")}
                disabled={isSaving || isTesting}
              />
              <i className="radio-indicator" />
              <b>Tanpa enkripsi</b>
              <span>Plaintext, port 25</span>
            </label>

            {/* TLS / STARTTLS */}
            <label
              className={`smtp-security-card ${securityMode === "tls" ? "selected" : ""}`}
              onClick={() => handleSecurityModeChange("tls")}
            >
              <input
                type="radio"
                name="sec"
                value="tls"
                checked={securityMode === "tls"}
                onChange={() => handleSecurityModeChange("tls")}
                disabled={isSaving || isTesting}
              />
              <i className="radio-indicator" />
              <b>TLS / STARTTLS</b>
              <span>Standar industri, port 587</span>
            </label>

            {/* SSL */}
            <label
              className={`smtp-security-card ${securityMode === "ssl" ? "selected" : ""}`}
              onClick={() => handleSecurityModeChange("ssl")}
            >
              <input
                type="radio"
                name="sec"
                value="ssl"
                checked={securityMode === "ssl"}
                onChange={() => handleSecurityModeChange("ssl")}
                disabled={isSaving || isTesting}
              />
              <i className="radio-indicator" />
              <b>SSL</b>
              <span>Enkripsi langsung, port 465</span>
            </label>
          </div>
        </section>

        {/* 3. AUTENTIKASI SECTION */}
        <section className="smtp-form-section" id="smtp-section-auth">
          <div className="smtp-section-header">
            <h3>
              <KeyRound size={19} />
              Autentikasi
            </h3>
            <p className="smtp-section-desc">
              Kosongkan username jika server internal tidak memerlukan login.
            </p>
          </div>
          <div className="smtp-fields-grid">
            {/* Username */}
            <div className="smtp-field-group">
              <label htmlFor="user" className="smtp-field-label">
                Username
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="user"
                  name="user"
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="smtp_user"
                  autoComplete="off"
                  disabled={isSaving || isTesting}
                />
              </div>
            </div>

            {/* Password */}
            <div className="smtp-field-group">
              <label htmlFor="pass" className="smtp-field-label">
                <span>Password</span>
                {passwordConfigured && !clearPassword && (
                  <span className="smtp-stored-badge" id="saved">
                    <CheckCircle2 size={13} />
                    <span>Tersimpan</span>
                  </span>
                )}
              </label>
              <div className="smtp-input-wrapper password-input">
                <input
                  id="pass"
                  name="pass"
                  type={showPassword ? "text" : "password"}
                  value={smtpPassword}
                  onChange={(e) => {
                    setSmtpPassword(e.target.value);
                    if (clearPassword) setClearPassword(false);
                  }}
                  placeholder={
                    passwordConfigured && !clearPassword
                      ? "Kosongkan untuk pakai yang tersimpan"
                      : "Masukkan password baru"
                  }
                  autoComplete="new-password"
                  disabled={isSaving || isTesting || clearPassword}
                />
                <button
                  type="button"
                  className="smtp-password-toggle-btn"
                  id="eye"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  disabled={clearPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Clear Stored Password Toggle */}
            <div className="smtp-field-group full-width">
              <label
                className={`smtp-toggle-row is-danger ${clearPassword ? "checked" : ""}`}
                htmlFor="clear"
              >
                <input
                  id="clear"
                  name="clear"
                  type="checkbox"
                  checked={clearPassword}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setClearPassword(checked);
                    if (checked) {
                      setSmtpPassword("");
                    }
                  }}
                  disabled={isSaving || isTesting}
                />
                <span className="smtp-switch" />
                <span>
                  <b>Hapus password tersimpan</b>
                  <small>Password lama akan dihapus saat Anda menyimpan.</small>
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* 4. EMAIL DAN APLIKASI SECTION */}
        <section className="smtp-form-section" id="smtp-section-email-app">
          <div className="smtp-section-header">
            <h3>
              <Globe size={19} />
              Email dan aplikasi
            </h3>
            <p className="smtp-section-desc">
              Identitas pengirim dan tautan yang muncul di badan email.
            </p>
          </div>
          <div className="smtp-fields-grid">
            {/* Email Pengirim */}
            <div
              className={`smtp-field-group ${fieldErrors.emailSender ? "has-error" : ""}`}
              id="f-from"
            >
              <label htmlFor="from" className="smtp-field-label">
                <span>
                  Email pengirim <span className="smtp-required-star">*</span>
                </span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="from"
                  name="from"
                  type="email"
                  value={emailSender}
                  onChange={(e) => {
                    setEmailSender(e.target.value);
                    if (fieldErrors.emailSender) {
                      setFieldErrors((prev) => ({ ...prev, emailSender: undefined }));
                    }
                  }}
                  placeholder="catering-ir@jai.co.id"
                  disabled={isSaving || isTesting}
                />
              </div>
              {fieldErrors.emailSender ? (
                <span className="smtp-field-error-msg">{fieldErrors.emailSender}</span>
              ) : (
                <span className="smtp-field-hint">
                  Satu alamat pengirim untuk semua alur persetujuan.
                </span>
              )}
            </div>

            {/* Nama Pengirim */}
            <div className="smtp-field-group">
              <label htmlFor="name" className="smtp-field-label">
                Nama pengirim
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="PT JAI Catering Management"
                  disabled={isSaving || isTesting}
                />
              </div>
              <span className="smtp-field-hint">Tampil di kotak masuk penerima.</span>
            </div>

            {/* App URL */}
            <div
              className={`smtp-field-group ${fieldErrors.appUrl ? "has-error" : ""}`}
              id="f-url"
            >
              <label htmlFor="url" className="smtp-field-label">
                App URL
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="url"
                  name="url"
                  type="url"
                  value={appUrl}
                  onChange={(e) => {
                    setAppUrl(e.target.value);
                    if (fieldErrors.appUrl) {
                      setFieldErrors((prev) => ({ ...prev, appUrl: undefined }));
                    }
                  }}
                  placeholder="http://localhost:3001/catering-ir/public"
                  disabled={isSaving || isTesting}
                />
              </div>
              {fieldErrors.appUrl ? (
                <span className="smtp-field-error-msg">{fieldErrors.appUrl}</span>
              ) : (
                <span className="smtp-field-hint">
                  Dipakai untuk tautan verifikasi dan review di email.
                </span>
              )}
              {appUrl && (appUrl.toLowerCase().includes("localhost") || appUrl.includes("127.0.0.1")) && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    lineHeight: 1.45,
                  }}
                  id="app-url-localhost-warning"
                >
                  <TriangleAlert
                    size={16}
                    style={{ flexShrink: 0, marginTop: 1, color: "#d97706" }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Peringatan App URL (Perlu Konfigurasi):</strong> Alamat saat ini menggunakan{" "}
                    <code>{appUrl}</code>. Approver dari komputer lain tidak dapat mengakses tautan email ini sampai App URL disesuaikan dengan alamat IP intranet atau domain server yang dapat dijangkau di jaringan perusahaan.
                  </span>
                </div>
              )}
            </div>

            {/* Status Aktif */}
            <div className="smtp-field-group">
              <span className="smtp-label-text">Status</span>
              <label
                className={`smtp-toggle-row is-good ${isActive ? "checked" : ""}`}
                htmlFor="active"
              >
                <input
                  id="active"
                  name="active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isSaving || isTesting}
                />
                <span className="smtp-switch" />
                <span>
                  <b id="actT">{isActive ? "SMTP aktif" : "SMTP nonaktif"}</b>
                  <small id="actS">
                    {isActive
                      ? "Notifikasi email dikirim seperti biasa."
                      : "Pengiriman email notifikasi dihentikan sementara."}
                  </small>
                </span>
              </label>
            </div>
          </div>
        </section>
      </form>

      {/* Sticky Bottom Action Bar */}
      <div className="smtp-sticky-bar" id="smtp-action-bar">
        <div className="smtp-bar-content">
          {/* Test Connection Button */}
          <button
            type="button"
            className="smtp-action-btn"
            id="test"
            onClick={handleTestConnection}
            disabled={isSaving || isTesting}
          >
            {isTesting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} color="#8f1a25" />
            )}
            <span id="testT">{isTesting ? "Menguji..." : "Tes koneksi"}</span>
          </button>

          {/* Dirty state indicator */}
          <span
            className="smtp-dirty-indicator"
            id="dirty"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: isDirty ? "var(--amber, #b45309)" : "var(--text-muted, #64748b)",
            }}
          >
            {isDirty ? "Ada perubahan yang belum disimpan" : "Konfigurasi siap"}
          </span>

          {/* Save Button */}
          <button
            type="button"
            className="smtp-action-btn primary"
            id="save"
            onClick={() => handleSave()}
            disabled={isSaving || isTesting}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span id="saveT">{isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
