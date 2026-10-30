import ExcelJS from "exceljs";
import { MonthlyMenuPlanDetail, MenuItemResponse, getBaseUrl } from "@/lib/api";

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (e) {
    console.warn("Gagal mengambil gambar QR untuk export excel:", e);
  }
  return null;
}

const INDONESIAN_DAYS = [
  "SENIN",
  "SELASA",
  "RABU",
  "KAMIS",
  "JUMAT",
  "SABTU",
  "MINGGU",
];

const COMPONENT_LABELS = [
  "1. Makanan Pokok",
  "2. Lauk Utama",
  "3. Lauk Pendamping",
  "4. Sayur",
  "5. Buah / Extra",
  "6. Minuman / Catatan",
];

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  dayIndex: number; // 0 = Senin, 6 = Minggu
}

function buildCalendarWeeks(year: number, month: number): CalendarDay[][] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday in JS
  // Convert to Monday = 0, ..., Sunday = 6
  const startDayIdx = (firstDayOfMonth.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  // Previous month trailing days
  const prevMonthLastDate = new Date(year, month - 1, 0).getDate();
  for (let i = startDayIdx - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    const prevDate = new Date(year, month - 2, d);
    const yStr = prevDate.getFullYear();
    const mStr = String(prevDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    days.push({
      date: prevDate,
      dateStr: `${yStr}-${mStr}-${dStr}`,
      isCurrentMonth: false,
      dayIndex: (prevDate.getDay() + 6) % 7,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month - 1, d);
    const yStr = year;
    const mStr = String(month).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    days.push({
      date: curDate,
      dateStr: `${yStr}-${mStr}-${dStr}`,
      isCurrentMonth: true,
      dayIndex: (curDate.getDay() + 6) % 7,
    });
  }

  // Next month leading days to complete the last week (multiple of 7)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(year, month, d);
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    days.push({
      date: nextDate,
      dateStr: `${yStr}-${mStr}-${dStr}`,
      isCurrentMonth: false,
      dayIndex: (nextDate.getDay() + 6) % 7,
    });
  }

  // Chunk into weeks of 7 days
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export async function generateMenuPlanExcelBuffer(
  plan: MonthlyMenuPlanDetail
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CARMEN PT JAI";
  workbook.lastModifiedBy = "CARMEN PT JAI";
  workbook.created = new Date();
  workbook.modified = new Date();

  const cateringName = plan.catering_nama || "Semua Katering (PT JAI)";
  const year = plan.effective_year || new Date().getFullYear();
  const month = plan.effective_month || new Date().getMonth() + 1;
  const periodLabel = plan.effective_menu_period || `${year}-${String(month).padStart(2, "0")}`;
  const version = plan.version || 1;
  const status = plan.status || "DRAFT";

  // Group items by shift and date
  // key: `${shift.toLowerCase()}_${dateStr}_${itemOrder}` -> menu_name
  const itemMap = new Map<string, string>();
  (plan.items || []).forEach((it: MenuItemResponse) => {
    const shift = (it.shift || "Pagi").trim().toLowerCase();
    const dateStr = (it.menu_date || "").slice(0, 10);
    const key = `${shift}_${dateStr}_${it.item_order}`;
    itemMap.set(key, it.menu_name || "");
  });

  const weeks = buildCalendarWeeks(year, month);

  const shifts: Array<{ title: string; sheetName: string; shiftKey: string }> = [
    { title: "SHIFT PAGI", sheetName: "SHIFT PAGI", shiftKey: "pagi" },
    { title: "SHIFT MALAM", sheetName: "SHIFT MALAM", shiftKey: "malam" },
  ];

  // Helper border styles
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  const dayCardBottomBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "medium", color: { argb: "FF1F4E79" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  for (const shift of shifts) {
    const ws = workbook.addWorksheet(shift.sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
      },
    });

    // 7 Columns for Monday to Sunday (Columns A..G)
    ws.columns = [
      { width: 22 }, // A - SENIN
      { width: 22 }, // B - SELASA
      { width: 22 }, // C - RABU
      { width: 22 }, // D - KAMIS
      { width: 22 }, // E - JUMAT
      { width: 22 }, // F - SABTU
      { width: 22 }, // G - MINGGU
    ];

    // Document Header
    ws.mergeCells("A1:G1");
    const cellA1 = ws.getCell("A1");
    cellA1.value = "PT. JATIM AUTOCOMP INDONESIA";
    cellA1.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1F4E79" } };
    cellA1.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:G2");
    const cellA2 = ws.getCell("A2");
    cellA2.value = `RENCANA MENU BULANAN — ${cateringName.toUpperCase()} (${shift.title})`;
    cellA2.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF0F172A" } };
    cellA2.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 20;

    ws.mergeCells("A3:G3");
    const cellA3 = ws.getCell("A3");
    cellA3.value = `Periode Berlaku: ${periodLabel}   |   Versi: v${version}   |   Status: ${status}   |   Catering: ${cateringName}`;
    cellA3.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF475569" } };
    cellA3.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(3).height = 18;

    // Row 4: Spacer
    ws.getRow(4).height = 10;

    // Row 5: Table Day Headers (SENIN s/d MINGGU)
    ws.getRow(5).height = 24;
    for (let cIdx = 0; cIdx < 7; cIdx++) {
      const colLetter = String.fromCharCode(65 + cIdx); // A..G
      const cell = ws.getCell(`${colLetter}5`);
      cell.value = INDONESIAN_DAYS[cIdx];
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cIdx >= 5 ? "FF8F1A25" : "FF1F4E79" }, // Merah untuk akhir pekan, Navy untuk hari kerja
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0F172A" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    }

    // Dynamic Calendar Matrix
    // Base row starts at row 6
    let currentBaseRow = 6;

    for (const week of weeks) {
      // Row 1: Date number (currentBaseRow)
      // Row 2: Day name (currentBaseRow + 1)
      // Rows 3..8: 6 menu slots (currentBaseRow + 2 .. currentBaseRow + 7)
      ws.getRow(currentBaseRow).height = 19;
      ws.getRow(currentBaseRow + 1).height = 15;
      for (let s = 2; s <= 7; s++) {
        ws.getRow(currentBaseRow + s).height = 18;
      }

      for (let cIdx = 0; cIdx < 7; cIdx++) {
        const colLetter = String.fromCharCode(65 + cIdx);
        const day = week[cIdx];

        const dateCell = ws.getCell(`${colLetter}${currentBaseRow}`);
        const dayNameCell = ws.getCell(`${colLetter}${currentBaseRow + 1}`);

        if (day && day.isCurrentMonth) {
          const dNum = day.date.getDate();
          const mNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
          dateCell.value = `${dNum} ${mNames[day.date.getMonth()]} ${day.date.getFullYear()}`;
          dateCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
          dateCell.alignment = { horizontal: "center", vertical: "middle" };
          dateCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: cIdx >= 5 ? "FFFCE4D6" : "FFD9E1F2" }, // Soft orange weekend / Soft blue weekday
          };
          dateCell.border = thinBorder;

          dayNameCell.value = INDONESIAN_DAYS[cIdx];
          dayNameCell.font = { name: "Calibri", size: 8.5, bold: true, color: { argb: "FF64748B" } };
          dayNameCell.alignment = { horizontal: "center", vertical: "middle" };
          dayNameCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
          dayNameCell.border = thinBorder;

          // 6 Menu Slots
          for (let slot = 1; slot <= 6; slot++) {
            const rowIdx = currentBaseRow + 1 + slot;
            const slotCell = ws.getCell(`${colLetter}${rowIdx}`);
            const itemKey = `${shift.shiftKey}_${day.dateStr}_${slot}`;
            const itemVal = itemMap.get(itemKey) || "";

            slotCell.value = itemVal || "-";
            slotCell.font = {
              name: "Calibri",
              size: 9,
              bold: slot <= 2,
              color: { argb: itemVal ? "FF0F172A" : "FF94A3B8" },
            };
            slotCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
            slotCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: slot % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
            };
            slotCell.border = slot === 6 ? dayCardBottomBorder : thinBorder;
          }
        } else {
          // Out of current month day
          dateCell.value = day ? `${day.date.getDate()}` : "";
          dateCell.font = { name: "Calibri", size: 9, color: { argb: "FF94A3B8" } };
          dateCell.alignment = { horizontal: "center", vertical: "middle" };
          dateCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
          dateCell.border = thinBorder;

          dayNameCell.value = "";
          dayNameCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
          dayNameCell.border = thinBorder;

          for (let slot = 1; slot <= 6; slot++) {
            const rowIdx = currentBaseRow + 1 + slot;
            const slotCell = ws.getCell(`${colLetter}${rowIdx}`);
            slotCell.value = "";
            slotCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF1F5F9" },
            };
            slotCell.border = slot === 6 ? dayCardBottomBorder : thinBorder;
          }
        }
      }

      currentBaseRow += 8;
    }
  }

  // Sheet 3: ESign (Standardized 3-Column Enterprise Format: Approved | Checked 2 | Checked 1)
  const wsSign = workbook.addWorksheet("ESign", {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9, // A4
    },
  });

  const blackThinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  wsSign.columns = [
    { width: 3 },  // A (Margin)
    { width: 19 }, // B (Approved)
    { width: 19 }, // C (Checked 2)
    { width: 19 }, // D (Checked 1)
  ];

  wsSign.getRow(1).height = 15;
  wsSign.getRow(2).height = 15;
  wsSign.getRow(3).height = 15;
  wsSign.getRow(4).height = 24;
  for (let r = 5; r <= 8; r++) {
    wsSign.getRow(r).height = 20;
  }
  wsSign.getRow(9).height = 20;

  // Header Table: Approved | Checked 2 | Checked 1
  wsSign.getCell("B4").value = "Approved";
  wsSign.getCell("C4").value = "Checked 2";
  wsSign.getCell("D4").value = "Checked 1";

  ["B4", "C4", "D4"].forEach((cellRef) => {
    const c = wsSign.getCell(cellRef);
    c.font = { name: "Calibri", size: 11, bold: false, color: { argb: "FF000000" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = blackThinBorder;
  });

  // Merged boxes for signature (Rows 5-8)
  wsSign.mergeCells("B5:B8");
  wsSign.mergeCells("C5:C8");
  wsSign.mergeCells("D5:D8");

  for (let r = 5; r <= 8; r++) {
    for (const col of ["B", "C", "D"]) {
      wsSign.getCell(`${col}${r}`).border = blackThinBorder;
    }
  }

  // Row 9: Approver Initial / blank before approval
  const isApproved = status === "ACTIVE" || status === "APPROVED";
  const bottomVals: Record<string, string> = {
    B: isApproved ? "" : "",
    C: isApproved ? "CAN" : "",
    D: isApproved ? "NIA" : "",
  };

  // Embed QR signatures into ESign sheet when document is approved
  if (isApproved) {
    try {
      const baseUrl = getBaseUrl();
      const qrTargets = [
        { cell: "D5:D8", userId: 17 }, // Checked 1 -> NIA
        { cell: "C5:C8", userId: 19 }, // Checked 2 -> CAN
        { cell: "B5:B8", userId: 20 }, // Approved  -> GA
      ];

      for (const t of qrTargets) {
        const buf = await fetchImageBuffer(`${baseUrl}/users/${t.userId}/signature/qr-image`);
        if (buf && buf.byteLength > 0) {
          const imgId = workbook.addImage({ buffer: buf, extension: "png" });
          wsSign.addImage(imgId, t.cell);
        }
      }
    } catch (qrErr) {
      console.warn("Gagal menyematkan QR code pada lembar ESign:", qrErr);
    }
  }

  ["B9", "C9", "D9"].forEach((cellRef) => {
    const col = cellRef[0];
    const c = wsSign.getCell(cellRef);
    c.value = bottomVals[col] || "";
    c.font = { name: "Calibri", size: 10, bold: false, color: { argb: "FF000000" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = blackThinBorder;
  });

  return await workbook.xlsx.writeBuffer();
}

export async function downloadMenuPlanExcel(
  plan: MonthlyMenuPlanDetail,
  customFilename?: string
): Promise<void> {
  const buffer = await generateMenuPlanExcelBuffer(plan);
  const cateringClean = (plan.catering_nama || "Katering").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const monthPad = String(plan.effective_month || 1).padStart(2, "0");
  const defaultFilename = `Rencana_Menu_${cateringClean}_${plan.effective_year || 2026}_${monthPad}_v${plan.version || 1}.xlsx`;
  const filename = customFilename || defaultFilename;

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
