"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  ClipboardCheck,
  Utensils,
  ClipboardList,
  FileSpreadsheet,
  TrendingUp,
  Send,
  FileCheck2,
  CheckCircle2,
  ShieldCheck,
  Store,
  Clock,
  ArrowRight,
} from "lucide-react";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ActionCard from "@/components/ActionCard";
import { getCatering, getApprovals, ApprovalItem, AuthUser } from "@/lib/api";

interface AdminDashboardProps {
  user: AuthUser | null;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeCateringCount, setActiveCateringCount] = useState<number | null>(null);
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(true);

  useEffect(() => {
    getCatering({ activeOnly: true })
      .then((data) => setActiveCateringCount(data.length))
      .catch(() => setActiveCateringCount(null));

    getApprovals({ tab: "all" })
      .then((res) => {
        setApprovalItems(res.items || []);
        setLoadingApprovals(false);
      })
      .catch(() => setLoadingApprovals(false));
  }, []);

  const pendingApprovalsCount = approvalItems.filter((a) => a.status === "PENDING").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Top Header Row with Breadcrumbs & Meta Boxes */}
      <div className="page-head-row" style={{ marginBottom: 28 }}>
        <div>
          <span className="eyebrow">PT JAI / DASHBOARD OVERVIEW</span>
          <h1 className="page-title">Dashboard Management Catering</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      {/* Metrics Summary Section (Optibiz Bold Number Pattern) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <Link
          href="/daftar-katering"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <div
            className="panel"
            style={{
              padding: "18px 20px",
              marginBottom: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                KATERING PARTNER
              </span>
              <Store size={18} style={{ color: "var(--red)" }} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", lineHeight: 1.1 }}>
                {activeCateringCount !== null ? activeCateringCount : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
                Katering Terdaftar &amp; Aktif
              </div>
            </div>
          </div>
        </Link>

        <div
          className="panel"
          style={{
            padding: "18px 20px",
            marginBottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
              KELAYAKAN MENU
            </span>
            <ClipboardCheck size={18} style={{ color: "var(--green)" }} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--green)", lineHeight: 1.1 }}>
              98.5%
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
              Rata-rata Skor Kelayakan
            </div>
          </div>
        </div>

        <div
          className="panel"
          style={{
            padding: "18px 20px",
            marginBottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
              AUDIT DAPUR
            </span>
            <ShieldCheck size={18} style={{ color: "var(--red)" }} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", lineHeight: 1.1 }}>
              92.4%
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
              Kepatuhan Higienitas &amp; Servis
            </div>
          </div>
        </div>

        {/* Approval Overview Metric for Admin */}
        <Link
          href="/approval"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <div
            className="panel"
            style={{
              padding: "18px 20px",
              marginBottom: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                STATUS APPROVAL
              </span>
              <FileCheck2 size={18} style={{ color: pendingApprovalsCount > 0 ? "var(--amber, #b45309)" : "var(--green, #16a34a)" }} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: pendingApprovalsCount > 0 ? "var(--amber, #b45309)" : "var(--text)", lineHeight: 1.1 }}>
                {loadingApprovals ? "—" : pendingApprovalsCount}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>
                Pengajuan Dalam Proses
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Feature Solutions Grid (Prosperum Reference Pattern) */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "0.5px" }}>
              MODUL MANAJEMEN CATERING
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
              Pilih modul operasional di bawah untuk pengisian data, inspeksi audit, atau melihat laporan bulanan PT JAI.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {/* Card 1: Kelayakan */}
          <ActionCard
            href="/kelayakan"
            title="Kelayakan Menu"
            description="Penilaian 13 kriteria kelayakan menu nasi, lauk, sayur, sambal, buah, dan kondisi rantang."
            icon={ClipboardCheck}
            iconTone="red"
            buttonLabel="Kelola Kelayakan"
            buttonVariant="outline"
          />

          {/* Card 2: Kalori Harian */}
          <ActionCard
            href="/kalori-harian"
            title="Kalori"
            description="Input &amp; kalkulasi energi bahan makanan harian (persentase kecukupan kalori katering)."
            icon={Utensils}
            iconTone="blue"
            buttonLabel="Kelola Kalori"
            buttonVariant="outline"
          />

          {/* Card 3: Audit Dapur */}
          <ActionCard
            href="/audit"
            title="Audit Dapur Catering"
            description="Checklist 54 kriteria audit kebersihan dapur (Form A) dan higienitas servis (Form B)."
            icon={ClipboardList}
            iconTone="green"
            buttonLabel="Kelola Audit"
            buttonVariant="outline"
          />

          {/* Card 4: Punishment */}
          <ActionCard
            href="/laporan-punishment"
            title="Laporan Punishment"
            description="Rekapitulasi denda dan punishment bulanan berdasarkan kalori, komplain, keterlambatan, dan audit dapur."
            icon={FileSpreadsheet}
            iconTone="amber"
            buttonLabel="Buka Laporan Punishment"
            buttonVariant="outline"
          />
        </div>
      </div>

      {/* Analytics & Report Quick Panel */}
      <div
        className="panel"
        style={{
          padding: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text)" }}>
            Rekapitulasi Performa &amp; Laporan Resmi Bulanan
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            Lihat performa katering partner atau cetak Laporan Resmi PT. Jatim Autocomp Indonesia.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/performance" className="btn btn-outline" style={{ fontSize: 11.5 }}>
            <TrendingUp size={15} /> Performa Katering
          </Link>
          <Link href="/approval" className="btn btn-outline" style={{ fontSize: 11.5 }}>
            <FileCheck2 size={15} /> Audit Approval
          </Link>
          <Link href="/send-report" className="btn btn-solid" style={{ fontSize: 11.5 }}>
            <Send size={15} /> Laporan Resmi (Send Report)
          </Link>
        </div>
      </div>
    </div>
  );
}
