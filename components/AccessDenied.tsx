"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AccessDeniedProps {
  returnUrl?: string;
  requiredCapability?: string;
}

export default function AccessDenied({
  returnUrl = "/",
}: AccessDeniedProps) {
  const { user } = useAuth();
  const roleDisplay = user?.role ? user.role.toUpperCase() : "PENGGUNA";

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: 520,
          width: "100%",
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "rgba(220, 38, 38, 0.1)",
            color: "var(--red, #dc2626)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <ShieldAlert size={34} strokeWidth={2.2} />
        </div>

        <span
          className="eyebrow"
          style={{
            color: "var(--red, #dc2626)",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          403 FORBIDDEN &bull; AKSES DITOLAK
        </span>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text, #0f172a)",
            margin: "0 0 12px 0",
            letterSpacing: "-0.02em",
          }}
        >
          Akses Terbatas
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary, #475569)",
            lineHeight: 1.6,
            margin: "0 0 24px 0",
          }}
        >
          Akun Anda terdaftar dengan role <strong>{roleDisplay}</strong> dan tidak memiliki otorisasi untuk membuka modul halaman ini.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={returnUrl}
            className="btn btn-solid"
            style={{
              padding: "10px 20px",
              fontSize: 13.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Home size={16} />
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
