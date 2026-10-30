"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ExcelJS from "exceljs";
import {
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Download,
  RotateCcw,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { downloadApprovalFileApi, getApprovalFileDownloadUrl } from "@/lib/api";

interface ReportPreviewProps {
  approvalId: number;
  filename: string;
  mimeType?: string | null;
  status: string;
  activeArtifactId?: number;
  activeRevisionNumber?: number;
  deliveryType?: string;
  onDownloadOriginal?: () => void;
  isDownloadingOriginal?: boolean;
}

interface ParsedCell {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  isNumber?: boolean;
  rowSpan?: number;
  colSpan?: number;
  hiddenByMerge?: boolean;
  bgColor?: string;
  textColor?: string;
  imageSrc?: string;
}

interface ParsedSheet {
  name: string;
  rows: ParsedCell[][];
  maxCols: number;
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx !== -1 ? filename.slice(idx).toLowerCase() : "";
}

function formatCellValue(val: any): { text: string; align?: "left" | "center" | "right"; isNumber?: boolean } {
  if (val === null || val === undefined) return { text: "" };

  if (typeof val === "object") {
    // ExcelJS formula result
    if ("result" in val && val.result !== undefined && val.result !== null) {
      return formatCellValue(val.result);
    }
    // ExcelJS rich text
    if (Array.isArray(val.richText)) {
      return { text: val.richText.map((r: any) => r.text || "").join("") };
    }
    if (val instanceof Date) {
      return { text: val.toLocaleDateString("id-ID"), align: "center" };
    }
    if ("text" in val && val.text !== undefined) {
      return { text: String(val.text) };
    }
    return { text: "" };
  }

  if (typeof val === "number") {
    const formatted = Number.isInteger(val)
      ? val.toLocaleString("id-ID")
      : val.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return { text: formatted, align: "right", isNumber: true };
  }

  if (typeof val === "boolean") {
    return { text: val ? "TRUE" : "FALSE", align: "center" };
  }

  return { text: String(val) };
}

function convertArgbToRgba(argb?: string): string | undefined {
  if (!argb || typeof argb !== "string") return undefined;
  if (argb.length === 8) {
    const a = parseInt(argb.slice(0, 2), 16) / 255;
    const r = parseInt(argb.slice(2, 4), 16);
    const g = parseInt(argb.slice(4, 6), 16);
    const b = parseInt(argb.slice(6, 8), 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
  if (argb.length === 6) {
    return `#${argb}`;
  }
  return undefined;
}

export default function ReportPreview({
  approvalId,
  filename,
  mimeType,
  status,
  activeArtifactId,
  activeRevisionNumber,
  deliveryType,
  onDownloadOriginal,
  isDownloadingOriginal,
}: ReportPreviewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const ext = useMemo(() => getFileExtension(filename), [filename]);
  const isXlsx = ext === ".xlsx" || ext === ".xls" || ext === ".csv";
  const isPdf = ext === ".pdf" || (mimeType && mimeType.includes("pdf"));
  const isImage = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) || (mimeType && mimeType.startsWith("image/"));

  // Fetch and parse workbook
  useEffect(() => {
    let isCancelled = false;
    let localBlobUrl: string | null = null;

    async function loadReport() {
      setLoading(true);
      setError(null);
      setSheets([]);

      try {
        const downloadOpts = {
          type: activeArtifactId ? ("latest" as const) : (activeRevisionNumber ? undefined : ("latest" as const)),
          artifactId: activeArtifactId,
          revision: activeRevisionNumber,
          disposition: "inline" as const,
        };

        const { blob, filename: fetchedFilename } = await downloadApprovalFileApi(approvalId, downloadOpts);
        if (isCancelled) return;

        // Check for safe file size (< 25MB)
        if (blob.size > 25 * 1024 * 1024) {
          setError("File terlalu besar untuk preview cepat. Silakan gunakan tombol 'Unduh File Asli' di bawah.");
          setLoading(false);
          return;
        }

        if (isXlsx) {
          const arrayBuffer = await blob.arrayBuffer();
          if (isCancelled) return;

          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          if (isCancelled) return;

          // Process visible sheets (or all sheets if none marked visible)
          const allWorksheets = workbook.worksheets || [];
          const visibleSheets = allWorksheets.filter((ws) => ws.state !== "hidden");
          const targetSheets = visibleSheets.length > 0 ? visibleSheets : allWorksheets;

          if (targetSheets.length === 0) {
            setError("Dokumen Excel tidak memiliki lembar kerja (worksheet).");
            setLoading(false);
            return;
          }

          const parsedSheets: ParsedSheet[] = [];

          for (const ws of targetSheets) {
            const rawModel = (ws as any).model;
            const merges: string[] = rawModel?.merges || [];

            // Extract embedded images from worksheet (e.g. stamped QR signatures)
            const imageMap = new Map<string, string>(); // "row,col" -> base64 dataUrl
            try {
              const wsImages = ws.getImages ? ws.getImages() : [];
              for (const img of wsImages) {
                if (img && img.imageId !== undefined) {
                  const imgData = (workbook as any).getImage(img.imageId);
                  if (imgData && imgData.buffer) {
                    let binary = "";
                    const bytes = new Uint8Array(imgData.buffer);
                    const len = bytes.byteLength;
                    for (let b = 0; b < len; b++) {
                      binary += String.fromCharCode(bytes[b]);
                    }
                    const base64 = window.btoa(binary);
                    const ext = imgData.extension || "png";
                    const dataUrl = `data:image/${ext};base64,${base64}`;

                    // tl range is 0-indexed: tl.row, tl.col
                    const tlRow = Math.floor(img.range?.tl?.row ?? 0) + 1;
                    const tlCol = Math.floor(img.range?.tl?.col ?? 0) + 1;
                    imageMap.set(`${tlRow},${tlCol}`, dataUrl);
                  }
                }
              }
            } catch (imgErr) {
              console.warn("[ReportPreview] Could not extract sheet images:", imgErr);
            }

            // Pre-calculate merge spans
            const mergeLookup = new Map<string, { rowSpan: number; colSpan: number }>();
            const skipCoords = new Set<string>();

            for (const mergeStr of merges) {
              const [startCell, endCell] = mergeStr.split(":");
              if (!startCell || !endCell) continue;

              const startMatch = startCell.match(/([A-Z]+)(\d+)/);
              const endMatch = endCell.match(/([A-Z]+)(\d+)/);
              if (!startMatch || !endMatch) continue;

              function colLetterToNumber(letter: string): number {
                let col = 0;
                for (let i = 0; i < letter.length; i++) {
                  col = col * 26 + (letter.charCodeAt(i) - 64);
                }
                return col;
              }

              const startCol = colLetterToNumber(startMatch[1]);
              const startRow = parseInt(startMatch[2], 10);
              const endCol = colLetterToNumber(endMatch[1]);
              const endRow = parseInt(endMatch[2], 10);

              const rowSpan = Math.max(1, endRow - startRow + 1);
              const colSpan = Math.max(1, endCol - startCol + 1);

              mergeLookup.set(`${startRow},${startCol}`, { rowSpan, colSpan });

              // Mark all internal slave cells as skipped
              for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                  if (r === startRow && c === startCol) continue;
                  skipCoords.add(`${r},${c}`);
                }
              }
            }

            const rowCount = Math.min(ws.rowCount, 500); // Guard max 500 rows for preview performance
            let maxCols = 0;
            const parsedRows: ParsedCell[][] = [];

            ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber > 500) return;
              if (row.cellCount > maxCols) maxCols = row.cellCount;

              const cellRow: ParsedCell[] = [];
              const lastCol = Math.min(row.cellCount, 40); // Cap 40 columns for preview

              for (let colIdx = 1; colIdx <= lastCol; colIdx++) {
                const coord = `${rowNumber},${colIdx}`;
                if (skipCoords.has(coord)) {
                  cellRow.push({ text: "", hiddenByMerge: true });
                  continue;
                }

                const cell = row.getCell(colIdx);
                const { text, align, isNumber } = formatCellValue(cell.value);

                const mergeInfo = mergeLookup.get(coord);
                const isBold = Boolean(cell.font?.bold);
                const isItalic = Boolean(cell.font?.italic);

                let bgColor: string | undefined;
                if (cell.fill && (cell.fill as any).fgColor?.argb) {
                  bgColor = convertArgbToRgba((cell.fill as any).fgColor.argb);
                }

                let textColor: string | undefined;
                if (cell.font?.color?.argb) {
                  textColor = convertArgbToRgba(cell.font.color.argb);
                }

                const imageSrc = imageMap.get(coord);

                cellRow.push({
                  text,
                  align: (cell.alignment?.horizontal as any) || align || (isNumber ? "right" : "left"),
                  bold: isBold,
                  italic: isItalic,
                  isNumber,
                  rowSpan: mergeInfo?.rowSpan,
                  colSpan: mergeInfo?.colSpan,
                  bgColor,
                  textColor,
                  imageSrc,
                });
              }

              parsedRows.push(cellRow);
            });

            parsedSheets.push({
              name: ws.name,
              rows: parsedRows,
              maxCols: Math.min(maxCols, 40),
            });
          }

          setSheets(parsedSheets);

          // RESUM worksheet priority per Section 10
          const resumIndex = parsedSheets.findIndex(
            (s) => s.name.trim().toUpperCase() === "RESUM"
          );
          if (resumIndex !== -1) {
            setActiveSheetIndex(resumIndex);
          } else {
            setActiveSheetIndex(0);
          }
        } else if (isPdf || isImage) {
          localBlobUrl = window.URL.createObjectURL(blob);
          setBlobUrl(localBlobUrl);
        } else {
          // Unsupported file preview
          setError("Format file ini tidak mendukung preview interaktif. Silakan unduh dokumen untuk membukanya secara lokal.");
        }

        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        // Safe logging without exposing stack trace to user
        console.warn("[ReportPreview] Gagal memuat file laporan:", err?.message || err);
        setError("Preview laporan tidak dapat ditampilkan.");
        setLoading(false);
      }
    }

    loadReport();

    return () => {
      isCancelled = true;
      if (localBlobUrl) {
        window.URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [approvalId, activeArtifactId, activeRevisionNumber, isXlsx, isPdf, isImage, reloadKey]);

  const activeSheet = sheets[activeSheetIndex];

  return (
    <div className="ap-preview-wrapper" style={{ marginTop: 14 }}>
      {/* Visual Disclaimer (Section 9) */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "var(--ap-card-subtle, #f8fafc)",
          border: "1px solid var(--ap-line, #e2e8f0)",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 12.5,
          color: "var(--ap-ink2, #64748b)",
          lineHeight: 1.45,
        }}
      >
        <Info size={16} style={{ color: "#3b82f6", flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: "var(--ap-ink, #1e293b)" }}>Informasi Preview: </span>
          Laporan dibaca langsung secara aman (read-only). Beberapa elemen visual Excel hanya tersedia pada file asli.
        </div>
      </div>

      {/* Loading State (Section 12) */}
      {loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "44px 20px",
            background: "#ffffff",
            border: "1px solid var(--ap-line, #e2e8f0)",
            borderRadius: 8,
            gap: 12,
            color: "var(--ap-ink2, #64748b)",
          }}
        >
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--ap-brand, #b3212f)" }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Memuat preview laporan...</span>
        </div>
      )}

      {/* Error Fallback State (Section 13) */}
      {!loading && error && (
        <div
          style={{
            padding: "24px 20px",
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 8,
            textAlign: "center",
            color: "#991b1b",
          }}
        >
          <AlertCircle size={28} style={{ color: "#dc2626", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
            Preview laporan tidak dapat ditampilkan.
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 420, margin: "0 auto 16px" }}>
            {error}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#1e293b",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Coba Lagi</span>
            </button>
            {onDownloadOriginal && (
              <button
                type="button"
                onClick={onDownloadOriginal}
                disabled={isDownloadingOriginal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "var(--ap-brand, #b3212f)",
                  border: "none",
                  borderRadius: 6,
                  cursor: isDownloadingOriginal ? "not-allowed" : "pointer",
                  opacity: isDownloadingOriginal ? 0.7 : 1,
                }}
              >
                <Download size={13} />
                <span>Unduh File Asli</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* XLSX Workbook Preview (Section 7, 8, 10) */}
      {!loading && !error && isXlsx && sheets.length > 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--ap-line, #e2e8f0)",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Worksheet Navigation Tabs (Section 10) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 8px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
            role="tablist"
            aria-label="Lembar kerja dokumen"
          >
            {sheets.map((sheet, idx) => {
              const isActive = idx === activeSheetIndex;
              return (
                <button
                  key={sheet.name + idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSheetIndex(idx)}
                  style={{
                    padding: "5px 12px",
                    fontSize: 11.5,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--ap-brand, #b3212f)" : "#475569",
                    background: isActive ? "#ffffff" : "transparent",
                    border: isActive ? "1px solid #cbd5e1" : "1px solid transparent",
                    borderBottomColor: isActive ? "#ffffff" : "transparent",
                    borderRadius: "5px 5px 0 0",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all .15s ease",
                  }}
                >
                  <FileSpreadsheet size={13} style={{ opacity: isActive ? 1 : 0.6 }} />
                  <span>{sheet.name}</span>
                </button>
              );
            })}
          </div>

          {/* Worksheet Table Container (Scrollable, Read-Only) */}
          <div
            style={{
              maxHeight: 460,
              overflow: "auto",
              background: "#ffffff",
              position: "relative",
            }}
          >
            {activeSheet && activeSheet.rows.length > 0 ? (
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 12,
                  color: "#1e293b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <tbody>
                  {activeSheet.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ height: 24 }}>
                      {/* Row coordinate */}
                      <td
                        style={{
                          width: 32,
                          minWidth: 32,
                          textAlign: "center",
                          fontSize: 10,
                          color: "#94a3b8",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          userSelect: "none",
                          fontWeight: 600,
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => {
                        if (cell.hiddenByMerge) return null;
                        return (
                          <td
                            key={cIdx}
                            rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
                            colSpan={cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined}
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: cell.imageSrc ? "6px 8px" : "4px 8px",
                              textAlign: cell.align || "left",
                              fontWeight: cell.bold ? 700 : "normal",
                              fontStyle: cell.italic ? "italic" : "normal",
                              backgroundColor: cell.bgColor || "transparent",
                              color: cell.textColor || "#1e293b",
                              whiteSpace: cell.imageSrc ? "normal" : "pre",
                              minWidth: cell.imageSrc ? 90 : 72,
                              verticalAlign: cell.imageSrc ? "middle" : "top",
                            }}
                          >
                            {cell.imageSrc ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={cell.imageSrc}
                                  alt="Signature QR"
                                  style={{
                                    maxWidth: 90,
                                    maxHeight: cell.rowSpan && cell.rowSpan > 1 ? 85 : 55,
                                    objectFit: "contain",
                                    display: "block",
                                    margin: "0 auto",
                                  }}
                                />
                                {cell.text && (
                                  <span style={{ fontSize: 10, color: "var(--ap-ink2, #64748b)" }}>{cell.text}</span>
                                )}
                              </div>
                            ) : (
                              cell.text
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                Lembar kerja kosong.
              </div>
            )}
          </div>

          {/* Footer of Table: Row Count & Active Sheet Info */}
          <div
            style={{
              padding: "6px 12px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              fontSize: 11,
              color: "#64748b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Lembar: <strong>{activeSheet?.name || "-"}</strong> ({activeSheet?.rows?.length || 0} baris)</span>
            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>Hanya Tinjauan (Read-Only)</span>
          </div>
        </div>
      )}

      {/* PDF Inline Viewer (Section 15) */}
      {!loading && !error && isPdf && blobUrl && (
        <div
          style={{
            height: 480,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
            background: "#525659",
          }}
        >
          <iframe
            src={`${blobUrl}#toolbar=0`}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Preview PDF Laporan"
          />
        </div>
      )}

      {/* Image Inline Viewer (Section 15) */}
      {!loading && !error && isImage && blobUrl && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 16,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            maxHeight: 480,
            overflow: "auto",
          }}
        >
          <img
            src={blobUrl}
            alt="Preview Laporan"
            style={{ maxWidth: "100%", maxHeight: 440, objectFit: "contain", borderRadius: 4 }}
          />
        </div>
      )}
    </div>
  );
}
