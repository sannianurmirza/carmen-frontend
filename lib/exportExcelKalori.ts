import ExcelJS from "exceljs";
import { CATERING_COLOR_CONFIG, SHAPE_LABELS, Catering } from "@/lib/api";
import { KaloriHarian, KaloriHarianBahan } from "@/lib/api";
import { formatMenuTitleCase } from "@/lib/formatters";

function formatDec(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return "0";
  if (Math.abs(val - Math.round(val)) < 1e-6) {
    return Math.round(val).toString();
  }
  const factor = 100;
  const truncated = Math.floor(Math.trunc(val * factor + 1e-9)) / factor;
  return truncated.toFixed(2);
}

interface ProcessedIngredientRow extends KaloriHarianBahan {
  b_val: number;
}

interface ItemRoleGroup {
  category: string;
  itemRole: string;
  menuName: string;
  roleStandardBerat: number | null;
  items: ProcessedIngredientRow[];
}

function normalizeCategory(rawCat: string | null | undefined): string {
  if (!rawCat) return "Lain-lain";
  const trimmed = rawCat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "nasi") return "Nasi";
  if (lower === "sayur") return "Sayur";
  if (lower === "lauk") return "Lauk";
  if (lower === "buah") return "Buah";
  if (lower === "lain-lain" || lower === "lain_lain" || lower === "lainlain") return "Lain-lain";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// NOTE: This function was previously heuristic based on catering name.
// It is now replaced with a dynamic lookup using the catering master data.
// The function now expects a full Catering object (with warna & bentuk) and returns
// the combined "WARNA BENTUK" label in uppercase, suitable for insertion into the Excel.
export function getWarnaBentuk(catering: Catering): string {
  // Fallback handling: ensure required fields exist
  if (!catering) {
    throw new Error("Data warna atau bentuk kotak makan untuk katering ini belum lengkap. Silakan lengkapi melalui halaman Daftar Katering.");
  }
  const colorLabel = CATERING_COLOR_CONFIG[catering.warna]?.label ?? catering.warna;
  const shapeLabel = SHAPE_LABELS[catering.bentuk]?.label ?? catering.bentuk;
  return `${colorLabel.toUpperCase()} ${shapeLabel.toUpperCase()}`;
}

