"use client";

import React, { useState } from "react";
import { Star, Info, ChevronDown, ChevronUp, Utensils, Sparkles, Box } from "lucide-react";

export type RatingCategoryType = "kelayakan" | "rasa" | "rantang";

export const RATING_DESCRIPTIONS: Record<RatingCategoryType, Record<number, string>> = {
  kelayakan: {
    5: "Menu dan porsi sesuai",
    4: "Menu tidak sesuai & porsi sesuai",
    3: "Menu sesuai & porsi tidak sesuai",
    2: "Menu dan porsi tidak sesuai",
    1: "Menu dan porsi tidak layak",
  },
  rasa: {
    5: "Sedap & lezat",
    4: "Enak",
    3: "Cukup",
    2: "Tidak enak (terlalu asin)",
    1: "Basi",
  },
  rantang: {
    5: "Utuh dan bersih",
    4: "Pecah dan kotor",
    3: "Pecah",
    2: "Kotor",
    1: "Bau sabun",
  },
};

interface KelayakanLegendCardProps {
  defaultExpanded?: boolean;
  style?: React.CSSProperties;
}

export default function KelayakanLegendCard({
  defaultExpanded = true,
  style,
}: KelayakanLegendCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className="panel"
      style={{
        borderRadius: "var(--radius, 8px)",
        border: "1px solid var(--border-strong, #cbd5e1)",
        background: "var(--card, #ffffff)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
        marginBottom: 20,
        ...style,
      }}
    >
      {/* Header bar / accordion toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: "12px 18px",
          background: "linear-gradient(135deg, rgba(30, 58, 138, 0.05) 0%, rgba(59, 130, 246, 0.08) 100%)",
          borderBottom: isExpanded ? "1px solid var(--border, #e2e8f0)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#3b82f6",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Info size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text, #1e293b)" }}>
              Panduan Keterangan Kategori Penilaian Kelayakan
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
              Standar baku deskripsi nilai bintang 1 s/d 5 untuk Kelayakan Menu &amp; Porsi, Kualitas Rasa, dan Kondisi Rantang
            </p>
          </div>
        </div>

        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#3b82f6",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          <span>{isExpanded ? "Sembunyikan Panduan" : "Tampilkan Panduan"}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div
          style={{
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 16,
            background: "var(--content-bg, #f8fafc)",
          }}
        >
          {/* Kolom 1: KELAYAKAN MENU & PORSI */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              padding: 14,
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <Utensils size={16} style={{ color: "var(--red, #dc2626)" }} />
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text, #0f172a)" }}>
                  1. Kelayakan Menu &amp; Porsi
                </strong>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                  Nasi, Lauk, Sayur, Sambal, Kerupuk, Buah
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const desc = RATING_DESCRIPTIONS.kelayakan[star];
                const badgeColor =
                  star === 5
                    ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" }
                    : star === 4
                    ? { bg: "#f8fafc", text: "#0f766e", border: "#ccfbf1" }
                    : star === 3
                    ? { bg: "#fffbeb", text: "#b45309", border: "#fde68a" }
                    : star === 2
                    ? { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5" }
                    : { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };

                return (
                  <div
                    key={star}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: badgeColor.bg,
                      border: `1px solid ${badgeColor.border}`,
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: badgeColor.text, minWidth: 14 }}>
                        ★ {star}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: badgeColor.text, textAlign: "right" }}>
                      {desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom 2: KUALITAS RASA */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              padding: 14,
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <Sparkles size={16} style={{ color: "#d97706" }} />
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text, #0f172a)" }}>
                  2. Kualitas Rasa
                </strong>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                  Cita rasa hidangan makanan katering
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const desc = RATING_DESCRIPTIONS.rasa[star];
                const badgeColor =
                  star === 5
                    ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" }
                    : star === 4
                    ? { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" }
                    : star === 3
                    ? { bg: "#fffbeb", text: "#b45309", border: "#fde68a" }
                    : star === 2
                    ? { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5" }
                    : { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };

                return (
                  <div
                    key={star}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: badgeColor.bg,
                      border: `1px solid ${badgeColor.border}`,
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: badgeColor.text, minWidth: 14 }}>
                        ★ {star}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: badgeColor.text, textAlign: "right" }}>
                      {desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom 3: KONDISI RANTANG */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              padding: 14,
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <Box size={16} style={{ color: "#2563eb" }} />
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text, #0f172a)" }}>
                  3. Kondisi Rantang &amp; Wadah
                </strong>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                  Keutuhan fisik dan kebersihan wadah makanan
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const desc = RATING_DESCRIPTIONS.rantang[star];
                const badgeColor =
                  star === 5
                    ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" }
                    : star === 4
                    ? { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" }
                    : star === 3
                    ? { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" }
                    : star === 2
                    ? { bg: "#fffbeb", text: "#9a3412", border: "#fed7aa" }
                    : { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };

                return (
                  <div
                    key={star}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: badgeColor.bg,
                      border: `1px solid ${badgeColor.border}`,
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: badgeColor.text, minWidth: 14 }}>
                        ★ {star}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: badgeColor.text, textAlign: "right" }}>
                      {desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
