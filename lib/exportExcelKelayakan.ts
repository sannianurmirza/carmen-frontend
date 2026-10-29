import ExcelJS from "exceljs";
import { KelayakanEntry } from "@/lib/api";

export type KelayakanReportGroupForExport = {
  key: string;
  catering_id: number;
  catering_nama: string;
  tanggal: string;
  shift: string;
  entries: KelayakanEntry[];
};

function formatDateID(iso: string): string {
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

export type ExportKelayakanOptions = {
  isSingleReport?: boolean;
};

export async function generateKelayakanExcelBuffer(
  selectedGroups: KelayakanReportGroupForExport[],
  options?: ExportKelayakanOptions
): Promise<ArrayBuffer> {
  const isSingle = options?.isSingleReport ?? false;
  // Lebar kolom TANGGAL: tambah ~2.8 satuan (14 -> 16.8) khusus export satu laporan agar tanggal tidak ###
  const tanggalColWidth = isSingle ? 16.8 : 14;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CARMEN";
  workbook.lastModifiedBy = "CARMEN";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Sheet 1: pagi - malam
  const ws = workbook.addWorksheet("pagi - malam", {
    views: [{ showGridLines: true }],
  });

  // Column Widths (A-T)
  ws.columns = [
    { width: 6 },               // A: NO
    { width: tanggalColWidth }, // B: TANGGAL
    { width: 12 },              // C: WAKTU
    { width: 22 }, // D: NAMA CATERING
    { width: 12 }, // E: NASI KELAYAKAN
    { width: 10 }, // F: NASI RASA
    { width: 12 }, // G: LAUK KELAYAKAN
    { width: 10 }, // H: LAUK RASA
    { width: 12 }, // I: SAYUR KELAYAKAN
    { width: 10 }, // J: SAYUR RASA
    { width: 12 }, // K: SAMBAL KELAYAKAN
    { width: 10 }, // L: SAMBAL RASA
    { width: 12 }, // M: KERUPUK KELAYAKAN
    { width: 10 }, // N: KERUPUK RASA
    { width: 12 }, // O: BUAH KELAYAKAN
    { width: 10 }, // P: BUAH RASA
    { width: 16 }, // Q: KONDISI RANTANG
    { width: 16 }, // R: TOTAL NILAI
    { width: 18 }, // S: SCORE PRESENTASE / SUMMARY NAMA CATERING
    { width: 18 }, // T: RATA- RATA NILAI / SUMMARY Persentase
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  // Header Title Lines
  ws.getCell("A1").value = "PT. JATIM AUTOCOMP INDONESIA";
  ws.getCell("A1").font = { name: "Arial", size: 11, bold: true };

  ws.getCell("A2").value = "Industrial Relation Section";
  ws.getCell("A2").font = { name: "Arial", size: 10, bold: true };

  // Calculate Date Range for Title
  const dates = selectedGroups.map((g) => g.tanggal).filter(Boolean).sort();
  const startDateStr = dates.length > 0 ? formatDateID(dates[0]) : "";
  const endDateStr = dates.length > 0 ? formatDateID(dates[dates.length - 1]) : "";
  const titlePeriod = startDateStr && endDateStr ? `${startDateStr} - ${endDateStr}` : "";

  ws.mergeCells("E6:P6");
  const titleCell = ws.getCell("E6");
  titleCell.value = `PENILAIAN MENU DAN KELAYAKAN CATERING ${titlePeriod}`.toUpperCase();
  titleCell.font = { name: "Arial", size: 12, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Table Headers (Rows 9, 10, 11)
  ws.mergeCells("A9:A11");
  const cellA9 = ws.getCell("A9");
  cellA9.value = "NO";
  cellA9.font = { name: "Arial", size: 10, bold: true };
  cellA9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("B9:B11");
  const cellB9 = ws.getCell("B9");
  cellB9.value = "TANGGAL";
  cellB9.font = { name: "Arial", size: 10, bold: true };
  cellB9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("C9:C11");
  const cellC9 = ws.getCell("C9");
  cellC9.value = "WAKTU";
  cellC9.font = { name: "Arial", size: 10, bold: true };
  cellC9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("D9:D11");
  const cellD9 = ws.getCell("D9");
  cellD9.value = "NAMA CATERING";
  cellD9.font = { name: "Arial", size: 10, bold: true };
  cellD9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("E9:Q9");
  const cellE9 = ws.getCell("E9");
  cellE9.value = "ITEM PENILAIAN";
  cellE9.font = { name: "Arial", size: 10, bold: true };
  cellE9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("R9:R11");
  const cellR9 = ws.getCell("R9");
  cellR9.value = "TOTAL NILAI";
  cellR9.font = { name: "Arial", size: 10, bold: true };
  cellR9.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("S9:S11");
  const cellS9 = ws.getCell("S9");
  cellS9.value = "SCORE PRESENTASE";
  cellS9.font = { name: "Arial", size: 10, bold: true };
  cellS9.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  ws.mergeCells("T9:T11");
  const cellT9 = ws.getCell("T9");
  cellT9.value = "RATA- RATA NILAI";
  cellT9.font = { name: "Arial", size: 10, bold: true };
  cellT9.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Row 10 Categories
  ws.mergeCells("E10:F10");
  ws.getCell("E10").value = "NASI";
  ws.mergeCells("G10:H10");
  ws.getCell("G10").value = "LAUK";
  ws.mergeCells("I10:J10");
  ws.getCell("I10").value = "SAYUR";
  ws.mergeCells("K10:L10");
  ws.getCell("K10").value = "SAMBAL";
  ws.mergeCells("M10:N10");
  ws.getCell("M10").value = "KERUPUK";
  ws.mergeCells("O10:P10");
  ws.getCell("O10").value = "BUAH";
  ws.mergeCells("Q10:Q11");
  ws.getCell("Q10").value = "KONDISI RANTANG";

  ["E10", "G10", "I10", "K10", "M10", "O10", "Q10"].forEach((cellRef) => {
    const c = ws.getCell(cellRef);
    c.font = { name: "Arial", size: 9.5, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Row 11 Sub-headers (KELAYAKAN / RASA)
  const subHeaders = [
    { col: "E", val: "KELAYAKAN" }, { col: "F", val: "RASA" },
    { col: "G", val: "KELAYAKAN" }, { col: "H", val: "RASA" },
    { col: "I", val: "KELAYAKAN" }, { col: "J", val: "RASA" },
    { col: "K", val: "KELAYAKAN" }, { col: "L", val: "RASA" },
    { col: "M", val: "KERUPUK" }, { col: "N", val: "RASA" },
    { col: "O", val: "KELAYAKAN" }, { col: "P", val: "RASA" },
  ];

  subHeaders.forEach(({ col, val }) => {
    const c = ws.getCell(`${col}11`);
    c.value = val;
    c.font = { name: "Arial", size: 8.5, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Apply Borders & Fill to Header Cells (Rows 9-11, Cols A-T)
  for (let r = 9; r <= 11; r++) {
    for (let c = 1; c <= 20; c++) {
      const cell = ws.getCell(r, c);
      cell.border = thinBorder;
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
      }
    }
  }

  // Map to track score percentages per catering for summary average
  const cateringScoresMap = new Map<string, number[]>();

  // Populate Data Rows starting at Row 12
  let currentRow = 12;
  let reportNo = 1;

  // Sort groups by: Date ASC, then Shift (PAGI before MALAM), then Catering Name A-Z
  const shiftRank = (s: string) => (s.toUpperCase() === "PAGI" ? 1 : 2);
  const sortedGroups = [...selectedGroups].sort((a, b) => {
    const dDiff = a.tanggal.localeCompare(b.tanggal);
    if (dDiff !== 0) return dDiff;
    const sDiff = shiftRank(a.shift) - shiftRank(b.shift);
    if (sDiff !== 0) return sDiff;
    return a.catering_nama.localeCompare(b.catering_nama);
  });

  // Group by Date for merged NO & TANGGAL cells
  const dateMap = new Map<string, KelayakanReportGroupForExport[]>();
  for (const g of sortedGroups) {
    if (!dateMap.has(g.tanggal)) dateMap.set(g.tanggal, []);
    dateMap.get(g.tanggal)!.push(g);
  }

  for (const [dateStr, groupsOnDate] of dateMap.entries()) {
    const groupStartRow = currentRow;

    const pagiGroups = groupsOnDate.filter((g) => g.shift.toUpperCase() === "PAGI");
    const malamGroups = groupsOnDate.filter((g) => g.shift.toUpperCase() === "MALAM");

    const processShiftGroups = (shiftGroups: KelayakanReportGroupForExport[]) => {
      if (shiftGroups.length === 0) return;
      const shiftStartRow = currentRow;

      for (const group of shiftGroups) {
        const catStartRow = currentRow;
        const catScores: number[] = [];

        for (const entry of group.entries) {
          const r = currentRow;
          ws.getCell(`A${r}`).value = reportNo;
          ws.getCell(`B${r}`).value = formatDateID(dateStr);
          ws.getCell(`C${r}`).value = group.shift.toUpperCase();
          ws.getCell(`D${r}`).value = group.catering_nama;

          const nk = entry.nasi_kelayakan || 0;
          const nr = entry.nasi_rasa || 0;
          const lk = entry.lauk_kelayakan || 0;
          const lr = entry.lauk_rasa || 0;
          const sk = entry.sayur_kelayakan || 0;
          const sr = entry.sayur_rasa || 0;
          const mk = entry.sambal_kelayakan || 0;
          const mr = entry.sambal_rasa || 0;
          const kk = entry.kerupuk_kelayakan || 0;
          const kr = entry.kerupuk_rasa || 0;
          const bk = entry.buah_kelayakan || 0;
          const br = entry.buah_rasa || 0;
          const krantang = entry.kondisi_rantang || 0;

          ws.getCell(`E${r}`).value = nk;
          ws.getCell(`F${r}`).value = nr;
          ws.getCell(`G${r}`).value = lk;
          ws.getCell(`H${r}`).value = lr;
          ws.getCell(`I${r}`).value = sk;
          ws.getCell(`J${r}`).value = sr;
          ws.getCell(`K${r}`).value = mk;
          ws.getCell(`L${r}`).value = mr;
          ws.getCell(`M${r}`).value = kk;
          ws.getCell(`N${r}`).value = kr;
          ws.getCell(`O${r}`).value = bk;
          ws.getCell(`P${r}`).value = br;
          ws.getCell(`Q${r}`).value = krantang;

          const totalNilai = nk + nr + lk + lr + sk + sr + mk + mr + kk + kr + bk + br + krantang;
          const scorePercent = totalNilai / 65;
          catScores.push(scorePercent);

          if (!cateringScoresMap.has(group.catering_nama)) {
            cateringScoresMap.set(group.catering_nama, []);
          }
          cateringScoresMap.get(group.catering_nama)!.push(scorePercent);

          ws.getCell(`R${r}`).value = { formula: `SUM(E${r}:Q${r})`, result: totalNilai };
          ws.getCell(`S${r}`).value = { formula: `R${r}/65`, result: scorePercent };
          ws.getCell(`S${r}`).numFmt = "0.00%";

          ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
          ws.getCell(`B${r}`).alignment = { horizontal: "center", vertical: "middle" };
          ws.getCell(`C${r}`).alignment = { horizontal: "center", vertical: "middle" };
          ws.getCell(`D${r}`).alignment = { horizontal: "left", vertical: "middle" };

          for (let c = 5; c <= 20; c++) {
            const cell = ws.getCell(r, c);
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = { name: "Arial", size: 9.5 };
          }

          ws.getCell(`A${r}`).font = { name: "Arial", size: 9.5, bold: true };
          ws.getCell(`B${r}`).font = { name: "Arial", size: 9.5 };
          ws.getCell(`C${r}`).font = { name: "Arial", size: 9.5, bold: true };
          ws.getCell(`D${r}`).font = { name: "Arial", size: 9.5, bold: true };

          for (let c = 1; c <= 20; c++) {
            ws.getCell(r, c).border = thinBorder;
          }

          currentRow++;
        }

        const catEndRow = currentRow - 1;

        // Merge Catering Name (Col D) if multiple entries on same date & shift
        if (catEndRow > catStartRow) {
          ws.mergeCells(`D${catStartRow}:D${catEndRow}`);
        }

        // Calculate & Write Column T (RATA- RATA NILAI) for this catering group
        const catAvg = catScores.reduce((sum, v) => sum + v, 0) / (catScores.length || 1);
        const formulaStr = catEndRow > catStartRow
          ? `AVERAGE(S${catStartRow}:S${catEndRow})`
          : `AVERAGE(S${catStartRow})`;

        const cellT = ws.getCell(`T${catStartRow}`);
        cellT.value = { formula: formulaStr, result: catAvg };
        cellT.numFmt = "0.00%";
        cellT.alignment = { horizontal: "center", vertical: "middle" };
        cellT.font = { name: "Arial", size: 9.5 };

        if (catEndRow > catStartRow) {
          ws.mergeCells(`T${catStartRow}:T${catEndRow}`);
        }
      }

      const shiftEndRow = currentRow - 1;
      if (shiftEndRow > shiftStartRow) {
        ws.mergeCells(`C${shiftStartRow}:C${shiftEndRow}`);
      }
    };

    processShiftGroups(pagiGroups);
    processShiftGroups(malamGroups);

    const groupEndRow = currentRow - 1;
    if (groupEndRow > groupStartRow) {
      ws.mergeCells(`A${groupStartRow}:A${groupEndRow}`);
      ws.mergeCells(`B${groupStartRow}:B${groupEndRow}`);
    }

    reportNo++;
  }

  // Summary Table: Rata-Rata Kelayakan Tiap Katering aligned under SCORE PRESENTASE (Col S) & RATA- RATA NILAI (Col T)
  const lastDataRow = currentRow - 1;
  let summaryRow = lastDataRow + 2;

  cateringScoresMap.forEach((scores, catName) => {
    const avgScore = scores.reduce((sum, v) => sum + v, 0) / (scores.length || 1);

    // Column S: Nama Catering (Aligned under SCORE PRESENTASE)
    const cellS = ws.getCell(`S${summaryRow}`);
    cellS.value = catName;
    cellS.font = { name: "Arial", size: 10, bold: true };
    cellS.alignment = { horizontal: "left", vertical: "middle" };
    cellS.border = thinBorder;

    // Column T: Overall Average (Aligned under RATA- RATA NILAI)
    const cellT = ws.getCell(`T${summaryRow}`);
    cellT.value = {
      formula: `AVERAGEIF(D$12:D$${lastDataRow}, "${catName}", T$12:T$${lastDataRow})`,
      result: avgScore,
    };
    cellT.font = { name: "Arial", size: 10, bold: true };
    cellT.alignment = { horizontal: "right", vertical: "middle" };
    cellT.numFmt = "0.00%";
    cellT.border = thinBorder;

    summaryRow++;
  });

  // Sheet 2: ESign
  const wsSign = workbook.addWorksheet("ESign", {
    views: [{ showGridLines: true }],
  });

  wsSign.columns = [
    { width: 3 },  // A
    { width: 19 }, // B (Approved)
    { width: 19 }, // C (Checked 2)
    { width: 19 }, // D (Checked 1)
    { width: 19 }, // E (Prepared)
  ];

  wsSign.getRow(1).height = 15;
  wsSign.getRow(2).height = 15;
  wsSign.getRow(3).height = 15;
  wsSign.getRow(4).height = 24;
  for (let r = 5; r <= 8; r++) {
    wsSign.getRow(r).height = 20;
  }
  wsSign.getRow(9).height = 20;

  // Header Table
  wsSign.getCell("B4").value = "Approved";
  wsSign.getCell("C4").value = "Checked 2";
  wsSign.getCell("D4").value = "Checked 1";
  wsSign.getCell("E4").value = "Prepared";

  ["B4", "C4", "D4", "E4"].forEach((cellRef) => {
    const c = wsSign.getCell(cellRef);
    c.font = { name: "Calibri", size: 11 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder;
  });

  // Merged boxes for signature (Rows 5-8)
  wsSign.mergeCells("B5:B8");
  wsSign.mergeCells("C5:C8");
  wsSign.mergeCells("D5:D8");
  wsSign.mergeCells("E5:E8");

  for (let r = 5; r <= 8; r++) {
    for (const col of ["B", "C", "D", "E"]) {
      wsSign.getCell(`${col}${r}`).border = thinBorder;
    }
  }

  // Base Export state: bottom row empty before approval
  ["B9", "C9", "D9", "E9"].forEach((cellRef) => {
    const c = wsSign.getCell(cellRef);
    c.value = "";
    c.font = { name: "Calibri", size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export function downloadExcelBuffer(buffer: any, filename: string) {
  if (!buffer) {
    alert("Gagal mengunduh: Buffer file Excel kosong.");
    return;
  }

  let blobPart: any;
  if (buffer instanceof ArrayBuffer) {
    blobPart = buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    blobPart = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (buffer instanceof Blob) {
    blobPart = buffer;
  } else {
    blobPart = buffer;
  }

  const blob = new Blob([blobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (blob.size === 0) {
    alert("Gagal mengunduh: Ukuran file Excel yang dihasilkan 0 bytes.");
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
  }, 500);
}
