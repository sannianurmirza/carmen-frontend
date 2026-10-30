"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  User,
  Briefcase,
  Calendar,
  Clock,
  Sparkles,
  Info,
  Building2,
  History,
  AlertCircle,
} from "lucide-react";
import { getBaseUrl } from "@/lib/api";

interface VerificationResponse {
  is_valid: boolean;
  status?: "ACTIVE" | "REPLACED" | "REVOKED" | "NOT_FOUND" | "INACTIVE_USER";
  is_historical?: boolean;
  message: string;
  user: {
    id: number;
    nama: string;
    role: string;
    jabatan: string | null;
    is_active: boolean;
  } | null;
  signature: {
    is_active: boolean;
    status?: string | null;
    created_at: string | null;
    regenerated_at: string | null;
    revoked_at: string | null;
    note: string | null;
  } | null;
}

export default function SignatureVerificationPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setFetchError("Token tanda tangan tidak disertakan dalam tautan.");
      return;
    }

    const fetchVerification = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`${getBaseUrl()}/approval/signature/verify/${encodeURIComponent(token)}`);
        if (!res.ok) {
          throw new Error(`Gagal memverifikasi tanda tangan (HTTP ${res.status}).`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setFetchError(err.message || "Terjadi kesalahan saat memverifikasi tanda tangan.");
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [token]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* Header Branding CARMEN */}
        <div
          style={{
            backgroundColor: "#8f1a25",
            backgroundImage: "linear-gradient(135deg, #8f1a25 0%, #69111b 100%)",
            padding: "24px 28px",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 20,
                letterSpacing: "0.05em",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              C
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
                CARMEN
              </div>
              <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>
                PT JAI Catering Assessment & Operations
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            Digital Identity
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: "28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "3px solid #e2e8f0",
                  borderTopColor: "#8f1a25",
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                Memverifikasi keabsahan tanda tangan digital...
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : fetchError ? (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <ShieldAlert size={30} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#991b1b" }}>
                Verifikasi Gagal
              </h2>
              <p style={{ fontSize: 13.5, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                {fetchError}
              </p>
            </div>
          ) : data ? (
            <div>
              {/* Status Banner */}
              {(() => {
                const isHist = Boolean(data.is_historical || data.status === "REPLACED");
                if (data.is_valid) {
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "16px",
                        borderRadius: 12,
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckCircle2 size={28} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>
                          Identitas Tanda Tangan Sah & Aktif
                        </div>
                        <div style={{ fontSize: 12.5, color: "#15803d", marginTop: 2 }}>
                          {data.message}
                        </div>
                      </div>
                    </div>
                  );
                } else if (isHist) {
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "16px",
                        borderRadius: 12,
                        backgroundColor: "#fffbeb",
                        border: "1px solid #fde68a",
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <History size={28} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e" }}>
                          QR Tanda Tangan Historis
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginTop: 1 }}>
                          Status: Telah Diganti
                        </div>
                        <div style={{ fontSize: 12.5, color: "#78350f", marginTop: 2 }}>
                          {data.message}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "16px",
                        borderRadius: 12,
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <XCircle size={28} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#991b1b" }}>
                          Tanda Tangan Tidak Valid / Tidak Ditemukan
                        </div>
                        <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 2 }}>
                          {data.message}
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Informational Notice: QR is Permanent User Signature Identity */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 8,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#475569",
                  marginBottom: 24,
                  lineHeight: 1.45,
                }}
              >
                <Info size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Halaman ini memvalidasi <strong>Identitas Tanda Tangan Elektronik Pengguna</strong> yang terdaftar secara permanen pada sistem CARMEN PT JAI. Tanda tangan ini berlaku secara sah pada seluruh pengesahan dokumen operasional yang disetujui oleh pengguna terkait.
                </span>
              </div>

              {/* User Identity Details Card */}
              {data.user && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "20px",
                    marginBottom: 20,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#64748b",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <User size={14} />
                    <span>Profil Penandatangan Resmi</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                        NAMA LENGKAP
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                        {data.user.nama}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                        JABATAN / PERAN
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
                        {data.user.jabatan || (data.user.role === "approver" ? "Approver" : data.user.role)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                        STATUS PENGGUNA
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: data.user.is_active ? "#10b981" : "#ef4444",
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: data.user.is_active ? "#047857" : "#b91c1c" }}>
                          {data.user.is_active ? "Akun Aktif" : "Akun Nonaktif"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                        STATUS TANDA TANGAN
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        {(() => {
                          const isHist = Boolean(data.is_historical || data.status === "REPLACED");
                          if (data.signature?.is_active) {
                            return (
                              <>
                                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#047857" }}>Aktif & Sah</span>
                              </>
                            );
                          } else if (isHist) {
                            return (
                              <>
                                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#b45309" }}>Telah Diganti (Historis)</span>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>Dicabut / Nonaktif</span>
                              </>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature Timeline & Cryptographic Metadata */}
              {data.signature && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "16px 20px",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Clock size={13} />
                    <span>Riwayat Tanda Tangan Digital</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Diterbitkan Pertama Kali:</span>
                      <strong style={{ color: "#0f172a" }}>{formatDate(data.signature.created_at)}</strong>
                    </div>

                    {data.signature.regenerated_at && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Pembaruan / Penerbitan:</span>
                        <strong style={{ color: "#0f172a" }}>{formatDate(data.signature.regenerated_at)}</strong>
                      </div>
                    )}

                    {data.signature.revoked_at && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
                        <span>Tanggal Penggantian / Pencabutan:</span>
                        <strong>{formatDate(data.signature.revoked_at)}</strong>
                      </div>
                    )}

                    {Boolean(data.is_historical || data.status === "REPLACED") && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "8px 10px",
                          borderRadius: 6,
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          fontSize: 11.5,
                          lineHeight: 1.4,
                        }}
                      >
                        Tanda tangan ini sah secara hukum internal untuk dokumen yang telah disetujui sebelum tanggal penggantian, dan tidak digunakan untuk pengesahan baru.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 28px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: 11.5,
            color: "#94a3b8",
          }}
        >
          Sistem Verifikasi Tanda Tangan Elektronik Terpusat &bull; CARMEN PT JAI
        </div>
      </div>
    </div>
  );
}
