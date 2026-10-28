export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : "/catering-ir/public";

export function getPublicUrl(path: string, customBasePath?: string): string {
  const base = customBasePath !== undefined ? customBasePath : BASE_PATH;
  const prefix = base ? base.replace(/\/+$/, "") : "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${cleanPath}`;
}

/**
 * Menghapus basePath dari pathname secara deterministik jika ada.
 * Contoh:
 *   stripBasePath("/catering-ir/public/login") => "/login"
 *   stripBasePath("/login") => "/login"
 *   stripBasePath("/catering-ir/public") => "/"
 *   stripBasePath("/catering-ir/public/dashboard") => "/dashboard"
 */
export function stripBasePath(pathname: string | null | undefined, customBasePath?: string): string {
  if (!pathname) return "/";
  let clean = pathname.trim();

  // Pisahkan query (?) atau hash (#) jika ada yang tidak sengaja terbawa
  const queryIdx = clean.indexOf("?");
  if (queryIdx !== -1) clean = clean.substring(0, queryIdx);
  const hashIdx = clean.indexOf("#");
  if (hashIdx !== -1) clean = clean.substring(0, hashIdx);

  const base = (customBasePath !== undefined ? customBasePath : BASE_PATH).replace(/\/+$/, "");

  if (base && (clean === base || clean.startsWith(`${base}/`))) {
    clean = clean.slice(base.length);
    if (!clean.startsWith("/")) {
      clean = `/${clean}`;
    }
  }

  return clean || "/";
}

/**
 * Menentukan apakah suatu pathname merupakan rute login resmi.
 * Menerima (return TRUE):
 *   - "/login"
 *   - "/login/"
 *   - "/catering-ir/public/login"
 *   - "/catering-ir/public/login/"
 * Menolak (return FALSE):
 *   - "/admin/login-history"
 *   - "/report/login-attempts"
 *   - "/foo/login/settings"
 *   - "/dashboard"
 *   - "/catering-ir/public/dashboard"
 *   - "/"
 */
export function isLoginPath(pathname: string | null | undefined, customBasePath?: string): boolean {
  if (!pathname) return false;
  const stripped = stripBasePath(pathname, customBasePath);
  // Normalisasi trailing slashes: "/login/" -> "/login"
  const normalized = stripped.replace(/\/+$/, "") || "/";
  return normalized.toLowerCase() === "/login";
}

/**
 * Membersihkan parameter redirect ?next=...
 * Syarat:
 * 1. Hanya menerima internal application path yang diawali "/"
 * 2. Menolak protocol-relative URL ("//evil.com")
 * 3. Menolak scheme-based URL ("https://...", "http://...", "javascript:...", "data:...")
 * 4. Menolak atau fallback jika next mengarah ke halaman login itu sendiri (mencegah loop)
 * 5. Menghapus prefix basePath agar tidak diduplikasi oleh Next.js router.push/replace
 * Fallback aman: "/"
 */
export function sanitizeRedirectPath(path: string | null | undefined, customBasePath?: string): string {
  if (!path) return "/";
  let trimmed = path.trim();

  // Tolak URL berbahaya / external / scheme-based
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("://") ||
    trimmed.includes("\\") ||
    trimmed.toLowerCase().startsWith("javascript:") ||
    trimmed.toLowerCase().startsWith("data:") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n")
  ) {
    return "/";
  }

  // Harus diawali dengan single slash "/"
  if (!trimmed.startsWith("/")) {
    return "/";
  }

  // Pisahkan pathname dan query untuk evaluasi rute login
  const queryIdx = trimmed.indexOf("?");
  const hashIdx = trimmed.indexOf("#");
  let endIdx = trimmed.length;
  if (queryIdx !== -1) endIdx = queryIdx;
  if (hashIdx !== -1 && hashIdx < endIdx) endIdx = hashIdx;

  const pathnamePart = trimmed.substring(0, endIdx);
  const queryAndHash = trimmed.substring(endIdx);

  // Jika tujuan adalah halaman login itu sendiri, cegah redirect loop dan fallback ke "/"
  if (isLoginPath(pathnamePart, customBasePath)) {
    return "/";
  }

  // Normalisasi basePath agar router Next.js tidak menduplikasi prefix
  const stripped = stripBasePath(pathnamePart, customBasePath);

  // Validasi ulang hasil stripBasePath terhadap login
  if (isLoginPath(stripped, customBasePath)) {
    return "/";
  }

  // Jika tujuan adalah rute lama /punishment yang sudah dihapus, arahkan ke dashboard "/"
  if (stripped === "/punishment" || stripped.startsWith("/punishment/")) {
    return "/";
  }

  const result = `${stripped}${queryAndHash}`;
  return result.startsWith("/") ? result : `/${result}`;
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    // Default portable API path under Apache/reverse proxy
    return "/catering-ir/api";
  }
  return process.env.INTERNAL_BACKEND_URL || process.env.BACKEND_API_TARGET || "http://127.0.0.1:80";
}

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/catering-ir/api";

let inMemoryCsrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  inMemoryCsrfToken = token;
}

export function getCsrfToken(): string | null {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)cms_csrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

let isRedirectingToLogin = false;

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const headers: Record<string, string> = {};

  // Jangan set Content-Type jika body adalah FormData (agar browser otomatis menyetel multipart boundary)
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Merge headers yang diberikan pemanggil
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => {
        headers[k] = v;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // Sisipkan token CSRF pada metode mutasi
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    let csrf = getCsrfToken();
    if (!csrf && path !== "/auth/login" && path !== "/auth/csrf") {
      try {
        csrf = await fetchCsrfTokenApi();
      } catch {}
    }
    if (csrf && !headers["X-CSRF-Token"] && !headers["x-csrf-token"]) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      cache: "no-store",
      ...options,
      credentials: "include", // Selalu sertakan cookie autentikasi & CSRF
      headers,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err;
    }
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  // Tangani 401 Unauthorized secara terpusat dengan pencegahan redirect berulang
  if (res.status === 401) {
    if (typeof window !== "undefined" && !isRedirectingToLogin) {
      const pathname = window.location.pathname;
      if (!isLoginPath(pathname)) {
        isRedirectingToLogin = true;
        const fullPath = pathname + window.location.search;
        window.dispatchEvent(new CustomEvent("cms-auth-unauthorized"));
        window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(fullPath)}`;
      }
    }
    let authDetail = "Sesi telah kedaluwarsa atau tidak valid.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) authDetail = parsed.detail;
    } catch {}
    throw new Error(authDetail);
  }

  if (!res.ok) {
    let detail = "Terjadi kesalahan pada server. Silakan coba kembali.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) {
        detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      try {
        const text = await res.text();
        if (text) detail = text;
      } catch {}
    }
    throw new Error(detail);
  }
  return res.json();
}


// ---------- Types (mengikuti model backend) ----------

export type CateringShape = "circle" | "rectangle";

export const CATERING_SHAPE_LABELS: Record<CateringShape, string> = {
  circle: "Bundar",
  rectangle: "Kotak",
};

export type CateringColor =
  | "merah"
  | "biru"
  | "hijau"
  | "kuning"
  | "oranye"
  | "ungu"
  | "merah-muda"
  | "cokelat"
  | "abu-abu"
  | "hitam";

export const CATERING_COLOR_CONFIG: Record<
  CateringColor,
  { label: string; hex: string }
> = {
  merah: { label: "Merah", hex: "#EF4444" },
  biru: { label: "Biru", hex: "#3B82F6" },
  hijau: { label: "Hijau", hex: "#22C55E" },
  kuning: { label: "Kuning", hex: "#EAB308" },
  oranye: { label: "Oranye", hex: "#F97316" },
  ungu: { label: "Ungu", hex: "#A855F7" },
  "merah-muda": { label: "Merah Muda", hex: "#EC4899" },
  cokelat: { label: "Cokelat", hex: "#92400E" },
  "abu-abu": { label: "Abu-abu", hex: "#6B7280" },
  hitam: { label: "Hitam", hex: "#111827" },
};

export type Catering = {
  id: number;
  nama: string;
  warna: CateringColor;
  color_hex?: string | null;
  bentuk: CateringShape;
  reward_punishment_group?: "A" | "B" | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Periode = {
  id: number;
  catering_id: number;
  nama_periode: string;
  jumlah_order_pagi: number;
  jumlah_order_malam: number;
};

export type Komplain = {
  id: number;
  periode_id: number;
  tanggal: string | null;
  jenis_komplain: string;
  shift: string;
  jumlah: number;
};

export type KaloriEntry = {
  id: number;
  periode_id: number;
  kategori: number;
  tanggal: string | null;
  jumlah: number;
  override_persen_pagi: number | null;
  override_persen_malam: number | null;
};

export type KaloriPencapaian = {
  id: number;
  periode_id: number;
  jumlah_mencapai: number;
  jumlah_tidak_mencapai: number;
};

export type MenuKelayakan = {
  id: number;
  periode_id: number;
  nilai_persen: number;
  pengurangan_poin: number;
};

export type PengirimanTerlambat = {
  id: number;
  periode_id: number;
  tanggal: string | null;
  lamanya_menit: number;
  jumlah: number;
  pengurangan_poin_pagi: number;
  pengurangan_poin_malam: number;
};

export type ScoreRule = {
  id: number;
  kategori: string;
  label: string;
  batas_bawah: number | null;
  batas_atas: number | null;
  grade: string | null;
  score: number;
};


export type Laporan = {
  catering: string;
  periode: string;
  jumlah_order_pagi: number;
  jumlah_order_malam: number;
  hasil_audit: {
    nilai_audit_persen: number;
    grade: string;
    score_performance: number;
  } | null;
  jumlah_komplain: {
    jumlah_komplain: number;
    pengurangan_poin_pagi: number;
    pengurangan_poin_malam: number;
    score_performance: number;
    rincian: { tanggal: string | null; shift: string; jumlah: number; jenis: string }[];
  };
  jumlah_kalori: {
    per_kategori: Record<
      string,
      { ada: boolean; jumlah_kejadian: number; pengurangan_poin_pagi: number; pengurangan_poin_malam: number }
    >;
    total_pengurangan_poin_pagi: number;
    total_pengurangan_poin_malam: number;
  };
  pencapaian_kalori: {
    jumlah_mencapai: number;
    jumlah_tidak_mencapai: number;
    jumlah_pengiriman: number;
    persentase: number;
    score_performance: number;
  } | null;
  menu_kelayakan: { nilai_persen: number; score_performance: number } | null;
  pengiriman_terlambat: {
    rincian: { lamanya_menit: number; jumlah: number }[];
    jumlah_total: number;
    score_performance: number;
  };
  total_score_performance: number;
};

// ---------- Catering ----------

export const getCatering = (options?: { activeOnly?: boolean }) => {
  const query = options?.activeOnly ? "?active_only=true" : "";
  return request<Catering[]>(`/catering${query}`);
};

// Helper to fetch a single catering by ID
export const fetchCateringById = (id: number) => {
  return request<Catering>(`/catering/${id}`);
};

// Shape label mapping (untuk laporan export)
export const SHAPE_LABELS: Record<CateringShape, { label: string }> = {
  circle: { label: "BUNDAR" },
  rectangle: { label: "KOTAK" },
};

export const createCatering = (
  data:
    | string
    | {
        nama: string;
        warna?: string;
        color_hex?: string | null;
        bentuk?: CateringShape;
        reward_punishment_group?: "A" | "B" | null;
      }
) => {
  const body = typeof data === "string" ? { nama: data } : data;
  return request<Catering>("/catering", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const updateCatering = (
  id: number,
  data: {
    nama?: string;
    warna?: string;
    color_hex?: string | null;
    bentuk?: CateringShape;
    reward_punishment_group?: "A" | "B" | null;
  }
) =>
  request<Catering>(`/catering/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const updateCateringStatus = (id: number, is_active: boolean) =>
  request<Catering>(`/catering/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active }),
  });

export type DeletionImpactResponse = {
  catering_id: number;
  catering_name: string;
  total_related_records: number;
  breakdown: Record<string, number>;
};

export const getCateringDeletionImpact = (id: number) =>
  request<DeletionImpactResponse>(`/catering/${id}/deletion-impact`);

export const deleteCatering = (id: number, confirmed: boolean = true) =>
  request<{
    message: string;
    deleted_catering_id: number;
    deleted_catering_name: string;
    total_deleted_records: number;
    breakdown: Record<string, number>;
  }>(`/catering/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmed }),
  });

// ---------- Periode (COMPATIBILITY ONLY: Used by legacy /send-report) ----------

export const getLaporan = (periodeId: number) => request<Laporan>(`/periode/${periodeId}/laporan`);

// ---------- Send Report (Manual File Upload + Ordered Recipients) ----------

export interface ApproverInfo {
  name: string;
  email: string;
  role: string;
}

export interface RequesterInfo {
  id?: number;
  username: string;
  nama: string;
  role: string;
}

export interface SendReportConfigResponse {
  sender_name: string;
  sender_email: string;
  smtp_configured: boolean;
  smtp_host: string | null;
  requester?: RequesterInfo | null;
  approver?: ApproverInfo | null;
  approvers?: ApproverInfo[];
}

export interface SendReportRecipient {
  order: number;
  name: string;
  position: string;
  email: string;
}

export interface SendReportAttachmentMeta {
  filename: string;
  size_bytes: number;
}

export type DeliveryType = "APPROVAL" | "REPORT_ONLY";

