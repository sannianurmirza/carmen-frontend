/**
 * Modul Normalizer Terpusat untuk Laporan Punishment PT JAI.
 * Memastikan semua data tabular aman dari runtime crash (null/undefined/NaN).
 *
 * Aturan Kontrak:
 * - Named keys (minus_tidak_berturut, minus_2_berturut, minus_berikutnya, minus_sidak) adalah kontrak utama.
 * - Alias lama (kategori_1 .. kategori_4) didukung untuk kompatibilitas snapshot lama.
 * - Nilai hasil normalisasi named key dan alias selalu identik.
 */

import {
  NormalizedMinusDetail,
  NormalizedPelanggaranKalori,
  NormalizedPencapaianKalori,
  NormalizedKaloriData,
  RawMinusDetail,
} from "./api";

export const EMPTY_MINUS_DETAIL: Readonly<NormalizedMinusDetail> = Object.freeze({
  nama: "",
  ada: false,
  jumlah: 0,
  tanggal: [],
  tanggal_display: "",
  tgl: "-",
  pengurangan_poin_pagi: 0,
  pengurangan_poin_malam: 0,
});

export const EMPTY_PENCAPAIAN_KALORI: Readonly<NormalizedPencapaianKalori> = Object.freeze({
  jumlah_mencapai: 0,
  jumlah_tidak_mencapai: 0,
  jumlah_pengiriman: 0,
  persentase: 0,
  formatted_persen: "-",
  score_performance: 0,
  has_data: false,
});

const MONTH_NAMES_ID: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Mei", 6: "Jun",
  7: "Jul", 8: "Agu", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Des",
};

function safeNumber(val: unknown, defaultVal = 0): number {
  if (typeof val === "boolean" || val === null || val === undefined) {
    return defaultVal;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : defaultVal;
}

function parseDateToTuple(dVal: unknown): [number, number, number, string] | null {
  if (typeof dVal !== "string") {
    return null;
  }
  const s = dVal.trim();
  if (!s || s === "-") {
    return null;
  }

  // Format ISO: YYYY-MM-DD
  const matchIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matchIso) {
    const y = parseInt(matchIso[1], 10);
    const m = parseInt(matchIso[2], 10);
    const d = parseInt(matchIso[3], 10);
    const isoStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return [y, m, d, isoStr];
  }

  // Format Indonesia: DD Mon YYYY / DD Month YYYY (misal "10 Jan 2025")
  const parts = s.split(/\s+/);
  if (parts.length === 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[2])) {
    const d = parseInt(parts[0], 10);
    const y = parseInt(parts[2], 10);
    const mStr = parts[1].toLowerCase();
    const mMap: Record<string, number> = {
      jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3,
      apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6,
      jul: 7, juli: 7, agu: 8, agustus: 8, aug: 8,
      sep: 9, september: 9, okt: 10, oktober: 10, oct: 10,
      nov: 11, november: 11, des: 12, desember: 12, dec: 12,
    };
    const m = mMap[mStr] || 1;
    const isoStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return [y, m, d, isoStr];
  }

  return null;
}

function formatIsoDatesToDisplay(isoList: string[]): string {
  if (!isoList.length) {
    return "";
  }
  const formatted: string[] = [];
  for (const iso of isoList) {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      const monName = MONTH_NAMES_ID[mo] || String(mo);
      formatted.push(`${String(d).padStart(2, "0")} ${monName} ${y}`);
    } else {
      formatted.push(iso);
    }
  }
  return formatted.join(", ");
}

/**
 * Normalisasi satu sel/kategori Minus Kalori.
 * Menggabungkan named key dan alias lama dengan fallback terpusat.
 */
