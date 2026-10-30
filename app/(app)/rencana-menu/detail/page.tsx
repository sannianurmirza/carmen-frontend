import { Suspense } from "react";
import RencanaMenuEditorPage from "../[id]/RencanaMenuDetailClient";

export default function RencanaMenuDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
          <p style={{ fontWeight: 600 }}>Memuat data rencana menu bulanan...</p>
        </div>
      }
    >
      <RencanaMenuEditorPage />
    </Suspense>
  );
}
