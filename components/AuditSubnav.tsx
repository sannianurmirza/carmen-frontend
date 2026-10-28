"use client";

import React from "react";
import Link from "next/link";
import { PlusCircle, History } from "lucide-react";

interface AuditSubnavProps {
  activeTab: "input" | "riwayat";
}

export default function AuditSubnav({ activeTab }: AuditSubnavProps) {
  return (
    <div
      role="tablist"
      aria-label="Tab Menu Audit"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderBottom: "1px solid var(--border, #e2e8f0)",
        marginBottom: 24,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Link
        href="/audit/input"
        role="tab"
        aria-selected={activeTab === "input"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          fontSize: 13.5,
          fontWeight: activeTab === "input" ? 700 : 600,
          color: activeTab === "input" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
          backgroundColor: activeTab === "input" ? "rgba(143, 26, 37, 0.05)" : "transparent",
          textDecoration: "none",
          borderBottom:
            activeTab === "input"
              ? "2.5px solid var(--red-dark, #8f1a25)"
              : "2.5px solid transparent",
          borderRadius: "6px 6px 0 0",
          transition: "all 150ms ease",
          marginBottom: -1,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <PlusCircle size={16} strokeWidth={activeTab === "input" ? 2.3 : 1.8} />
        <span>Input Audit</span>
      </Link>

      <Link
        href="/audit/riwayat"
        role="tab"
        aria-selected={activeTab === "riwayat"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          fontSize: 13.5,
          fontWeight: activeTab === "riwayat" ? 700 : 600,
          color: activeTab === "riwayat" ? "var(--red-dark, #8f1a25)" : "var(--text-muted, #64748b)",
          backgroundColor: activeTab === "riwayat" ? "rgba(143, 26, 37, 0.05)" : "transparent",
          textDecoration: "none",
          borderBottom:
            activeTab === "riwayat"
              ? "2.5px solid var(--red-dark, #8f1a25)"
              : "2.5px solid transparent",
          borderRadius: "6px 6px 0 0",
          transition: "all 150ms ease",
          marginBottom: -1,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <History size={16} strokeWidth={activeTab === "riwayat" ? 2.3 : 1.8} />
        <span>Riwayat Audit</span>
      </Link>
    </div>
  );
}