export function normalizeMinusDetail(
  namedVal: unknown,
  aliasVal?: unknown,
  defaultName = ""
): NormalizedMinusDetail {
  const isNamedObject = typeof namedVal === "object" && namedVal !== null;
  const isAliasObject = typeof aliasVal === "object" && aliasVal !== null;

  // Prioritas 1: Named key jika ada dan bertipe object
  // Prioritas 2: Alias lama jika named key tidak ada
  // Prioritas 3: Default kosong
  const src = (isNamedObject ? namedVal : (isAliasObject ? aliasVal : {})) as RawMinusDetail;

  const nama = typeof src.nama === "string" && src.nama.trim() ? src.nama.trim() : defaultName;

  // Tanggal: kumpulkan dari array tanggal atau string tanggal_display / tgl
  const dateTuples: [number, number, number, string][] = [];

  if (Array.isArray(src.tanggal)) {
    for (const item of src.tanggal) {
      const tuple = parseDateToTuple(item);
      if (tuple) {
        dateTuples.push(tuple);
      }
    }
  }

  // Jika array kosong, coba parsing dari string display / tgl
  if (!dateTuples.length) {
    const rawStr = typeof src.tanggal_display === "string" && src.tanggal_display
      ? src.tanggal_display
      : typeof src.tgl === "string" && src.tgl
      ? src.tgl
      : "";
    if (rawStr && rawStr !== "-") {
      for (const chunk of rawStr.split(",")) {
        const tuple = parseDateToTuple(chunk.trim());
        if (tuple) {
          dateTuples.push(tuple);
        }
      }
    }
  }

  // Urutkan kronologis & deduplikasi
  dateTuples.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  });

  const seenIso = new Set<string>();
  const sortedIso: string[] = [];
  for (const item of dateTuples) {
    const iso = item[3];
    if (!seenIso.has(iso)) {
      seenIso.add(iso);
      sortedIso.push(iso);
    }
  }

  // Format display
  let tanggalDisplay = "";
  if (typeof src.tanggal_display === "string" && src.tanggal_display.trim() && src.tanggal_display.trim() !== "-") {
    tanggalDisplay = src.tanggal_display.trim();
  } else if (sortedIso.length > 0) {
    tanggalDisplay = formatIsoDatesToDisplay(sortedIso);
  }

  let jumlah = safeNumber(src.jumlah, 0);
  if (jumlah === 0 && sortedIso.length > 0) {
    jumlah = sortedIso.length;
  }

  let ada = false;
  if (src.ada === true) {
    ada = true;
  } else if (src.ada === false) {
    ada = false;
  } else {
    ada = jumlah > 0;
  }

  const pPagi = safeNumber(src.pengurangan_poin_pagi, 0);
  const pMalam = safeNumber(src.pengurangan_poin_malam, 0);

  return {
    nama,
    ada,
    jumlah,
    tanggal: sortedIso,
    tanggal_display: tanggalDisplay,
    tgl: tanggalDisplay || "-",
    pengurangan_poin_pagi: pPagi,
    pengurangan_poin_malam: pMalam,
  };
}

/**
 * Normalisasi data pencapaian kalori (>=900 kkal).
 */
export function normalizePencapaianKalori(value: unknown): NormalizedPencapaianKalori {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_PENCAPAIAN_KALORI };
  }

  const item = value as Record<string, unknown>;

  const mencapai = safeNumber(item.jumlah_mencapai, 0);
  const tidakMencapai = safeNumber(item.jumlah_tidak_mencapai, 0);
  const pengiriman = safeNumber(item.jumlah_pengiriman, mencapai + tidakMencapai);
  const persentase = safeNumber(item.persentase, 0);
  const score = safeNumber(item.score_performance, 0);

  let formattedPersen = "-";
  if (typeof item.formatted_persen === "string" && item.formatted_persen.trim()) {
    formattedPersen = item.formatted_persen.trim();
  } else if (pengiriman > 0) {
    formattedPersen = `${persentase.toFixed(2)}%`;
  }

  const hasData = item.has_data === true || (item.has_data !== false && pengiriman > 0);

  return {
    jumlah_mencapai: mencapai,
    jumlah_tidak_mencapai: tidakMencapai,
    jumlah_pengiriman: pengiriman,
    persentase,
    formatted_persen: formattedPersen,
    score_performance: score,
    has_data: hasData,
  };
}

/**
 * Normalisasi seluruh data kalori catering (pelanggaran minus + pencapaian).
 * Mengembalikan objek kalori dengan tipe NormalizedKaloriData lengkap.
 */
