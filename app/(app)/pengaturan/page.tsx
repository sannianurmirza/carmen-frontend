"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSettingsRedirectTarget } from "@/lib/settingsNav";

function PengaturanRootRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    const target = resolveSettingsRedirectTarget(tab);
    router.replace(target);
  }, [router, searchParams]);

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
      <span>Memuat pengaturan...</span>
    </div>
  );
}

export default function PengaturanPage() {
  return (
    <Suspense fallback={null}>
      <PengaturanRootRedirect />
    </Suspense>
  );
}
