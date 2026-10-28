"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

export interface MissingCateringItem {
  id?: number | string;
  nama: string;
}

export interface AuditCompletenessWarningProps {
  missingCaterings: MissingCateringItem[];
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Komponen peringatan internal "Data Audit Belum Lengkap".
 * Digunakan pada modul Performance dan Punishment secara konsisten:
 * - Struktur ringkas, jelas, dan natural
 * - Menghilangkan teks duplikat / badge redundant
 * - Daftar katering single-bullet yang compact
 * - CTA terpisah dan helper text informatif di bagian bawah
 */
export default function AuditCompletenessWarning({
  missingCaterings,
  href = "/audit/riwayat",
  className = "",
  style,
}: AuditCompletenessWarningProps) {
  if (!missingCaterings || missingCaterings.length === 0) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-label="Peringatan Data Audit Belum Lengkap"
      className={`audit-completeness-warning ${className}`}
      style={{
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "8px",
        padding: "14px 18px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        boxShadow: "0 1px 2px rgba(217, 119, 6, 0.05)",
        ...style,
      }}
    >
      <AlertTriangle
        size={18}
        style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title */}
        <h2
          style={{
            fontSize: "14.5px",
            fontWeight: 700,
            color: "#78350f",
            margin: "0 0 4px 0",
            lineHeight: 1.3,
          }}
        >
          Data Audit Belum Lengkap
        </h2>

        {/* Body Copy */}
        <p
          style={{
            fontSize: "13px",
            color: "#92400e",
            margin: "0 0 8px 0",
            lineHeight: 1.45,
          }}
        >
          Finalisasi belum bisa dilakukan karena beberapa katering belum memiliki Audit final pada periode ini.
        </p>

        {/* List Katering */}
        <div style={{ margin: "0 0 10px 0" }}>
          <span
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#78350f",
              marginBottom: "4px",
            }}
          >
            Belum lengkap:
          </span>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              listStyleType: "disc",
              color: "#92400e",
            }}
          >
            {missingCaterings.map((c, idx) => (
              <li
                key={c.id ?? idx}
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  marginBottom: "2px",
                  color: "#78350f",
                }}
              >
                {c.nama}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Button */}
        <div>
          <Link
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              fontSize: "12.5px",
              fontWeight: 650,
              color: "#92400e",
              backgroundColor: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "6px",
              textDecoration: "none",
              transition: "background-color 0.15s ease",
            }}
          >
            Buka Riwayat Audit
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {/* Helper Note */}
        <p
          style={{
            fontSize: "11.5px",
            color: "#b45309",
            margin: "8px 0 0 0",
            lineHeight: 1.4,
            opacity: 0.9,
          }}
        >
          Audit yang dihitung: status Final, dengan atau tanpa temuan.
        </p>
      </div>
    </section>
  );
}
