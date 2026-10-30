import { Suspense } from "react";
import RencanaMenuEditorPage from "./RencanaMenuDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
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
