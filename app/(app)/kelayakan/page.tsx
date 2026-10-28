"use client";

import { ClipboardCheck, History } from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ActionCard from "@/components/ActionCard";

export default function KelayakanHubPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
            KELAYAKAN MANAGEMENT
          </p>
          <h1 className="page-title" style={{ margin: 0 }}>
            Kelayakan Catering
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "13.5px" }}>
            Penilaian kelayakan menu makanan harian katering dan laporan rekapitulasi.
          </p>
        </div>
        <HeaderMetaBoxes />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          marginTop: "12px",
        }}
      >
        {/* Kotak 1: Input Kelayakan */}
        <ActionCard
          href="/kelayakan/input"
          title="Input Kelayakan"
          description="Mulai penilaian 13 kriteria kelayakan menu makanan katering harian, kondisi rantang, nasi, lauk, dan sayur."
          icon={ClipboardCheck}
          iconTone="red"
          buttonLabel="Mulai Input Kelayakan"
          buttonVariant="primary"
        />

        {/* Kotak 2: Export */}
        <ActionCard
          href="/kelayakan/export"
          title="Export"
          description="Lihat riwayat laporan kelayakan, filter berdasarkan rentang tanggal, dan unduh data laporan ke file Excel."
          icon={History}
          iconTone="blue"
          buttonLabel="Buka Halaman Export"
          buttonVariant="outline"
        />
      </div>
    </div>
  );
}
