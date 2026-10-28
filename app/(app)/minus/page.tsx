"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MinusRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/kalori-harian/minus");
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "var(--muted)" }}>Mengalihkan ke Kalori Minus...</p>
    </div>
  );
}
