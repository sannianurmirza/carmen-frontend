"use client";

import { useState, useEffect } from "react";
import { Utensils, History, TrendingDown } from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ActionCard from "@/components/ActionCard";
import { getMinusEntries } from "@/lib/api";

export default function KaloriHarianHubPage() {
  const [uncompletedMinusCount, setUncompletedMinusCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    getMinusEntries(undefined, undefined, undefined, undefined, "belum_dilengkapi")
      .then((entries) => {
        if (isMounted) {
          setUncompletedMinusCount(entries.length);
        }
      })
      .catch(() => {
        // Silently handle if backend not reachable on landing
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
            KALORI MANAGEMENT
          </p>
          <h1 className="page-title" style={{ margin: 0 }}>
            Kalori
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-secondary)", fontSize: "13.5px" }}>
            Input &amp; kalkulasi kecukupan kalori makanan harian, ekspor data mingguan, dan kelola kalori minus.
          </p>
        </div>
        <HeaderMetaBoxes />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
          marginTop: "12px",
        }}
      >
        {/* Kotak 1: Input Kalori */}
        <ActionCard
          href="/kalori-harian/input"
          title="Input Kalori"
          description="Input gramasi dan kalkulasi energi bahan makanan per menu/shift untuk menghitung persentase kecukupan kalori."
          icon={Utensils}
          iconTone="red"
          buttonLabel="Mulai Input Kalori"
          buttonVariant="primary"
        />

        {/* Kotak 2: Export */}
        <ActionCard
          href="/kalori-harian/mingguan"
          title="Export"
          description="Lihat rekapitulasi kalori mingguan dan bulanan seluruh katering partner, serta unduh laporan Excel resmi."
          icon={History}
          iconTone="blue"
          buttonLabel="Buka Halaman Export"
          buttonVariant="outline"
        />

        {/* Kotak 3: Kalori Minus */}
        <ActionCard
          href="/kalori-harian/minus"
          title="Kalori Minus"
          description="Kelola menu dengan kalori di bawah standar, periksa bukti foto timbangan gramasi, dan lengkapi laporan minus."
          icon={TrendingDown}
          iconTone="amber"
          buttonLabel="Kelola Kalori Minus"
          buttonVariant="outline"
          badgeCount={uncompletedMinusCount}
          badgeLabel="Belum Dilengkapi"
          badgeTitle="Jumlah laporan minus yang belum dilengkapi"
        />
      </div>
    </div>
  );
}