export function normalizeCateringKalori(c: unknown): NormalizedKaloriData {
  if (!c || typeof c !== "object") {
    const emptyPelanggaran: NormalizedPelanggaranKalori = {
      minus_tidak_berturut: { ...EMPTY_MINUS_DETAIL },
      minus_2_berturut: { ...EMPTY_MINUS_DETAIL },
      minus_berikutnya: { ...EMPTY_MINUS_DETAIL },
      minus_sidak: { ...EMPTY_MINUS_DETAIL },
      kategori_1: { ...EMPTY_MINUS_DETAIL },
      kategori_2: { ...EMPTY_MINUS_DETAIL },
      kategori_3: { ...EMPTY_MINUS_DETAIL },
      kategori_4: { ...EMPTY_MINUS_DETAIL },
      total_pengurangan_poin_pagi: 0,
      total_pengurangan_poin_malam: 0,
    };
    return {
      pelanggaran: emptyPelanggaran,
      pencapaian: { ...EMPTY_PENCAPAIAN_KALORI },
      pengurangan_poin_pagi: 0,
      pengurangan_poin_malam: 0,
      score_performance: 0,
    };
  }

  const obj = c as Record<string, unknown>;
  const rawKalori = (obj.jumlah_kalori || obj.kalori || {}) as Record<string, unknown>;
  const rawPelanggaran = (rawKalori.pelanggaran || {}) as Record<string, unknown>;

  // Normalisasi 4 kategori
  const k1 = normalizeMinusDetail(
    rawPelanggaran.minus_tidak_berturut,
    rawPelanggaran.kategori_1,
    "TIDAK BERTURUT-TURUT"
  );
  const k2 = normalizeMinusDetail(
    rawPelanggaran.minus_2_berturut,
    rawPelanggaran.kategori_2,
    "BERTURUT-TURUT (2x)"
  );
  const k3 = normalizeMinusDetail(
    rawPelanggaran.minus_berikutnya,
    rawPelanggaran.kategori_3,
    "SETELAH 2 HARI BERTURUT-TURUT"
  );
  const k4 = normalizeMinusDetail(
    rawPelanggaran.minus_sidak,
    rawPelanggaran.kategori_4,
    "BERTURUT-TURUT SAAT SIDAK"
  );

  const calcTotPagi = k1.pengurangan_poin_pagi + k2.pengurangan_poin_pagi + k3.pengurangan_poin_pagi + k4.pengurangan_poin_pagi;
  const calcTotMalam = k1.pengurangan_poin_malam + k2.pengurangan_poin_malam + k3.pengurangan_poin_malam + k4.pengurangan_poin_malam;

  const totPagi = rawPelanggaran.total_pengurangan_poin_pagi !== undefined && rawPelanggaran.total_pengurangan_poin_pagi !== null
    ? safeNumber(rawPelanggaran.total_pengurangan_poin_pagi, 0)
    : calcTotPagi;
  const totMalam = rawPelanggaran.total_pengurangan_poin_malam !== undefined && rawPelanggaran.total_pengurangan_poin_malam !== null
    ? safeNumber(rawPelanggaran.total_pengurangan_poin_malam, 0)
    : calcTotMalam;

  const normalizedPelanggaran: NormalizedPelanggaranKalori = {
    minus_tidak_berturut: k1,
    minus_2_berturut: k2,
    minus_berikutnya: k3,
    minus_sidak: k4,
    kategori_1: k1,
    kategori_2: k2,
    kategori_3: k3,
    kategori_4: k4,
    total_pengurangan_poin_pagi: totPagi,
    total_pengurangan_poin_malam: totMalam,
  };

  const pencapaian = normalizePencapaianKalori(rawKalori.pencapaian);

  const scorePerformance = rawKalori.score_performance !== undefined && rawKalori.score_performance !== null
    ? safeNumber(rawKalori.score_performance, 0)
    : pencapaian.score_performance;

  return {
    pelanggaran: normalizedPelanggaran,
    pencapaian,
    pengurangan_poin_pagi: totPagi,
    pengurangan_poin_malam: totMalam,
    score_performance: scorePerformance,
  };
}
