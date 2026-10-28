/**
 * Shared number and decimal formatting & parsing utilities for Indonesian locale (id-ID).
 * 
 * Rules:
 * - Desimal menggunakan koma: 1,90
 * - Pemisah ribuan menggunakan titik: 1.250,75
 * - Kompatibel dengan input pengguna berkoma maupun bertitik (54,2 -> 54.2).
 */

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  decimals?: number; // Shorthand to set both min and max to the same fixed digits
  useGrouping?: boolean; // Default true (ribuan dengan titik)
  fallback?: string; // Default "-" for null/undefined/empty
}

/**
 * Parses numeric input string into a standard JavaScript number.
 * Safely handles Indonesian decimal comma ("54,2" -> 54.2) and thousands dot ("1.250" -> 1250).
 */
export function parseNumberID(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const str = String(raw).trim();
  if (str === "") return null;

  // Case 1: Contains both '.' and ','
  // E.g. "1.250,75" (Indonesian) or "1,250.75" (English)
  if (str.includes(".") && str.includes(",")) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Indonesian format: 1.250,75 -> dot is thousands, comma is decimal
      const normalized = str.replace(/\./g, "").replace(",", ".");
      const n = Number(normalized);
      return isNaN(n) ? null : n;
    } else {
      // English format: 1,250.75 -> comma is thousands, dot is decimal
      const normalized = str.replace(/,/g, "");
      const n = Number(normalized);
      return isNaN(n) ? null : n;
    }
  }

  // Case 2: Contains only comma ','
  // E.g. "54,2" or "1250,75" or "1,25" -> comma is decimal separator
  if (str.includes(",")) {
    // If it has multiple commas, replace all except the last as thousands
    const commaCount = (str.match(/,/g) || []).length;
    let normalized = str;
    if (commaCount > 1) {
      const lastIdx = str.lastIndexOf(",");
      normalized = str.slice(0, lastIdx).replace(/,/g, "") + "." + str.slice(lastIdx + 1);
    } else {
      normalized = str.replace(",", ".");
    }
    const n = Number(normalized);
    return isNaN(n) ? null : n;
  }

  // Case 3: Contains only dot '.'
  // E.g. "1.250" (thousands) vs "54.2" (decimal) vs "112.25" (decimal)
  if (str.includes(".")) {
    // If exactly one or more groups of 3 digits after each dot, e.g. "1.250", "25.000", "1.250.000"
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      const n = Number(str.replace(/\./g, ""));
      return isNaN(n) ? null : n;
    }
    // Otherwise standard decimal dot (e.g. "54.2", "112.25", "0.5")
    const n = Number(str);
    return isNaN(n) ? null : n;
  }

  // Pure integer
  const n = Number(str);
  return isNaN(n) ? null : n;
}

/**
 * Checks if a string is a valid partial or full decimal input.
 * Allows digits with at most one decimal separator (',' or '.') so typing "54," is smooth.
 */
export function isValidDecimalInput(val: string): boolean {
  if (val === "") return true;
  return /^[0-9]*[.,]?[0-9]*$/.test(val);
}

/**
 * Normalizes user typed decimal string for storage or state if needed.
 * Returns the raw string if typing in progress (ends with ',' or '.'), or numeric value.
 */
export function toInternalDecimalNumber(val: string | number | null | undefined, fallback = 0): number {
  const parsed = parseNumberID(val);
  return parsed !== null && !isNaN(parsed) ? parsed : fallback;
}

/**
 * Formats a number into Indonesian locale (id-ID):
 * - Decimal separator: comma (',')
 * - Thousands separator: dot ('.')
 */
export function formatNumberID(
  val: number | string | null | undefined,
  options?: FormatNumberOptions
): string {
  if (val === null || val === undefined || val === "") {
    return options?.fallback ?? "-";
  }

  const num = typeof val === "number" ? val : parseNumberID(String(val));
  if (num === null || isNaN(num)) {
    return options?.fallback ?? "-";
  }

  let minDigits = options?.minimumFractionDigits ?? 0;
  let maxDigits = options?.maximumFractionDigits ?? 2;

  if (options?.decimals !== undefined) {
    minDigits = options.decimals;
    maxDigits = options.decimals;
  }

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
    useGrouping: options?.useGrouping ?? true,
  }).format(num);
}

/**
 * Shorthand for formatting percentages (e.g. 97.44 -> "97,44%").
 */
export function formatPercentID(
  val: number | string | null | undefined,
  decimals = 2,
  fallback = "-"
): string {
  if (val === null || val === undefined || val === "") return fallback;
  const num = typeof val === "number" ? val : parseNumberID(String(val));
  if (num === null || isNaN(num)) return fallback;

  return `${formatNumberID(num, { decimals })}%`;
}

