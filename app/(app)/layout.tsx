"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import AccessDenied from "@/components/AccessDenied";
import { isRouteAllowed } from "@/lib/permissions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isSlowConnection } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const fullPath = pathname + search;
      router.replace(`/login?next=${encodeURIComponent(fullPath)}`);
    }
  }, [user, isLoading, pathname, router]);

  // Tampilkan loading ringan selama pengecekan sesi berlangsung
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-main, #f8fafc)",
          color: "var(--text, #0f172a)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid var(--border, #cbd5e1)",
            borderTopColor: "#dc2626",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted, #64748b)",
            letterSpacing: "0.02em",
            textAlign: "center",
            maxWidth: 360,
            padding: "0 16px",
          }}
        >
          {isSlowConnection
            ? "Pemeriksaan sesi memerlukan waktu lebih lama dari biasanya. Harap tunggu..."
            : "Memeriksa sesi..."}
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Cegah kilatan halaman internal jika tidak terautentikasi
  if (!user) {
    return null;
  }

  // Evaluasi izin akses rute berdasarkan role & kapabilitas pengguna
  const allowed = isRouteAllowed(user, pathname);
  if (!allowed) {
    return (
      <AppShell>
        <AccessDenied returnUrl="/" />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
