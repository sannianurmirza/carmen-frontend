"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getPublicUrl, sanitizeRedirectPath } from "@/lib/api";



function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, isLoading: isAuthChecking } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const nextParam = searchParams.get("next");
  const targetRedirect = sanitizeRedirectPath(nextParam);

  // Jika sudah terautentikasi, langsung arahkan ke route tujuan
  useEffect(() => {
    if (!isAuthChecking && user) {
      router.replace(targetRedirect);
    }
  }, [user, isAuthChecking, router, targetRedirect]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage("Email atau password wajib diisi.");
      if (!trimmedEmail) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({
        email: trimmedEmail,
        password: password,
        remember_me: rememberMe,
      });

      router.replace(targetRedirect);
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        msg.includes("Tidak dapat terhubung") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError")
      ) {
        setErrorMessage("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
      } else if (msg.includes("dinonaktifkan")) {
        setErrorMessage("Akun ini telah dinonaktifkan. Silakan hubungi Administrator.");
      } else if (
        msg.includes("Terlalu banyak percobaan") ||
        msg.includes("tunggu") ||
        msg.includes("429")
      ) {
        setErrorMessage(msg);
      } else {
        setErrorMessage("Email atau password salah.");
      }
      passwordInputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Sisi Kiri: Branding Perusahaan (42% Desktop) */}
      <section className="login-brand-panel" aria-label="Informasi Perusahaan">
        <div className="login-brand-accent" aria-hidden="true" />

        <div className="login-brand-container">
          <div className="login-brand-top">
            {/* Logo Resmi YAZAKI / PT JAI dalam Kartu Putih Bersih */}
            <div className="login-brand-logo-card">
              <img
                src={getPublicUrl("/image/yazaki-jai-logo.png")}
                alt="YAZAKI PT. Jatim Autocomp Indonesia"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = "true";
                    target.src = getPublicUrl("/yazaki-jai-logo.png");
                  }
                }}
                style={{
                  height: 42,
                  width: "auto",
                  maxWidth: 210,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            {/* Teks Identitas Sistem & Perusahaan */}
            <div className="login-brand-content">
              <h1 className="login-brand-title">CARMEN</h1>
              <div className="login-brand-divider" aria-hidden="true" />
              <p className="login-brand-desc">
                Sistem pengelolaan dan evaluasi layanan katering PT Jatim Autocomp Indonesia.
              </p>
            </div>
          </div>

          {/* Footer Sisi Kiri */}
          <div className="login-brand-footer">
            OPERASIONAL &bull; STANDAR HIGIENITAS &bull; KUALITAS
          </div>
        </div>
      </section>

      {/* Sisi Kanan: Form Autentikasi (58% Desktop) */}
      <section className="login-form-panel" aria-label="Formulir Masuk">
        <div className="login-card-container">
          {/* Header Form */}
          <div>
            <span className="login-form-label-small">
              CARMEN
            </span>
            <h2 className="login-form-heading">
              Masuk ke Sistem
            </h2>
            <p className="login-form-desc">
              Masukkan akun Anda untuk melanjutkan.
            </p>
          </div>

          {/* Alert Kegagalan Login */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="corp-alert-box"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle
                size={18}
                style={{ flexShrink: 0, marginTop: 1, color: "#991b1b" }}
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Utama */}
          <form onSubmit={handleSubmit} noValidate style={{ width: "100%" }}>
            {/* Input Email */}
            <div style={{ marginBottom: 22, width: "100%" }}>
              <label htmlFor="email" className="login-input-label">
                Email
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                >
                  <Mail size={17} />
                </div>
                <input
                  ref={emailInputRef}
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Masukkan email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-describedby={errorMessage ? "login-error-alert" : undefined}
                  className={`login-input-field ${errorMessage ? "input-error" : ""}`}
                />
              </div>
            </div>

            {/* Input Password */}
            <div style={{ marginBottom: 20, width: "100%" }}>
              <label htmlFor="password" className="login-input-label">
                Password
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                >
                  <Lock size={17} />
                </div>
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-describedby={errorMessage ? "login-error-alert" : undefined}
                  className={`login-input-field ${errorMessage ? "input-error" : ""}`}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 38,
                    height: 38,
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    transition: "color 140ms ease",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Checkbox Ingat Saya */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 28,
                width: "100%",
              }}
            >
              <label
                htmlFor="remember-me"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "#475569",
                  cursor: "pointer",
                  userSelect: "none",
                  minHeight: 28,
                }}
              >
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                  style={{
                    width: 17,
                    height: 17,
                    accentColor: "#8f1a25",
                    cursor: "pointer",
                    margin: 0,
                  }}
                />
                <span>Ingat Saya</span>
              </label>
            </div>

            {/* Tombol Masuk */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="login-btn-primary"
            >
              {isSubmitting && (
                <svg
                  style={{
                    width: 17,
                    height: 17,
                    animation: "corpSpin 0.8s linear infinite",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="31.4 31.4"
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <span>{isSubmitting ? "Memproses..." : "Masuk"}</span>
            </button>
          </form>

          {/* Informasi Bantuan */}
          <p
            style={{
              fontSize: 12.5,
              color: "#64748b",
              textAlign: "center",
              margin: "20px 0 0 0",
              lineHeight: 1.5,
            }}
          >
            Kendala akses akun? Hubungi Administrator GA/IT PT JAI.
          </p>

          {/* Footer Card */}
          <div
            style={{
              borderTop: "1px solid #f1f5f9",
              marginTop: 22,
              paddingTop: 16,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#94a3b8",
                margin: 0,
                letterSpacing: "0.01em",
              }}
            >
              &copy; PT Jatim Autocomp Indonesia
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--content-bg, #f8fafc)",
            color: "#64748b",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Memuat halaman masuk...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