export interface SendReportResponse {
  success: boolean;
  message: string;
  sent_at: string;
  delivery_type?: DeliveryType;
  email_sent?: boolean;
  warning?: string | null;
  approval_id?: number;
  report_id?: number;
  sender?: string;
  requester?: RequesterInfo;
  approver?: ApproverInfo;
  attachments: Array<string | SendReportAttachmentMeta>;
  notes?: string;
  subject?: string;
  recipients?: SendReportRecipient[] | {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  periode_formatted?: string;
}

export interface SendReportHistoryItem {
  id: number;
  delivery_type: DeliveryType;
  delivery_type_label?: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type?: string;
  status: string;
  note?: string | null;
  requested_at: string | null;
  requester?: {
    id: number | null;
    nama: string | null;
  };
  approvers?: {
    id: number;
    sequence: number;
    name: string;
    position: string;
    email: string;
    status: string;
  }[];
  recipients?: {
    id?: number;
    sequence: number;
    name: string;
    position?: string;
    jabatan?: string;
    email: string;
  }[];
  download_url: string;
}

export interface SendReportHistoryResponse {
  items: SendReportHistoryItem[];
  total: number;
}

// Retain legacy interfaces for backward compatibility
export interface SendReportReadinessItem {
  report_type: "performance" | "punishment";
  report_name: string;
  available: boolean;
  report_id: number | null;
  status: "draft" | "final" | null;
  filename: string | null;
  download_url: string | null;
  is_ready: boolean;
  completeness_message: string | null;
}

export interface SendReportReadinessResponse {
  bulan?: number;
  tahun?: number;
  periode_mulai?: string;
  periode_selesai?: string;
  periode_formatted?: string;
  smtp_configured: boolean;
  smtp_host: string | null;
  sender_name?: string;
  sender_email?: string;
  reports?: {
    performance?: SendReportReadinessItem;
    punishment?: SendReportReadinessItem;
  };
  default_subject?: string;
  default_body?: string;
}

export interface SendReportPayload {
  bulan?: number;
  tahun?: number;
  include_performance?: boolean;
  include_punishment?: boolean;
  recipients_to?: string[];
  recipients_cc?: string[];
  recipients_bcc?: string[];
  subject: string;
  body: string;
}

export const getSendReportConfig = () =>
  request<SendReportConfigResponse>("/send-report/config");

export const getSendReportReadiness = (bulan?: number, tahun?: number) =>
  request<SendReportReadinessResponse>(
    bulan !== undefined && tahun !== undefined
      ? `/send-report/readiness?bulan=${bulan}&tahun=${tahun}`
      : "/send-report/readiness"
  );

export const submitApprovalRequest = (formData: FormData) =>
  request<SendReportResponse>("/send-report", {
    method: "POST",
    body: formData,
  });

export const sendReportMultipart = (formData: FormData) =>
  submitApprovalRequest(formData);

export const sendReport = (payloadOrFormData: FormData | SendReportPayload) => {
  if (payloadOrFormData instanceof FormData) {
    return sendReportMultipart(payloadOrFormData);
  }
  const formData = new FormData();
  formData.append("subject", payloadOrFormData.subject || "");
  formData.append("message", payloadOrFormData.body || "");
  const recipients = (payloadOrFormData.recipients_to || []).map((email, idx) => ({
    order: idx + 1,
    name: email.split("@")[0],
    position: "Staff",
    email,
  }));
  formData.append("recipients_json", JSON.stringify(recipients));
  return sendReportMultipart(formData);
};

export const getSendReportHistory = () =>
  request<SendReportHistoryResponse>("/send-report/history");

// ---------- Approval Module Types & Endpoints ----------

export interface ApprovalApproverStep {
  id: number;
  sequence: number;
  name: string;
  position: string;
  email: string;
  status: "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "REVISION";
  reviewed_at: string | null;
  rejection_reason: string | null;
  revision_comment?: string | null;
  cycle?: number;
}

export interface ApprovalRevisionRecord {
  id: number;
  revision_number: number;
  original_filename: string;
  file_size_bytes: number;
  mime_type?: string;
  submitted_by: number;
  submitted_by_name?: string;
  submitted_at: string;
  note?: string | null;
}

export interface ApprovalItem {
  id: number;
  delivery_type?: DeliveryType;
  original_filename: string;
  file_size_bytes: number;
  status: "PENDING" | "REVISION_REQUIRED" | "APPROVED" | "REJECTED" | "WAITING" | string;
  note: string | null;
  requested_at: string;
  current_cycle?: number;
  requester: {
    id: number;
    nama: string;
  };
  approvers: ApprovalApproverStep[];
  current_approver?: {
    id: number;
    sequence: number;
    name: string;
    position: string;
    email: string;
    total: number;
  } | null;
  revision_info?: {
    approver_name: string;
    approver_position: string;
    approver_email: string;
    reviewed_at?: string | null;
    revision_comment?: string | null;
  } | null;
  my_step?: {
    id?: number;
    sequence: number;
    name?: string;
    position?: string;
    status: string;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    revision_comment?: string | null;
  } | null;
  can_review: boolean;
  is_requester: boolean;
}

export interface ApprovalListResponse {
  items: ApprovalItem[];
  total: number;
  pending_for_me_count: number;
}

export interface ApprovalArtifactInfo {
  id: number;
  stage: string;
  artifact_type?: string;
  sequence: number;
  stage_sequence?: number;
  cycle: number;
  revision_number: number;
  approver_name: string;
  approver_position: string;
  output_file_sha256: string;
  status: "READY" | "GENERATION_FAILED";
  generation_error?: string | null;
  approved_at?: string | null;
}

export interface ApprovalDetail extends ApprovalItem {
  mime_type?: string;
  revisions?: ApprovalRevisionRecord[];
  history_cycles?: {
    cycle: number;
    approvers: ApprovalApproverStep[];
  }[];
  artifacts?: ApprovalArtifactInfo[];
}

export const getApprovals = (params?: {
  status?: string;
  tab?: string;
  search?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.tab) query.set("tab", params.tab);
  if (params?.search) query.set("search", params.search);
  const qStr = query.toString();
  return request<ApprovalListResponse>(qStr ? `/approvals?${qStr}` : "/approvals");
};

export const getApprovalDetail = (id: number) =>
  request<ApprovalDetail>(`/approvals/${id}`);

export const getPendingApprovalCount = () =>
  request<{ pending_count: number }>("/approvals/pending-count");

export const getApprovalRevisionCount = () =>
  request<{ revision_count: number }>("/approvals/revision-count");

export const approveReport = (id: number) =>
  request<{ success: boolean; message: string; status: string; current_step: number }>(
    `/approvals/${id}/approve`,
    { method: "POST" }
  );

export const rejectReport = (id: number, rejectionReason: string) =>
  request<{ success: boolean; message: string; status: string; rejection_reason: string }>(
    `/approvals/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }
  );

export const requestApprovalRevision = (id: number, comment: string) =>
  request<{
    success: boolean;
    message: string;
    status: string;
    comment: string;
    reviewed_by: string;
    reviewed_at: string;
  }>(`/approvals/${id}/revision-request`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });

export const submitApprovalRevision = async (
  id: number,
  file: File,
  notes?: string
): Promise<{ success: boolean; message: string; revision_number: number; status: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  if (notes) formData.append("notes", notes);

  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  if (csrf) {
    headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${getBaseUrl()}/approvals/${id}/revisions`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  if (!res.ok) {
    let detail = "Gagal mengunggah file revisi.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      try {
        const text = await res.text();
        if (text) detail = text;
      } catch {}
    }
    throw new Error(detail);
  }

  return res.json();
};

export interface ApprovalDownloadOptions {
  revision?: number;
  type?: "original" | "latest";
  artifactId?: number;
  fallbackFilename?: string;
  disposition?: "inline" | "attachment";
}

export const getApprovalFileDownloadUrl = (
  id: number,
  options?: number | ApprovalDownloadOptions
) => {
  const params = new URLSearchParams();
  if (typeof options === "number") {
    params.set("revision", String(options));
  } else if (options) {
    if (options.revision !== undefined) params.set("revision", String(options.revision));
    if (options.type) params.set("type", options.type);
    if (options.artifactId !== undefined) params.set("artifact_id", String(options.artifactId));
    if (options.disposition) params.set("disposition", options.disposition);
  }
  const qStr = params.toString();
  return `${getBaseUrl()}/approvals/${id}/file${qStr ? `?${qStr}` : ""}`;
};

