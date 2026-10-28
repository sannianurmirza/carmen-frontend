"use client";

import React from "react";
import { PlusCircle, History } from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ActionCard from "@/components/ActionCard";

export default function AuditLandingPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header Row */}
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
            PENILAIAN &amp; AUDIT
          </p>
          <h1 className="page-title" style={{ margin: 0 }}>
            Audit Dapur
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "13.5px" }}>
            Catat hasil pemeriksaan dapur katering dan lihat riwayat audit sebelumnya.
          </p>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Landing Menu Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          marginTop: "12px",
        }}
      >
        {/* Card 1: Input Audit */}
        <ActionCard
          href="/audit/input"
          title="Input Audit"
          description="Mulai audit dapur baru dan catat temuan ketidaksesuaian jika ada. Jika seluruh kriteria memenuhi standar, audit dapat diselesaikan tanpa temuan."
          icon={PlusCircle}
          iconTone="red"
          buttonLabel="Mulai Input Audit"
          buttonVariant="primary"
        />

        {/* Card 2: Riwayat Audit */}
        <ActionCard
          href="/audit/riwayat"
          title="Riwayat Audit"
          description="Lihat riwayat audit yang sudah final maupun draft yang sedang berjalan, periksa detail kriteria dan foto bukti temuan, serta unduh laporan Excel."
          icon={History}
          iconTone="blue"
          buttonLabel="Lihat Riwayat Audit"
          buttonVariant="outline"
        />
      </div>
    </div>
  );
}
