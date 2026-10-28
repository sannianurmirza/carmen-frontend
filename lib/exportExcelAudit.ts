import ExcelJS from "exceljs";
import { AuditEntryItemResponse, AuditKriteriaItem } from "@/lib/api";

export function formatDateID(iso: string): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const idx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${monthNames[idx] || month} ${year}`;
}

const A_CELLS = [
  "E9", "E11", "E13", "E15", "E17", "E20", "E21", "E22", "E23", "E26", "E29",
  "E31", "E32", "E33", "E35", "E37", "E38", "E39", "E40", "E41", "E44", "E47",
  "E50", "E51", "E55", "E59", "E62"
];

const B_CELLS = [
  "L9", "L12", "L14", "L17", "L19", "L21", "L23", "L25", "L27", "L28", "L30",
  "L31", "L32", "L33", "L34", "L36", "L39", "L43", "L48", "L49", "L50", "L51",
  "L52", "L53", "L55", "L56", "L60"
];

const DEFAULT_A_POINTS = [
  10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 15, 15, 10, 10
];

const DEFAULT_B_POINTS = [
  20, 20, 20, 20, 15, 20, 20, 75, 15, 15, 15, 15, 15, 15, 15, 25, 25, 20, 25, 30, 30, 30, 30, 30, 30, 30, 30
];

export async function generateAuditExcelBuffer(
  entries: AuditEntryItemResponse[],
  kriteriaList: AuditKriteriaItem[],
  cateringNamaFilter: string = "SEMUA CATERING",
  startISO?: string,
  endISO?: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const entry = entries[0];

  const kriteriaMap = new Map<number, number>();
  kriteriaList.forEach((k) => kriteriaMap.set(k.id, k.point));

  try {
    const res = await fetch("/Form Audit Dapur Catering Rev 5 2023.xlsx");
    if (res.ok) {
      const templateBuffer = await res.arrayBuffer();
      await workbook.xlsx.load(templateBuffer);

      const ws = workbook.getWorksheet("CHECK SHEET DAPUR rev (2)") || workbook.worksheets[0];

      if (ws) {
        // Disable pageBreakPreview to remove "Page 1" watermark
        ws.views = [{ state: "normal", showGridLines: true }];
        if (ws.headerFooter) {
          ws.headerFooter.oddHeader = "";
          ws.headerFooter.oddFooter = "";
          ws.headerFooter.evenHeader = "";
          ws.headerFooter.evenFooter = "";
          ws.headerFooter.firstHeader = "";
          ws.headerFooter.firstFooter = "";
        }

        if (entry) {
          // 2. Fix large gap between Tanggal/Catering and colon (Image 2 format)
          ws.getCell("D2").value = `:  ${formatDateID(entry.tanggal)}`;
          ws.getCell("D2").font = { name: "Calibri", size: 11, bold: true };
          ws.getCell("E2").value = "";

          ws.getCell("D3").value = `:  ${entry.catering_nama}`;
          ws.getCell("D3").font = { name: "Calibri", size: 11, bold: true };
          ws.getCell("E3").value = "";

          // Ensure tercentangSet converts all IDs to number
          const tercentangSet = new Set((entry.tercentang_ids || []).map((id) => Number(id)));

          // 1. Fill Point columns & set GREEN (FF00B050) for checked items
          A_CELLS.forEach((cellRef, idx) => {
            const id = idx + 1;
            const pt = kriteriaMap.get(id) ?? DEFAULT_A_POINTS[idx] ?? 10;
            const cell = ws.getCell(cellRef);
            cell.value = Number(pt);
            cell.numFmt = "0";

            const isChecked = tercentangSet.has(id);
            cell.font = {
              name: "Calibri",
              size: 10,
              bold: isChecked,
              color: { argb: isChecked ? "FF00B050" : "FF000000" },
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          });

          B_CELLS.forEach((cellRef, idx) => {
            const id = 28 + idx;
            const pt = kriteriaMap.get(id) ?? DEFAULT_B_POINTS[idx] ?? 20;
            const cell = ws.getCell(cellRef);
            cell.value = Number(pt);
            cell.numFmt = "0";

            const isChecked = tercentangSet.has(id);
            cell.font = {
              name: "Calibri",
              size: 10,
              bold: isChecked,
              color: { argb: isChecked ? "FF00B050" : "FF000000" },
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          });

          const commentsList = entry.comments || [];
          const getComment = (sisi: string, kat: string) => {
            const found = commentsList.find(
              (c) => c.sisi.toUpperCase() === sisi.toUpperCase() && c.kategori.toUpperCase() === kat.toUpperCase()
            );
            return found ? found.comment || "" : "";
          };

          // Unmerge old template merged cells first to allow complete category merging
          const oldMergesToUnmerge = [
            "F9:F16", "F17:F19", "F20:F31", "F33:F40", "F41:F50", "F51:F64",
            "M9:M24", "M27:M35", "M36:M48", "M49:M64"
          ];
          oldMergesToUnmerge.forEach((range) => {
            try { ws.unMergeCells(range); } catch (e) {}
          });

          // Form A Comment ranges in Column F
          const formACommentRanges: { kat: string; cellRef: string; range: string; startRow: number; endRow: number }[] = [
            { kat: "BAHAN", cellRef: "F9", range: "F9:F19", startRow: 9, endRow: 19 },
            { kat: "PERLENGKAPAN", cellRef: "F20", range: "F20:F32", startRow: 20, endRow: 32 },
            { kat: "PENCUCIAN", cellRef: "F33", range: "F33:F40", startRow: 33, endRow: 40 },
            { kat: "LINGKUNGAN", cellRef: "F41", range: "F41:F50", startRow: 41, endRow: 50 },
            { kat: "LIMBAH", cellRef: "F51", range: "F51:F64", startRow: 51, endRow: 64 },
          ];
          formACommentRanges.forEach(({ kat, cellRef, range, startRow, endRow }) => {
            const comm = getComment("A", kat);
            try { ws.mergeCells(range); } catch (e) {}
            const cell = ws.getCell(cellRef);
            cell.value = comm;
            for (let r = startRow; r <= endRow; r++) {
              const c = ws.getCell(`F${r}`);
              c.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF334155" } };
              c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            }
          });

          // Form B Comment ranges in Column M
          const formBCommentRanges: { kat: string; cellRef: string; range: string; startRow: number; endRow: number }[] = [
            { kat: "PERLENGKAPAN", cellRef: "M9", range: "M9:M24", startRow: 9, endRow: 24 },
            { kat: "OTHERS", cellRef: "M25", range: "M25:M26", startRow: 25, endRow: 26 },
            { kat: "MAKANAN", cellRef: "M27", range: "M27:M35", startRow: 27, endRow: 35 },
            { kat: "PEKERJA", cellRef: "M36", range: "M36:M48", startRow: 36, endRow: 48 },
            { kat: "HIGENITAS", cellRef: "M49", range: "M49:M64", startRow: 49, endRow: 64 },
          ];
          formBCommentRanges.forEach(({ kat, cellRef, range, startRow, endRow }) => {
            const comm = getComment("B", kat);
            try { ws.mergeCells(range); } catch (e) {}
            const cell = ws.getCell(cellRef);
            cell.value = comm;
            for (let r = startRow; r <= endRow; r++) {
              const c = ws.getCell(`M${r}`);
              c.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF334155" } };
              c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            }
          });

          // 3. Calculate percentages & final score (Image 3 format)
          const totalA = entry.total_nilai_a ?? 0;
          const totalB = entry.total_nilai_b ?? 0;
          const maxA = entry.maksimum_sisi_a || (entry.total_nilai_a ? 510 : 0);
          const maxB = entry.maksimum_sisi_b || (entry.total_nilai_b ? 650 : 0);
          const pctA = entry.persentase_sisi_a ?? entry.nilai_a_pct ?? (maxA > 0 ? (Math.round((totalA / maxA) * 100 * 100) / 100) : 0);
          const pctB = entry.persentase_sisi_b ?? entry.nilai_b_pct ?? (maxB > 0 ? (Math.round((totalB / maxB) * 100 * 100) / 100) : 0);
          const totalMax = (maxA + maxB) || 1160;
          const nilaiFinal = entry.nilai_audit ?? entry.nilai_final ?? (totalMax > 0 ? (Math.round(((totalA + totalB) / totalMax) * 100 * 100) / 100) : 0);

          const borderThin = { style: "thin", color: { argb: "FF000000" } } as const;
          const borderMedium = { style: "medium", color: { argb: "FF000000" } } as const;

          // Bold all ITEM Category labels in Column A (Form A) and Column H (Form B)
          for (let r = 7; r <= 65; r++) {
            const cellA = ws.getCell(`A${r}`);
            if (cellA.value) {
              cellA.font = { name: "Calibri", size: 10, bold: true };
            }
            const cellH = ws.getCell(`H${r}`);
            if (cellH.value) {
              cellH.font = { name: "Calibri", size: 10, bold: true };
            }
          }

          // Clear dotted borders between D65 & E65 and K65 & L65
          ws.getCell("D65").border = { ...ws.getCell("D65").border, right: undefined };
          ws.getCell("D66").border = { ...ws.getCell("D66").border, right: undefined };
          ws.getCell("E65").border = { ...ws.getCell("E65").border, left: undefined };
          ws.getCell("E66").border = { ...ws.getCell("E66").border, left: undefined };

          // Unmerge template merged cells F65 / M65 first
          try { ws.unMergeCells("F65"); } catch (e) {}
          try { ws.unMergeCells("M65"); } catch (e) {}

          try { ws.mergeCells("E65:F66"); } catch (e) {}
          const cellE65 = ws.getCell("E65");
          cellE65.value = pctA / 100;
          cellE65.numFmt = "0%";
          cellE65.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
          cellE65.alignment = { horizontal: "center", vertical: "middle" };

          // Solid bottom border for Table A at row 66
          for (let c = 1; c <= 6; c++) {
            const cell = ws.getCell(66, c);
            cell.border = { ...cell.border, bottom: borderMedium };
          }
          ws.getCell("F65").border = { ...ws.getCell("F65").border, right: borderMedium };
          ws.getCell("F66").border = { ...ws.getCell("F66").border, right: borderMedium };

          ws.getCell("K65").border = { ...ws.getCell("K65").border, right: undefined };
          ws.getCell("K66").border = { ...ws.getCell("K66").border, right: undefined };
          ws.getCell("L65").border = { ...ws.getCell("L65").border, left: undefined };
          ws.getCell("L66").border = { ...ws.getCell("L66").border, left: undefined };

          try { ws.mergeCells("L65:M66"); } catch (e) {}
          const cellL65 = ws.getCell("L65");
          cellL65.value = pctB / 100;
          cellL65.numFmt = "0%";
          cellL65.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
          cellL65.alignment = { horizontal: "center", vertical: "middle" };

          // Solid bottom border for Table B at row 66
          for (let c = 8; c <= 13; c++) {
            const cell = ws.getCell(66, c);
            cell.border = { ...cell.border, bottom: borderMedium };
          }
          ws.getCell("M65").border = { ...ws.getCell("M65").border, right: borderMedium };
          ws.getCell("M66").border = { ...ws.getCell("M66").border, right: borderMedium };

          // Build "Penilaian" Box under Form B (Image 2 format)
          // Box Range: I68:M72
          try { ws.mergeCells("J69:K69"); } catch (e) {}
          try { ws.mergeCells("J71:K71"); } catch (e) {}
          try { ws.mergeCells("L70:M70"); } catch (e) {}

          // Header inside Penilaian box: I68
          const cellPenilaian = ws.getCell("I68");
          cellPenilaian.value = "Penilaian";
          cellPenilaian.font = { name: "Calibri", size: 11, bold: true, underline: true };

          // "Nilai =" in I70
          const cellNilaiLabel = ws.getCell("I70");
          cellNilaiLabel.value = "Nilai =";
          cellNilaiLabel.font = { name: "Calibri", size: 11, bold: true };
          cellNilaiLabel.alignment = { horizontal: "center", vertical: "middle" };

          // Numerator: "Total Nilai" in J69:K69
          const numCell = ws.getCell("J69");
          numCell.value = "Total Nilai";
          numCell.font = { name: "Calibri", size: 10, bold: false };
          numCell.alignment = { horizontal: "center", vertical: "bottom" };

          // Fraction line (bottom border of J69 and K69)
          ws.getCell("J69").border = { bottom: borderThin };
          ws.getCell("K69").border = { bottom: borderThin };

          // Denominator: "Total Item Point Penilaian" in J71:K71
          const denCell = ws.getCell("J71");
          denCell.value = "Total Item Point Penilaian";
          denCell.font = { name: "Calibri", size: 10, bold: false };
          denCell.alignment = { horizontal: "center", vertical: "top" };

          // Formula right: "X   100 %   =   100%" in L70:M70
          const rightCell = ws.getCell("L70");
          rightCell.value = `X   100 %   =   ${Number(nilaiFinal).toFixed(2)}%`;
          rightCell.font = { name: "Calibri", size: 11, bold: true };
          rightCell.alignment = { horizontal: "center", vertical: "middle" };

          // Re-apply outer medium border for Penilaian box (I68:M72) after merges to ensure unbroken lines
          for (let r = 68; r <= 72; r++) {
            for (let c = 9; c <= 13; c++) {
              const cell = ws.getCell(r, c);
              const top = r === 68 ? borderMedium : cell.border?.top;
              const bottom = r === 72 ? borderMedium : cell.border?.bottom;
              const left = c === 9 ? borderMedium : cell.border?.left;
              const right = c === 13 ? borderMedium : cell.border?.right;

              cell.border = {
                top,
                bottom,
                left,
                right,
              };
            }
          }
        }
      }

      const outBuffer = await workbook.xlsx.writeBuffer();
      return outBuffer;
    }
  } catch (e) {
    console.warn("Using fallback template loader:", e);
  }

  // Fallback if template loading fails
  const ws = workbook.addWorksheet("CHECK SHEET DAPUR rev (2)", {
    views: [{ state: "normal", showGridLines: true }],
  });

  if (entry) {
    ws.getCell("D2").value = `:  ${formatDateID(entry.tanggal)}`;
    ws.getCell("D3").value = `:  ${entry.catering_nama}`;
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return outBuffer;
}

export function generateAuditCSVString(
  entry: AuditEntryItemResponse,
  kriteriaList: AuditKriteriaItem[]
): string {
  function csvCell(v: string | number) {
    return `"${String(v).replace(/"/g, '""')}"`;
  }

  const commentsList = entry.comments || [];
  const getComment = (sisi: string, kat: string) => {
    const found = commentsList.find(
      (c) => c.sisi.toUpperCase() === sisi.toUpperCase() && c.kategori.toUpperCase() === kat.toUpperCase()
    );
    return found ? found.comment || "" : "";
  };

  const tercentangSet = new Set((entry.tercentang_ids || []).map((id) => Number(id)));

  const grouped: { A: Record<string, AuditKriteriaItem[]>; B: Record<string, AuditKriteriaItem[]> } = {
    A: {},
    B: {},
  };

  kriteriaList.forEach((k) => {
    const sisi = k.sisi.toUpperCase() as "A" | "B";
    if (!grouped[sisi]) grouped[sisi] = {};
    const cleanKat = k.kategori.replace(/B\s*A\s*H\s*A\s*N/gi, "BAHAN").trim().toUpperCase();
    if (!grouped[sisi][cleanKat]) grouped[sisi][cleanKat] = [];
    grouped[sisi][cleanKat].push(k);
  });

  const lines: string[] = [];

  lines.push([csvCell("PT JAI - AUDIT DAPUR CATERING")].join(","));
  lines.push(
    [
      csvCell(`Catering: ${entry.catering_nama}`),
      csvCell(""),
      csvCell(`Tanggal: ${formatDateID(entry.tanggal)}`),
    ].join(",")
  );
  lines.push("");

  // === FORM A ===
  lines.push([csvCell("=== FORM A ===")].join(","));
  lines.push(["Kategori", "Material", "Deskripsi", "Point", "Tercentang"].map(csvCell).join(","));

  Object.entries(grouped.A).forEach(([katName, items]) => {
    items.forEach((item) => {
      const isChecked = tercentangSet.has(item.id) ? "Ya" : "Tidak";
      lines.push([katName, item.material || "-", item.deskripsi, item.point, isChecked].map(csvCell).join(","));
    });
    const comm = getComment("A", katName);
    lines.push([csvCell(`Comment (${katName}): ${comm}`)].join(","));
  });

  lines.push("");

  // === FORM B ===
  lines.push([csvCell("=== FORM B ===")].join(","));
  lines.push(["Kategori", "Material", "Deskripsi", "Point", "Tercentang"].map(csvCell).join(","));

  Object.entries(grouped.B).forEach(([katName, items]) => {
    items.forEach((item) => {
      const isChecked = tercentangSet.has(item.id) ? "Ya" : "Tidak";
      lines.push([katName, item.material || "-", item.deskripsi, item.point, isChecked].map(csvCell).join(","));
    });
    const comm = getComment("B", katName);
    lines.push([csvCell(`Comment (${katName}): ${comm}`)].join(","));
  });

  const totalRawPoints = (entry.total_nilai_a || 0) + (entry.total_nilai_b || 0);
  const totalMaxPoints = (entry.maksimum_sisi_a || 510) + (entry.maksimum_sisi_b || 650);
  lines.push("");
  lines.push([csvCell(`TOTAL POIN: ${totalRawPoints} / ${totalMaxPoints}`)].join(","));
  lines.push([csvCell(`NILAI AUDIT: ${Number(entry.nilai_audit ?? entry.nilai_final).toFixed(2)}%`)].join(","));

  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCSVBuffer(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
