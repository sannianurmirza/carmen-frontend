"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import UserManagementTab from "@/components/pengaturan/UserManagementTab";

export default function PengaturanPenggunaPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 0",
          color: "var(--text-muted, #64748b)",
          fontSize: 13,
        }}
      >
        <span>Memuat data pengguna...</span>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div
        style={{
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          padding: 32,
          textAlign: "center",
          maxWidth: 480,
          margin: "32px auto",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: "rgba(143, 26, 37, 0.08)",
            color: "#8f1a25",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <ShieldAlert size={26} strokeWidth={2} />
        </div>
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text, #0f172a)",
          }}
        >
          Akses Ditolak
        </h2>
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: 13,
            color: "var(--text-muted, #64748b)",
            lineHeight: 1.5,
          }}
        >
          Halaman Kelola Pengguna hanya dapat diakses oleh Administrator sistem.
        </p>
        <Link
          href="/pengaturan/akun"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: "#8f1a25",
            borderRadius: 6,
            textDecoration: "none",
            transition: "opacity 140ms ease",
          }}
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Akun Saya</span>
        </Link>
      </div>
    );
  }

  return <UserManagementTab />;
}
