"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  FileArchive,
  File as FileIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Loader2,
  UserCheck,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  ExternalLink,
  Download,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import {
  getSendReportConfig,
  submitApprovalRequest,
  getBaseUrl,
  SendReportConfigResponse,
  SendReportResponse,
  DeliveryType,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".pdf", ".docx", ".doc", ".zip", ".csv"];
const MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface ManualApprover {
  id: string; // client-side temp id
  name: string;
  position: string;
  email: string;
}

export interface ManualRecipient {
  id: string; // client-side temp id
  name: string;
  position: string; // jabatan
  email: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Byte";
  const k = 1024;
  const sizes = ["Byte", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx !== -1 ? filename.slice(idx).toLowerCase() : "";
}

function getFileIcon(filename: string) {
  const ext = getFileExtension(filename);
  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    return <FileSpreadsheet size={16} style={{ color: "var(--green, #15803d)", flexShrink: 0 }} />;
  }
  if (ext === ".pdf" || ext === ".docx" || ext === ".doc") {
    return <FileText size={16} style={{ color: "var(--red, #b3212f)", flexShrink: 0 }} />;
  }
  if (ext === ".zip") {
    return <FileArchive size={16} style={{ color: "var(--amber, #b45309)", flexShrink: 0 }} />;
  }
  return <FileIcon size={16} style={{ color: "var(--text-secondary, #64748b)", flexShrink: 0 }} />;
}