function groupIngredients(entry: KaloriHarian): ItemRoleGroup[] {
  const rawBahan = entry.bahan || [];
  if (rawBahan.length === 0) return [];

  const KATEGORI_ORDER = ["Nasi", "Sayur", "Lauk", "Buah", "Lain-lain"];
  const groupMap = new Map<string, ProcessedIngredientRow[]>();

  for (const b of rawBahan) {
    const cat = normalizeCategory(b.kategori);
    let role = b.item_role ? b.item_role.trim() : "";
    if (!role) {
      if (cat === "Sayur") role = "SAYUR";
      else if (cat === "Nasi") role = "NASI/MIE";
      else if (cat === "Buah") role = "BUAH";
      else role = "LAUK UTAMA";
    }

    const key = `${cat}__${role}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }

    const actBerat = Math.max(0, b.berat_aktual || 0);
    const bVal = b.standar_berat !== null && b.standar_berat !== undefined ? b.standar_berat : actBerat;

    groupMap.get(key)!.push({
      ...b,
      kategori: cat,
      item_role: role,
      b_val: bVal,
    });
  }

  const sortedEntries = Array.from(groupMap.entries()).sort((a, b) => {
    const catA = a[1][0]?.kategori || "";
    const catB = b[1][0]?.kategori || "";
    let idxA = KATEGORI_ORDER.indexOf(catA);
    let idxB = KATEGORI_ORDER.indexOf(catB);
    if (idxA === -1) idxA = 99;
    if (idxB === -1) idxB = 99;
    return idxA - idxB;
  });

  const result: ItemRoleGroup[] = [];

  for (const [, items] of sortedEntries) {
    if (!items || items.length === 0) continue;
    const cat = items[0].kategori;
    const role = items[0].item_role || "";
    let menuName = "";
    if (cat === "Nasi") {
      menuName = entry.nama_masakan_nasi || "Nasi";
    } else if (cat === "Sayur") {
      menuName = entry.nama_masakan_sayur || "Tumis sayur";
    } else {
      menuName = role || cat;
    }

    let roleStandardBerat: number | null = null;
    for (const item of items) {
      if (item.standar_berat !== null && item.standar_berat !== undefined) {
        roleStandardBerat = item.standar_berat;
      }
    }

    result.push({
      category: cat,
      itemRole: role,
      menuName,
      roleStandardBerat,
      items,
    });
  }

  return result;
}

export function formatDateID(isoDate: string): string {
  if (!isoDate) return "-";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const mIdx = parseInt(month, 10) - 1;
  const monthName = monthNames[mIdx] || month;
  const dayNum = parseInt(day, 10);
  return `${dayNum} ${monthName} ${year}`;
}

function formatSheetDateID(isoDate: string): string {
  if (!isoDate) return "Sheet1";
  const name = formatDateID(isoDate);
  return name.replace(/[\\/?*:[\]]/g, "").slice(0, 31);
}

function setupKaloriWorksheetColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { key: "colA", width: 6 },   // Col A: Index / Note
    { key: "colB", width: 14 },  // Col B: SHIFT / Info Label
    { key: "colC", width: 22 },  // Col C: MENU
    { key: "colD", width: 36 },  // Col D: BAHAN
    { key: "colE", width: 22 },  // Col E: STANDARD KALORI ( A )
    { key: "colF", width: 20 },  // Col F: STANDARD BERAT
    { key: "colG", width: 18 },  // Col G: ACTUAL BERAT
    { key: "colH", width: 24 },  // Col H: TOTAL ACTUAL BERAT
    { key: "colI", width: 38 },  // Col I: BERAT MAXIMAL SESUAI STANDARD (gr) ( B )
    { key: "colJ", width: 18 },  // Col J: TOTAL BERAT
    { key: "colK", width: 26 },  // Col K: ENERGI (kkal) (( B : 100 ) X A )
  ];
}

function renderKaloriEntryBlock(
  worksheet: ExcelJS.Worksheet,
  entry: KaloriHarian,
  blockIdx: number,
  currentRow: number,
  catering: Catering,
  cateringsById?: ReadonlyMap<number, Catering>
): number {
  const groups = groupIngredients(entry);
  const entryCatering = cateringsById?.get(entry.catering_id) ?? catering;

    // --- Row 1: Company Name ---
    const r1 = worksheet.getRow(currentRow);
    r1.getCell(1).value = "PT. JATIM AUTOCOMP INDONESIA";
    r1.getCell(1).font = { name: "Arial", size: 14, bold: true };

    // --- Row 2: Section Name ---
    const r2 = worksheet.getRow(currentRow + 1);
    r2.getCell(1).value = "INDUSTRIAL RELATION SECTION";
    r2.getCell(1).font = { name: "Arial", size: 11, bold: false };

    // --- Row 5: Document Title ---
    const r5 = worksheet.getRow(currentRow + 4);
    r5.getCell(2).value = "HASIL PERHITUNGAN KALORI MAKANAN";
    r5.getCell(2).font = { name: "Arial", size: 14, bold: true };

    // --- Rows 10-12: Entry Info Box ---
    const rInfoStart = currentRow + 9; // Row 10

    // Block Index in Col A
    const numCell = worksheet.getCell(rInfoStart, 1);
    numCell.value = `${blockIdx + 1}.`;
    numCell.font = { name: "Arial", size: 12, bold: false };

    const cateringNama = entryCatering.nama;
    const warnaBentukVal = getWarnaBentuk(entryCatering);

    // Info Box Rows (Red Fill FFFF0000 or clean styling)
    const infoData = [
      { label: "NAMA CATERING   ", val: `: ${cateringNama.toUpperCase()}` },
      { label: "WARNA/BENTUK", val: `: ${warnaBentukVal}` },
      { label: "DATE ", val: `: ${formatDateID(entry.tanggal)}` },
    ];

    infoData.forEach((info, idx) => {
      const rIdx = rInfoStart + idx;
      worksheet.mergeCells(rIdx, 2, rIdx, 3);
      const lblCell = worksheet.getCell(rIdx, 2);
      lblCell.value = info.label;
      lblCell.font = { name: "Arial", size: 11, bold: false };

      const valCell = worksheet.getCell(rIdx, 4);
      valCell.value = info.val;
      valCell.font = { name: "Arial", size: 11, bold: false };
    });

    // --- Row 14: Header Row (10 Columns B to K) ---
    const tableHeaderRow = currentRow + 13; // Row 14
    const rHeader = worksheet.getRow(tableHeaderRow);
    rHeader.height = 38;

    // Header Titles matching user specification & screenshot:
    // SHIFT | MENU | BAHAN | STANDARD KALORI ( A ) | STANDARD BERAT | ACTUAL BERAT | TOTAL ACTUAL BERAT | BERAT MAXIMAL SESUAI STANDARD (gr) ( B ) | TOTAL BERAT | ENERGI (kkal) (( B : 100 ) X A )
    const headers = [
      { col: 2, text: "SHIFT" },
      { col: 3, text: "MENU" },
      { col: 4, text: "BAHAN" },
      { col: 5, text: "STANDARD KALORI\n( A )" },
      { col: 6, text: "STANDARD BERAT" },
      { col: 7, text: "ACTUAL BERAT" },
      { col: 8, text: "TOTAL ACTUAL BERAT" },
      { col: 9, text: "BERAT MAXIMAL SESUAI STANDARD (gr)\n( B )" },
      { col: 10, text: "TOTAL BERAT" },
      { col: 11, text: "ENERGI\n(kkal)\n(( B : 100 ) X A )" },
    ];

    headers.forEach((h) => {
      const cell = rHeader.getCell(h.col);
      cell.value = h.text;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } }; // Silver / Light Gray Header Fill
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        left: h.col === 2 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
        right: h.col === 11 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
      };
    });

    // --- Row 15: Sub-header Row (Shift & Masakan Jenis) ---
    const subHeaderRow = currentRow + 14; // Row 15
    const rSubHeader = worksheet.getRow(subHeaderRow);
    rSubHeader.height = 24;

    const shiftCell = rSubHeader.getCell(2);
    shiftCell.value = entry.shift.toUpperCase();
    shiftCell.alignment = { horizontal: "center", vertical: "middle" };
    shiftCell.font = { name: "Arial", size: 11, bold: false };

    const jenisCell = rSubHeader.getCell(6);
    jenisCell.value = (entry.jenis_masakan || "KERINGAN").toUpperCase();
    jenisCell.alignment = { horizontal: "center", vertical: "middle" };
    jenisCell.font = { name: "Arial", size: 10, bold: true };

    for (let c = 2; c <= 11; c++) {
      const cell = rSubHeader.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: c === 2 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
        right: c === 11 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
      };
    }

    // --- Data Rows (starting Row 16) ---
    let dataRowIndex = subHeaderRow + 1;
    const firstDataRow = dataRowIndex;

    const categoryLabels: Record<string, string> = {
      Nasi: "NASI :",
      Sayur: "SAYUR: ",
      Lauk: "LAUK:",
      Buah: "BUAH:",
      "Lain-lain": "LAIN-LAIN :",
    };

    let lastCategory = "";

    groups.forEach((group) => {
      const itemCount = group.items.length;

      // Print category header label if new category
      if (group.category !== lastCategory) {
        lastCategory = group.category;

        if (group.category === "Sayur" || group.category === "Lain-lain") {
          // Sayur / Lain-lain title row (e.g. Col C: "SAYUR: ", Col D: "Tumis kacang panjang & tempe :")
          const rCat = worksheet.getRow(dataRowIndex);
          rCat.height = 24;
          rCat.getCell(3).value = categoryLabels[group.category] || `${group.category.toUpperCase()}:`;
          rCat.getCell(3).font = { name: "Arial", size: 11, bold: false };
          rCat.getCell(4).value = `${group.menuName} :`;
          rCat.getCell(4).font = { name: "Arial", size: 11, bold: false };

          for (let c = 2; c <= 11; c++) {
            rCat.getCell(c).border = {
              top: { style: "thin", color: { argb: "FF000000" } },
              bottom: { style: "thin", color: { argb: "FF000000" } },
              left: c === 2 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
              right: c === 11 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
            };
          }
          dataRowIndex++;
        }
      }

      const itemsStartRow = dataRowIndex;

      group.items.forEach((item, itemIdx) => {
        const row = worksheet.getRow(dataRowIndex);
        row.height = 24;

        // Col C: Category label for single-line categories (NASI :, LAUK:, BUAH:, Krupuk/Rempeyek, Bumbu:)
        if (itemIdx === 0) {
          if (group.category === "Nasi" || group.category === "Lauk" || group.category === "Buah") {
            row.getCell(3).value = categoryLabels[group.category];
            row.getCell(3).font = { name: "Arial", size: 11, bold: false };
          } else if (group.category === "Lain-lain") {
            const isBumbuGroup = group.itemRole === "BUMBU" || group.itemRole === "BUMBU LAIN-LAIN" || group.items.some((i) => i.preset_name === "bumbu");
            row.getCell(3).value = isBumbuGroup ? "Bumbu:" : item.nama_bahan;
            row.getCell(3).font = { name: "Arial", size: 11, bold: false };
          }
        }

        // Col D: BAHAN Name
        row.getCell(4).value = item.nama_bahan;
        row.getCell(4).font = { name: "Arial", size: 11, bold: false };
        row.getCell(4).alignment = { horizontal: "left", vertical: "middle" };

        // Col E: STANDARD KALORI ( A )
        row.getCell(5).value = item.standar_kalori ? Number(formatDec(item.standar_kalori)) : 0;
        row.getCell(5).font = { name: "Arial", size: 11, bold: false };
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

        // Col F: STANDARD BERAT (only on first row of group if roleStandardBerat exists)
        if (itemIdx === 0) {
          const stdB = item.standar_berat !== null && item.standar_berat !== undefined
            ? item.standar_berat
            : group.roleStandardBerat;
          if (stdB !== null && stdB !== undefined) {
            row.getCell(6).value = Number(formatDec(stdB));
            row.getCell(6).font = { name: "Arial", size: 11, bold: true };
            row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
          }
        }

        // Col G: ACTUAL BERAT
        row.getCell(7).value = item.berat_aktual ? Number(formatDec(item.berat_aktual)) : 0;
        row.getCell(7).font = { name: "Arial", size: 11, bold: false };
        row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };

        // Col H: TOTAL ACTUAL BERAT (Formula)
        if (itemIdx === 0) {
          if (itemCount > 1) {
            row.getCell(8).value = { formula: `=SUM(G${itemsStartRow}:G${itemsStartRow + itemCount - 1})` };
          } else {
            row.getCell(8).value = { formula: `=G${dataRowIndex}` };
          }
          row.getCell(8).font = { name: "Arial", size: 11, bold: false };
          row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
        }

        // Col I: BERAT MAXIMAL SESUAI STANDARD (gr) ( B )
        row.getCell(9).value = Number(formatDec(item.b_val));
        row.getCell(9).font = { name: "Arial", size: 11, bold: false };
        row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };

        // Col J: TOTAL BERAT (Formula)
        if (itemIdx === 0) {
          if (itemCount > 1) {
            row.getCell(10).value = { formula: `=SUM(I${itemsStartRow}:I${itemsStartRow + itemCount - 1})` };
          } else {
            row.getCell(10).value = { formula: `=I${dataRowIndex}` };
          }
          row.getCell(10).font = { name: "Arial", size: 11, bold: false };
          row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
        }

        // Col K: ENERGI (kkal) Formula
        row.getCell(11).value = { formula: `=(I${dataRowIndex}/100)*E${dataRowIndex}` };
        row.getCell(11).font = { name: "Arial", size: 11, bold: false };
        row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };

        // Outer & inner borders for data row cells (Cols B to K)
        for (let c = 2; c <= 11; c++) {
          row.getCell(c).border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            left: c === 2 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
            right: c === 11 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
          };
        }

        dataRowIndex++;
      });

      // Merge Cells for composite groups (itemCount > 1)
      if (itemCount > 1) {
        const endGroupRow = itemsStartRow + itemCount - 1;

        // Col F (STANDARD BERAT)
        worksheet.mergeCells(itemsStartRow, 6, endGroupRow, 6);

        // Col H (TOTAL ACTUAL BERAT)
        worksheet.mergeCells(itemsStartRow, 8, endGroupRow, 8);

        // Col J (TOTAL BERAT)
        worksheet.mergeCells(itemsStartRow, 10, endGroupRow, 10);
      }
    });

    const lastDataRow = dataRowIndex - 1;

    // Merge Shift Cell (Col B) across all data rows of this block
    if (lastDataRow >= firstDataRow) {
      worksheet.mergeCells(subHeaderRow, 2, lastDataRow, 2);
      const shiftMergedCell = worksheet.getCell(subHeaderRow, 2);
      shiftMergedCell.value = entry.shift.toUpperCase();
      shiftMergedCell.alignment = { horizontal: "center", vertical: "middle" };
      shiftMergedCell.font = { name: "Arial", size: 11, bold: false };
    }

    // --- Total Energi Row ---
    const totalRowIdx = dataRowIndex;
    const rTotal = worksheet.getRow(totalRowIdx);
    rTotal.height = 28;

    // Merge Col C to I for "Total energi (kalori)"
    worksheet.mergeCells(totalRowIdx, 3, totalRowIdx, 9);
    const totalLabelCell = worksheet.getCell(totalRowIdx, 3);
    totalLabelCell.value = "Total energi (kalori)";
    totalLabelCell.alignment = { horizontal: "right", vertical: "middle" };
    totalLabelCell.font = { name: "Arial", size: 11, bold: false };

    for (let c = 2; c <= 10; c++) {
      worksheet.getCell(totalRowIdx, c).border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        left: c === 2 ? { style: "medium", color: { argb: "FF000000" } } : { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }

    // Col K: Total Energi Formula `=SUM(K{firstDataRow}:K{lastDataRow})` with Soft Blue fill
    const totalValCell = worksheet.getCell(totalRowIdx, 11);
    totalValCell.value = { formula: `=SUM(K${firstDataRow}:K${lastDataRow})` };
    totalValCell.alignment = { horizontal: "center", vertical: "middle" };
    totalValCell.font = { name: "Arial", size: 11, bold: true };
    totalValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; // Soft Blue fill
    totalValCell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };

    dataRowIndex++;

    // --- Note Section (matching Book1.xlsx Rows 45-52) ---
    const rNoteStart = dataRowIndex + 3;

    const noteLines = [
      { colA: "NOTE : ", colB: "A. Bagi yang tidak memenuhi standar kalori," },
      { colA: "", colB: "     Harap segera meningkatkan perbaikan kalorinya!!!" },
      { colA: "", colB: "     Bila tidak ada perbaikan akan diberikan sanksi." },
      { colA: "", colB: "" },
      { colA: "", colB: "B. Harap menu catering yang dihidangkan disesuaikan dengan " },
      { colA: "", colB: "     menu yang terdaftar (disepakati) !" },
      { colA: "", colB: "" },
      { colA: "", colB: "C. Menu tidak sesuai : Tidak ada" },
    ];

    noteLines.forEach((n, idx) => {
      const rN = worksheet.getRow(rNoteStart + idx);
      if (n.colA) {
        rN.getCell(1).value = n.colA;
        rN.getCell(1).font = { name: "Arial", size: 11, bold: true };
      }
      if (n.colB) {
        rN.getCell(2).value = n.colB;
        rN.getCell(2).font = { name: "Calibri", size: 11, bold: true };
      }
    });

  return rNoteStart + noteLines.length + 4;
}

export type ExportKaloriDetailOptions = {
  groupByDateSheets?: boolean;
};

export async function generateKaloriExcelBuffer(
  entries: KaloriHarian[],
  catering: Catering,
  startDate: string,
  endDate: string,
  cateringsById?: ReadonlyMap<number, Catering>,
  options?: ExportKaloriDetailOptions
): Promise<ArrayBuffer> {
  if (!entries || entries.length === 0) {
    throw new Error("Tidak ada data laporan kalori untuk diexport.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT. JATIM AUTOCOMP INDONESIA";
  workbook.lastModifiedBy = "Internal Relation Section";
  workbook.created = new Date();

  const shiftRank = (s: string) => (s?.toUpperCase() === "PAGI" ? 1 : 2);

  if (options?.groupByDateSheets) {
    // 1. Group entries by date (using entry.tanggal without timezone conversions)
    const dateMap = new Map<string, KaloriHarian[]>();
    for (const entry of entries) {
      if (!entry.tanggal) continue;
      if (!dateMap.has(entry.tanggal)) {
        dateMap.set(entry.tanggal, []);
      }
      dateMap.get(entry.tanggal)!.push(entry);
    }

    // 2. Sort dates chronologically from earliest to latest
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));

    if (sortedDates.length === 0) {
      throw new Error("Tidak ada data laporan kalori dengan tanggal yang valid untuk diexport.");
    }

    const usedSheetNames = new Set<string>();

    for (const dateStr of sortedDates) {
      let sheetName = formatSheetDateID(dateStr);
      let counter = 1;
      while (usedSheetNames.has(sheetName.toLowerCase())) {
        counter++;
        sheetName = `${formatSheetDateID(dateStr).slice(0, 27)} (${counter})`;
      }
      usedSheetNames.add(sheetName.toLowerCase());

      const ws = workbook.addWorksheet(sheetName, {
        pageSetup: { paperSize: 9, orientation: "landscape" },
        views: [{ showGridLines: true }],
      });
      setupKaloriWorksheetColumns(ws);

      const entriesOnDate = dateMap.get(dateStr) || [];
      // Sort: PAGI before MALAM, and consistent catering order (A-Z)
      entriesOnDate.sort((a, b) => {
        const sDiff = shiftRank(a.shift || "") - shiftRank(b.shift || "");
        if (sDiff !== 0) return sDiff;
        const catA = (cateringsById?.get(a.catering_id)?.nama || catering.nama || "").toLowerCase();
        const catB = (cateringsById?.get(b.catering_id)?.nama || catering.nama || "").toLowerCase();
        const cDiff = catA.localeCompare(catB);
        if (cDiff !== 0) return cDiff;
        return (a.id || 0) - (b.id || 0);
      });

      let currentRow = 1;
      entriesOnDate.forEach((entry, blockIdx) => {
        currentRow = renderKaloriEntryBlock(ws, entry, blockIdx, currentRow, catering, cateringsById);
      });
    }
  } else {
    // Default / Single report action: Single worksheet named with date format (e.g. 2 September 2026)
    const cateringNama = catering.nama;
    const singleDateStr = entries[0]?.tanggal ? formatSheetDateID(entries[0].tanggal) : "";
    const sheetName = singleDateStr || `detail kalori ${cateringNama.split(" ")[0] || "Catering"}`;
    const worksheet = workbook.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: "landscape" },
      views: [{ showGridLines: true }],
    });
    setupKaloriWorksheetColumns(worksheet);

    let currentRow = 1;
    entries.forEach((entry, blockIdx) => {
      currentRow = renderKaloriEntryBlock(worksheet, entry, blockIdx, currentRow, catering, cateringsById);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

const MONTH_ABBR_ID = [
  "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES",
  "JAN", "FEB", "MAR", "APR", "MEI"
];

function getMonthAbbrID(monthIdx: number): string {
  const abbrs = [
    "JAN", "FEB", "MAR", "APR", "MEI", "JUN",
    "JUL", "AGU", "SEP", "OKT", "NOV", "DES"
  ];
  return abbrs[monthIdx] || "";
}

function getFullMonthNameID(monthIdx: number): string {
  const fullNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  return fullNames[monthIdx] || "";
}

export async function generateKaloriWeeklyExcelBuffer(
  entries: KaloriHarian[],
  allCaterings: Catering[],
  startDateISO: string,
  endDateISO: string,
  selectedCateringId?: number | "",
  selectedShift?: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT. JATIM AUTOCOMP INDONESIA";
  workbook.lastModifiedBy = "Industrial Relation Section";
  workbook.created = new Date();

  // 1. Target Caterings to display as columns
  let cateringsToExport: Catering[] = [];
  if (selectedCateringId) {
    const found = allCaterings.find((c) => c.id === Number(selectedCateringId));
    if (found) cateringsToExport = [found];
    else cateringsToExport = allCaterings;
  } else {
    const entryCatIds = new Set(entries.map((e) => e.catering_id));
    cateringsToExport = allCaterings.filter((c) => c.is_active || entryCatIds.has(c.id));
    if (cateringsToExport.length === 0) cateringsToExport = allCaterings;
  }

  // Sort caterings consistently by ID
  cateringsToExport.sort((a, b) => a.id - b.id);

  // 2. Parse exact user date range
  const sParts = startDateISO.split("-").map(Number);
  const eParts = endDateISO.split("-").map(Number);
  const sDate = new Date(sParts[0], sParts[1] - 1, sParts[2]);
  const eDate = new Date(eParts[0], eParts[1] - 1, eParts[2]);

  const borderThin = {
    top: { style: "thin" as const, color: { argb: "FF000000" } },
    bottom: { style: "thin" as const, color: { argb: "FF000000" } },
    left: { style: "thin" as const, color: { argb: "FF000000" } },
    right: { style: "thin" as const, color: { argb: "FF000000" } },
  };

  // 3. SINGLE SHEET FOR ENTIRE DATE RANGE: "SUMMARY KALORI"
  const sDay = sDate.getDate();
  const sMonthIdx = sDate.getMonth();
  const sYear = sDate.getFullYear();
  const eDay = eDate.getDate();
  const eMonthIdx = eDate.getMonth();
  const eYear = eDate.getFullYear();

  let periodText = "";
  if (sMonthIdx === eMonthIdx && sYear === eYear) {
    periodText = `${sDay} s/d ${eDay} ${getFullMonthNameID(sMonthIdx)} ${sYear}`;
  } else if (sYear === eYear) {
    periodText = `${sDay} ${getFullMonthNameID(sMonthIdx)} s/d ${eDay} ${getFullMonthNameID(eMonthIdx)} ${sYear}`;
  } else {
    periodText = `${sDay} ${getFullMonthNameID(sMonthIdx)} ${sYear} s/d ${eDay} ${getFullMonthNameID(eMonthIdx)} ${eYear}`;
  }

  const worksheet = workbook.addWorksheet("SUMMARY KALORI", {
    views: [{ state: "normal", showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: "landscape" },
  });

  // Total columns = 3 (Tanggal, Shift, Menu) + cateringsToExport.length
  const totalCols = 3 + cateringsToExport.length;

  worksheet.getColumn(1).width = 20.00; // TANGGAL (format "2 September 2026", cukup lebar agar tidak #####)
  worksheet.getColumn(2).width = 10.00; // SHIFT
  worksheet.getColumn(3).width = 63.57; // MENU
  for (let c = 4; c <= totalCols; c++) {
    worksheet.getColumn(c).width = 13.43; // CATERING
  }

  worksheet.getRow(1).height = 13.5;
  worksheet.getRow(2).height = 13.5;
  worksheet.getRow(3).height = 13.5;
  worksheet.getRow(4).height = 15.75;
  worksheet.getRow(5).height = 15.75;
  worksheet.getRow(6).height = 13.5;
  worksheet.getRow(7).height = 24.75;
  worksheet.getRow(8).height = 24.75;

  const cellA1 = worksheet.getCell("A1");
  cellA1.value = "PT JATIM AUTOCOMP INDONESIA";
  cellA1.font = { name: "Calibri", size: 9, underline: true };

  const cellA2 = worksheet.getCell("A2");
  cellA2.value = "INDUSTRIAL RELATION SECTION";
  cellA2.font = { name: "Calibri", size: 9 };

  worksheet.mergeCells(4, 1, 4, totalCols);
  const cellA4 = worksheet.getCell("A4");
  cellA4.value = "SUMMARY HASIL KALORI CATERING";
  cellA4.font = { name: "Calibri", size: 12, bold: true };
  cellA4.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells(5, 1, 5, totalCols);
  const cellA5 = worksheet.getCell("A5");
  cellA5.value = `PERIODE ${formatDateID(startDateISO)} \u2013 ${formatDateID(endDateISO)}`;
  cellA5.font = { name: "Calibri", size: 12, bold: true };
  cellA5.alignment = { horizontal: "center", vertical: "middle" };

  // Table Header (Rows 7 & 8)
  // A7:A8 TANGGAL
  worksheet.mergeCells(7, 1, 8, 1);
  const cellA7 = worksheet.getCell("A7");
  cellA7.value = "TANGGAL";
  cellA7.font = { name: "Calibri", size: 11, bold: true };
  cellA7.alignment = { horizontal: "center", vertical: "middle" };

  // B7:B8 SHIFT
  worksheet.mergeCells(7, 2, 8, 2);
  const cellB7 = worksheet.getCell("B7");
  cellB7.value = "SHIFT";
  cellB7.font = { name: "Calibri", size: 11, bold: true };
  cellB7.alignment = { horizontal: "center", vertical: "middle" };

  // C7:C8 MENU
  worksheet.mergeCells(7, 3, 8, 3);
  const cellC7 = worksheet.getCell("C7");
  cellC7.value = "MENU";
  cellC7.font = { name: "Calibri", size: 11, bold: true };
  cellC7.alignment = { horizontal: "center", vertical: "middle" };

  // D7:LastCol CATERING
  worksheet.mergeCells(7, 4, 7, totalCols);
  const cellD7 = worksheet.getCell("D7");
  cellD7.value = "CATERING";
  cellD7.font = { name: "Calibri", size: 11, bold: true };
  cellD7.alignment = { horizontal: "center", vertical: "middle" };

  cateringsToExport.forEach((cObj, idx) => {
    const colIdx = 4 + idx;
    const cell = worksheet.getCell(8, colIdx);
    cell.value = cObj.nama.toUpperCase();
    cell.font = { name: "Calibri", size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (let r = 7; r <= 8; r++) {
    for (let c = 1; c <= totalCols; c++) {
      worksheet.getCell(r, c).border = borderThin;
    }
  }

  let currentRow = 9;
  let currDay = new Date(sDate.getTime());

  while (currDay <= eDate) {
    const dateISO = `${currDay.getFullYear()}-${String(currDay.getMonth() + 1).padStart(2, "0")}-${String(currDay.getDate()).padStart(2, "0")}`;

    // Filter entries for current date
    let dayEntries = entries.filter((e) => e.tanggal === dateISO);

    // If user filtered by a specific shift in UI, apply it
    if (selectedShift) {
      dayEntries = dayEntries.filter((e) => e.shift?.toUpperCase() === selectedShift.toUpperCase());
    }

    if (dayEntries.length === 0) {
      // No reports on this date across all shifts: single row with '-'
      const r = worksheet.getRow(currentRow);
      r.height = 24.75;

      const dateCell = r.getCell(1);
      const [y, m, d] = dateISO.split("-").map(Number);
      dateCell.value = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dateCell.numFmt = "[$-0421]d mmmm yyyy;@";
      dateCell.font = { name: "Calibri", size: 11 };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      dateCell.border = borderThin;

      const shiftCell = r.getCell(2);
      shiftCell.value = "-";
      shiftCell.font = { name: "Calibri", size: 11 };
      shiftCell.alignment = { horizontal: "center", vertical: "middle" };
      shiftCell.border = borderThin;

      const menuCell = r.getCell(3);
      menuCell.value = "-";
      menuCell.font = { name: "Calibri", size: 11 };
      menuCell.alignment = { horizontal: "center", vertical: "middle" };
      menuCell.border = borderThin;

      for (let c = 4; c <= totalCols; c++) {
        const catCell = r.getCell(c);
        catCell.value = "-";
        catCell.font = { name: "Calibri", size: 11 };
        catCell.alignment = { horizontal: "center", vertical: "middle" };
        catCell.border = borderThin;
      }

      currentRow++;
    } else {
      // Determine shifts present on this date (Order: PAGI first, then MALAM)
      const shiftsPresent: string[] = [];
      ["PAGI", "MALAM"].forEach((s) => {
        if (dayEntries.some((e) => e.shift?.toUpperCase() === s)) {
          shiftsPresent.push(s);
        }
      });

      // Add any other shift if unstandardized
      dayEntries.forEach((e) => {
        const uShift = e.shift?.toUpperCase() || "PAGI";
        if (!shiftsPresent.includes(uShift)) {
          shiftsPresent.push(uShift);
        }
      });

      const dateStartRow = currentRow;

      // Process each shift for this date
      shiftsPresent.forEach((sh) => {
        const shiftEntries = dayEntries.filter((e) => (e.shift?.toUpperCase() || "PAGI") === sh);
        if (shiftEntries.length === 0) return;

        // Build menu items list for this shift
        const menuLines: string[] = [];
        const addMenuLine = (txt: string | undefined | null) => {
          if (txt && txt.trim()) {
            const formatted = formatMenuTitleCase(txt);
            if (formatted && !menuLines.includes(formatted)) {
              menuLines.push(formatted);
            }
          }
        };

        shiftEntries.forEach((e) => addMenuLine(e.nama_masakan_sayur));

        shiftEntries.forEach((e) => {
          const groups = groupIngredients(e);
          groups.forEach((g) => {
            if (g.category === "Nasi" && e.nama_masakan_nasi) {
              // skipped
            } else if (g.category === "Sayur") {
              // skipped
            } else {
              g.items.forEach((it) => {
                if (it.preset_name === "bumbu") return;
                addMenuLine(it.nama_bahan);
              });
            }
          });
        });

        if (menuLines.length === 0) {
          menuLines.push("Menu Harian");
        }

        const blockRowCount = menuLines.length;
        const shiftStartRow = currentRow;
        const shiftEndRow = shiftStartRow + blockRowCount - 1;

        // Merge Col 2 (SHIFT) if blockRowCount > 1
        if (blockRowCount > 1) {
          worksheet.mergeCells(shiftStartRow, 2, shiftEndRow, 2);
        }
        const shiftCell = worksheet.getCell(shiftStartRow, 2);
        shiftCell.value = sh;
        shiftCell.font = { name: "Calibri", size: 11, bold: true };
        shiftCell.alignment = { horizontal: "center", vertical: "middle" };

        for (let rIdx = shiftStartRow; rIdx <= shiftEndRow; rIdx++) {
          worksheet.getRow(rIdx).height = 24.75;
          worksheet.getCell(rIdx, 2).border = borderThin;
        }

        // Populate Col 3 (MENU)
        menuLines.forEach((mText, idx) => {
          const rIdx = shiftStartRow + idx;
          const menuCell = worksheet.getCell(rIdx, 3);
          menuCell.value = formatMenuTitleCase(mText);
          menuCell.font = { name: "Calibri", size: 11 };
          menuCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
          menuCell.border = borderThin;
        });

        // Populate Catering columns (Col 4 to totalCols)
        cateringsToExport.forEach((cObj, cIdx) => {
          const colIdx = 4 + cIdx;
          const matchedEntry = shiftEntries.find((e) => e.catering_id === cObj.id);

          if (blockRowCount > 1) {
            worksheet.mergeCells(shiftStartRow, colIdx, shiftEndRow, colIdx);
          }

          const catCell = worksheet.getCell(shiftStartRow, colIdx);

          if (matchedEntry) {
            const totCal = typeof matchedEntry.total_kalori === "number" ? matchedEntry.total_kalori : parseFloat(String(matchedEntry.total_kalori)) || 0;
            catCell.value = Math.round(totCal * 100) / 100;
            catCell.numFmt = "#,##0.00";
            catCell.font = { name: "Calibri", size: 11 };
            catCell.alignment = { horizontal: "center", vertical: "middle" };

            if (totCal < 900 || matchedEntry.mencapai === false) {
              catCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFF00" },
              };
            }
          } else {
            catCell.value = "-";
            catCell.font = { name: "Calibri", size: 11 };
            catCell.alignment = { horizontal: "center", vertical: "middle" };
          }

          for (let rIdx = shiftStartRow; rIdx <= shiftEndRow; rIdx++) {
            worksheet.getCell(rIdx, colIdx).border = borderThin;
          }
        });

        currentRow = shiftEndRow + 1;
      });

      const dateEndRow = currentRow - 1;

      // Merge Col 1 (TANGGAL) across entire date block (PAGI + MALAM)
      if (dateEndRow > dateStartRow) {
        worksheet.mergeCells(dateStartRow, 1, dateEndRow, 1);
      }
      const dateCell = worksheet.getCell(dateStartRow, 1);
      const [y, m, d] = dateISO.split("-").map(Number);
      dateCell.value = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dateCell.numFmt = "[$-0421]d mmmm yyyy;@";
      dateCell.font = { name: "Calibri", size: 11 };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };

      for (let rIdx = dateStartRow; rIdx <= dateEndRow; rIdx++) {
        worksheet.getCell(rIdx, 1).border = borderThin;
      }
    }

    currDay = new Date(currDay.getFullYear(), currDay.getMonth(), currDay.getDate() + 1);
  }

  const lastRow = currentRow - 1;
  const lastColLetter = String.fromCharCode(64 + totalCols);
  worksheet.pageSetup.printArea = `A1:${lastColLetter}${lastRow}`;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
