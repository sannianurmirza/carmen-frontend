"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Upload,
  Image as ImageIcon,
  Trash2,
  Save,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import {
  Catering,
  getCatering,
  uploadFotoMinus,
  createMinusEntry,
} from "@/lib/api";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import IndoDatePicker from "@/components/IndoDatePicker";
import { useToast } from "@/context/ToastContext";
import { parseNumberID, isValidDecimalInput } from "@/lib/formatters";

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function InputMinusPage() {
  const router = useRouter();
  const [caterings, setCaterings] = useState<Catering[]>([]);
  const [loadingCaterings, setLoadingCaterings] = useState(true);

  // Form State
  const [tanggal, setTanggal] = useState<string>(todayISO());
  const [cateringId, setCateringId] = useState<string>("");
  const [menu, setMenu] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const [hasilKalori, setHasilKalori] = useState<string>("");
  const [problem, setProblem] = useState<string>("");
  const [perbaikan, setPerbaikan] = useState<string>("");

  // Upload state
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/catering-ir/api";

  useEffect(() => {
    async function fetchCaterings() {
      try {
        const data = await getCatering({ activeOnly: true });
        setCaterings(data);
      } catch {
        showToast({
          type: "error",
          title: "Gagal Memuat Data",
          message: "Gagal mengambil daftar catering dari server.",
        });
      } finally {
        setLoadingCaterings(false);
      }
    }
    fetchCaterings();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick validation
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      showToast({
        type: "error",
        title: "Format File Tidak Sesuai",
        message: "Hanya file gambar (.jpg, .jpeg, .png, .webp) yang diperbolehkan.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast({
        type: "error",
        title: "Ukuran File Terlalu Besar",
        message: "Ukuran file foto maksimal 5MB.",
      });
      return;
    }

    setUploadingFoto(true);
    try {
      const res = await uploadFotoMinus(file);
      setFotoUrl(res.url);
      showToast({
        type: "success",
        title: "Foto Berhasil Diupload",
        message: "Foto catering telah tersimpan.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Upload Foto",
        message: err.message || "Terjadi kesalahan saat mengunggah foto.",
      });
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!cateringId) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Pilih nama catering terlebih dahulu.",
      });
      return;
    }

    if (!tanggal) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Tanggal wajib diisi.",
      });
      return;
    }

    if (!menu.trim()) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Deskripsi menu wajib diisi.",
      });
      return;
    }

    if (!hasilKalori || isNaN(Number(hasilKalori))) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Hasil kalori harus berupa angka desimal.",
      });
      return;
    }

    if (!problem.trim()) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Problem/Kekurangan wajib diisi.",
      });
      return;
    }

    if (!perbaikan.trim()) {
      showToast({
        type: "error",
        title: "Form Belum Lengkap",
        message: "Tindakan perbaikan wajib diisi.",
      });
      return;
    }

    const parsedKalori = parseNumberID(hasilKalori);
    if (parsedKalori === null || isNaN(parsedKalori) || parsedKalori <= 0) {
      showToast({
        type: "error",
        title: "Format Angka Tidak Valid",
        message: "Hasil kalori harus berupa angka yang valid dan lebih dari 0.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createMinusEntry({
        catering_id: Number(cateringId),
        tanggal,
        menu: menu.trim(),
        foto_url: fotoUrl || null,
        hasil_kalori: parsedKalori,
        problem: problem.trim(),
        perbaikan: perbaikan.trim(),
      });

      showToast({
        type: "success",
        title: "Data Berhasil Disimpan",
        message: "Entri kalori minus telah berhasil ditambahkan.",
      });

      setTimeout(() => {
        router.push("/minus/riwayat");
      }, 1200);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Gagal Menyimpan Data",
        message: err.message || "Terjadi kesalahan saat menyimpan data.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const getFullFotoUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
      <div className="page-head-row" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link
              href="/minus"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--red)",
                textDecoration: "none",
                letterSpacing: "0.06em",
              }}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
              Kembali ke Management Minus
            </Link>
          </div>
          <h1 className="page-title">Input Keterangan Kalori Minus</h1>
        </div>
        <HeaderMetaBoxes />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="panel" style={{ padding: 28, borderRadius: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Tanggal */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 6,
                }}
              >
                TANGGAL <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <IndoDatePicker
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>

            {/* Catering */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 6,
                }}
              >
                KATERING <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <select
                className="input-field"
                value={cateringId}
                onChange={(e) => setCateringId(e.target.value)}
                disabled={loadingCaterings}
                style={{ width: "100%" }}
                required
              >
                {loadingCaterings ? (
                  <option value="">Memuat data katering...</option>
                ) : (
                  <>
                    <option value="" disabled hidden>Pilih Katering</option>
                    {caterings.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Menu */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              MENU <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Deskripsi menu lengkap hari itu, contoh: Oseng kacang panjang dan + kecambah pedas + pentol, Pesmol ikan mujaer, Tempe goreng, Sambal trasi + Kerupuk 2 pcs, Jeruk"
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
              style={{ width: "100%", resize: "vertical" }}
              required
            />
          </div>

          {/* Hasil Kalori */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              HASIL KALORI <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              placeholder="Masukkan angka hasil kalori (contoh: 882,96)"
              value={hasilKalori}
              onChange={(e) => {
                const val = e.target.value;
                if (isValidDecimalInput(val)) {
                  setHasilKalori(val);
                }
              }}
              style={{ width: "100%" }}
              required
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Nilai desimal hasil pengujian kalori (di bawah 900 kkal).
            </p>
          </div>

          {/* Upload Foto Catering */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              FOTO CATERING <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>(Opsional)</span>
            </label>
            
            {!fotoUrl ? (
              <div
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 10,
                  padding: "24px 16px",
                  textAlign: "center",
                  background: "var(--bg-subtle, #f9fafb)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s ease",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploadingFoto}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--border-light, #e5e7eb)",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {uploadingFoto ? (
                      <span className="spinner-border spinner-border-sm" role="status" />
                    ) : (
                      <Upload size={22} />
                    )}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {uploadingFoto ? "Mengunggah Foto..." : "Klik atau seret foto ke sini untuk upload"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      Format gambar: JPG, JPEG, PNG, WEBP (Maks. 5MB)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle, #f9fafb)",
                }}
              >
                <img
                  src={getFullFotoUrl(fotoUrl)}
                  alt="Preview Catering"
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    Foto berhasil diunggah
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                    {fotoUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeletePhotoModal(true)}
                  style={{
                    background: "var(--red-light, #fee2e2)",
                    color: "var(--red)",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Trash2 size={14} /> Hapus Foto
                </button>
              </div>
            )}
          </div>

          {/* Problem */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              PROBLEM / KEKURANGAN <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder={`Penjelasan kekurangan per-bahan, contoh:\nBerat sayur kurang\nStandard berat = 85gr\nActual berat = 54,2gr`}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
              required
            />
          </div>

          {/* Perbaikan */}
          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              PERBAIKAN <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder={`Tindakan perbaikan, contoh:\n1. Informasi ke catering Alvia bahwa hasil kalori minus agar dilakukan perbaikan`}
              value={perbaikan}
              onChange={(e) => setPerbaikan(e.target.value)}
              style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
              required
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Link
              href="/minus"
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Batal
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || uploadingFoto}
              style={{
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Save size={18} />
              {submitting ? "Menyimpan Data..." : "Simpan Data"}
            </button>
          </div>
        </div>
      </form>

      {/* Confirm Delete Uploaded Photo Modal */}
      <ConfirmDeleteModal
        isOpen={showDeletePhotoModal}
        title="Hapus Foto Lampiran?"
        itemName={fotoUrl ? fotoUrl.split("/").pop() : "Foto Sampel Kalori Minus"}
        description="Apakah Anda yakin ingin menghapus foto bukti sampel ini dari form?"
        confirmText="Hapus Foto"
        cancelText="Batal"
        onConfirm={() => {
          setFotoUrl("");
          setShowDeletePhotoModal(false);
        }}
        onClose={() => setShowDeletePhotoModal(false)}
      />
    </div>
  );
}