export default function SendReportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected delivery mode: "APPROVAL" | "REPORT_ONLY" | null (initial state shows 2 choice cards)

  // Configuration State (Sender, Requester)
  const [config, setConfig] = useState<SendReportConfigResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  // Manual Uploaded Files State
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Manual Approvers State (Section 4A-4N)
  // Starts EMPTY as required: "Initial state: Belum ada approver."
  const [approvers, setApprovers] = useState<ManualApprover[]>([]);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState<boolean>(false);
  const [editingApproverId, setEditingApproverId] = useState<string | null>(null);
  const [modalName, setModalName] = useState<string>("");
  const [modalPosition, setModalPosition] = useState<string>("");
  const [modalEmail, setModalEmail] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);

  // Delivery Mode State (Dual Delivery Modes: APPROVAL vs REPORT_ONLY)
  // Explicitly tracked, not silently defaulted to prevent ambiguous UX
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);

  // Manual Recipients State (Section: PENERIMA LAPORAN)
  // Starts EMPTY as required: "Initial state: Belum ada penerima."
  const [recipients, setRecipients] = useState<ManualRecipient[]>([]);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState<boolean>(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [modalRecipName, setModalRecipName] = useState<string>("");
  const [modalRecipPosition, setModalRecipPosition] = useState<string>("");
  const [modalRecipEmail, setModalRecipEmail] = useState<string>("");
  const [modalRecipError, setModalRecipError] = useState<string | null>(null);



  // Approval Request Content
  const [subject, setSubject] = useState<string>("Permintaan Approval Laporan Catering");
  const [notes, setNotes] = useState<string>("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SendReportResponse | null>(null);

  const { showSuccess, showError, showWarning } = useToast();

  // Load Sender & Requester Configuration
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const data = await getSendReportConfig();
      setConfig(data);
    } catch (err: any) {
      console.error("Gagal memuat konfigurasi approval:", err);
      setConfig({
        sender_name: "PT JAI Catering Management",
        sender_email: "catering-ir@jai.co.id",
        smtp_configured: false,
        smtp_host: null,
        requester: null,
        approver: null,
        approvers: [],
      });
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // File Upload Handlers
  const handleValidateAndAddFiles = (incomingFiles: FileList | File[]) => {
    setFileError(null);
    const validNewFiles: File[] = [];
    let currentTotalSize = uploadedFiles.reduce((acc, f) => acc + f.size, 0);

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const ext = getFileExtension(file.name);

      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(
          `Jenis file '${file.name}' tidak didukung. File yang diizinkan: ${ALLOWED_EXTENSIONS.join(", ")}.`
        );
        return;
      }

      if (file.size === 0) {
        setFileError(`File '${file.name}' kosong (0 Byte). Silakan pilih file yang valid.`);
        return;
      }

      if (
        file.name.toLowerCase().endsWith(".exe") ||
        file.name.toLowerCase().endsWith(".bat") ||
        file.name.toLowerCase().endsWith(".sh")
      ) {
        setFileError(`File biner executable '${file.name}' tidak diizinkan.`);
        return;
      }

      if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
        setFileError(`Total ukuran file melebihi batas maksimal 15 MB.`);
        return;
      }

      currentTotalSize += file.size;
      validNewFiles.push(file);
    }

    if (validNewFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...validNewFiles]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleValidateAndAddFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  // Approver Modal Handlers
  const openAddApproverModal = () => {
    setEditingApproverId(null);
    // Fields must start EMPTY (Do NOT preload SPV/KSL/Manager or names)
    setModalName("");
    setModalPosition("");
    setModalEmail("");
    setModalError(null);
    setIsApproverModalOpen(true);
  };

  const openEditApproverModal = (approver: ManualApprover) => {
    setEditingApproverId(approver.id);
    setModalName(approver.name);
    setModalPosition(approver.position);
    setModalEmail(approver.email);
    setModalError(null);
    setIsApproverModalOpen(true);
  };

  const handleSaveApprover = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = modalName.trim();
    const cleanPos = modalPosition.trim();
    const cleanEmail = modalEmail.trim().toLowerCase();

    if (!cleanName) {
      setModalError("Nama approver wajib diisi.");
      return;
    }
    if (!cleanPos) {
      setModalError("Jabatan approver wajib diisi.");
      return;
    }
    if (!cleanEmail) {
      setModalError("Email approver wajib diisi.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setModalError("Format email tidak valid.");
      return;
    }

    // Duplicate email check
    const isDuplicate = approvers.some(
      (a) => a.email.toLowerCase() === cleanEmail && a.id !== editingApproverId
    );
    if (isDuplicate) {
      setModalError("Email approver sudah ditambahkan.");
      return;
    }

    if (editingApproverId) {
      setApprovers((prev) =>
        prev.map((a) =>
          a.id === editingApproverId
            ? { ...a, name: cleanName, position: cleanPos, email: cleanEmail }
            : a
        )
      );
    } else {
      const newApprover: ManualApprover = {
        id: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: cleanName,
        position: cleanPos,
        email: cleanEmail,
      };
      setApprovers((prev) => [...prev, newApprover]);
    }

    setIsApproverModalOpen(false);
  };

  // Reorder Approvers
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setApprovers((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === approvers.length - 1) return;
    setApprovers((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleRemoveApprover = (id: string) => {
    setApprovers((prev) => prev.filter((a) => a.id !== id));
  };

  // Recipient Modal Handlers (Penerima Laporan)
  const openAddRecipientModal = () => {
    setEditingRecipientId(null);
    setModalRecipName("");
    setModalRecipPosition("");
    setModalRecipEmail("");
    setModalRecipError(null);
    setIsRecipientModalOpen(true);
  };

  const openEditRecipientModal = (recipient: ManualRecipient) => {
    setEditingRecipientId(recipient.id);
    setModalRecipName(recipient.name);
    setModalRecipPosition(recipient.position);
    setModalRecipEmail(recipient.email);
    setModalRecipError(null);
    setIsRecipientModalOpen(true);
  };

  const handleSaveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = modalRecipName.trim();
    const cleanPos = modalRecipPosition.trim();
    const cleanEmail = modalRecipEmail.trim().toLowerCase();

    if (!cleanName) {
      setModalRecipError("Nama penerima wajib diisi.");
      return;
    }
    if (!cleanEmail) {
      setModalRecipError("Email penerima wajib diisi.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setModalRecipError("Format email tidak valid.");
      return;
    }

    // Duplicate email check (case-insensitive)
    const isDuplicate = recipients.some(
      (r) => r.email.toLowerCase() === cleanEmail && r.id !== editingRecipientId
    );
    if (isDuplicate) {
      setModalRecipError("Email penerima sudah ditambahkan.");
      return;
    }

    if (editingRecipientId) {
      setRecipients((prev) =>
        prev.map((r) =>
          r.id === editingRecipientId
            ? { ...r, name: cleanName, position: cleanPos, email: cleanEmail }
            : r
        )
      );
    } else {
      const newRecipient: ManualRecipient = {
        id: `recip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: cleanName,
        position: cleanPos,
        email: cleanEmail,
      };
      setRecipients((prev) => [...prev, newRecipient]);
    }

    setIsRecipientModalOpen(false);
  };

  // Reorder Recipients (Naik / Turun)
  const handleMoveRecipientUp = (index: number) => {
    if (index === 0) return;
    setRecipients((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveRecipientDown = (index: number) => {
    if (index === recipients.length - 1) return;
    setRecipients((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // Submission Validation
  const totalFileSize = uploadedFiles.reduce((acc, f) => acc + f.size, 0);
  const canSubmit =
    !isSubmitting &&
    uploadedFiles.length > 0 &&
    ((deliveryType === "APPROVAL" && approvers.length > 0) ||
      (deliveryType === "REPORT_ONLY" && recipients.length > 0));

  const handleSubmitApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryType) return;

    if (uploadedFiles.length === 0) {
      setErrorMsg("File belum dipilih. Unggah minimal satu file laporan yang diajukan.");
      showError("File belum dipilih. Unggah minimal satu file laporan yang diajukan.");
      return;
    }
    if (deliveryType === "APPROVAL" && approvers.length === 0) {
      setErrorMsg("Tambahkan minimal satu approver.");
      showError("Tambahkan minimal satu approver.");
      return;
    }
    if (deliveryType === "REPORT_ONLY" && recipients.length === 0) {
      setErrorMsg("Tambahkan minimal satu penerima laporan.");
      showError("Tambahkan minimal satu penerima laporan.");
      return;
    }
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessResult(null);

    try {
      const formData = new FormData();
      formData.append("delivery_type", deliveryType);
      formData.append(
        "subject",
        subject.trim() ||
          (deliveryType === "APPROVAL"
            ? "Permintaan Approval Laporan Catering"
            : "Distribusi Laporan Catering")
      );
      formData.append("notes", notes.trim());

      if (deliveryType === "APPROVAL") {
        const approversPayload = approvers.map((appr, idx) => ({
          sequence: idx + 1,
          name: appr.name,
          position: appr.position,
          email: appr.email,
        }));
        formData.append("approvers_json", JSON.stringify(approversPayload));
      } else {
        const recipientsPayload = recipients.map((recip, idx) => ({
          sequence: idx + 1,
          name: recip.name,
          position: recip.position,
          jabatan: recip.position,
          email: recip.email,
        }));
        formData.append("recipients_json", JSON.stringify(recipientsPayload));
      }

      uploadedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const result = await submitApprovalRequest(formData);
      setSuccessResult(result);
      if (deliveryType === "APPROVAL") {
        if (result.email_sent === false || result.warning) {
          showWarning(
            result.warning ||
              "Permintaan approval berhasil diajukan, tetapi email notifikasi gagal dikirim.",
            "Notifikasi Email Tertunda"
          );
        } else {
          showSuccess(
            result.message ||
              "Permintaan approval berhasil diajukan dan dikirim ke approver tahap pertama."
          );
        }
      } else {
        if (result.email_sent === false && result.warning) {
          showWarning(result.warning, "Notifikasi Email Tertunda");
        } else {
          showSuccess(result.message || "Laporan berhasil dikirim.");
        }
      }


      if (deliveryType === "APPROVAL" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cms-approval-updated"));
      }
    } catch (err: any) {
      const msg =
        err?.message ||
        (deliveryType === "APPROVAL"
          ? "Gagal mengajukan approval."
          : "Gagal mengirim report.");
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setUploadedFiles([]);
    setNotes("");
    setRecipients([]);
    setApprovers([]);
    setSuccessResult(null);
    setErrorMsg(null);
    setDeliveryType(null);
  };

  const handleSelectApproval = () => {
    setDeliveryType("APPROVAL");
    if (subject === "Distribusi Laporan Catering") {
      setSubject("Permintaan Approval Laporan Catering");
    }
  };

  const handleSelectReportOnly = () => {
    setDeliveryType("REPORT_ONLY");
    if (subject === "Permintaan Approval Laporan Catering") {
      setSubject("Distribusi Laporan Catering");
    }
  };

  const handleBackToSelection = () => {
    setDeliveryType(null);
  };

  return (
    <div className="send-report-container" style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 48, minWidth: 0 }}>
      {/* Scoped CSS for 2-Step Flow, Micro-Interactions, and Responsive Viewports */}
      <style>{`
        @keyframes sendReportPageEnter {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .send-report-container {
          animation: sendReportPageEnter 190ms ease forwards;
        }

        /* CARMEN Two-Card Choice Grid */
        .send-report-cards-grid,
        .step1-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          align-items: stretch;
          width: 100%;
          box-sizing: border-box;
        }
        .send-report-choice-card,
        .step1-card {
          min-width: 0;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 28px 24px;
          border-radius: var(--radius, 8px);
          border: 1px solid var(--border, #e2e8f0);
          background-color: var(--card, #ffffff);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .send-report-choice-card:hover,
        .step1-card:hover {
          border-color: #cbd5e1 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06) !important;
        }
        .step1-cta-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 42px;
          padding: 0 18px;
          font-size: 13.5px;
          font-weight: 700;
          border-radius: var(--radius-sm, 6px);
          border: none;
          background-color: var(--red, #b3212f);
          color: #ffffff;
          cursor: pointer;
          margin-top: auto;
          box-sizing: border-box;
          transition: background-color 140ms ease;
        }
        .step1-cta-primary:hover {
          background-color: #991b1b !important;
        }
        .step1-cta-primary:focus-visible {
          outline: 2px solid var(--red, #b3212f);
          outline-offset: 2px;
        }
        .step1-cta-outline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 42px;
          padding: 0 18px;
          font-size: 13.5px;
          font-weight: 700;
          border-radius: var(--radius-sm, 6px);
          border: 1px solid var(--border-strong, #cbd5e1);
          background-color: #ffffff;
          color: var(--text, #0f172a);
          cursor: pointer;
          margin-top: auto;
          box-sizing: border-box;
          transition: background-color 140ms ease, border-color 140ms ease;
        }
        .step1-cta-outline:hover {
          background-color: var(--bg-subtle, #f8fafc) !important;
          border-color: #94a3b8 !important;
        }
        .step1-cta-outline:focus-visible {
          outline: 2px solid #64748b;
          outline-offset: 2px;
        }
        @media (max-width: 768px) {
          .send-report-cards-grid,
          .step1-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .send-report-choice-card,
          .step1-card {
            padding: 20px 16px !important;
          }
        }

        /* Upload Drop Area Interactions */
        .upload-dropzone {
          border: 1px dashed var(--border-strong, #cbd5e1);
          border-radius: var(--radius-sm, 4px);
          background-color: var(--bg-subtle, #f8fafc);
          padding: 24px 20px;
          text-align: center;
          cursor: pointer;
          transition: background-color 180ms ease, border-color 180ms ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .upload-dropzone:hover {
          border-color: var(--text-muted, #94a3b8);
          background-color: var(--card-hover, #f1f5f9);
        }
        .upload-dropzone.dragging {
          border-color: var(--red, #b3212f);
          background-color: var(--red-bg, #fef2f2);
        }
        .upload-dropzone-icon {
          color: var(--text-muted, #64748b);
          margin-bottom: 8px;
          transition: transform 180ms ease, color 180ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .upload-dropzone:hover .upload-dropzone-icon {
          color: var(--red, #b3212f);
          transform: translateY(-2px);
        }
        .upload-dropzone.dragging .upload-dropzone-icon {
          color: var(--red, #b3212f);
          transform: translateY(-3px);
        }

        /* File & Approver Row Items */
        @keyframes fileRowEntry {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .file-row-item, .approver-row-item {
          animation: fileRowEntry 160ms ease forwards;
          transition: background-color 140ms ease;
        }
        .file-row-item:hover, .approver-row-item:hover {
          background-color: var(--card-hover, #f1f5f9);
        }

        /* Submit Button Interaction */
        .send-report-submit-btn {
          transition: background-color 140ms ease, transform 120ms ease;
        }
        .send-report-submit-btn:not(:disabled):hover {
          transform: translateY(-1px);
        }
        .send-report-submit-btn:not(:disabled):hover .send-icon-wrapper {
          transform: translateX(2px);
        }
        .send-report-submit-btn:not(:disabled):active {
          transform: translateY(0);
        }
        .send-icon-wrapper {
          display: inline-flex;
          align-items: center;
          transition: transform 140ms ease;
        }

        /* Form Controls Focus State */
        .send-report-container input:not([type="checkbox"]):not([type="radio"]),
        .send-report-container textarea,
        .send-report-container select {
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .send-report-container input:not([type="checkbox"]):not([type="radio"]):focus,
        .send-report-container textarea:focus,
        .send-report-container select:focus {
          border-color: var(--red, #b3212f);
          box-shadow: 0 0 0 2px rgba(179, 33, 47, 0.12);
          outline: none;
        }

        /* Accessibility: Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .send-report-container,
          .file-row-item,
          .approver-row-item,
          .upload-dropzone,
          .upload-dropzone-icon,
          .send-report-submit-btn,
          .send-icon-wrapper,
          * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* PAGE HEADER (Neutral, No Mention of Approver)             */}
      {/* ========================================================= */}
      <div style={{ marginBottom: 18 }}>
        <div
          className="eyebrow"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--red, #b3212f)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          PENGIRIMAN LAPORAN
        </div>
        <h1
          className="page-title"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text, #0f172a)",
            margin: "0 0 4px",
            letterSpacing: "-0.01em",
          }}
        >
          Send Report
        </h1>
        <p
          className="page-desc"
          style={{
            fontSize: 13,
            color: "var(--text-secondary, #475569)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Unggah dan kirim laporan sesuai kebutuhan approval atau distribusi.
        </p>
      </div>

      {/* ========================================================= */}
      {/* ALERT / FEEDBACK BANNER                                   */}
      {/* ========================================================= */}
      {successResult && (() => {
        const isReportOnly = successResult.delivery_type === "REPORT_ONLY";
        const isEmailWarning = successResult.email_sent === false || Boolean(successResult.warning);

        if (isReportOnly) {
          return (
            <div
              style={{
                marginBottom: 18,
                padding: "16px 20px",
                borderRadius: "var(--radius-sm, 4px)",
                backgroundColor: isEmailWarning ? "#fffbeb" : "var(--green-bg, #f0fdf4)",
                border: isEmailWarning ? "1px solid #fde68a" : "1px solid #bbf7d0",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              {isEmailWarning ? (
                <AlertTriangle size={20} style={{ color: "#b45309", flexShrink: 0, marginTop: 2 }} />
              ) : (
                <CheckCircle2 size={20} style={{ color: "var(--green, #15803d)", flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: isEmailWarning ? "#b45309" : "var(--green, #15803d)",
                  }}
                >
                  {successResult.message || "Laporan berhasil dikirim."}
                </div>
                {isEmailWarning && (
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>
                    {successResult.warning || "Laporan tersimpan tetapi notifikasi email gagal terkirim."}
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: "var(--text, #0f172a)", marginTop: 6, lineHeight: 1.6 }}>
                  <div>
                    <strong>Jenis Pengiriman:</strong>{" "}
                    <span style={{ color: "#047857", fontWeight: 700 }}>Report Saja (Tanpa Approval)</span>
                  </div>
                  <div>
                    <strong>Status:</strong>{" "}
                    <span style={{ color: "#0369a1", fontWeight: 700 }}>SENT</span>
                  </div>
                  <div>
                    <strong>File Terkirim:</strong>{" "}
                    {successResult.attachments?.map((a) => (typeof a === "string" ? a : a.filename)).join(", ") ||
                      uploadedFiles.map((f) => f.name).join(", ")}
                  </div>
                  {successResult.sent_at && (
                    <div style={{ color: "var(--text-secondary, #475569)", fontSize: 11.5, marginTop: 2 }}>
                      Waktu Pengiriman: {new Date(successResult.sent_at).toLocaleString("id-ID")}
                    </div>
                  )}
                  {((successResult.recipients && Array.isArray(successResult.recipients) && successResult.recipients.length > 0) ||
                    (recipients && recipients.length > 0)) && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Penerima Laporan:</strong>
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                        {(successResult.recipients && Array.isArray(successResult.recipients) && successResult.recipients.length > 0
                          ? successResult.recipients
                          : recipients
                        ).map((rec: any, idx: number) => (
                          <div key={rec.id || idx} style={{ fontSize: 12 }}>
                            {idx + 1}. <strong>{rec.name}</strong>
                            {rec.position || rec.jabatan ? ` (${rec.position || rec.jabatan})` : ""} —{" "}
                            <span style={{ fontFamily: "monospace", color: "var(--text-muted, #64748b)" }}>
                              {rec.email}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={`${getBaseUrl()}/approvals/${successResult.approval_id || successResult.report_id}/file`}
                    download
                    className="btn btn-primary"
                    style={{
                      fontSize: 12,
                      height: 30,
                      padding: "0 14px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      textDecoration: "none",
                      backgroundColor: "#059669",
                    }}
                  >
                    <Download size={13} />
                    <span>Unduh File Laporan</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="btn btn-outline"
                    style={{ fontSize: 12, height: 30, padding: "0 12px" }}
                  >
                    Kirim Laporan Lain
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            style={{
              marginBottom: 18,
              padding: "16px 20px",
              borderRadius: "var(--radius-sm, 4px)",
              backgroundColor: isEmailWarning ? "#fffbeb" : "var(--green-bg, #f0fdf4)",
              border: isEmailWarning ? "1px solid #fde68a" : "1px solid #bbf7d0",
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            {isEmailWarning ? (
              <AlertTriangle size={20} style={{ color: "#b45309", flexShrink: 0, marginTop: 2 }} />
            ) : (
              <CheckCircle2 size={20} style={{ color: "var(--green, #15803d)", flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: isEmailWarning ? "#b45309" : "var(--green, #15803d)",
                }}
              >
                {isEmailWarning
                  ? (successResult.warning || "Permintaan approval berhasil diajukan, tetapi email notifikasi gagal dikirim.")
                  : (successResult.message || "Permintaan approval berhasil diajukan dan dikirim ke approver tahap pertama.")}
              </div>
              {isEmailWarning && (
                <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>
                  Pengajuan approval telah tersimpan ke sistem (ID #{successResult.approval_id || "-"}), namun notifikasi email ke approver tahap pertama tidak terkirim karena kendala pengiriman SMTP.
                </div>
              )}
              <div style={{ fontSize: 12.5, color: "var(--text, #0f172a)", marginTop: 6, lineHeight: 1.6 }}>
                <div>
                  <strong>Status Pengajuan:</strong>{" "}
                  <span style={{ color: "var(--amber, #b45309)", fontWeight: 700 }}>Menunggu Approval</span>
                </div>
                <div>
                  <strong>Approver Tahap 1:</strong>{" "}
                  {successResult.approver?.name || (approvers[0] ? `${approvers[0].name} (${approvers[0].email})` : "-")}
                </div>
                <div>
                  <strong>File Diajukan:</strong>{" "}
                  {successResult.attachments?.map((a) => (typeof a === "string" ? a : a.filename)).join(", ") ||
                    uploadedFiles.map((f) => f.name).join(", ")}
                </div>
                {successResult.sent_at && (
                  <div style={{ color: "var(--text-secondary, #475569)", fontSize: 11.5, marginTop: 2 }}>
                    Waktu Pengajuan: {new Date(successResult.sent_at).toLocaleString("id-ID")}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href="/approval"
                  className="btn btn-primary"
                  style={{
                    fontSize: 12,
                    height: 30,
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    textDecoration: "none",
                  }}
                >
                  <span>Lihat di Modul Approval</span>
                  <ExternalLink size={13} />
                </Link>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="btn btn-outline"
                  style={{ fontSize: 12, height: 30, padding: "0 12px" }}
                >
                  Ajukan Laporan Lain
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {errorMsg && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: "var(--radius-sm, 4px)",
            backgroundColor: "var(--red-bg, #fef2f2)",
            border: "1px solid var(--red-light, #fee2e2)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <AlertCircle size={18} style={{ color: "var(--red, #b3212f)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--red, #b3212f)" }}>
              Gagal Memproses Laporan
            </div>
            <div style={{ fontSize: 12, color: "var(--text, #0f172a)", marginTop: 4, lineHeight: 1.5 }}>
              {errorMsg}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: "none", border: "none", color: "var(--red, #b3212f)", cursor: "pointer", padding: 2 }}
            aria-label="Tutup notifikasi error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* INITIAL VIEW: TWO CHOICE CARDS (NO STEPPER)               */}
      {/* ========================================================= */}
      {!deliveryType && (
        <div
          className="send-report-cards-grid step1-cards-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 24,
            marginTop: 24,
            alignItems: "stretch",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* CARD 1: Approval / E-Sign */}
          <div
            className="send-report-choice-card step1-card"
            onClick={handleSelectApproval}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "28px 24px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border, #e2e8f0)",
              backgroundColor: "var(--card, #ffffff)",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              minWidth: 0,
              cursor: "pointer",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            {/* Icon Box (CARMEN Soft-Red) */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "rgba(179, 33, 47, 0.08)",
                color: "var(--red, #b3212f)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginBottom: 16,
              }}
            >
              <ClipboardCheck size={24} strokeWidth={2.2} />
            </div>

            {/* Card Title */}
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                lineHeight: 1.3,
                margin: "0 0 8px 0",
              }}
            >
              Approval / E-Sign
            </h2>

            {/* Card Description */}
            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-secondary, #475569)",
                lineHeight: 1.5,
                margin: "0 0 24px 0",
                flex: 1,
              }}
            >
              Ajukan laporan melalui proses approval berjenjang dan tanda tangan elektronik.
            </p>

            {/* Full-Width Action Button (Red Primary) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectApproval();
              }}
              className="step1-cta-primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                height: 42,
                padding: "0 18px",
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: "var(--radius-sm, 6px)",
                border: "none",
                backgroundColor: "var(--red, #b3212f)",
                color: "#ffffff",
                cursor: "pointer",
                marginTop: "auto",
                boxSizing: "border-box",
              }}
              aria-label="Pilih Approval / E-Sign"
            >
              <span>Pilih Approval / E-Sign</span>
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>

          {/* CARD 2: Report Saja */}
          <div
            className="send-report-choice-card step1-card"
            onClick={handleSelectReportOnly}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "28px 24px",
              borderRadius: "var(--radius, 8px)",
              border: "1px solid var(--border, #e2e8f0)",
              backgroundColor: "var(--card, #ffffff)",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              minWidth: 0,
              cursor: "pointer",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            {/* Icon Box (CARMEN Soft-Blue) */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                color: "#1d4ed8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginBottom: 16,
              }}
            >
              <FileText size={24} strokeWidth={2.2} />
            </div>

            {/* Card Title */}
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                lineHeight: 1.3,
                margin: "0 0 8px 0",
              }}
            >
              Report Saja
            </h2>

            {/* Card Description */}
            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-secondary, #475569)",
                lineHeight: 1.5,
                margin: "0 0 24px 0",
                flex: 1,
              }}
            >
              Kirim laporan kepada penerima untuk dilihat atau diunduh tanpa proses approval.
            </p>

            {/* Full-Width Action Button (Outline) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectReportOnly();
              }}
              className="step1-cta-outline"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                height: 42,
                padding: "0 18px",
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border-strong, #cbd5e1)",
                backgroundColor: "#ffffff",
                color: "var(--text, #0f172a)",
                cursor: "pointer",
                marginTop: "auto",
                boxSizing: "border-box",
              }}
              aria-label="Pilih Report Saja"
            >
              <span>Pilih Report Saja</span>
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FORM VIEW (Shown after selecting mode)                     */}
      {/* ========================================================= */}
      {deliveryType && (
        <div
          className="card"
          style={{
            marginTop: 20,
            backgroundColor: "var(--card, #ffffff)",
            borderRadius: "var(--radius, 6px)",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <form onSubmit={handleSubmitApproval}>
            {/* Form Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--text, #0f172a)",
                    margin: "0 0 4px",
                  }}
                >
                  {deliveryType === "APPROVAL" ? "Approval / E-Sign" : "Report Saja"}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary, #475569)",
                    margin: 0,
                  }}
                >
                  {deliveryType === "APPROVAL"
                    ? "Unggah file laporan dan tentukan daftar approver berjenjang."
                    : "Unggah file laporan untuk distribusi langsung tanpa alur approval."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToSelection}
                className="btn btn-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 32,
                  padding: "0 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>
            </div>

            {/* --------------------------------------------------- */}
            {/* SECTION 1: UPLOAD FILE LAPORAN                      */}
            {/* --------------------------------------------------- */}
            <div style={{ padding: "20px 24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--text, #0f172a)",
                    }}
                  >
                    FILE LAPORAN <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                    Pilih atau unggah file laporan yang diajukan (.xlsx, .xls, .pdf, .docx, .zip, .csv). Maksimal total 15 MB.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-outline"
                  style={{ height: 32, fontSize: 12, gap: 6, fontWeight: 600 }}
                >
                  <Upload size={13} />
                  Pilih File
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.pdf,.docx,.doc,.zip,.csv"
                style={{ display: "none" }}
                onChange={handleFileInputChange}
              />

              {/* Upload Dropzone */}
              <div
                className={`upload-dropzone ${isDragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-dropzone-icon">
                  <UploadCloud size={30} />
                </div>
                {isDragging ? (
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--red, #b3212f)" }}>
                    Lepaskan file di sini
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text, #0f172a)", marginBottom: 2 }}>
                      Pilih file laporan
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                      Klik untuk memilih atau tarik file ke area ini
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted, #94a3b8)" }}>
                      Excel, PDF, Word, ZIP • Maks. 15 MB
                    </div>
                  </>
                )}
              </div>

              {fileError && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm, 4px)",
                    backgroundColor: "var(--red-bg, #fef2f2)",
                    border: "1px solid var(--red-light, #fee2e2)",
                    fontSize: 12,
                    color: "var(--red, #b3212f)",
                  }}
                >
                  {fileError}
                </div>
              )}

              {/* Uploaded File List */}
              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="file-row-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm, 4px)",
                        border: "1px solid var(--border, #e2e8f0)",
                        backgroundColor: "var(--bg-subtle, #f8fafc)",
                        fontSize: 13,
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        {getFileIcon(file.name)}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text, #0f172a)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                            }}
                          >
                            {file.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)" }}>
                            {formatBytes(file.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--red, #b3212f)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          borderRadius: "var(--radius-sm, 4px)",
                        }}
                        title="Hapus file"
                      >
                        <Trash2 size={12} />
                        Hapus
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", textAlign: "right", marginTop: 2 }}>
                    Total: {uploadedFiles.length} file ({formatBytes(totalFileSize)} / 15 MB)
                  </div>
                </div>
              )}
            </div>

            {/* --------------------------------------------------- */}
            {/* DIVIDER                                             */}
            {/* --------------------------------------------------- */}
            <div style={{ borderTop: "1px solid var(--border, #e2e8f0)" }} />

            {/* --------------------------------------------------- */}
            {/* SECTION 2: DIAJUKAN OLEH                            */}
            {/* --------------------------------------------------- */}
            <div style={{ padding: "16px 24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm, 4px)",
                  border: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      backgroundColor: "var(--red-bg, #fef2f2)",
                      border: "1px solid var(--red-light, #fee2e2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--red, #b3212f)",
                      flexShrink: 0,
                    }}
                  >
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                        {config?.requester?.nama || "Pengguna Terautentikasi"}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 3,
                          backgroundColor: "var(--card, #ffffff)",
                          border: "1px solid var(--border-strong, #cbd5e1)",
                          color: "var(--text-secondary, #475569)",
                          textTransform: "uppercase",
                        }}
                      >
                        {config?.requester?.role || "USER"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary, #475569)", marginTop: 1 }}>
                      @{config?.requester?.username || "user"} • {config?.sender_email || "catering-ir@jai.co.id"}
                    </div>
                  </div>
                </div>

                {/* SMTP Connection Indicator */}
                <div style={{ textAlign: "right" }}>
                  {config?.smtp_configured ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--green, #15803d)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "var(--green, #15803d)",
                        }}
                      />
                      SMTP Aktif ({config.smtp_host})
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--amber, #b45309)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "var(--amber, #b45309)",
                        }}
                      />
                      SMTP Belum Dikonfigurasi
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* DIVIDER                                             */}
            {/* --------------------------------------------------- */}
            <div style={{ borderTop: "1px solid var(--border, #e2e8f0)" }} />

            {/* --------------------------------------------------- */}
            {/* SECTION 3: CONDITIONAL (APPROVER vs RECIPIENT)      */}
            {/* --------------------------------------------------- */}
            {deliveryType === "APPROVAL" ? (
              <div style={{ padding: "20px 24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--text, #0f172a)",
                      }}
                    >
                      APPROVER <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                      Tentukan urutan approver. Proses approval berjalan berjenjang (sekuensial) sesuai urutan yang Anda tentukan.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openAddApproverModal}
                    className="btn btn-outline"
                    style={{
                      height: 32,
                      fontSize: 12,
                      gap: 6,
                      fontWeight: 600,
                      color: "var(--text, #0f172a)",
                      borderColor: "var(--border-strong, #cbd5e1)",
                    }}
                  >
                    <Plus size={14} />
                    Tambah Approver
                  </button>
                </div>

                {/* Approver List or Empty State */}
                {approvers.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 20px",
                      borderRadius: "var(--radius-sm, 4px)",
                      backgroundColor: "var(--bg-subtle, #f8fafc)",
                      border: "1px dashed var(--border-strong, #cbd5e1)",
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--text-muted, #64748b)", marginBottom: 8 }}>
                      Belum ada approver.
                    </div>
                    <button
                      type="button"
                      onClick={openAddApproverModal}
                      className="btn btn-primary"
                      style={{
                        height: 30,
                        fontSize: 12,
                        gap: 6,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <Plus size={13} />
                      Tambah Approver
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                    {approvers.map((appr, idx) => (
                      <div
                        key={appr.id}
                        className="approver-row-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm, 4px)",
                          border: "1px solid var(--border, #e2e8f0)",
                          backgroundColor: "var(--card, #ffffff)",
                          fontSize: 13,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          {/* Sequence Badge */}
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              backgroundColor: idx === 0 ? "var(--red-bg, #fef2f2)" : "var(--bg-subtle, #f8fafc)",
                              border: `1px solid ${idx === 0 ? "var(--red-light, #fee2e2)" : "var(--border, #cbd5e1)"}`,
                              color: idx === 0 ? "var(--red, #b3212f)" : "var(--text-secondary, #475569)",
                              fontSize: 12,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                                {appr.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  backgroundColor: "var(--bg-subtle, #f1f5f9)",
                                  border: "1px solid var(--border, #e2e8f0)",
                                  color: "var(--text-secondary, #475569)",
                                }}
                              >
                                {appr.position}
                              </span>
                              {idx === 0 && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    backgroundColor: "var(--amber-bg, #fffbeb)",
                                    color: "var(--amber, #b45309)",
                                  }}
                                >
                                  Approver Pertama
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "ui-monospace, monospace",
                                color: "var(--text-muted, #64748b)",
                                marginTop: 2,
                              }}
                            >
                              {appr.email}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Move Up, Move Down, Edit, Delete */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 6px",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              opacity: idx === 0 ? 0.35 : 1,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Pindahkan ke atas"
                          >
                            <ArrowUp size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === approvers.length - 1}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 6px",
                              cursor: idx === approvers.length - 1 ? "not-allowed" : "pointer",
                              opacity: idx === approvers.length - 1 ? 0.35 : 1,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Pindahkan ke bawah"
                          >
                            <ArrowDown size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditApproverModal(appr)}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Edit data approver"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveApprover(appr.id)}
                            style={{
                              background: "none",
                              border: "1px solid var(--red-light, #fee2e2)",
                              borderRadius: 3,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--red, #b3212f)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Hapus approver"
                          >
                            <Trash2 size={12} />
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", textAlign: "right", marginTop: 2 }}>
                      Total: {approvers.length} approver berjenjang
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "20px 24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--text, #0f172a)",
                      }}
                    >
                      PENERIMA LAPORAN <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                      Tentukan daftar penerima laporan. Laporan akan dikirim untuk dilihat atau diunduh tanpa proses approval.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openAddRecipientModal}
                    className="btn btn-outline"
                    style={{
                      height: 32,
                      fontSize: 12,
                      gap: 6,
                      fontWeight: 600,
                      color: "var(--text, #0f172a)",
                      borderColor: "var(--border-strong, #cbd5e1)",
                    }}
                  >
                    <Plus size={14} />
                    Tambah Penerima
                  </button>
                </div>

                {/* Recipient List or Empty State */}
                {recipients.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 20px",
                      borderRadius: "var(--radius-sm, 4px)",
                      backgroundColor: "var(--bg-subtle, #f8fafc)",
                      border: "1px dashed var(--border-strong, #cbd5e1)",
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--text-muted, #64748b)", marginBottom: 8 }}>
                      Belum ada penerima.
                    </div>
                    <button
                      type="button"
                      onClick={openAddRecipientModal}
                      className="btn btn-primary"
                      style={{
                        height: 30,
                        fontSize: 12,
                        gap: 6,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <Plus size={13} />
                      Tambah Penerima
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                    {recipients.map((recip, idx) => (
                      <div
                        key={recip.id}
                        className="recipient-row-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm, 4px)",
                          border: "1px solid var(--border, #e2e8f0)",
                          backgroundColor: "var(--card, #ffffff)",
                          fontSize: 13,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          {/* Sequence Badge */}
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              backgroundColor: "var(--bg-subtle, #f8fafc)",
                              border: "1px solid var(--border, #cbd5e1)",
                              color: "var(--text-secondary, #475569)",
                              fontSize: 12,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
                                {recip.name}
                              </span>
                              {recip.position && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    backgroundColor: "var(--bg-subtle, #f1f5f9)",
                                    border: "1px solid var(--border, #e2e8f0)",
                                    color: "var(--text-secondary, #475569)",
                                  }}
                                >
                                  {recip.position}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "ui-monospace, monospace",
                                color: "var(--text-muted, #64748b)",
                                marginTop: 2,
                                wordBreak: "break-all",
                              }}
                            >
                              {recip.email}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Move Up, Move Down, Edit, Delete */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleMoveRecipientUp(idx)}
                            disabled={idx === 0}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 6px",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              opacity: idx === 0 ? 0.35 : 1,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Pindahkan ke atas"
                            aria-label="Pindahkan ke atas"
                          >
                            <ArrowUp size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveRecipientDown(idx)}
                            disabled={idx === recipients.length - 1}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 6px",
                              cursor: idx === recipients.length - 1 ? "not-allowed" : "pointer",
                              opacity: idx === recipients.length - 1 ? 0.35 : 1,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Pindahkan ke bawah"
                            aria-label="Pindahkan ke bawah"
                          >
                            <ArrowDown size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditRecipientModal(recip)}
                            style={{
                              background: "none",
                              border: "1px solid var(--border, #e2e8f0)",
                              borderRadius: 3,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--text-secondary, #475569)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Edit data penerima"
                            aria-label="Edit data penerima"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(recip.id)}
                            style={{
                              background: "none",
                              border: "1px solid var(--red-light, #fee2e2)",
                              borderRadius: 3,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: "var(--red, #b3212f)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Hapus penerima"
                            aria-label="Hapus penerima"
                          >
                            <Trash2 size={12} />
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", textAlign: "right", marginTop: 2 }}>
                      Total: {recipients.length} penerima laporan
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --------------------------------------------------- */}
            {/* DIVIDER                                             */}
            {/* --------------------------------------------------- */}
            <div style={{ borderTop: "1px solid var(--border, #e2e8f0)" }} />

            {/* --------------------------------------------------- */}
            {/* SECTION 4: SUBJECT & CATATAN                        */}
            {/* --------------------------------------------------- */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="approval-subject-input">
                  SUBJECT <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-muted, #64748b)" }}>(otomatis terisi)</span>
                </label>
                <input
                  id="approval-subject-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={deliveryType === "APPROVAL" ? "Permintaan Approval Laporan Catering" : "Distribusi Laporan Catering"}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label htmlFor="approval-notes-textarea">
                  {deliveryType === "APPROVAL" ? "CATATAN UNTUK APPROVER" : "CATATAN LAPORAN"}{" "}
                  <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-muted, #64748b)" }}>(opsional)</span>
                </label>
                <textarea
                  id="approval-notes-textarea"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan jika diperlukan..."
                  style={{ height: "auto", minHeight: 80, padding: 10, lineHeight: 1.5, fontSize: 13 }}
                />
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* DIVIDER                                             */}
            {/* --------------------------------------------------- */}
            <div style={{ borderTop: "1px solid var(--border, #e2e8f0)" }} />

            {/* --------------------------------------------------- */}
            {/* SECTION 5: ACTION BAR (Back & Submit)               */}
            {/* --------------------------------------------------- */}
            <div
              className="send-report-action-bar"
              style={{
                padding: "16px 24px",
                background: "var(--sidebar-bg, #ffffff)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              {/* Secondary Button: Kembali */}
              <button
                type="button"
                onClick={handleBackToSelection}
                className="btn btn-outline"
                style={{
                  height: 38,
                  padding: "0 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {/* Summary Note */}
                <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  {deliveryType === "APPROVAL" ? (
                    <>
                      {uploadedFiles.length} file • {approvers.length} approver
                      {approvers.length === 0 && (
                        <span style={{ color: "var(--red, #b3212f)", fontWeight: 600, marginLeft: 6 }}>
                          * Tambahkan minimal satu approver.
                        </span>
                      )}
                    </>
                  ) : (
                    <>{uploadedFiles.length} file • Tanpa approval (Report Saja)</>
                  )}
                </div>

                {/* Primary Button: Ajukan Approval or Kirim Report */}
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="btn btn-primary send-report-submit-btn"
                  style={{
                    height: 38,
                    padding: "0 22px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
                    opacity: canSubmit && !isSubmitting ? 1 : 0.5,
                    backgroundColor:
                      canSubmit && !isSubmitting
                        ? deliveryType === "APPROVAL"
                          ? "var(--red, #b3212f)"
                          : "#059669"
                        : "#94a3b8",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      <span>{deliveryType === "APPROVAL" ? "Mengajukan..." : "Mengirim..."}</span>
                    </>
                  ) : (
                    <>
                      <span className="send-icon-wrapper">
                        <Send size={14} />
                      </span>
                      <span>{deliveryType === "APPROVAL" ? "Ajukan Approval" : "Kirim Report"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPACT MODAL: TAMBAH / EDIT APPROVER                     */}
      {/* ========================================================= */}
      {isApproverModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setIsApproverModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              borderRadius: "var(--radius, 6px)",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: 420,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                {editingApproverId ? "Edit Approver" : "Tambah Approver"}
              </div>
              <button
                type="button"
                onClick={() => setIsApproverModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted, #64748b)", cursor: "pointer", padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveApprover}>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {modalError && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm, 4px)",
                      backgroundColor: "var(--red-bg, #fef2f2)",
                      border: "1px solid var(--red-light, #fee2e2)",
                      fontSize: 12,
                      color: "var(--red, #b3212f)",
                    }}
                  >
                    {modalError}
                  </div>
                )}

                <div>
                  <label htmlFor="approver-modal-nama" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Nama <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </label>
                  <input
                    id="approver-modal-nama"
                    type="text"
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    placeholder=""
                    autoFocus
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="approver-modal-jabatan" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Jabatan <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </label>
                  <input
                    id="approver-modal-jabatan"
                    type="text"
                    value={modalPosition}
                    onChange={(e) => setModalPosition(e.target.value)}
                    placeholder=""
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="approver-modal-email" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Email <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </label>
                  <input
                    id="approver-modal-email"
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder=""
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "10px 18px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsApproverModalOpen(false)}
                  className="btn btn-outline"
                  style={{ height: 30, fontSize: 11.5, padding: "0 12px" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: 30, fontSize: 11.5, padding: "0 14px", fontWeight: 700 }}
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPACT MODAL: TAMBAH / EDIT PENERIMA LAPORAN            */}
      {/* ========================================================= */}
      {isRecipientModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setIsRecipientModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              borderRadius: "var(--radius, 6px)",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: 420,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                {editingRecipientId ? "Edit Penerima" : "Tambah Penerima"}
              </div>
              <button
                type="button"
                onClick={() => setIsRecipientModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted, #64748b)", cursor: "pointer", padding: 2 }}
                aria-label="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRecipient}>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {modalRecipError && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm, 4px)",
                      backgroundColor: "var(--red-bg, #fef2f2)",
                      border: "1px solid var(--red-light, #fee2e2)",
                      fontSize: 12,
                      color: "var(--red, #b3212f)",
                    }}
                  >
                    {modalRecipError}
                  </div>
                )}

                <div>
                  <label htmlFor="recipient-modal-nama" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Nama <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </label>
                  <input
                    id="recipient-modal-nama"
                    type="text"
                    value={modalRecipName}
                    onChange={(e) => setModalRecipName(e.target.value)}
                    placeholder="Nama lengkap penerima"
                    autoFocus
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="recipient-modal-jabatan" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Jabatan <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted, #64748b)" }}>(opsional)</span>
                  </label>
                  <input
                    id="recipient-modal-jabatan"
                    type="text"
                    value={modalRecipPosition}
                    onChange={(e) => setModalRecipPosition(e.target.value)}
                    placeholder="Contoh: Section Head / Staff"
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="recipient-modal-email" style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary, #475569)", marginBottom: 4 }}>
                    Email <span style={{ color: "var(--red, #b3212f)" }}>*</span>
                  </label>
                  <input
                    id="recipient-modal-email"
                    type="email"
                    value={modalRecipEmail}
                    onChange={(e) => setModalRecipEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    style={{
                      width: "100%",
                      height: 34,
                      fontSize: 12.5,
                      padding: "0 10px",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--border-strong, #cbd5e1)",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "10px 18px",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--bg-subtle, #f8fafc)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsRecipientModalOpen(false)}
                  className="btn btn-outline"
                  style={{ height: 30, fontSize: 11.5, padding: "0 12px" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: 30, fontSize: 11.5, padding: "0 14px", fontWeight: 700 }}
                >
                  {editingRecipientId ? "Simpan Perubahan" : "Tambah Penerima"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
