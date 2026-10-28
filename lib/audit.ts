import type { AuditEntryItemResponse } from "./api";
export type AuditTypeInfo = {
  label: string;
  badgeClass: string;
  isFindings: boolean;
};

export type AuditStatusInfo = {
  label: string;
  badgeStyle: {
    bg: string;
    color: string;
    border?: string;
  };
  isDraft: boolean;
  isTanpaTemuan: boolean;
};

/**
 * Returns type information for audit entry (Audit Temuan vs Checklist Legacy)
 */
export function getAuditTypeInfo(entry: AuditEntryItemResponse): AuditTypeInfo {
  const isFindings = entry.assessment_mode === "findings_v1";
  return {
    label: isFindings ? "Audit Temuan" : "Audit Checklist Legacy",
    badgeClass: isFindings ? "badge-findings" : "badge-legacy",
    isFindings,
  };
}

/**
 * Returns detailed status information and display badges
 */
export function getAuditStatusInfo(entry: AuditEntryItemResponse): AuditStatusInfo {
  // If legacy entry
  if (entry.assessment_mode === "legacy_checklist" || !entry.assessment_mode) {
    return {
      label: "Legacy",
      badgeStyle: {
        bg: "rgba(148, 163, 184, 0.12)",
        color: "#64748b",
        border: "1px solid #cbd5e1",
      },
      isDraft: false,
      isTanpaTemuan: false,
    };
  }

  // If Draft
  if (entry.status === "draft") {
    return {
      label: "Draft",
      badgeStyle: {
        bg: "rgba(234, 179, 8, 0.12)",
        color: "#b45309",
        border: "1px solid #fde047",
      },
      isDraft: true,
      isTanpaTemuan: false,
    };
  }

  // If Final without findings
  if (entry.is_tanpa_temuan || (entry.findings_count ?? 0) === 0) {
    return {
      label: "Tanpa Temuan",
      badgeStyle: {
        bg: "rgba(22, 163, 74, 0.12)",
        color: "#15803d",
        border: "1px solid #86efac",
      },
      isDraft: false,
      isTanpaTemuan: true,
    };
  }

  // Final with findings
  return {
    label: "Dengan Temuan",
    badgeStyle: {
      bg: "rgba(239, 68, 68, 0.12)",
      color: "#b91c1c",
      border: "1px solid #fca5a5",
    },
    isDraft: false,
    isTanpaTemuan: false,
  };
}

/**
 * Standardize display date formatting for Indonesian locale (e.g. 29 Sep 2026)
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format kriteria display label with number, sisi, category
 */
export function formatKriteriaDisplay(kriteria: {
  nomor?: number;
  sisi?: string;
  kategori?: string;
  deskripsi?: string;
  material?: string;
}): string {
  const code =
    kriteria.sisi && kriteria.nomor
      ? `${kriteria.sisi}-${String(kriteria.nomor).padStart(2, "0")}`
      : "";
  const parts = [code, kriteria.kategori, kriteria.material || kriteria.deskripsi].filter(Boolean);
  return parts.join(" • ");
}