export async function downloadApprovalFileApi(
  id: number,
  optionsOrRevision?: number | ApprovalDownloadOptions,
  legacyFallbackFilename?: string
): Promise<{ blob: Blob; filename: string }> {
  let revision: number | undefined;
  let type: "original" | "latest" | undefined;
  let artifactId: number | undefined;
  let fallbackFilename: string | undefined = legacyFallbackFilename;
  let disposition: "inline" | "attachment" | undefined;

  if (typeof optionsOrRevision === "number") {
    revision = optionsOrRevision;
  } else if (optionsOrRevision) {
    revision = optionsOrRevision.revision;
    type = optionsOrRevision.type;
    artifactId = optionsOrRevision.artifactId;
    fallbackFilename = optionsOrRevision.fallbackFilename || fallbackFilename;
    disposition = optionsOrRevision.disposition;
  }

  const params = new URLSearchParams();
  if (revision !== undefined) params.set("revision", String(revision));
  if (type) params.set("type", type);
  if (artifactId !== undefined) params.set("artifact_id", String(artifactId));
  if (disposition) params.set("disposition", disposition);

  const qStr = params.toString();
  const url = `${getBaseUrl()}/approvals/${id}/file${qStr ? `?${qStr}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (err: any) {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isRedirectingToLogin) {
      const pathname = window.location.pathname;
      if (!isLoginPath(pathname)) {
        isRedirectingToLogin = true;
        const fullPath = pathname + window.location.search;
        window.dispatchEvent(new CustomEvent("cms-auth-unauthorized"));
        window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(fullPath)}`;
      }
    }
    throw new Error("Sesi Anda sudah tidak valid. Silakan masuk kembali.");
  }

  if (res.status === 403) {
    let detail = "Anda tidak memiliki akses untuk mengunduh file ini.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) detail = parsed.detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 404) {
    let detail = "File tidak ditemukan.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) detail = parsed.detail;
    } catch {}
    throw new Error(detail);
  }

  if (!res.ok) {
    let detail = "Gagal mengunduh file. Silakan coba lagi.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) detail = parsed.detail;
    } catch {}
    throw new Error(detail);
  }

  const blob = await res.blob();
  const defaultFallback =
    fallbackFilename ||
    (type === "original"
      ? `original-approval-${id}.xlsx`
      : revision
      ? `approval-${id}-rev${revision}.xlsx`
      : `approval-${id}.xlsx`);
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    defaultFallback
  );

  return { blob, filename };
}

export async function triggerApprovalFileDownload(
  id: number,
  optionsOrRevision?: number | ApprovalDownloadOptions,
  legacyFallbackFilename?: string
): Promise<string> {
  const { blob, filename } = await downloadApprovalFileApi(
    id,
    optionsOrRevision,
    legacyFallbackFilename
  );
  const blobUrl = window.URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    window.URL.revokeObjectURL(blobUrl);
  }
  return filename;
}


// ---------- Input Kalori Harian Master & Entry ----------

export type BahanStandar = {
  id: number;
  nama: string;
  standar_kalori: number;
  standar_berat?: number | null;
  satuan?: string;
  is_active?: boolean;
  updated_at?: string | null;
  updated_by?: number | null;
};

export type CalorieMasterItem = {
  id: number;
  nama: string;
  standar_kalori: number;
  standar_berat: number;
  satuan: string;
  is_active: boolean;
  updated_at: string | null;
  updated_by: number | null;
  updater_name: string | null;
};

export type CalorieStandardItem = {
  id: number;
  nama: string;
  standar_kalori: number;
  is_active: boolean;
  updated_at: string | null;
  updated_by: number | null;
  updater_name: string | null;
};

export type StandarBerat = {
  id: number;
  jenis_masakan: string;
  item_role: string;
  berat_gram: number;
  satuan?: string;
  is_active?: boolean;
  updated_at?: string | null;
  updated_by?: number | null;
  updater_name?: string | null;
};

export type KaloriHarianBahan = {
  id?: number;
  kalori_harian_id?: number;
  kategori: string;
  item_role: string | null;
  nama_bahan: string;
  standar_kalori: number;
  standar_berat: number | null;
  berat_aktual: number;
  preset_name?: string | null;
};

export type PresetItem = {
  nama: string;
  standardKalori: number;
  defaultBerat: number;
  maxBerat: number;
};

export type PresetConfig = {
  key: string;
  label: string;
  category: string;
  type: "preset";
  items: PresetItem[];
};

export type KaloriHarian = {
  id: number;
  catering_id: number;
  tanggal: string;
  shift: string;
  jenis_masakan: string | null;
  nama_masakan_nasi?: string | null;
  nama_masakan_sayur?: string | null;
  menu_components?: string | null;
  menu_plan_id?: number | null;
  menu_plan_version?: number | null;
  bahan: KaloriHarianBahan[];
  total_kalori: number;
  mencapai: boolean;
  is_locked?: boolean;
  lock_reason?: string | null;
};

export type KaloriHarianCreatePayload = {
  catering_id: number;
  tanggal: string;
  shift: string;
  jenis_masakan: string | null;
  nama_masakan_nasi?: string | null;
  nama_masakan_sayur?: string | null;
  menu_components?: string | null;
  menu_plan_id?: number | null;
  menu_plan_version?: number | null;
  bahan: {
    kategori: string;
    item_role?: string | null;
    nama_bahan: string;
    standar_kalori: number;
    standar_berat?: number | null;
    berat_aktual: number;
    preset_name?: string | null;
  }[];
};

export const getBahanStandar = () => request<BahanStandar[]>("/bahan-standar");
export const createBahanStandar = (data: { nama: string; standar_kalori: number; standar_berat?: number; satuan?: string }) =>
  request<BahanStandar>("/bahan-standar", { method: "POST", body: JSON.stringify(data) });
export const updateBahanStandar = (id: number, data: { nama: string; standar_kalori: number; standar_berat?: number; satuan?: string }) =>
  request<BahanStandar>(`/bahan-standar/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const getCalorieStandard = () => request<CalorieStandardItem[]>("/settings/calorie-standard");
export const createCalorieStandard = (data: { nama: string; standar_kalori: number }) =>
  request<CalorieStandardItem>("/settings/calorie-standard", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateCalorieStandard = (id: number, data: { standar_kalori: number }) =>
  request<CalorieStandardItem>(`/settings/calorie-standard/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const deleteCalorieStandard = (id: number) =>
  request<{ status: string; message: string; action: string; id: number; nama: string }>(
    `/settings/calorie-standard/${id}`,
    {
      method: "DELETE",
    }
  );

export const getCalorieMaster = () => request<CalorieMasterItem[]>("/settings/calorie-master");
export const updateCalorieMaster = (id: number, data: { standar_berat?: number; standar_kalori?: number }) =>
  request<CalorieMasterItem>(`/settings/calorie-master/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const getStandarBeratSettings = () => request<StandarBerat[]>("/settings/standar-berat");
export const updateStandarBeratSettings = (id: number, data: { berat_gram: number }) =>
  request<StandarBerat>(`/settings/standar-berat/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const deleteStandarBeratSettings = (id: number) =>
  request<{ status: string; message: string; action: string; id: number; jenis_masakan: string; item_role: string }>(
    `/settings/standar-berat/${id}`,
    {
      method: "DELETE",
    }
  );
export const deleteStandarBeratCell = (jenis_masakan: string, item_role: string) => {
  const params = new URLSearchParams({ jenis_masakan, item_role });
  return request<{ status: string; message: string; action: string; id: number; jenis_masakan: string; item_role: string }>(
    `/settings/standar-berat/cell?${params.toString()}`,
    {
      method: "DELETE",
    }
  );
};
export const createJenisMasakanStandardWeights = (data: {
  jenis_masakan: string;
  weights: { item_role: string; berat_gram?: number | null }[];
}) =>
  request<{ status: string; jenis_masakan: string; count: number; items: StandarBerat[] }>(
    "/settings/standar-berat/jenis-masakan",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
export const deleteJenisMasakanStandardWeights = (jenis_masakan: string) =>
  request<{ status: string; message: string; action: string; jenis_masakan: string; count: number }>(
    `/settings/standar-berat/jenis-masakan/${encodeURIComponent(jenis_masakan)}`,
    {
      method: "DELETE",
    }
  );
export const upsertStandarBeratCell = (data: {
  jenis_masakan: string;
  item_role: string;
  berat_gram: number | null;
}) =>
  request<StandarBerat | null>("/settings/standar-berat/cell", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getStandarBerat = () => request<StandarBerat[]>("/standar-berat");
export const getJenisMasakan = () => request<string[]>("/jenis-masakan");
export const getPresets = () => request<PresetConfig[]>("/presets");

export const createKaloriHarian = (data: KaloriHarianCreatePayload) =>
  request<KaloriHarian>("/kalori-harian", { method: "POST", body: JSON.stringify(data) });

export const getKaloriHarian = (
  cateringId?: number | "",
  start?: string,
  end?: string,
  shift?: string
) => {
  const params = new URLSearchParams();
  if (cateringId) params.set("catering_id", String(cateringId));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (shift) params.set("shift", shift);
  const qs = params.toString();
  return request<KaloriHarian[]>(`/kalori-harian${qs ? `?${qs}` : ""}`);
};

export const deleteKaloriHarian = (id: number) =>
  request<{ ok: boolean; deleted_id: number }>(`/kalori-harian/${id}`, { method: "DELETE" });

export const konfirmasiMingguanKalori = (data: { catering_id: number; start: string; end: string }) =>
  request<{ ok: boolean; hari_dikonfirmasi: number; periode_ids: number[] }>(
    "/kalori-harian/konfirmasi-mingguan",
    { method: "POST", body: JSON.stringify(data) }
  );

// ---------- Kelayakan ----------

export type KelayakanEntry = {
  id?: number;
  catering_id: number;
  tanggal: string;
  shift: string;
  nasi_kelayakan: number;
  nasi_rasa: number;
  lauk_kelayakan: number;
  lauk_rasa: number;
  sayur_kelayakan: number;
  sayur_rasa: number;
  sambal_kelayakan: number;
  sambal_rasa: number;
  kerupuk_kelayakan: number;
  kerupuk_rasa: number;
  buah_kelayakan: number;
  buah_rasa: number;
  kondisi_rantang: number;
  total_nilai?: number;
  score_presentase?: number;
  rata_rata_nilai?: number | null;
};

export type KelayakanListResponse = {
  entries: KelayakanEntry[];
  rata_rata_nilai: number | null;
};

export const createKelayakanEntry = (data: Omit<KelayakanEntry, "id" | "total_nilai" | "score_presentase" | "rata_rata_nilai">) =>
  request<KelayakanEntry>("/kelayakan", { method: "POST", body: JSON.stringify(data) });

export const getKelayakanEntries = (
  cateringId?: number | "",
  tanggal?: string,
  shift?: string,
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams();
  if (cateringId) params.set("catering_id", String(cateringId));
  if (tanggal) params.set("tanggal", tanggal);
  if (shift) params.set("shift", shift);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return request<KelayakanListResponse>(`/kelayakan${qs ? `?${qs}` : ""}`);
};

export const deleteKelayakanEntry = (id: number) =>
  request<{ ok: boolean; deleted_id: number }>(`/kelayakan/${id}`, { method: "DELETE" });


// ---------- Audit Dapur Catering ----------

export type AuditKriteriaItem = {
  id: number;
  sisi: string;
  kategori: string;
  material: string | null;
  deskripsi: string;
  point: number;
};

export type AuditKriteriaResponse = {
  all: AuditKriteriaItem[];
  grouped: {
    A: Record<string, AuditKriteriaItem[]>;
    B: Record<string, AuditKriteriaItem[]>;
  };
  maksimum_sisi_a?: number;
  maksimum_sisi_b?: number;
  total_maksimum?: number;
};

export type AuditFindingPhoto = {
  id: number;
  relative_path: string;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string;
  sha256: string;
  created_at?: string;
  url: string;
};

export type AuditFindingItem = {
  id: number;
  audit_entry_id: number;
  audit_kriteria_id: number;
  keterangan: string;
  nama_kriteria: string;
  kategori: string;
  material?: string | null;
  sisi: string;
  point: number;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  photos: AuditFindingPhoto[];
};

export type AuditEntrySnapshotItem = {
  id: number;
  audit_kriteria_id: number;
  tercentang: boolean;
  nama_kriteria_snapshot?: string;
  kategori_snapshot?: string;
  material_snapshot?: string | null;
  sisi_snapshot?: string;
  point_snapshot?: number;
};

export type AuditEntryComment = {
  sisi: string;
  kategori: string;
  comment?: string;
};

export type AuditEntryPayload = {
  catering_id: number;
  tanggal: string;
  tercentang: number[];
  comments?: AuditEntryComment[];
};

export type AuditEntryItemResponse = {
  id: number;
  catering_id: number;
  catering_nama: string;
  tanggal: string;
  assessment_mode?: "legacy_checklist" | "findings_v1";
  status?: "draft" | "final";
  is_tanpa_temuan?: boolean;
  catatan_umum?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_by_name_snapshot?: string | null;
  finalized_by_name_snapshot?: string | null;
  finalized_by?: number | null;
  finalized_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  finalized_at?: string | null;
  findings_count?: number;
  violated_kriteria_count?: number;
  photos_count?: number;
  maksimum_sisi_a?: number;
  maksimum_sisi_b?: number;
  pengurangan_sisi_a?: number;
  pengurangan_sisi_b?: number;
  nilai_sisi_a?: number;
  nilai_sisi_b?: number;
  persentase_sisi_a?: number;
  persentase_sisi_b?: number;
  total_poin_maksimum?: number;
  total_poin_aktual?: number;
  nilai_audit?: number;
  total_nilai_a: number;
  total_nilai_b: number;
  nilai_a_pct?: number;
  nilai_b_pct?: number;
  nilai_final: number;
  tercentang_ids?: number[];
  comments?: AuditEntryComment[];
  findings?: AuditFindingItem[];
  items?: AuditEntrySnapshotItem[];
};

export const getAuditKriteria = () => request<AuditKriteriaResponse>("/audit-kriteria");

export const createAuditEntry = (data: AuditEntryPayload) =>
  request<AuditEntryItemResponse>("/audit-entry", { method: "POST", body: JSON.stringify(data) });

export const getAuditEntries = (cateringId?: number | "", start?: string, end?: string) => {
  const params = new URLSearchParams();
  if (cateringId) params.set("catering_id", String(cateringId));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const qs = params.toString();
  return request<AuditEntryItemResponse[]>(`/audit-entry${qs ? `?${qs}` : ""}`);
};

export const getAuditEntryById = (id: number) =>
  request<AuditEntryItemResponse>(`/audit-entry/${id}`);

export const deleteAuditEntry = (id: number) =>
  request<{ ok: boolean; deleted_id: number }>(`/audit-entry/${id}`, { method: "DELETE" });

export const exportAuditExcelApi = async (entryId: number): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${getBaseUrl()}/audit-entry/${entryId}/export-excel`, {
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Gagal mengunduh Excel Audit Dapur.";
    try {
      const err = await res.json();
      if (err?.detail) message = err.detail;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `Form Audit Dapur Catering - Entry #${entryId}.xlsx`
  );
  return { blob, filename };
};


export const createAuditEntryV1 = (data: { catering_id: number; tanggal: string; catatan_umum?: string }) =>
  request<AuditEntryItemResponse>("/audit-entries", { method: "POST", body: JSON.stringify(data) });

export const listAuditEntries = (cateringId?: number | "", start?: string, end?: string, status?: string) => {
  const params = new URLSearchParams();
  if (cateringId) params.set("catering_id", String(cateringId));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (status) params.set("status", status);
  const qs = params.toString();
  return request<AuditEntryItemResponse[]>(`/audit-entries${qs ? `?${qs}` : ""}`);
};

export const getAuditEntryDetail = (id: number) =>
  request<AuditEntryItemResponse>(`/audit-entries/${id}`);

export const updateAuditEntryMeta = (id: number, data: { catering_id?: number; tanggal?: string; catatan_umum?: string }) =>
  request<AuditEntryItemResponse>(`/audit-entries/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteAuditEntryV1 = (id: number) =>
  request<{ ok: boolean; deleted_id: number }>(`/audit-entries/${id}`, { method: "DELETE" });

export const finalizeAuditEntry = (id: number, confirm_no_findings: boolean = false) =>
  request<AuditEntryItemResponse>(`/audit-entries/${id}/finalize`, {
    method: "POST",
    body: JSON.stringify({ confirm_no_findings }),
  });

export const addAuditFinding = (auditId: number, formData: FormData) =>
  request<AuditEntryItemResponse>(`/audit-entries/${auditId}/findings`, {
    method: "POST",
    body: formData,
  });

export const updateAuditFinding = (
  auditId: number,
  findingId: number,
  formData: FormData
) =>
  request<AuditEntryItemResponse>(`/audit-entries/${auditId}/findings/${findingId}`, {
    method: "PUT",
    body: formData,
  });

export const deleteAuditFinding = (auditId: number, findingId: number) =>
  request<AuditEntryItemResponse>(`/audit-entries/${auditId}/findings/${findingId}`, {
    method: "DELETE",
  });

export const getAuditFindingPhotoUrl = (photoId: number) =>
  `${getBaseUrl()}/audit-findings/photos/${photoId}`;

export const getUnifiedAuditEntries = async (
  cateringId?: number | "",
  start?: string,
  end?: string,
  status?: string
): Promise<AuditEntryItemResponse[]> => {
  try {
    return await listAuditEntries(cateringId, start, end, status);
  } catch (err: any) {
    // Jika V1 schema belum aktif atau endpoint V1 error, fallback aman ke legacy
    return await getAuditEntries(cateringId, start, end);
  }
};

export const getUnifiedAuditEntryDetail = async (id: number): Promise<AuditEntryItemResponse> => {
  try {
    return await getAuditEntryDetail(id);
  } catch (err: any) {
    return await getAuditEntryById(id);
  }
};



// ---------- MINUS (KETERANGAN KALORI MINUS) API ----------

export type MinusEntry = {
  id: number;
  kalori_harian_id?: number | null;
  catering_id: number;
  catering_nama?: string;
  tanggal: string;
  shift?: string;
  menu: string;
  foto_url?: string | null;
  hasil_kalori: number;
  problem: string;
  perbaikan: string;
  is_active?: boolean;
  status_pengisian?: string;
};

export type MinusInputPayload = {
  catering_id: number;
  tanggal: string;
  shift?: string;
  menu: string;
  foto_url?: string | null;
  hasil_kalori: number;
  problem?: string;
  perbaikan?: string;
};

export type MinusUpdatePayload = {
  problem?: string;
  perbaikan?: string;
  foto_url?: string | null;
  menu?: string;
  shift?: string;
};

export const uploadFotoMinus = async (file: File): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  if (csrf) {
    headers["X-CSRF-Token"] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/minus/upload-foto`, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });
  } catch (err: any) {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isLoginPath(window.location.pathname)) {
      const fullPath = window.location.pathname + window.location.search;
      window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(fullPath)}`;
    }
    throw new Error("Sesi telah kedaluwarsa. Silakan masuk kembali.");
  }

  if (!res.ok) {
    let detail = "Gagal mengunggah foto.";
    try {
      const parsed = await res.json();
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      try {
        const text = await res.text();
        if (text) detail = text;
      } catch {}
    }
    throw new Error(detail);
  }
  return res.json();
};

export const createMinusEntry = (data: MinusInputPayload) =>
  request<MinusEntry>("/minus", { method: "POST", body: JSON.stringify(data) });

export const getMinusEntries = (
  cateringId?: number | "",
  start?: string,
  end?: string,
  shift?: string,
  statusPengisian?: string,
  includeInactive?: boolean
) => {
  const params = new URLSearchParams();
  if (cateringId) params.set("catering_id", String(cateringId));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (shift) params.set("shift", shift);
  if (statusPengisian) params.set("status_pengisian", statusPengisian);
  if (includeInactive) params.set("include_inactive", "true");
  const qs = params.toString();
  return request<MinusEntry[]>(`/minus${qs ? `?${qs}` : ""}`);
};

export const getMinusEntryById = (id: number) =>
  request<MinusEntry>(`/minus/${id}`);

export const updateMinusEntry = (id: number, data: MinusUpdatePayload) =>
  request<MinusEntry>(`/minus/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteMinusEntry = (id: number) =>
  request<{ status: string; message: string }>(`/minus/${id}`, { method: "DELETE" });

export function getDownloadFilename(
  contentDisposition: string | null,
  fallback: string
): string {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );

  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // fallback
    }
  }

  const basicMatch = contentDisposition.match(
    /filename="?([^"]+)"?/i
  );

  return basicMatch?.[1] || fallback;
}