/**
 * Formats weights with optional "g" unit (e.g. 54.2 -> "54,2 g").
 */
export function formatWeightID(
  val: number | string | null | undefined,
  includeUnit = true,
  fallback = "-"
): string {
  if (val === null || val === undefined || val === "") return fallback;
  const num = typeof val === "number" ? val : parseNumberID(String(val));
  if (num === null || isNaN(num)) return fallback;

  const formatted = formatNumberID(num, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return includeUnit ? `${formatted} g` : formatted;
}

/**
 * Formats calories with optional "kkal" unit (e.g. 882.96 -> "882,96 kkal").
 */
export function formatCalorieID(
  val: number | string | null | undefined,
  includeUnit = true,
  decimals?: number,
  fallback = "-"
): string {
  if (val === null || val === undefined || val === "") return fallback;
  const num = typeof val === "number" ? val : parseNumberID(String(val));
  if (num === null || isNaN(num)) return fallback;

  const formatted = formatNumberID(num, {
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: decimals !== undefined ? decimals : 2,
  });
  return includeUnit ? `${formatted} kkal` : formatted;
}

/**
 * Daftar kata / singkatan / akronim yang harus tetap UPPERCASE dalam nama menu.
 */
export const MENU_UPPERCASE_EXCEPTIONS = new Set([
  // Singkatan perusahaan / industri / sertifikasi
  "JAI", "IR", "PT", "CV", "KFC", "BBQ", "MSG", "HACCP", "ISO", "IDR",
  // Satuan/ukuran tertentu dalam kapital jika ada
  "SDM", "SDT", "PCS",
  // Angka Romawi
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
]);

/**
 * Kata penghubung / preposisi Bahasa Indonesia yang tetap lowercase
 * jika tidak berada di awal segmen / awal kalimat / awal nama:
 * "dan", "atau", "dengan", "serta", "untuk", "dari", "ke", "di"
 */
export const INDONESIAN_CONJUNCTIONS = new Set([
  "dan",
  "atau",
  "dengan",
  "serta",
  "untuk",
  "dari",
  "ke",
  "di",
]);

/**
 * Satuan atau ukuran standar yang tetap lowercase (misal: kg, g, mg, ml, l, cc, kkal)
 */
export const MENU_LOWERCASE_UNITS = new Set([
  "kg",
  "g",
  "mg",
  "ml",
  "l",
  "dl",
  "cl",
  "cc",
  "cm",
  "mm",
  "kkal",
  "kcal",
]);

/**
 * Memformat sebuah kata individu ke dalam Title Case Bahasa Indonesia.
 */
function formatSingleMenuWord(word: string, isStartOfSegment: boolean): string {
  if (!word) return "";
  const upper = word.toUpperCase();
  if (MENU_UPPERCASE_EXCEPTIONS.has(upper)) {
    return upper;
  }
  // Jangan ubah token yang mengandung angka (misal: 100g, 250ml, paket 1, 100%)
  if (/^\d+[a-zA-Z%]*$/.test(word)) {
    return word;
  }
  const lower = word.toLowerCase();
  // Satuan ukuran (misal: kg, g, ml, kkal) tetap huruf kecil jika bukan di awal segmen
  if (MENU_LOWERCASE_UNITS.has(lower)) {
    if (isStartOfSegment) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
  }
  if (INDONESIAN_CONJUNCTIONS.has(lower)) {
    if (isStartOfSegment) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
  }
  // Kata utama: huruf pertama kapital, sisanya huruf kecil
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Membersihkan spasi berulang, spasi sebelum tanda baca, dan memastikan spasi setelah koma.
 */
function cleanMenuPunctuationSpacing(str: string): string {
  return str
    .replace(/[ \t]+/g, " ") // Hapus spasi berulang
    .replace(/\s+([,.:;!?])/g, "$1") // Hapus spasi sebelum tanda baca
    .replace(/,([^\s0-9])/g, ", $1") // Tambah 1 spasi setelah koma jika belum ada (kecuali desimal)
    .trim();
}

/**
 * Memformat satu baris nama menu ke Title Case Bahasa Indonesia.
 */
function formatMenuLine(line: string): string {
  const cleaned = cleanMenuPunctuationSpacing(line);
  if (!cleaned) return "";

  // Memisahkan kata alfabet/angka dengan pemisah (spasi, tanda baca, tanda kurung, garis miring, dsb.)
  const tokens = cleaned.split(/([A-Za-z0-9À-ÿ]+)/);
  let wordCount = 0;
  let prevDelimiter = "";

  return tokens
    .map((token, idx) => {
      if (idx % 2 === 0) {
        // Delimiter
        prevDelimiter = token;
        return token;
      }
      // Word token
      const isStartOfSegment = wordCount === 0 || /[:.!?\(\[]\s*$/.test(prevDelimiter);
      wordCount++;
      return formatSingleMenuWord(token, isStartOfSegment);
    })
    .join("");
}

/**
 * Memformat nama menu menjadi Title Case Bahasa Indonesia.
 * 
 * Aturan:
 * - Huruf pertama setiap kata utama dibuat kapital.
 * - Kata penghubung ("dan", "atau", "dengan", "serta", "untuk", "dari", "ke", "di") tetap lowercase jika bukan di awal.
 * - Tanda baca (koma, tanda kurung, garis miring, tanda tambah, tanda hubung) dipertahankan.
 * - Spasi berulang dan sebelum tanda baca dibersihkan.
 * - Spasi setelah koma ditambahkan jika belum ada.
 * - Multiline line break dipertahankan.
 * - Singkatan/akronim dan angka/satuan dipertahankan.
 * - Menangani input null/undefined/kosong dengan aman tanpa menghasilkan "null" / "undefined".
 */
export function formatMenuTitleCase(menu: string | null | undefined): string {
  if (menu === null || menu === undefined) return "";
  const str = String(menu);
  if (!str.trim() || str.trim() === "-") return str.trim();
  const lines = str.split(/\r?\n/);
  return lines.map(formatMenuLine).join("\n");
}

/**
 * Nama bulan dalam Bahasa Indonesia (id-ID) untuk formatting tanggal deterministik.
 */
export const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export interface FormatTimestampOptions {
  fallback?: string;
  shortMonth?: boolean;
}

/**
 * Memformat objek Date ke waktu Asia/Jakarta (WIB) secara deterministik.
 * Menggunakan Intl.DateTimeFormat dengan timeZone: "Asia/Jakarta" sehingga perangkat laptop
 * dan tablet selalu menampilkan waktu yang sama persis tanpa terpengaruh konfigurasi timezone OS lokal.
 */
function formatDateInAsiaJakarta(
  d: Date,
  shortMonth: boolean = false
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    else if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "hour") {
      const h = parseInt(p.value, 10);
      hour = h === 24 ? 0 : h;
    } else if (p.type === "minute") {
      minute = parseInt(p.value, 10);
    }
  }

  const monthIdx = month - 1;
  const monthName = shortMonth
    ? INDONESIAN_MONTHS[monthIdx].slice(0, 3)
    : INDONESIAN_MONTHS[monthIdx];
  const formattedHours = String(hour).padStart(2, "0");
  const formattedMinutes = String(minute).padStart(2, "0");

  return `${day} ${monthName} ${year}, ${formattedHours}.${formattedMinutes}`;
}

/**
 * Memformat timestamp ke format Bahasa Indonesia (id-ID) dengan zona waktu Asia/Jakarta (WIB):
 * Contoh: "2026-09-15T07:05:00Z" -> "15 September 2026, 14.05"
 * Contoh: "2026-09-15T16:05:00+09:00" -> "15 September 2026, 14.05"
 *
 * - Menerima string ISO, Date, null, atau undefined.
 * - Memeriksa invalid date dan mengembalikan fallback (default: "-").
 * - Semua timestamp yang memiliki Z atau offset dikonversi sebagai sebuah instant ke Asia/Jakarta.
 * - Timestamp naive SQLite tanpa timezone diperlakukan sebagai UTC dan dikonversi ke Asia/Jakarta.
 * - Konsistensi penuh di laptop dan tablet tanpa terpengaruh zona waktu OS perangkat.
 */
export function formatIndoTimestamp(
  raw: string | Date | null | undefined,
  options?: FormatTimestampOptions
): string {
  const fallback = options?.fallback ?? "-";
  if (raw === null || raw === undefined) return fallback;

  const shortMonth = !!options?.shortMonth;

  let d: Date;
  if (raw instanceof Date) {
    d = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "-") return fallback;

    let normalized =
      trimmed.includes(" ") && !trimmed.includes("T")
        ? trimmed.replace(" ", "T")
        : trimmed;

    // Jika string tidak memiliki Z atau offset (+HH:MM / -HH:MM), anggap sebagai UTC
    const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(normalized);
    if (!hasTz) {
      normalized += "Z";
    }

    d = new Date(normalized);
  } else {
    return fallback;
  }

  if (isNaN(d.getTime())) return fallback;

  return formatDateInAsiaJakarta(d, shortMonth);
}
