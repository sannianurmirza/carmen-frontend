"use client";

import React, { useState, useRef } from "react";
import {
  Server,
  ShieldCheck,
  KeyRound,
  Mail,
  CircleCheck,
  TriangleAlert,
  Loader2,
  Eye,
  EyeOff,
  Send,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from "lucide-react";
import {
  testSmtpTestingConnectionApi,
  sendSmtpTestingEmailApi,
  SmtpTestingPayload,
} from "@/lib/api";

// ======================================================================
// TEMPORARY SMTP TESTING PAGE
// SAFE TO REMOVE AFTER SMTP PRODUCTION VALIDATION
// ======================================================================

type SecurityMode = "none" | "tls" | "ssl";
type PresetType = "gmail" | "outlook" | "custom";

export default function SmtpTestingTab() {
  const [selectedPreset, setSelectedPreset] = useState<PresetType>("custom");

  // Form states - pure in-memory, cleared on reload
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number | string>(587);
  const [securityMode, setSecurityMode] = useState<SecurityMode>("tls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailSender, setEmailSender] = useState("");
  const [senderName, setSenderName] = useState("CARMEN Tester");
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [subject, setSubject] = useState("CARMEN SMTP Test");

  // Action states
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Accordion state
  const [isGmailHelpOpen, setIsGmailHelpOpen] = useState(false);

  // Test result banner state
  const [resultBanner, setResultBanner] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    smtpHost?: string;
    smtpPort?: string;
    emailSender?: string;
    testRecipientEmail?: string;
  }>({});

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Apply preset
  const handleSelectPreset = (preset: PresetType) => {
    setSelectedPreset(preset);
    if (preset === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setSecurityMode("tls");
    } else if (preset === "outlook") {
      setSmtpHost("smtp-mail.outlook.com");
      setSmtpPort(587);
      setSecurityMode("tls");
    }
    // "custom" leaves current values intact for manual tweaking
  };

  // Security mode change with intelligent port suggestion
  const handleSecurityModeChange = (newMode: SecurityMode) => {
    setSecurityMode(newMode);

    const currentPortStr = String(smtpPort).trim();
    const isStandardDefault =
      currentPortStr === "" ||
      currentPortStr === "25" ||
      currentPortStr === "587" ||
      currentPortStr === "465";

    if (isStandardDefault) {
      if (newMode === "none") setSmtpPort(25);
      else if (newMode === "tls") setSmtpPort(587);
      else if (newMode === "ssl") setSmtpPort(465);
    }
  };

  // Validate fields for connection test
  const validateForConnection = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!smtpHost.trim()) {
      errors.smtpHost = "SMTP Host wajib diisi.";
    }
    const numPort = Number(smtpPort);
    if (!smtpPort || isNaN(numPort) || numPort < 1 || numPort > 65535) {
      errors.smtpPort = "Port harus angka 1 - 65535.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate fields for email send
  const validateForSend = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!smtpHost.trim()) {
      errors.smtpHost = "SMTP Host wajib diisi.";
    }
    const numPort = Number(smtpPort);
    if (!smtpPort || isNaN(numPort) || numPort < 1 || numPort > 65535) {
      errors.smtpPort = "Port harus angka 1 - 65535.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailSender.trim() || !emailRegex.test(emailSender.trim())) {
      errors.emailSender = "Email pengirim wajib diisi dengan format valid.";
    }
    if (!testRecipientEmail.trim() || !emailRegex.test(testRecipientEmail.trim())) {
      errors.testRecipientEmail = "Email tujuan uji wajib diisi dengan format valid.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle connection test
  const handleTestConnection = async () => {
    if (!validateForConnection()) return;

    setIsTestingConnection(true);
    setResultBanner({ status: "idle", message: "" });

    try {
      const payload: SmtpTestingPayload = {
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        security_mode: securityMode,
        username: username.trim() || null,
        password: password ? password : null,
      };

      const res = await testSmtpTestingConnectionApi(payload);
      if (res.success) {
        setResultBanner({
          status: "success",
          message: res.message || "Koneksi berhasil.",
        });
      } else {
        setResultBanner({
          status: "error",
          message: res.message || "Koneksi gagal. Periksa konfigurasi host dan port.",
        });
      }
    } catch (err: any) {
      setResultBanner({
        status: "error",
        message: err.message || "Gagal menghubungi server untuk pengujian koneksi.",
      });
    } finally {
      setIsTestingConnection(false);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Handle sending real test email
  const handleSendTestEmail = async () => {
    if (!validateForSend()) return;

    setIsSendingEmail(true);
    setResultBanner({ status: "idle", message: "" });

    try {
      const payload: SmtpTestingPayload = {
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        security_mode: securityMode,
        username: username.trim() || null,
        password: password ? password : null,
        email_sender: emailSender.trim(),
        sender_name: senderName.trim() || "CARMEN Tester",
        test_recipient_email: testRecipientEmail.trim(),
        subject: subject.trim() || "CARMEN SMTP Test",
      };

      const res = await sendSmtpTestingEmailApi(payload);
      if (res.success) {
        setResultBanner({
          status: "success",
          message: res.message || `Email uji berhasil dikirim ke: ${testRecipientEmail.trim()}`,
        });
      } else {
        setResultBanner({
          status: "error",
          message: res.message || "Email uji gagal dikirim.",
        });
      }
    } catch (err: any) {
      setResultBanner({
        status: "error",
        message: err.message || "Gagal mengirim email uji.",
      });
    } finally {
      setIsSendingEmail(false);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isActionDisabled = isTestingConnection || isSendingEmail;
  const isSendEmailDisabled =
    isActionDisabled ||
    !smtpHost.trim() ||
    !smtpPort ||
    !emailSender.trim() ||
    !testRecipientEmail.trim();

  return (
    <div className="smtp-page-container" ref={containerRef} id="smtp-testing-container">
      {/* Page Header */}
      <div className="smtp-page-head">
        <div className="smtp-head-text">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="smtp-page-title" style={{ margin: 0 }}>
              SMTP Testing
            </h1>
            <span className="smtp-testing-badge" id="smtp-mode-testing-badge">
              <FlaskConical size={13} strokeWidth={2.5} />
              MODE TESTING
            </span>
          </div>
          <p className="smtp-page-subtitle">
            Uji koneksi email sementara tanpa mengubah konfigurasi SMTP utama.
          </p>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="smtp-testing-notice-banner" id="smtp-testing-notice">
        <Info size={18} style={{ flexShrink: 0, marginTop: 1, color: "#b45309" }} />
        <div>
          <strong>Halaman Sementara untuk Pengujian SMTP:</strong> Konfigurasi di halaman ini tidak
          mengubah SMTP utama aplikasi dan tidak disimpan ke database. Kredensial hanya tersimpan di
          memori browser selama sesi ini.
        </div>
      </div>

      {/* Test / Result Banner */}
      {resultBanner.status !== "idle" && (
        <div
          className={`smtp-result-banner ${resultBanner.status}`}
          id="smtp-testing-result-banner"
          role="alert"
        >
          {resultBanner.status === "success" ? (
            <CircleCheck size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
          ) : (
            <TriangleAlert size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
          )}
          <span className="banner-text">{resultBanner.message}</span>
        </div>
      )}

      {/* Main Unified Form Card */}
      <div className="smtp-form-card" id="smtp-testing-form-card">
        {/* SECTION 1: SERVER */}
        <section className="smtp-form-section" id="smtp-testing-section-server">
          <div className="smtp-section-header">
            <h3>
              <Server size={18} strokeWidth={2.2} />
              Server
            </h3>
            <p className="smtp-section-desc">Host dan port server email pengujian.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Quick Preset Buttons */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-muted, #64748b)",
                  marginBottom: 6,
                }}
              >
                Preset Cepat (Opsional):
              </label>
              <div className="smtp-preset-row">
                <button
                  type="button"
                  className={`smtp-preset-btn ${selectedPreset === "gmail" ? "active" : ""}`}
                  onClick={() => handleSelectPreset("gmail")}
                  id="preset-gmail-btn"
                >
                  Gmail
                </button>
                <button
                  type="button"
                  className={`smtp-preset-btn ${selectedPreset === "outlook" ? "active" : ""}`}
                  onClick={() => handleSelectPreset("outlook")}
                  id="preset-outlook-btn"
                >
                  Outlook.com
                </button>
                <button
                  type="button"
                  className={`smtp-preset-btn ${selectedPreset === "custom" ? "active" : ""}`}
                  onClick={() => handleSelectPreset("custom")}
                  id="preset-custom-btn"
                >
                  Kustom
                </button>
              </div>

              {selectedPreset === "gmail" && (
                <div className="smtp-preset-note" id="preset-gmail-note">
                  ℹ️ <strong>Gmail testing:</strong> umumnya menggunakan App Password dengan
                  Verifikasi 2 Langkah aktif.
                </div>
              )}
              {selectedPreset === "outlook" && (
                <div className="smtp-preset-note" id="preset-outlook-note">
                  ℹ️ <strong>Outlook.com:</strong> mungkin memerlukan Modern Authentication / OAuth2
                  tergantung akun. Pengujian basic SMTP username/password mungkin tidak berlaku
                  untuk semua akun.
                </div>
              )}
            </div>

            {/* Inputs Grid */}
            <div className="smtp-fields-grid">
              <div className={`smtp-field-group ${fieldErrors.smtpHost ? "has-error" : ""}`}>
                <label className="smtp-field-label" htmlFor="testing-host">
                  <span>
                    SMTP Host <span className="smtp-required-star">*</span>
                  </span>
                </label>
                <div className="smtp-input-wrapper">
                  <input
                    id="testing-host"
                    type="text"
                    value={smtpHost}
                    onChange={(e) => {
                      setSmtpHost(e.target.value);
                      if (fieldErrors.smtpHost) {
                        setFieldErrors((prev) => ({ ...prev, smtpHost: undefined }));
                      }
                    }}
                    placeholder="e.g. smtp.gmail.com"
                  />
                </div>
                {fieldErrors.smtpHost && (
                  <span className="smtp-field-error-msg">{fieldErrors.smtpHost}</span>
                )}
              </div>

              <div className={`smtp-field-group ${fieldErrors.smtpPort ? "has-error" : ""}`}>
                <label className="smtp-field-label" htmlFor="testing-port">
                  <span>
                    SMTP Port <span className="smtp-required-star">*</span>
                  </span>
                </label>
                <div className="smtp-input-wrapper">
                  <input
                    id="testing-port"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => {
                      setSmtpPort(e.target.value);
                      if (fieldErrors.smtpPort) {
                        setFieldErrors((prev) => ({ ...prev, smtpPort: undefined }));
                      }
                    }}
                    placeholder="587"
                  />
                </div>
                <span className="smtp-field-hint">Port umum: 25, 587, 465</span>
                {fieldErrors.smtpPort && (
                  <span className="smtp-field-error-msg">{fieldErrors.smtpPort}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: KEAMANAN KONEKSI */}
        <section className="smtp-form-section" id="smtp-testing-section-security">
          <div className="smtp-section-header">
            <h3>
              <ShieldCheck size={18} strokeWidth={2.2} />
              Keamanan koneksi
            </h3>
            <p className="smtp-section-desc">Protokol enkripsi jabat tangan jaringan.</p>
          </div>

          <div className="smtp-security-options">
            <label
              className={`smtp-security-card ${securityMode === "none" ? "selected" : ""}`}
              id="testing-sec-card-none"
            >
              <input
                type="radio"
                name="testing-security-mode"
                value="none"
                checked={securityMode === "none"}
                onChange={() => handleSecurityModeChange("none")}
              />
              <span className="radio-indicator" />
              <b>Tanpa enkripsi</b>
              <span>Plaintext, port 25</span>
            </label>

            <label
              className={`smtp-security-card ${securityMode === "tls" ? "selected" : ""}`}
              id="testing-sec-card-tls"
            >
              <input
                type="radio"
                name="testing-security-mode"
                value="tls"
                checked={securityMode === "tls"}
                onChange={() => handleSecurityModeChange("tls")}
              />
              <span className="radio-indicator" />
              <b>TLS / STARTTLS</b>
              <span>Standar industri, port 587</span>
            </label>

            <label
              className={`smtp-security-card ${securityMode === "ssl" ? "selected" : ""}`}
              id="testing-sec-card-ssl"
            >
              <input
                type="radio"
                name="testing-security-mode"
                value="ssl"
                checked={securityMode === "ssl"}
                onChange={() => handleSecurityModeChange("ssl")}
              />
              <span className="radio-indicator" />
              <b>SSL</b>
              <span>Enkripsi langsung, port 465</span>
            </label>
          </div>
        </section>

        {/* SECTION 3: AUTENTIKASI */}
        <section className="smtp-form-section" id="smtp-testing-section-auth">
          <div className="smtp-section-header">
            <h3>
              <KeyRound size={18} strokeWidth={2.2} />
              Autentikasi
            </h3>
            <p className="smtp-section-desc">Kredensial sementara untuk sesi pengujian.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="smtp-fields-grid">
              <div className="smtp-field-group">
                <label className="smtp-field-label" htmlFor="testing-user">
                  <span>Username</span>
                </label>
                <div className="smtp-input-wrapper">
                  <input
                    id="testing-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alamat email / username"
                  />
                </div>
              </div>

              <div className="smtp-field-group">
                <label className="smtp-field-label" htmlFor="testing-pass">
                  <span>Password / App Password</span>
                </label>
                <div className="smtp-input-wrapper password-input">
                  <input
                    id="testing-pass"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password / App Password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="smtp-password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    id="testing-eye"
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <span className="smtp-field-hint">
              Untuk akun pribadi, gunakan App Password jika penyedia email mendukungnya. Hindari
              menggunakan password utama akun.
            </span>

            {/* Expandable Gmail App Password Guide */}
            <div>
              <button
                type="button"
                className="smtp-accordion-header"
                onClick={() => setIsGmailHelpOpen(!isGmailHelpOpen)}
                id="gmail-help-accordion-btn"
              >
                <span>Bagaimana mendapatkan App Password Gmail?</span>
                {isGmailHelpOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isGmailHelpOpen && (
                <div className="smtp-accordion-content" id="gmail-help-accordion-content">
                  <ol>
                    <li>Aktifkan Verifikasi 2 Langkah di akun Google.</li>
                    <li>Buka pengaturan keamanan akun Google.</li>
                    <li>Buat App Password baru untuk testing CARMEN.</li>
                    <li>Gunakan App Password tersebut pada field Password / App Password.</li>
                    <li>Setelah testing selesai, revoke/hapus App Password.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: EMAIL PENGUJIAN */}
        <section className="smtp-form-section" id="smtp-testing-section-email">
          <div className="smtp-section-header">
            <h3>
              <Mail size={18} strokeWidth={2.2} />
              Email pengujian
            </h3>
            <p className="smtp-section-desc">Alamat pengirim, tujuan uji, dan subjek pesan.</p>
          </div>

          <div className="smtp-fields-grid">
            <div className={`smtp-field-group ${fieldErrors.emailSender ? "has-error" : ""}`}>
              <label className="smtp-field-label" htmlFor="testing-sender">
                <span>
                  Email Pengirim <span className="smtp-required-star">*</span>
                </span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="testing-sender"
                  type="email"
                  value={emailSender}
                  onChange={(e) => {
                    setEmailSender(e.target.value);
                    if (fieldErrors.emailSender) {
                      setFieldErrors((prev) => ({ ...prev, emailSender: undefined }));
                    }
                  }}
                  placeholder="e.g. pengirim@example.com"
                />
              </div>
              {fieldErrors.emailSender && (
                <span className="smtp-field-error-msg">{fieldErrors.emailSender}</span>
              )}
            </div>

            <div className="smtp-field-group">
              <label className="smtp-field-label" htmlFor="testing-sender-name">
                <span>Nama Pengirim</span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="testing-sender-name"
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="CARMEN Tester"
                />
              </div>
            </div>

            <div
              className={`smtp-field-group ${fieldErrors.testRecipientEmail ? "has-error" : ""}`}
            >
              <label className="smtp-field-label" htmlFor="testing-recipient">
                <span>
                  Email Tujuan Uji <span className="smtp-required-star">*</span>
                </span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="testing-recipient"
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => {
                    setTestRecipientEmail(e.target.value);
                    if (fieldErrors.testRecipientEmail) {
                      setFieldErrors((prev) => ({ ...prev, testRecipientEmail: undefined }));
                    }
                  }}
                  placeholder="e.g. tujuan@example.com"
                />
              </div>
              <span className="smtp-field-hint">Alamat email yang akan menerima pesan tes.</span>
              {fieldErrors.testRecipientEmail && (
                <span className="smtp-field-error-msg">{fieldErrors.testRecipientEmail}</span>
              )}
            </div>

            <div className="smtp-field-group">
              <label className="smtp-field-label" htmlFor="testing-subject">
                <span>Subject</span>
              </label>
              <div className="smtp-input-wrapper">
                <input
                  id="testing-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="CARMEN SMTP Test"
                />
              </div>
              <span className="smtp-field-hint">
                Isi email dibuat otomatis dengan metadata pengujian.
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="smtp-sticky-bar" id="smtp-testing-sticky-bar">
        <div className="smtp-bar-content">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Test Connection Button */}
            <button
              type="button"
              className="smtp-action-btn"
              onClick={handleTestConnection}
              disabled={isActionDisabled}
              id="testing-btn-test-connection"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Menguji koneksi...</span>
                </>
              ) : (
                <>
                  <Activity size={16} strokeWidth={2} />
                  <span>Tes koneksi</span>
                </>
              )}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Send Test Email Button */}
            <button
              type="button"
              className="smtp-action-btn primary"
              onClick={handleSendTestEmail}
              disabled={isSendEmailDisabled}
              id="testing-btn-send-email"
              title={
                !testRecipientEmail.trim()
                  ? "Masukkan Email Tujuan Uji untuk mengirim email"
                  : undefined
              }
            >
              {isSendingEmail ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Mengirim email...</span>
                </>
              ) : (
                <>
                  <Send size={16} strokeWidth={2} />
                  <span>Kirim email uji</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