export const exportMinusExcelApi = async (
  cateringId?: number | "",
  start?: string,
  end?: string,
  shift?: string,
  id?: number
): Promise<{ blob: Blob; filename: string }> => {
  const params = new URLSearchParams();
  if (id !== undefined && id !== null) params.set("id", String(id));
  if (cateringId) params.set("catering_id", String(cateringId));
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (shift) params.set("shift", shift);
  const qs = params.toString();

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/minus/export-excel${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
  } catch (err: any) {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isLoginPath(window.location.pathname)) {
      window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new Error("Sesi telah kedaluwarsa. Silakan masuk kembali.");
  }

  if (!res.ok) {
    let message = "Gagal mengunduh file Excel.";
    try {
      const errorData = await res.json();
      message = errorData.detail || errorData.message || message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = txt;
      } catch {}
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("spreadsheetml") &&
    !contentType.includes("octet-stream") &&
    !contentType.includes("excel")
  ) {
    let errText = "Format file dari server tidak sesuai.";
    try {
      const jsonRes = await res.json();
      if (jsonRes.detail) errText = jsonRes.detail;
    } catch {}
    throw new Error(errText);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("File Excel yang diterima kosong.");
  }
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    "Kalori Minus.xlsx"
  );
  return { blob, filename };
};

export const exportMinusExcelPostApi = async (
  entryIds: number[]
): Promise<{ blob: Blob; filename: string }> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrf = getCsrfToken();
  if (csrf) {
    headers["X-CSRF-Token"] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/minus/export-excel`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ entry_ids: entryIds }),
    });
  } catch (err: any) {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isLoginPath(window.location.pathname)) {
      window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new Error("Sesi telah kedaluwarsa. Silakan masuk kembali.");
  }

  if (!res.ok) {
    let message = "Gagal mengunduh file Excel.";
    try {
      const errorData = await res.json();
      message = errorData.detail || errorData.message || message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = txt;
      } catch {}
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("spreadsheetml") &&
    !contentType.includes("octet-stream") &&
    !contentType.includes("excel")
  ) {
    let errText = "Format file dari server tidak sesuai.";
    try {
      const jsonRes = await res.json();
      if (jsonRes.detail) errText = jsonRes.detail;
    } catch {}
    throw new Error(errText);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("File Excel yang diterima kosong.");
  }

  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    "Kalori Minus.xlsx"
  );

  return { blob, filename };
};

// ---------- Auth & User Management API ----------

export type UserSignatureInfo = {
  user_id: number;
  has_signature: boolean;
  is_active: boolean;
  status: "Aktif" | "Nonaktif" | "Belum Dibuat";
  created_at: string | null;
  regenerated_at: string | null;
  revoked_at: string | null;
  qr_image_url: string | null;
};

export type AuthUser = {
  id: number;
  username: string;
  nama: string;
  email?: string | null;
  role: "admin" | "staff" | "approver" | "user";
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
  signature?: UserSignatureInfo;
};

export type LoginPayload = {
  email?: string;
  username?: string;
  password: string;
  remember_me?: boolean;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export type CreateUserPayload = {
  nama: string;
  username: string;
  email?: string;
  role: "admin" | "staff" | "approver";
  password: string;
  confirm_password: string;
};

export type UpdateUserPayload = {
  nama?: string;
  username?: string;
  email?: string | null;
  role?: "admin" | "staff" | "approver" | "user";
};

export type ResetPasswordPayload = {
  new_password: string;
  confirm_password: string;
};

export const fetchCsrfTokenApi = async () => {
  const data = await request<{ csrf_token: string }>("/auth/csrf");
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  return data.csrf_token;
};

export const loginApi = async (payload: LoginPayload) => {
  const data = await request<{ user: AuthUser; csrf_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  return data;
};

export const getMeApi = async () => {
  const data = await request<{ user: AuthUser; csrf_token?: string }>("/auth/me");
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  return data.user;
};

export const logoutApi = async () => {
  const res = await request<{ message: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
  setCsrfToken(null);
  return res;
};

export const changePasswordApi = (payload: ChangePasswordPayload) =>
  request<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getUsersApi = () =>
  request<AuthUser[]>("/users");

export const createUserApi = (payload: CreateUserPayload) =>
  request<AuthUser>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateUserStatusApi = (userId: number, isActive: boolean) =>
  request<AuthUser>(`/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });

export const resetUserPasswordApi = (userId: number, payload: ResetPasswordPayload) =>
  request<{ message: string; user_id?: number; username?: string }>(`/settings/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateUserApi = (userId: number, payload: UpdateUserPayload) =>
  request<AuthUser>(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateMyProfileApi = (payload: { nama?: string; username?: string; email?: string | null }) =>
  request<AuthUser>("/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteUserApi = (userId: number) =>
  request<{ message: string; deleted_user_id: number }>(`/users/${userId}`, {
    method: "DELETE",
  });

export const getUserSignatureApi = (userId: number) =>
  request<UserSignatureInfo>(`/users/${userId}/signature`);

export const getMySignatureApi = () =>
  request<UserSignatureInfo>(`/users/me/signature`);

export const replaceMySignatureQrApi = (currentPassword: string, note?: string) =>
  request<{ success: boolean; message: string; signature: UserSignatureInfo }>(`/users/me/signature/replace`, {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, note: note || undefined }),
  });

export const resetUserSignatureApi = (userId: number, note?: string) =>
  request<{ success: boolean; message: string; signature: UserSignatureInfo }>(`/users/${userId}/signature/reset`, {
    method: "POST",
    body: JSON.stringify({ note: note || undefined }),
  });

// =====================================================================
// ---------- Keterlambatan Pengiriman Katering -------------------------
// =====================================================================

export type KeterlambatanRecord = {
  id: number;
  catering_id: number;
  catering_nama: string;
  catering_warna: CateringColor;
  catering_bentuk: CateringShape;
  catering_is_active: boolean;
  tanggal: string; // YYYY-MM-DD
  shift: string;   // pagi / malam
  is_terlambat: boolean;
  status_pengiriman: "tepat_waktu" | "terlambat" | "tidak_dikirim";
  menit_terlambat: number | null;
  kategori: string | null;
  komentar: string | null;
  created_at?: string;
  updated_at?: string;
};

export type KeterlambatanPayload = {
  catering_id: number;
  tanggal: string;
  shift: string;
  is_terlambat?: boolean;
  status_pengiriman: "tepat_waktu" | "terlambat" | "tidak_dikirim";
  menit_terlambat?: number | null;
  kategori?: string | null;
  komentar?: string | null;
};

export type KeterlambatanFilter = {
  catering_id?: number;
  start?: string;
  end?: string;
  shift?: string;
  status_pengiriman?: string;
  kategori?: string;
};

export type KeterlambatanSummary = {
  total_records: number;
  tepat_waktu: number;
  terlambat: number;
  tidak_dikirim: number;
  total_menit: number;
  kategori_distribution: Record<string, number>;
};

export function hitungKategoriKeterlambatan(
  status: "tepat_waktu" | "terlambat" | "tidak_dikirim",
  menit?: number | null
): string | null {
  if (status === "tepat_waktu") return null;
  if (status === "tidak_dikirim") return "Tidak Dikirim";
  if (status === "terlambat") {
    if (menit === undefined || menit === null || menit < 1) return null;
    if (menit <= 5) return "1–5 Menit";
    if (menit <= 10) return "6–10 Menit";
    if (menit <= 30) return "11–30 Menit";
    if (menit <= 60) return "31–60 Menit";
    return "Lebih dari 60 Menit";
  }
  return null;
}

export const getKeterlambatan = (filter?: KeterlambatanFilter) => {
  const params = new URLSearchParams();
  if (filter?.catering_id) params.set("catering_id", String(filter.catering_id));
  if (filter?.start) params.set("start", filter.start);
  if (filter?.end) params.set("end", filter.end);
  if (filter?.shift) params.set("shift", filter.shift);
  if (filter?.status_pengiriman) params.set("status_pengiriman", filter.status_pengiriman);
  if (filter?.kategori) params.set("kategori", filter.kategori);

  const qs = params.toString();
  return request<KeterlambatanRecord[]>(`/keterlambatan${qs ? `?${qs}` : ""}`);
};

export const getKeterlambatanById = (id: number) =>
  request<KeterlambatanRecord>(`/keterlambatan/${id}`);

export const createKeterlambatan = (payload: KeterlambatanPayload) =>
  request<KeterlambatanRecord>("/keterlambatan", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateKeterlambatan = (id: number, payload: KeterlambatanPayload) =>
  request<KeterlambatanRecord>(`/keterlambatan/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteKeterlambatan = (id: number) =>
  request<{ status: string; message: string }>(`/keterlambatan/${id}`, {
    method: "DELETE",
  });

export const getKeterlambatanSummary = (filter?: {
  catering_id?: number;
  start?: string;
  end?: string;
}) => {
  const params = new URLSearchParams();
  if (filter?.catering_id) params.set("catering_id", String(filter.catering_id));
  if (filter?.start) params.set("start", filter.start);
  if (filter?.end) params.set("end", filter.end);

  const qs = params.toString();
  return request<KeterlambatanSummary>(`/keterlambatan/summary${qs ? `?${qs}` : ""}`);
};

export const exportKeterlambatanExcelApi = async (params: {
  start?: string;
  end?: string;
  catering_id?: number | string;
  shift?: string;
  status_pengiriman?: string;
  kategori?: string;
}): Promise<{ blob: Blob; filename: string }> => {
  const queryParams = new URLSearchParams();
  if (params.start) queryParams.set("start", params.start);
  if (params.end) queryParams.set("end", params.end);
  if (params.catering_id && params.catering_id !== "all") queryParams.set("catering_id", String(params.catering_id));
  if (params.shift && params.shift !== "all") queryParams.set("shift", params.shift);
  if (params.status_pengiriman && params.status_pengiriman !== "all") queryParams.set("status_pengiriman", params.status_pengiriman);
  if (params.kategori && params.kategori !== "all") queryParams.set("kategori", params.kategori);

  const res = await fetch(`${getBaseUrl()}/keterlambatan/export-excel?${queryParams.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Gagal mengunduh laporan Keterlambatan Excel.";
    try {
      const err = await res.json();
      if (err?.detail) message = err.detail;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `Laporan_Keterlambatan_${params.start || "All"}_${params.end || "All"}.xlsx`
  );
  return { blob, filename };
};


// ============================================================================
// KOMPLAIN CATERING TYPES & API FUNCTIONS
// ============================================================================

export type SourceMenuResponse = {
  found: boolean;
  count: number;
  report_id: number | null;
  menu: string | null;
  tanggal?: string;
  shift?: string;
  catering_id?: number;
  catering_nama?: string;
  message?: string;
};

export type KomplainRecord = {
  id: number;
  tanggal: string;
  shift: string;
  catering_id: number;
  catering_nama: string;
  catering_warna?: string;
  catering_bentuk?: string;
  catering_is_active?: boolean;
  source_report_id: number;
  menu_snapshot: string;
  foto_path?: string | null;
  keterangan: string;
  created_by?: number | null;
  created_by_nama?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KomplainPayload = {
  tanggal: string;
  shift: string;
  catering_id: number;
  source_report_id: number;
  menu_snapshot: string;
  foto_path?: string | null;
  keterangan: string;
};

export type KomplainFilter = {
  catering_id?: number;
  start?: string;
  end?: string;
  shift?: string;
  search?: string;
};

export type KomplainSummary = {
  total_records: number;
  shift_pagi: number;
  shift_malam: number;
  catering_distribution: Record<number, number>;
};

export const getSourceMenu = (
  tanggal: string,
  shift: string,
  catering_id: number,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams({
    tanggal,
    shift,
    catering_id: String(catering_id),
  });
  return request<SourceMenuResponse>(`/komplain/source-menu?${params.toString()}`, {
    signal,
  });
};

export const uploadFotoKomplain = async (file: File, signal?: AbortSignal) => {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ foto_path: string }>("/komplain/upload-foto", {
    method: "POST",
    body: formData,
    signal,
  });
};

export const getKomplainCatering = (filter?: KomplainFilter) => {
  const params = new URLSearchParams();
  if (filter?.catering_id) params.set("catering_id", String(filter.catering_id));
  if (filter?.start) params.set("start", filter.start);
  if (filter?.end) params.set("end", filter.end);
  if (filter?.shift) params.set("shift", filter.shift);
  if (filter?.search) params.set("search", filter.search);

  const qs = params.toString();
  return request<KomplainRecord[]>(`/komplain${qs ? `?${qs}` : ""}`);
};

export const getKomplainCateringById = (id: number) =>
  request<KomplainRecord>(`/komplain/${id}`);

export const createKomplainCatering = (payload: KomplainPayload) =>
  request<KomplainRecord>("/komplain", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateKomplainCatering = (id: number, payload: KomplainPayload) =>
  request<KomplainRecord>(`/komplain/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteKomplainCatering = (id: number) =>
  request<{ status: string; message: string }>(`/komplain/${id}`, {
    method: "DELETE",
  });

export const getKomplainCateringSummary = (filter?: {
  catering_id?: number;
  start?: string;
  end?: string;
}) => {
  const params = new URLSearchParams();
  if (filter?.catering_id) params.set("catering_id", String(filter.catering_id));
  if (filter?.start) params.set("start", filter.start);
  if (filter?.end) params.set("end", filter.end);

  const qs = params.toString();
  return request<KomplainSummary>(`/komplain/summary${qs ? `?${qs}` : ""}`);
};

export const exportKomplainExcelApi = async (
  komplainId: number
): Promise<{ blob: Blob; filename: string }> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/komplain/${komplainId}/export-excel`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isLoginPath(window.location.pathname)) {
      window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new Error("Sesi telah kedaluwarsa. Silakan masuk kembali.");
  }

  if (!res.ok) {
    let message = "Gagal mengunduh laporan Komplain.";
    try {
      const errorData = await res.json();
      message = errorData.detail || errorData.message || message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = txt;
      } catch {}
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("spreadsheetml") &&
    !contentType.includes("octet-stream") &&
    !contentType.includes("excel")
  ) {
    let errText = "Format file dari server tidak sesuai.";
    try {
      const jsonRes = await res.json();
      if (jsonRes.detail) errText = jsonRes.detail;
    } catch {}
    throw new Error(errText);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("File Excel yang diterima kosong.");
  }

  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `komplain-laporan-${komplainId}.xlsx`
  );

  return { blob, filename };
};

export const exportKomplainWeeklyExcelApi = async (params: {
  start_date: string;
  end_date: string;
  catering_id?: number | string;
  shift?: string;
}): Promise<{ blob: Blob; filename: string }> => {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", params.start_date);
  queryParams.set("end_date", params.end_date);
  if (params.catering_id !== undefined && params.catering_id !== "" && params.catering_id !== "all") {
    queryParams.set("catering_id", String(params.catering_id));
  }
  if (params.shift && params.shift !== "all" && params.shift !== "") {
    queryParams.set("shift", params.shift);
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/komplain/export-excel-weekly?${queryParams.toString()}`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !isLoginPath(window.location.pathname)) {
      window.location.href = `${getPublicUrl("/login")}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new Error("Sesi telah kedaluwarsa. Silakan masuk kembali.");
  }

  if (!res.ok) {
    let message = "Gagal mengunduh laporan Komplain mingguan.";
    try {
      const errorData = await res.json();
      message = errorData.detail || errorData.message || message;
    } catch {
      try {
        const txt = await res.text();
        if (txt) message = txt;
      } catch {}
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("spreadsheetml") &&
    !contentType.includes("octet-stream") &&
    !contentType.includes("excel")
  ) {
    let errText = "Format file dari server tidak sesuai.";
    try {
      const jsonRes = await res.json();
      if (jsonRes.detail) errText = jsonRes.detail;
    } catch {}
    throw new Error(errText);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("File Excel yang diterima kosong.");
  }

  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `komplain-mingguan-${params.start_date}-${params.end_date}.xlsx`
  );

  return { blob, filename };
};

// ============================================================================
// LAPORAN PUNISHMENT BULANAN
// ============================================================================

export interface PunishmentMonthlyCompletenessItem {
  count: number;
  caterings_count: number;
  status: "Tersedia" | "Belum Lengkap" | "Tidak Ada Data";
}

export interface AuditCateringInfo {
  id: number;
  nama: string;
}

export interface AuditCompletenessStatus {
  is_complete: boolean;
  total_required: number;
  total_completed: number;
  total_missing: number;
  required_caterings: AuditCateringInfo[];
  completed_caterings: AuditCateringInfo[];
  missing_caterings: AuditCateringInfo[];
  title: string;
  message: string;
}

export interface PunishmentMonthlyCompleteness {
  keterlambatan: PunishmentMonthlyCompletenessItem;
  kelayakan: PunishmentMonthlyCompletenessItem;
  audit: PunishmentMonthlyCompletenessItem;
  kalori: PunishmentMonthlyCompletenessItem;
  komplain: PunishmentMonthlyCompletenessItem;
  kebersihan?: PunishmentMonthlyCompletenessItem;
  order?: PunishmentMonthlyCompletenessItem & { is_complete?: boolean; total?: number };
}

export interface CateringOrderItem {
  catering_id: number;
  jumlah_order_pagi: number;
  jumlah_order_malam: number;
  kebersihan_kondisi?: string;
  kebersihan_score?: number | null;
}

// ============================================================================
// Raw API / Snapshot Interfaces (Semua field nested opsional / nullable)
// ============================================================================

export interface RawMinusDetail {
  nama?: string;
  ada?: boolean | null;
  jumlah?: number | string | null;
  tanggal?: string[] | null;
  tanggal_display?: string | null;
  tgl?: string | null;
  pengurangan_poin_pagi?: number | string | null;
  pengurangan_poin_malam?: number | string | null;
}

export interface RawPelanggaranKalori {
  minus_tidak_berturut?: RawMinusDetail | null;
  minus_2_berturut?: RawMinusDetail | null;
  minus_berikutnya?: RawMinusDetail | null;
  minus_sidak?: RawMinusDetail | null;
  kategori_1?: RawMinusDetail | null;
  kategori_2?: RawMinusDetail | null;
  kategori_3?: RawMinusDetail | null;
  kategori_4?: RawMinusDetail | null;
  total_pengurangan_poin_pagi?: number | string | null;
  total_pengurangan_poin_malam?: number | string | null;
}

export interface RawPencapaianKalori {
  jumlah_mencapai?: number | string | null;
  jumlah_tidak_mencapai?: number | string | null;
  jumlah_pengiriman?: number | string | null;
  persentase?: number | string | null;
  formatted_persen?: string | null;
  score_performance?: number | string | null;
  has_data?: boolean | null;
}

export interface RawKaloriData {
  pelanggaran?: RawPelanggaranKalori | null;
  pencapaian?: RawPencapaianKalori | null;
  pengurangan_poin_pagi?: number | string | null;
  pengurangan_poin_malam?: number | string | null;
  score_performance?: number | string | null;
}

// ============================================================================
// Normalized UI Interfaces (Field-field wajib terisi nilai aman)
// ============================================================================

export interface NormalizedMinusDetail {
  nama: string;
  ada: boolean;
  jumlah: number;
  tanggal: string[];
  tanggal_display: string;
  tgl: string;
  pengurangan_poin_pagi: number;
  pengurangan_poin_malam: number;
}

export interface NormalizedPelanggaranKalori {
  minus_tidak_berturut: NormalizedMinusDetail;
  minus_2_berturut: NormalizedMinusDetail;
  minus_berikutnya: NormalizedMinusDetail;
  minus_sidak: NormalizedMinusDetail;
  kategori_1: NormalizedMinusDetail;
  kategori_2: NormalizedMinusDetail;
  kategori_3: NormalizedMinusDetail;
  kategori_4: NormalizedMinusDetail;
  total_pengurangan_poin_pagi: number;
  total_pengurangan_poin_malam: number;
}

export interface NormalizedPencapaianKalori {
  jumlah_mencapai: number;
  jumlah_tidak_mencapai: number;
  jumlah_pengiriman: number;
  persentase: number;
  formatted_persen: string;
  score_performance: number;
  has_data: boolean;
}

export interface NormalizedKaloriData {
  pelanggaran: NormalizedPelanggaranKalori;
  pencapaian: NormalizedPencapaianKalori;
  pengurangan_poin_pagi: number;
  pengurangan_poin_malam: number;
  score_performance: number;
}

export interface LaporanPunishmentBulananItem {
  id: number;
  periode_mulai: string;
  periode_selesai: string;
  bulan_laporan: number;
  tahun_laporan: number;
  rule_version: string;
  active_rule_version?: string;
  rule_status?: string;
  is_rule_approved?: boolean;
  is_legacy?: boolean;
  status: "draft" | "final";
  total_caterings: number;
  generated_at?: string;
  created_by?: number;
  creator_name?: string;
  finalized_at?: string;
  finalized_by_name?: string;
  updated_at?: string;
}

export interface LaporanPunishmentPreviewResponse {
  start_date: string;
  end_date: string;
  rule_version: string;
  active_rule_version?: string;
  is_rule_approved?: boolean;
  rule_version_config?: {
    status?: string;
    shift_basis?: string;
    multi_audit_aggregation?: string;
    punishment_rounding?: string;
    complaint_rule?: string;
    [key: string]: any;
  };
  ketentuan_aktif?: Record<string, any>;
  status_aturan_shift?: string;
  is_shift_rules_confirmed?: boolean;
  shift_config?: Record<string, string>;
  total_caterings: number;
  completeness: PunishmentMonthlyCompleteness;
  audit_completeness?: AuditCompletenessStatus;
  is_order_complete?: boolean;
  incomplete_order_caterings?: string[];
  caterings: any[];
  resum: any[];
  existing_report?: {
    id: number;
    status: string;
    generated_at?: string;
  } | null;
}

export interface LaporanPunishmentDetailResponse {
  id: number;
  periode_mulai: string;
  periode_selesai: string;
  bulan_laporan: number;
  tahun_laporan: number;
  rule_version: string;
  active_rule_version?: string;
  rule_status?: string;
  is_rule_approved?: boolean;
  is_legacy?: boolean;
  status: "draft" | "final";
  total_caterings: number;
  notes?: string;
  generated_at?: string;
  created_by?: number;
  creator_name?: string;
  finalized_at?: string;
  finalized_by_name?: string;
  updated_at?: string;
  caterings_order: CateringOrderItem[];
  snapshot: {
    start_date: string;
    end_date: string;
    rule_version: string;
    active_rule_version?: string;
    is_rule_approved?: boolean;
    rule_version_config?: {
      status?: string;
      shift_basis?: string;
      multi_audit_aggregation?: string;
      punishment_rounding?: string;
      complaint_rule?: string;
      [key: string]: any;
    };
    ketentuan_aktif?: Record<string, any>;
    status_aturan_shift?: string;
    is_shift_rules_confirmed?: boolean;
    shift_config?: Record<string, string>;
    total_caterings: number;
    completeness: PunishmentMonthlyCompleteness;
    caterings: any[];
    resum: any[];
  };
}

export interface LaporanPunishmentCreatePayload {
  start_date: string;
  end_date: string;
  bulan_laporan: number;
  tahun_laporan: number;
  rule_version?: string;
  caterings_order?: CateringOrderItem[];
  notes?: string;
  revisi_final?: boolean;
}

export const getPunishmentMonthlyPreviewApi = async (
  startDate: string,
  endDate: string,
  ruleVersion?: string
): Promise<LaporanPunishmentPreviewResponse> => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  if (ruleVersion) {
    params.set("rule_version", ruleVersion);
  }
  return request<LaporanPunishmentPreviewResponse>(`/punishment-monthly/preview?${params.toString()}`);
};

export const savePunishmentMonthlyApi = async (
  payload: LaporanPunishmentCreatePayload
): Promise<any> => {
  return request<any>("/punishment-monthly", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const listPunishmentMonthlyApi = async (
  tahun?: number
): Promise<LaporanPunishmentBulananItem[]> => {
  const path = tahun ? `/punishment-monthly?tahun=${tahun}` : "/punishment-monthly";
  return request<LaporanPunishmentBulananItem[]>(path);
};

export const getPunishmentMonthlyDetailApi = async (
  id: number
): Promise<LaporanPunishmentDetailResponse> => {
  return request<LaporanPunishmentDetailResponse>(`/punishment-monthly/${id}`);
};

export const finalizePunishmentMonthlyApi = async (
  id: number
): Promise<any> => {
  return request<any>(`/punishment-monthly/${id}/finalize`, {
    method: "POST",
  });
};

export const exportPunishmentMonthlyExcelApi = async (
  id: number,
  sign?: { approved_by?: string; checked_by?: string; prepared_by?: string }
): Promise<{ blob: Blob; filename: string }> => {
  const queryParams = new URLSearchParams();
  if (sign?.approved_by) queryParams.set("approved_by", sign.approved_by);
  if (sign?.checked_by) queryParams.set("checked_by", sign.checked_by);
  if (sign?.prepared_by) queryParams.set("prepared_by", sign.prepared_by);

  const res = await fetch(`${getBaseUrl()}/punishment-monthly/${id}/export-excel?${queryParams.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Gagal mengunduh file Excel.";
    try {
      const err = await res.json();
      if (err?.detail) message = err.detail;
    } catch {}
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `laporan-punishment-${id}.xlsx`
  );

  return { blob, filename };
};

export const deletePunishmentMonthlyApi = async (
  id: number
): Promise<any> => {
  return request<any>(`/punishment-monthly/${id}`, {
    method: "DELETE",
  });
};


// =============================================================================
// PERFORMANCE CATERING BULANAN API
// =============================================================================

export interface PerformanceComponentResult {
  raw_value?: number | string | null;
  raw_label?: string;
  score: number | null;
  max_score: number;
  has_data: boolean;
  is_complete: boolean;
  status?: string;
  kondisi?: string;
  kondisi_kebersihan?: string;
  melanggar_disiplin?: boolean;
  source_assessment_id?: number | null;
  note?: string;
  formula?: string;
  rule_status?: string;
}

export interface PerformanceCateringItem {
  catering_id: number;
  catering_nama: string;
  terlambat: PerformanceComponentResult;
  kelayakan: PerformanceComponentResult;
  kalori: PerformanceComponentResult;
  komplain: PerformanceComponentResult;
  audit: PerformanceComponentResult;
  kebersihan: PerformanceComponentResult;
  subtotal_5_komponen: number;
  total_score: number | null;
  grade: string | null;
  action: string | null;
  is_complete: boolean;
  missing_components: string[];
  periode_lalu?: {
    score_terlambat?: number | null;
    score_kelayakan?: number | null;
    score_kalori?: number | null;
    score_komplain?: number | null;
    score_audit?: number | null;
    score_kebersihan?: number | null;
    subtotal_5_komponen?: number | null;
    total_score?: number | null;
    grade?: string | null;
    action?: string | null;
    has_data?: boolean;
  };
  perubahan_subtotal?: number | null;
}

export interface PerformanceReportSummary {
  total_caterings_assessed: number;
  rata_rata_subtotal_5: number;
  rata_rata_total?: number | null;
  total_grade_a: number;
  total_grade_b: number;
  total_grade_c: number;
  total_grade_d: number;
}

export interface PerformancePreviewResponse {
  bulan_laporan: number;
  tahun_laporan: number;
  periode_mulai: string;
  periode_selesai: string;
  nama_periode: string;
  periode_lalu_mulai: string;
  periode_lalu_selesai: string;
  nama_periode_lalu: string;
  tanggal_dibuat: string;
  rule_version: string;
  status: string;
  total_caterings: number;
  caterings: PerformanceCateringItem[];
  summary: PerformanceReportSummary;
  is_complete: boolean;
  missing_components: string[];
  finalization_blocked: boolean;
  finalization_block_reason: string;
  audit_formula: string;
  audit_rule_status: string;
  audit_completeness?: AuditCompletenessStatus;
  warnings?: string[];
  existing_report?: {
    id: number;
    status: string;
    created_at?: string | null;
  } | null;
}

export interface PerformanceReportListItem {
  id: number;
  bulan_laporan: number;
  tahun_laporan: number;
  periode_mulai: string;
  periode_selesai: string;
  nama_periode: string;
  tanggal_dibuat: string;
  status: string;
  total_caterings: number;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
}

export interface PerformanceReportDetailResponse {
  id: number;
  bulan_laporan: number;
  tahun_laporan: number;
  periode_mulai: string;
  periode_selesai: string;
  nama_periode: string;
  tanggal_dibuat: string;
  status: string;
  rule_version: string;
  total_caterings: number;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
  snapshot: PerformancePreviewResponse;
}

export interface PerformanceCreatePayload {
  bulan_laporan: number;
  tahun_laporan: number;
  tanggal_dibuat?: string;
  notes?: string;
}

export interface PerformanceUpdatePayload {
  tanggal_dibuat?: string;
  notes?: string;
}

export const getPerformancePreviewApi = async (
  bulan: number,
  tahun: number,
  tanggalDibuat?: string
): Promise<PerformancePreviewResponse> => {
  const params = new URLSearchParams({
    bulan: bulan.toString(),
    tahun: tahun.toString(),
  });
  if (tanggalDibuat) {
    params.set("tanggal_dibuat", tanggalDibuat);
  }
  return request<PerformancePreviewResponse>(`/performance/preview?${params.toString()}`);
};

export const exportPerformancePreviewExcelApi = async (
  bulan: number,
  tahun: number,
  tanggalDibuat?: string
): Promise<{ blob: Blob; filename: string }> => {
  const params = new URLSearchParams({
    bulan: bulan.toString(),
    tahun: tahun.toString(),
  });
  if (tanggalDibuat) {
    params.set("tanggal_dibuat", tanggalDibuat);
  }
  const res = await fetch(`${getBaseUrl()}/performance/preview/export-excel?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Gagal mengunduh Excel Draft Performance.";
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `PERFORMANCE_CATERING_${bulan}_${tahun}_DRAFT.xlsx`
  );
  return { blob, filename };
};

export const listPerformanceReportsApi = async (): Promise<PerformanceReportListItem[]> => {
  return request<PerformanceReportListItem[]>("/performance");
};

export const getPerformanceReportDetailApi = async (
  id: number
): Promise<PerformanceReportDetailResponse> => {
  return request<PerformanceReportDetailResponse>(`/performance/${id}`);
};

export const createPerformanceDraftApi = async (
  payload: PerformanceCreatePayload
): Promise<{ id: number; status: string; message: string }> => {
  return request<{ id: number; status: string; message: string }>("/performance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updatePerformanceDraftApi = async (
  id: number,
  payload: PerformanceUpdatePayload
): Promise<{ id: number; status: string; message: string }> => {
  return request<{ id: number; status: string; message: string }>(`/performance/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const finalizePerformanceReportApi = async (
  id: number
): Promise<{ id: number; status: string; message: string }> => {
  return request<{ id: number; status: string; message: string }>(`/performance/${id}/finalize`, {
    method: "POST",
  });
};

export const deletePerformanceDraftApi = async (
  id: number
): Promise<{ message: string }> => {
  return request<{ message: string }>(`/performance/${id}`, {
    method: "DELETE",
  });
};

export const exportPerformanceReportExcelApi = async (
  id: number
): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${getBaseUrl()}/performance/${id}/export-excel`, {
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Gagal mengunduh Excel Performance.";
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `PERFORMANCE_CATERING_${id}.xlsx`
  );
  return { blob, filename };
};

export const exportPerformanceVendorExcelApi = async (
  id: number,
  cateringId: number
): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${getBaseUrl()}/performance/${id}/export-vendor/${cateringId}`, {
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Gagal mengunduh Excel Vendor.";
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `PERFORMANCE_VENDOR_${cateringId}.xlsx`
  );
  return { blob, filename };
};

export const exportKaloriMonthlyExcelApi = async (
  month: number,
  year: number,
  holidayDates: string[] = []
): Promise<{ blob: Blob; filename: string }> => {
  const params = new URLSearchParams();
  params.set("month", String(month));
  params.set("year", String(year));
  for (const h of holidayDates) {
    if (h) params.append("holiday_dates", h);
  }

  const res = await fetch(`${getBaseUrl()}/kalori-harian/export-monthly?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Gagal mengunduh Excel Kalori Bulanan.";
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `LAPORAN_KALORI_BULANAN_${month}_${year}.xlsx`
  );
  return { blob, filename };
};


// ============================================================================
// KEBERSIHAN KANTIN & KEDISIPLINAN (PHASE 2B)
// ============================================================================

export type KondisiKebersihan = "bersih" | "tidak_rapi" | "kotor";

export interface KebersihanAssessment {
  id: number;
  catering_id: number;
  catering_nama?: string | null;
  periode_mulai: string;
  periode_selesai: string;
  kondisi_kebersihan: KondisiKebersihan;
  pelanggaran_rantang_tidak_langsung_masuk_mobil: boolean;
  pelanggaran_buka_pilah_rantang_sisa_di_jai: boolean;
  pelanggaran_memberi_makan_kucing: boolean;
  melanggar_disiplin: boolean;
  derived_score_preview: number;
  catatan?: string | null;
  status: "draft" | "final";
  created_by?: number | null;
  finalized_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  finalized_at?: string | null;
}

export interface KebersihanAssessmentCreateInput {
  catering_id: number;
  periode_mulai: string;
  periode_selesai: string;
  kondisi_kebersihan: KondisiKebersihan;
  pelanggaran_rantang_tidak_langsung_masuk_mobil?: boolean;
  pelanggaran_buka_pilah_rantang_sisa_di_jai?: boolean;
  pelanggaran_memberi_makan_kucing?: boolean;
  catatan?: string | null;
}

export interface KebersihanAssessmentUpdateInput {
  kondisi_kebersihan?: KondisiKebersihan;
  pelanggaran_rantang_tidak_langsung_masuk_mobil?: boolean;
  pelanggaran_buka_pilah_rantang_sisa_di_jai?: boolean;
  pelanggaran_memberi_makan_kucing?: boolean;
  catatan?: string | null;
}

export function computeKebersihanScorePreview(
  kondisi: KondisiKebersihan | string,
  violation: boolean
): { score: number; reason: string } {
  if (violation) {
    return {
      score: 4.0,
      reason: "Terdapat pelanggaran kedisiplinan katering (skor diturunkan ke 4.0).",
    };
  }
  switch (kondisi) {
    case "bersih":
      return {
        score: 10.0,
        reason: "Bersih & rapi, tidak ada pelanggaran disiplin (skor maksimal 10.0).",
      };
    case "tidak_rapi":
      return {
        score: 8.0,
        reason: "Kondisi tidak rapi tanpa pelanggaran disiplin (skor 8.0).",
      };
    case "kotor":
      return {
        score: 6.0,
        reason: "Kondisi kotor tanpa pelanggaran disiplin (skor 6.0).",
      };
    default:
      return {
        score: 10.0,
        reason: "Pilih kondisi kebersihan fisik.",
      };
  }
}

export function getPeriodeDates(bulan: number, tahun: number): { periode_mulai: string; periode_selesai: string } {
  const startYear = bulan === 1 ? tahun - 1 : tahun;
  const startMonth = bulan === 1 ? 12 : bulan - 1;
  const startStr = `${startYear}-${String(startMonth).padStart(2, "0")}-20`;
  const endStr = `${tahun}-${String(bulan).padStart(2, "0")}-19`;
  return { periode_mulai: startStr, periode_selesai: endStr };
}

export const getKebersihanAssessmentsApi = (params?: {
  periode_mulai?: string;
  periode_selesai?: string;
  catering_id?: number;
  status?: string;
}): Promise<KebersihanAssessment[]> => {
  const q = new URLSearchParams();
  if (params?.periode_mulai) q.set("periode_mulai", params.periode_mulai);
  if (params?.periode_selesai) q.set("periode_selesai", params.periode_selesai);
  if (params?.catering_id) q.set("catering_id", String(params.catering_id));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return request<KebersihanAssessment[]>(`/kebersihan-kantin${qs ? `?${qs}` : ""}`);
};

export const getKebersihanAssessmentByIdApi = (id: number): Promise<KebersihanAssessment> => {
  return request<KebersihanAssessment>(`/kebersihan-kantin/${id}`);
};

export const createKebersihanAssessmentApi = (
  data: KebersihanAssessmentCreateInput
): Promise<KebersihanAssessment> => {
  return request<KebersihanAssessment>("/kebersihan-kantin", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateKebersihanAssessmentApi = (
  id: number,
  data: KebersihanAssessmentUpdateInput
): Promise<KebersihanAssessment> => {
  return request<KebersihanAssessment>(`/kebersihan-kantin/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const finalizeKebersihanAssessmentApi = (id: number): Promise<KebersihanAssessment> => {
  return request<KebersihanAssessment>(`/kebersihan-kantin/${id}/finalize`, {
    method: "POST",
  });
};

export const deleteKebersihanAssessmentApi = (id: number): Promise<{ message: string; id: number }> => {
  return request<{ message: string; id: number }>(`/kebersihan-kantin/${id}`, {
    method: "DELETE",
  });
};

// ==========================================
// Kebersihan Daily & Shift Models & API (New Workflow)
// ==========================================

export interface KebersihanDailyAssessment {
  id: number;
  catering_id: number;
  catering_nama?: string | null;
  tanggal: string;
  shift: "Pagi" | "Malam";
  kondisi_kebersihan: KondisiKebersihan;
  pelanggaran_rantang_tidak_langsung_masuk_mobil: boolean;
  pelanggaran_buka_pilah_rantang_sisa_di_jai: boolean;
  pelanggaran_memberi_makan_kucing: boolean;
  melanggar_disiplin: boolean;
  derived_score_preview: number;
  catatan?: string | null;
  status: "draft" | "final";
  created_by?: number | null;
  updated_by?: number | null;
  finalized_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  finalized_at?: string | null;
}

export interface KebersihanDailyInput {
  catering_id: number;
  tanggal: string;
  shift: "Pagi" | "Malam";
  kondisi_kebersihan: KondisiKebersihan;
  pelanggaran_rantang_tidak_langsung_masuk_mobil?: boolean;
  pelanggaran_buka_pilah_rantang_sisa_di_jai?: boolean;
  pelanggaran_memberi_makan_kucing?: boolean;
  catatan?: string | null;
  status?: "draft" | "final";
}

export const getKebersihanDailyAssessmentApi = (
  cateringId: number,
  tanggal: string,
  shift: "Pagi" | "Malam"
): Promise<KebersihanDailyAssessment | null> => {
  const qs = new URLSearchParams({
    catering_id: String(cateringId),
    tanggal,
    shift,
  }).toString();
  return request<KebersihanDailyAssessment | null>(`/kebersihan-kantin/daily?${qs}`);
};

export const upsertKebersihanDailyAssessmentApi = (
  data: KebersihanDailyInput
): Promise<KebersihanDailyAssessment> => {
  return request<KebersihanDailyAssessment>("/kebersihan-kantin/daily", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getKebersihanDailyListApi = (params?: {
  tanggal?: string;
  shift?: string;
  catering_id?: number;
  start_date?: string;
  end_date?: string;
}): Promise<KebersihanDailyAssessment[]> => {
  const q = new URLSearchParams();
  if (params?.tanggal) q.set("tanggal", params.tanggal);
  if (params?.shift) q.set("shift", params.shift);
  if (params?.catering_id) q.set("catering_id", String(params.catering_id));
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);
  const qs = q.toString();
  return request<KebersihanDailyAssessment[]>(`/kebersihan-kantin/daily/list${qs ? `?${qs}` : ""}`);
};

export const finalizeKebersihanDailyAssessmentApi = (
  id: number
): Promise<KebersihanDailyAssessment> => {
  return request<KebersihanDailyAssessment>(`/kebersihan-kantin/daily/${id}/finalize`, {
    method: "POST",
  });
};

export const deleteKebersihanDailyAssessmentApi = (
  id: number
): Promise<{ message: string; id: number }> => {
  return request<{ message: string; id: number }>(`/kebersihan-kantin/daily/${id}`, {
    method: "DELETE",
  });
};

export const exportKebersihanExcelApi = async (params?: {
  start_date?: string;
  end_date?: string;
  catering_id?: number | string;
  shift?: string;
}): Promise<{ blob: Blob; filename: string }> => {
  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.set("start_date", params.start_date);
  if (params?.end_date) queryParams.set("end_date", params.end_date);
  if (params?.catering_id && params.catering_id !== "all") queryParams.set("catering_id", String(params.catering_id));
  if (params?.shift && params.shift !== "all") queryParams.set("shift", params.shift);

  const res = await fetch(`${getBaseUrl()}/kebersihan/export-excel?${queryParams.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Gagal mengunduh laporan Kebersihan Kantin.";
    try {
      const err = await res.json();
      if (err?.detail) message = err.detail;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `Laporan_Kebersihan_${params?.start_date || "All"}_${params?.end_date || "All"}.xlsx`
  );
  return { blob, filename };
};


// ==========================================
// Catering Daily Order Models & API (New Workflow in Kalori)
// ==========================================

export interface CateringDailyOrder {
  id: number;
  catering_id: number;
  catering_nama?: string | null;
  tanggal: string;
  shift: "Pagi" | "Malam";
  jumlah_order: number;
  is_locked?: boolean;
  lock_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OperationalLockStatus {
  catering_id: number;
  tanggal: string;
  is_locked: boolean;
  lock_reason?: string | null;
}

export const getOperationalLockStatusApi = (
  cateringId: number,
  tanggal: string
): Promise<OperationalLockStatus> => {
  const qs = new URLSearchParams({
    catering_id: String(cateringId),
    tanggal,
  }).toString();
  return request<OperationalLockStatus>(`/operational-lock/status?${qs}`);
};

export interface CateringDailyOrderInput {
  catering_id: number;
  tanggal: string;
  shift: "Pagi" | "Malam";
  jumlah_order: number;
}

export const getCateringDailyOrderApi = (
  cateringId: number,
  tanggal: string,
  shift: "Pagi" | "Malam"
): Promise<CateringDailyOrder | null> => {
  const qs = new URLSearchParams({
    catering_id: String(cateringId),
    tanggal,
    shift,
  }).toString();
  return request<CateringDailyOrder | null>(`/catering-daily-order?${qs}`);
};

export const upsertCateringDailyOrderApi = (
  data: CateringDailyOrderInput
): Promise<CateringDailyOrder> => {
  return request<CateringDailyOrder>("/catering-daily-order", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// ==========================================
// Order / Kuota Catering Models & API (DEPRECATED - COMPATIBILITY ONLY)
// ==========================================

export interface CateringOrderQuota {
  id: number;
  catering_id: number;
  catering_nama?: string | null;
  periode_mulai: string;
  periode_selesai: string;
  order_pagi: number;
  order_malam: number;
  total_order?: number;
  catatan?: string | null;
  status: "draft" | "confirmed";
  created_by?: number | null;
  updated_by?: number | null;
  confirmed_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  confirmed_at?: string | null;
}

export interface CateringOrderQuotaInput {
  catering_id: number;
  periode_mulai: string;
  periode_selesai: string;
  order_pagi: number;
  order_malam: number;
  catatan?: string;
}

export interface CateringOrderQuotaUpdateInput {
  order_pagi?: number;
  order_malam?: number;
  catatan?: string;
}

export const getOrderCateringApi = (params?: {
  periode_mulai?: string;
  periode_selesai?: string;
  catering_id?: number;
  status?: string;
}): Promise<CateringOrderQuota[]> => {
  const q = new URLSearchParams();
  if (params?.periode_mulai) q.set("periode_mulai", params.periode_mulai);
  if (params?.periode_selesai) q.set("periode_selesai", params.periode_selesai);
  if (params?.catering_id) q.set("catering_id", String(params.catering_id));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return request<CateringOrderQuota[]>(`/order-catering${qs ? `?${qs}` : ""}`);
};

export const getOrderCateringByIdApi = (id: number): Promise<CateringOrderQuota> => {
  return request<CateringOrderQuota>(`/order-catering/${id}`);
};

export const createOrderCateringApi = (
  data: CateringOrderQuotaInput
): Promise<CateringOrderQuota> => {
  return request<CateringOrderQuota>("/order-catering", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateOrderCateringApi = (
  id: number,
  data: CateringOrderQuotaUpdateInput
): Promise<CateringOrderQuota> => {
  return request<CateringOrderQuota>(`/order-catering/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const confirmOrderCateringApi = (id: number): Promise<CateringOrderQuota> => {
  return request<CateringOrderQuota>(`/order-catering/${id}/confirm`, {
    method: "POST",
  });
};

export const deleteOrderCateringApi = (id: number): Promise<{ message: string; id: number }> => {
  return request<{ message: string; id: number }>(`/order-catering/${id}`, {
    method: "DELETE",
  });
};

/* =========================================================================
   SMTP SETTINGS API
   ========================================================================= */

export interface SmtpConfig {
  id?: number;
  smtp_host: string;
  smtp_port: number;
  smtp_username?: string | null;
  smtp_password_configured: boolean;
  email_sender: string;
  sender_name?: string | null;
  use_tls: boolean;
  use_ssl: boolean;
  app_url?: string | null;
  is_active: boolean;
  updated_at?: string | null;
  updated_by_nama?: string | null;
}

export interface SmtpConfigUpdatePayload {
  smtp_host: string;
  smtp_port: number;
  smtp_username?: string | null;
  smtp_password?: string | null;
  clear_password?: boolean;
  email_sender: string;
  sender_name?: string | null;
  use_tls: boolean;
  use_ssl: boolean;
  app_url?: string | null;
  is_active: boolean;
}

export interface SmtpTestPayload {
  test_recipient_email?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  clear_password?: boolean | null;
  use_tls?: boolean | null;
  use_ssl?: boolean | null;
  email_sender?: string | null;
  sender_name?: string | null;
}

export interface SmtpTestResult {
  success: boolean;
  message: string;
}

export const getSmtpConfigApi = (): Promise<SmtpConfig> => {
  return request<SmtpConfig>("/settings/smtp");
};

export const updateSmtpConfigApi = (
  data: SmtpConfigUpdatePayload
): Promise<SmtpConfig> => {
  return request<SmtpConfig>("/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const testSmtpApi = (
  data: SmtpTestPayload
): Promise<SmtpTestResult> => {
  return request<SmtpTestResult>("/settings/smtp/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// ======================================================================
// TEMPORARY SMTP TESTING PAGE
// SAFE TO REMOVE AFTER SMTP PRODUCTION VALIDATION
// ======================================================================

export interface SmtpTestingPayload {
  smtp_host: string;
  smtp_port: number;
  security_mode?: "none" | "tls" | "ssl";
  use_tls?: boolean;
  use_ssl?: boolean;
  username?: string | null;
  password?: string | null;
  email_sender?: string | null;
  sender_name?: string | null;
  test_recipient_email?: string | null;
  subject?: string | null;
}

export interface SmtpTestingResult {
  success: boolean;
  message: string;
  recipient?: string;
}

export const testSmtpTestingConnectionApi = (
  data: SmtpTestingPayload
): Promise<SmtpTestingResult> => {
  return request<SmtpTestingResult>("/settings/smtp-testing/connection", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const sendSmtpTestingEmailApi = (
  data: SmtpTestingPayload
): Promise<SmtpTestingResult> => {
  return request<SmtpTestingResult>("/settings/smtp-testing/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// ======================================================================
// REWARD & PUNISHMENT CATERING EVALUATION MODULE
// ======================================================================

export interface RewardPunishmentPeriodListItem {
  id: number;
  nama_periode: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  target_bulan_berikutnya: string;
  status: "DRAFT" | "FINAL";
  punishment_source_status?: "FINAL" | "DRAFT / PREVIEW" | string;
  catatan?: string | null;
  keterangan?: string | null;
  created_at: string;
  updated_at: string;
  finalized_at?: string | null;
}

export interface RewardPunishmentItem {
  id: number;
  period_id: number;
  group_code: "A" | "B";
  shift: "Pagi" | "Malam";
  catering_id?: number | null;
  catering_nama: string;
  catering_warna: string;
  catering_bentuk: string;
  jumlah_order_berjalan: number;
  prosentase_order: number;
  performa_katering: number;
  sanksi_terlambat: number;
  sanksi_kelayakan: number;
  sanksi_kalori: number;
  sanksi_komplain: number;
  sanksi_audit: number;
  sanksi_kebersihan: number;
  total_sanksi: number;
  reward: number;
  hasil_perhitungan: number;
  prosentase_order_berikutnya: number;
  perkiraan_order: number | null;
  order_minmax?: number | null;
  aktual_order?: number | null;
  catatan?: string | null;
  urutan?: number;
}

export interface RewardPunishmentShiftDetail {
  id?: number;
  shift_id?: number | null;
  shift: "Pagi" | "Malam";
  jumlah_karyawan: number | null;
  jumlah_order_total: number;
  total_perkiraan_order?: number | null;
  total_order_minmax?: number | null;
  total_aktual_order?: number | null;
  items: RewardPunishmentItem[];
  summary?: {
    total_order_saat_ini: number;
    jumlah_catering: number;
    total_sanksi: number;
    total_reward: number;
    total_perkiraan_order: number | null;
    total_aktual_order: number | null;
  };
}

export interface RewardPunishmentPeriodDetail {
  period: RewardPunishmentPeriodListItem;
  group_code?: "A" | "B";
  group?: "A" | "B";
  shifts: {
    Pagi: RewardPunishmentShiftDetail;
    Malam: RewardPunishmentShiftDetail;
  };
}

export interface RewardPunishmentPeriodCreatePayload {
  nama_periode: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  target_bulan_berikutnya: string;
  catatan?: string | null;
  keterangan?: string | null;
  default_karyawan_pagi?: number | null;
  default_karyawan_malam?: number | null;
}

export interface RewardPunishmentItemUpdatePayload {
  reward?: number;
  order_minmax?: number | null;
  aktual_order?: number | null;
  catatan?: string | null;
  sanksi_kebersihan?: number;
}

export interface RewardPunishmentShiftUpdatePayload {
  jumlah_karyawan?: number | null;
  jumlah_order_total?: number;
}

export const getRewardPunishmentPeriodsApi = (): Promise<RewardPunishmentPeriodListItem[]> => {
  return request<RewardPunishmentPeriodListItem[]>("/reward-punishment/periods");
};

export const createRewardPunishmentPeriodApi = (
  payload: RewardPunishmentPeriodCreatePayload
): Promise<{ success: boolean; message: string; period_id: number }> => {
  return request("/reward-punishment/periods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getRewardPunishmentPeriodDetailApi = (
  periodId: number,
  group: "A" | "B" = "A"
): Promise<RewardPunishmentPeriodDetail> => {
  return request<RewardPunishmentPeriodDetail>(`/reward-punishment/periods/${periodId}?group=${group}`);
};

export const updateRewardPunishmentPeriodApi = (
  periodId: number,
  payload: { target_bulan_berikutnya?: string; catatan?: string; keterangan?: string }
): Promise<{ success: boolean; message: string }> => {
  return request(`/reward-punishment/periods/${periodId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const syncRewardPunishmentPeriodApi = (
  periodId: number
): Promise<{ success: boolean; synced_items_count: number; message: string }> => {
  return request(`/reward-punishment/periods/${periodId}/sync`, {
    method: "POST",
  });
};

export const updateRewardPunishmentItemApi = (
  periodId: number,
  itemId: number,
  payload: RewardPunishmentItemUpdatePayload
): Promise<{ success: boolean; message: string; item_id: number }> => {
  return request(`/reward-punishment/periods/${periodId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const updateRewardPunishmentShiftApi = (
  periodId: number,
  shiftId: number,
  payload: RewardPunishmentShiftUpdatePayload
): Promise<{ success: boolean; message: string }> => {
  return request(`/reward-punishment/periods/${periodId}/shifts/${shiftId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const finalizeRewardPunishmentPeriodApi = (
  periodId: number
): Promise<{ success: boolean; message: string; finalized_at: string }> => {
  return request(`/reward-punishment/periods/${periodId}/finalize`, {
    method: "POST",
  });
};

export async function triggerRewardPunishmentExcelDownload(
  periodId: number,
  periodName: string,
  group?: "A" | "B"
): Promise<void> {
  const query = group ? `?group=${group}` : "";
  const url = `${getBaseUrl()}/reward-punishment/periods/${periodId}/export-excel${query}`;
  const res = await fetch(url, {
    credentials: "include",
  });
  if (res.status === 401) {
    throw new Error("Sesi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.");
  }
  if (!res.ok) {
    let msg = `Gagal mengunduh Excel (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }

  let filename = `REWARD_PUNISHMENT_${periodName.replace(/[\s/]+/g, "_")}.xlsx`;
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}

// ==============================================================================
// MANAGEMENT ANALYTICS API (APPROVER / SPV / EXECUTIVE VIEW)
// ==============================================================================

export interface ManagementSummaryResponse {
  pending_approvals: number;
  pending_approvals_count: number;
  kalori: {
    has_data: boolean;
    bulan: number;
    tahun: number;
    bulan_nama: string;
    avg_kalori: number;
    compliance_pct: number;
    compliant_count: number;
    total_count: number;
  };
  punishment: {
    has_data: boolean;
    periode_nama: string;
    status: string;
    total_sanksi: number;
    caterings_with_sanksi: number;
    top_domain: string;
  };
  performance: {
    has_data: boolean;
    periode_nama: string;
    status: string;
    avg_score: number;
    grade_a_count: number;
    grade_b_count: number;
    grade_c_d_count: number;
  };
  reward_punishment: {
    has_data: boolean;
    nama_periode: string;
    status: string;
    total_order_berjalan: number;
    total_sanksi: number;
    total_reward: number;
    total_hasil_perhitungan: number;
  };
}

export interface ManagementKaloriDailyResponse {
  has_data: boolean;
  tanggal: string;
  summary: {
    total_pengukuran: number;
    memenuhi: number;
    tidak_memenuhi: number;
    persen_kepatuhan: number;
    standar_kalori: number;
  };
  items: Array<{
    id: number;
    tanggal: string;
    catering_id: number;
    catering_nama: string;
    shift: string;
    nama_menu: string;
    jenis_masakan?: string | null;
    nama_masakan_nasi?: string | null;
    nama_masakan_sayur?: string | null;
    total_kalori: number;
    standar_minimal: number;
    status_standar: "Memenuhi Standar" | "Di Bawah Standar" | "Belum Ada Data";
    is_memenuhi: boolean;
    jumlah_order?: number | null;
    bahan: Array<{
      id?: number;
      kategori: string;
      nama_bahan: string;
      standar_kalori: number;
      standar_berat?: number | null;
      berat_aktual: number;
    }>;
  }>;
}

export interface ManagementKaloriResponse {
  has_data: boolean;
  periode: {
    bulan: number;
    tahun: number;
    bulan_nama: string;
    available_periods: Array<{ bulan: number; tahun: number; bulan_nama: string; label?: string }>;
  };
  kpi: {
    rata_rata_kalori: number;
    persentase_memenuhi: number;
    jumlah_memenuhi: number;
    jumlah_tidak_memenuhi: number;
    total_pemeriksaan: number;
    standar_kalori: number;
    standard_kalori: number;
  };
  charts: {
    trend_harian: Array<{
      tanggal: string;
      tanggal_label: string;
      rata_rata: number;
      memenuhi: number;
      tidak_memenuhi: number;
    }>;
    perbandingan_katering: Array<{
      catering_id: number;
      catering_nama: string;
      total: number;
      memenuhi: number;
      tidak_memenuhi: number;
      persen_memenuhi: number;
      rata_rata_kalori: number;
    }>;
    perbandingan_shift: {
      pagi: { total: number; memenuhi: number; tidak_memenuhi: number; persen: number; rata_rata: number };
      malam: { total: number; memenuhi: number; tidak_memenuhi: number; persen: number; rata_rata: number };
    };
  };
  table: Array<{
    catering_id: number;
    catering_nama: string;
    shift: string;
    total_pemeriksaan: number;
    memenuhi: number;
    tidak_memenuhi: number;
    persentase_memenuhi: number;
    rata_rata_kalori: number;
    status: string;
  }>;
  insights: string[];
}

export interface ManagementPunishmentResponse {
  has_data: boolean;
  status: string;
  is_final: boolean;
  periode: {
    id: number;
    nama_periode: string;
    bulan: number;
    tahun: number;
    periode_mulai: string;
    periode_selesai: string;
    available_reports: Array<{ id: number; nama_periode: string; bulan: number; tahun: number; status: string }>;
  };
  kpi: {
    total_sanksi: number;
    jumlah_katering_sanksi: number;
    domain_terbesar: string;
    jumlah_laporan_final: number;
  };
  charts: {
    perbandingan_katering: Array<{
      catering_id: number;
      catering_nama: string;
      total_sanksi: number;
      sanksi_terlambat: number;
      sanksi_kelayakan: number;
      sanksi_kalori: number;
      sanksi_komplain: number;
      sanksi_audit: number;
    }>;
    komposisi_domain: Array<{
      domain: string;
      total: number;
      percentage: number;
    }>;
    tren_periode: Array<{
      report_id: number;
      nama_periode: string;
      bulan: number;
      tahun: number;
      total_sanksi: number;
      status: string;
    }>;
  };
  table: Array<{
    catering_id: number;
    catering_nama: string;
    shift: string;
    keterlambatan: number;
    kelayakan: number;
    kalori: number;
    komplain: number;
    audit: number;
    total: number;
    status_laporan: string;
  }>;
  insights: string[];
}

export interface ManagementPerformanceResponse {
  has_data: boolean;
  status: string;
  is_final: boolean;
  periode: {
    bulan: number;
    tahun: number;
    nama_periode: string;
    available_reports: Array<{ id: number; nama_periode: string; bulan: number; tahun: number; status: string }>;
  };
  kpi: {
    rata_rata_skor: number;
    jumlah_grade_a: number;
    jumlah_grade_b: number;
    jumlah_grade_c_d: number;
    total_katering: number;
  };
  component_weights: {
    keterlambatan: number;
    kelayakan: number;
    kalori: number;
    komplain: number;
    audit: number;
    kebersihan: number;
  };
  charts: {
    ranking_katering: Array<{
      catering_id: number;
      catering_nama: string;
      score: number;
      grade: string;
      delta_from_prev?: number | null;
    }>;
    kontribusi_komponen: Array<{
      catering_id: number;
      catering_nama: string;
      terlambat: number;
      kelayakan: number;
      kalori: number;
      komplain: number;
      audit: number;
      kebersihan: number;
      total_score: number;
    }>;
    tren_skor: Array<{
      nama_periode: string;
      bulan: number;
      tahun: number;
      rata_rata_skor: number;
      status: string;
    }>;
  };
  table: Array<{
    catering_id: number;
    catering_nama: string;
    shift: string;
    score: number;
    grade: string;
    perubahan?: number | null;
    terlambat: number;
    kelayakan: number;
    kalori: number;
    komplain: number;
    audit: number;
    kebersihan: any;
    status_data: string;
  }>;
  insights: string[];
}

export interface ManagementRewardPunishmentResponse {
  has_data: boolean;
  status: string;
  is_final: boolean;
  periode: {
    id: number;
    nama_periode: string;
    status: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    target_bulan: string;
    available_periods: Array<{
      id: number;
      nama_periode: string;
      status: string;
      tanggal_mulai: string;
      tanggal_selesai: string;
      target_bulan_berikutnya: string;
    }>;
  };
  kpi: {
    total_order_berjalan: number;
    total_sanksi: number;
    total_reward: number;
    total_hasil_perhitungan: number;
  };
  charts: {
    perbandingan_katering: Array<{
      catering_id: number;
      catering_nama: string;
      group_code: string;
      shift: string;
      order_berjalan: number;
      total_sanksi: number;
      reward: number;
      hasil_perhitungan: number;
    }>;
    perbandingan_grup: {
      grup_a: { order_berjalan: number; sanksi: number; reward: number; hasil: number };
      grup_b: { order_berjalan: number; sanksi: number; reward: number; hasil: number };
    };
    komposisi_penyesuaian: Array<{
      label: string;
      catering_nama: string;
      group_code: string;
      shift: string;
      order_berjalan: number;
      net_penyesuaian: number;
      hasil_perhitungan: number;
    }>;
  };
  table: Array<{
    id: number;
    catering_id: number;
    catering_nama: string;
    group: string;
    shift: string;
    order_berjalan: number;
    total_sanksi: number;
    reward: number;
    hasil_perhitungan: number;
    target_persen: number;
    projected_order: number;
    aktual_order: string;
    status: string;
  }>;
  insights: string[];
}

export const getManagementSummaryApi = () =>
  request<ManagementSummaryResponse>("/management/summary");

export const getManagementKaloriApi = (params?: {
  bulan?: number;
  tahun?: number;
  shift?: string;
  catering_id?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.bulan) query.set("bulan", String(params.bulan));
  if (params?.tahun) query.set("tahun", String(params.tahun));
  if (params?.shift) query.set("shift", params.shift);
  if (params?.catering_id) query.set("catering_id", String(params.catering_id));
  const qs = query.toString();
  return request<ManagementKaloriResponse>(`/management/kalori${qs ? `?${qs}` : ""}`);
};

export const getManagementKaloriDailyApi = (params: {
  tanggal: string;
  shift?: string;
  catering_id?: number;
}) => {
  const query = new URLSearchParams();
  query.set("tanggal", params.tanggal);
  if (params.shift && params.shift !== "ALL") query.set("shift", params.shift);
  if (params.catering_id && params.catering_id > 0) query.set("catering_id", String(params.catering_id));
  const qs = query.toString();
  return request<ManagementKaloriDailyResponse>(`/management/kalori/daily${qs ? `?${qs}` : ""}`);
};

export const getManagementPunishmentApi = (params?: {
  report_id?: number;
  bulan?: number;
  tahun?: number;
  shift?: string;
  catering_id?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.report_id) query.set("report_id", String(params.report_id));
  if (params?.bulan) query.set("bulan", String(params.bulan));
  if (params?.tahun) query.set("tahun", String(params.tahun));
  if (params?.shift) query.set("shift", params.shift);
  if (params?.catering_id) query.set("catering_id", String(params.catering_id));
  const qs = query.toString();
  return request<ManagementPunishmentResponse>(`/management/punishment${qs ? `?${qs}` : ""}`);
};

export const getManagementPerformanceApi = (params?: {
  bulan?: number;
  tahun?: number;
  catering_id?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.bulan) query.set("bulan", String(params.bulan));
  if (params?.tahun) query.set("tahun", String(params.tahun));
  if (params?.catering_id) query.set("catering_id", String(params.catering_id));
  const qs = query.toString();
  return request<ManagementPerformanceResponse>(`/management/performance${qs ? `?${qs}` : ""}`);
};

export const getManagementRewardPunishmentApi = (params?: {
  period_id?: number;
  group_code?: string;
  shift?: string;
  catering_id?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.period_id) query.set("period_id", String(params.period_id));
  if (params?.group_code) query.set("group_code", params.group_code);
  if (params?.shift) query.set("shift", params.shift);
  if (params?.catering_id) query.set("catering_id", String(params.catering_id));
  const qs = query.toString();
  return request<ManagementRewardPunishmentResponse>(`/management/reward-punishment${qs ? `?${qs}` : ""}`);
};

// ==============================================================================
// IN-APP NOTIFICATIONS API
// ==============================================================================

export interface InAppNotification {
  id: number;
  notification_type:
    | "APPROVAL_REQUEST"
    | "APPROVAL_PASSED"
    | "APPROVAL_FINAL"
    | "REVISION_REQUIRED"
    | "REJECTED"
    | "REVISION_RESUBMITTED"
    | "REPORT_DISTRIBUTION"
    | "SYSTEM"
    | string;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  link_url?: string | null;
  event_key?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: InAppNotification[];
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
}

export const getNotificationsApi = (params?: {
  status?: "all" | "unread" | "read";
  limit?: number;
  offset?: number;
}): Promise<NotificationListResponse> => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ""}`);
};

export const getUnreadNotificationCountApi = (): Promise<{ unread_count: number }> => {
  return request<{ unread_count: number }>("/notifications/unread-count");
};

export const markNotificationReadApi = (
  id: number
): Promise<{ success: boolean; notification_id: number; read_at?: string; unread_count: number }> => {
  return request(`/notifications/${id}/read`, {
    method: "PATCH",
  });
};

export const markAllNotificationsReadApi = (): Promise<{
  success: boolean;
  marked_count: number;
  unread_count: number;
}> => {
  return request("/notifications/read-all", {
    method: "PATCH",
  });
};


// ==============================================================================
// MODUL PERENCANAAN MENU BULANAN (CARMEN PHASE 3)
// ==============================================================================

export interface MenuItemPayload {
  menu_date: string; // YYYY-MM-DD
  shift: "Pagi" | "Malam";
  item_order: number; // 1..6
  item_role?: string | null;
  menu_name: string;
  notes?: string | null;
}

export interface MenuItemResponse extends MenuItemPayload {
  id?: number;
  plan_id: number;
}

export interface MonthlyMenuPlanSummary {
  id: number;
  catering_id: number;
  catering_nama?: string | null;
  submission_period: string;
  effective_menu_period: string;
  effective_year: number;
  effective_month: number;
  version: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "SUPERSEDED" | "REJECTED" | "REVISION_REQUIRED";
  is_active: boolean;
  approval_request_id?: number | null;
  catatan?: string | null;
  created_by_user_id: number;
  created_by_nama?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  activated_at?: string | null;
}

export interface MonthlyMenuPlanDetail extends MonthlyMenuPlanSummary {
  items: MenuItemResponse[];
}

export interface MenuPlanCreatePayload {
  catering_id: number;
  submission_period: string;
  effective_menu_period: string;
  effective_year: number;
  effective_month: number;
  catatan?: string | null;
}

export interface MenuPlanUpdateItemsPayload {
  catatan?: string | null;
  items: MenuItemPayload[];
}

export interface ActiveMenuQueryResponse {
  has_menu: boolean;
  catering_id: number;
  catering_nama?: string | null;
  tanggal: string;
  shift: string;
  menu_plan_id?: number | null;
  menu_plan_version?: number | null;
  effective_menu_period?: string | null;
  components: string[];
  items: MenuItemResponse[];
  message?: string | null;
}

export const getMenuPlansApi = (params?: {
  catering_id?: number;
  effective_year?: number;
  effective_month?: number;
  status?: string;
}): Promise<MonthlyMenuPlanSummary[]> => {
  const query = new URLSearchParams();
  if (params?.catering_id) query.set("catering_id", String(params.catering_id));
  if (params?.effective_year) query.set("effective_year", String(params.effective_year));
  if (params?.effective_month) query.set("effective_month", String(params.effective_month));
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return request<MonthlyMenuPlanSummary[]>(`/menu-plans${qs ? `?${qs}` : ""}`);
};

export const getMenuPlanDetailApi = (id: number): Promise<MonthlyMenuPlanDetail> => {
  return request<MonthlyMenuPlanDetail>(`/menu-plans/${id}`);
};

export const createMenuPlanApi = (
  payload: MenuPlanCreatePayload
): Promise<MonthlyMenuPlanSummary> => {
  return request<MonthlyMenuPlanSummary>("/menu-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateMenuPlanItemsApi = (
  id: number,
  payload: MenuPlanUpdateItemsPayload
): Promise<MonthlyMenuPlanDetail> => {
  return request<MonthlyMenuPlanDetail>(`/menu-plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const activateMenuPlanApi = (id: number): Promise<MonthlyMenuPlanSummary> => {
  return request<MonthlyMenuPlanSummary>(`/menu-plans/${id}/activate`, {
    method: "POST",
  });
};

export const submitMenuPlanApprovalApi = (id: number): Promise<MonthlyMenuPlanSummary> => {
  return request<MonthlyMenuPlanSummary>(`/menu-plans/${id}/submit-approval`, {
    method: "POST",
  });
};

export const exportMenuPlanExcelApi = async (
  id: number
): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${getBaseUrl()}/menu-plans/${id}/export`, {
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Gagal mengunduh Excel Rencana Menu.";
    try {
      const err = await res.json();
      if (err?.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = getDownloadFilename(
    res.headers.get("Content-Disposition"),
    `Rencana_Menu_${id}.xlsx`
  );
  return { blob, filename };
};

export const getActiveMenuForKaloriApi = (
  cateringId: number,
  tanggal: string,
  shift: "Pagi" | "Malam"
): Promise<ActiveMenuQueryResponse> => {
  const qs = new URLSearchParams({
    catering_id: String(cateringId),
    tanggal,
    shift,
  }).toString();
  return request<ActiveMenuQueryResponse>(`/menu-plans/active-menu?${qs}`);
};





