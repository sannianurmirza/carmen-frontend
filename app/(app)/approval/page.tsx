"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  FileArchive,
  File as FileIcon,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Plus,
  X,
  Loader2,
  History,
  Upload,
  AlertTriangle,
  RotateCcw,
  Check,
  Hourglass,
  Users,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  getApprovals,
  getApprovalDetail,
  approveReport,
  rejectReport,
  requestApprovalRevision,
  submitApprovalRevision,
  ApprovalItem,
  ApprovalDetail,
  ApprovalListResponse,
  ApprovalRevisionRecord,
  triggerApprovalFileDownload,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { normalizeRole } from "@/lib/permissions";
import ReportPreview from "@/components/approval/ReportPreview";
import HeaderMetaBoxes from "@/components/HeaderMetaBoxes";

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx !== -1 ? filename.slice(idx).toLowerCase() : "";
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function formatSplitDate(isoStr?: string | null): { time: string; date: string } {
  if (!isoStr) return { time: "-", date: "-" };
  try {
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;
    const date = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return { time, date };
  } catch {
    return { time: "-", date: isoStr };
  }
}

function getFileBadgeType(filename: string): { label: string; className: string } {
  const ext = getFileExtension(filename);
  if (ext === ".xlsx" || ext === ".xls") return { label: "XLS", className: "xlsx" };
  if (ext === ".csv") return { label: "CSV", className: "xlsx" };
  if (ext === ".pdf") return { label: "PDF", className: "pdf" };
  if (ext === ".docx" || ext === ".doc") return { label: "DOC", className: "pdf" };
  if (ext === ".zip") return { label: "ZIP", className: "zip" };
  return { label: ext.replace(".", "").toUpperCase() || "FILE", className: "other" };
}

function ApprovalPageContent() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const searchParams = useSearchParams();
  const userRole = normalizeRole(user?.role);

  // Available Tabs per Role
  // Approver: "todo" (Perlu Tindakan Saya), "approved_by_me" (Sudah Saya Setujui), "waiting_my_turn" (Menunggu Giliran), "revision_rejected" (Revisi / Ditolak), "all" (Semua yang Ditugaskan)
  // Staff: "mine" (Pengajuan Saya)
  // Admin: "all" (Semua Pengajuan)
  const defaultTab = useMemo(() => {
    if (userRole === "admin" || userRole === "staff") return "all";
    return "todo";
  }, [userRole]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Raw data from server
  const [data, setData] = useState<ApprovalListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Drawer & Detail State
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ApprovalDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Modals state
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState<boolean>(false);
  const [revisionComment, setRevisionComment] = useState<string>("");
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [isSubmittingRevisionRequest, setIsSubmittingRevisionRequest] = useState<boolean>(false);

  const [isRevisionUploadModalOpen, setIsRevisionUploadModalOpen] = useState<boolean>(false);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionNotes, setRevisionNotes] = useState<string>("");
  const [revisionUploadError, setRevisionUploadError] = useState<string | null>(null);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState<boolean>(false);

  // Keep active tab valid for user role and respect URL search param
  useEffect(() => {
    if (user) {
      const r = normalizeRole(user.role);
      const tabParam = searchParams.get("tab");
      const cardParam = searchParams.get("card");
      const targetParam = cardParam || tabParam;

      if (targetParam) {
        if (targetParam === "history") {
          setActiveTab("approved_by_me");
        } else if (
          [
            "todo",
            "approved_by_me",
            "waiting_my_turn",
            "revision_rejected",
            "all",
            "mine",
          ].includes(targetParam)
        ) {
          setActiveTab(targetParam);
        }
      } else {
        if (
          r === "admin" &&
          !["all", "approved_by_me", "todo", "revision_rejected", "history"].includes(activeTab)
        ) {
          setActiveTab("all");
        } else if (
          r === "staff" &&
          !["mine", "approved_by_me", "revision_rejected", "all", "history"].includes(activeTab)
        ) {
          setActiveTab("mine");
        } else if (
          r === "approver" &&
          !["todo", "approved_by_me", "waiting_my_turn", "revision_rejected", "all", "history"].includes(activeTab)
        ) {
          setActiveTab("todo");
        }
      }
    }
  }, [user, searchParams]);

  // Load approvals from backend
  const loadApprovals = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      try {
        // Query backend for all authorized items for this user
        // We fetch with tab="all" (or role-specific endpoint) so client can compute accurate tab & status counts
        const apiTabParam = userRole === "admin" || userRole === "staff" ? "all" : "assigned";
        const res = await getApprovals({
          tab: apiTabParam,
        });
        setData(res);
      } catch (err: any) {
        console.error("Gagal memuat daftar approval:", err);
        showError(err?.message || "Gagal memuat daftar approval.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userRole, showError]
  );

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // Handle escape key and lock body scroll when drawer or modal is open
  useEffect(() => {
    const isAnyOpen =
      isDrawerOpen ||
      isApproveModalOpen ||
      isRejectModalOpen ||
      isRevisionModalOpen ||
      isRevisionUploadModalOpen;

    if (isAnyOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (isApproveModalOpen) setIsApproveModalOpen(false);
          else if (isRejectModalOpen) setIsRejectModalOpen(false);
          else if (isRevisionModalOpen) setIsRevisionModalOpen(false);
          else if (isRevisionUploadModalOpen) setIsRevisionUploadModalOpen(false);
          else if (isDrawerOpen) setIsDrawerOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = origOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [
    isDrawerOpen,
    isApproveModalOpen,
    isRejectModalOpen,
    isRevisionModalOpen,
    isRevisionUploadModalOpen,
  ]);

  // All raw items sorted strictly OLDEST FIRST: requested_at ASC, id ASC
  const rawItems = useMemo(() => {
    const list = [...(data?.items || [])];
    list.sort((a, b) => {
      const tA = a.requested_at ? new Date(a.requested_at).getTime() : 0;
      const tB = b.requested_at ? new Date(b.requested_at).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return a.id - b.id;
    });
    return list;
  }, [data]);

  // Compute exact status card counts on the full dataset before search filtering & pagination
  const cardCounts = useMemo(() => {
    if (userRole === "approver") {
      let todo = 0;
      let approved = 0;
      let waiting = 0;
      let revRej = 0;

      for (const r of rawItems) {
        const mySt = r.my_step?.status?.toUpperCase();
        const docSt = r.status?.toUpperCase();

        if (r.can_review && (docSt === "PENDING" || docSt === "WAITING") && mySt === "PENDING") {
          todo++;
        } else if (mySt === "APPROVED") {
          approved++;
        } else if (!r.can_review && (mySt === "WAITING" || (mySt === "PENDING" && !r.can_review)) && docSt === "PENDING") {
          waiting++;
        } else if (
          mySt === "REJECTED" ||
          mySt === "REVISION" ||
          mySt === "REVISION_REQUIRED" ||
          docSt === "REJECTED" ||
          docSt === "REVISION_REQUIRED" ||
          docSt === "REVISION"
        ) {
          revRej++;
        }
      }

      return {
        todo,
        approved_by_me: approved,
        waiting_my_turn: waiting,
        revision_rejected: revRej,
      };
    }

    if (userRole === "staff") {
      let pending = 0;
      let approved = 0;
      let inProgress = 0;
      let revRej = 0;

      for (const r of rawItems) {
        if (!r.is_requester) continue;
        const docSt = r.status?.toUpperCase();
        if (docSt === "APPROVED") {
          approved++;
        } else if (docSt === "REJECTED" || docSt === "REVISION_REQUIRED" || docSt === "REVISION") {
          revRej++;
        } else if (r.current_approver && r.current_approver.sequence > 1) {
          inProgress++;
        } else {
          pending++;
        }
      }

      return {
        todo: pending,
        approved_by_me: approved,
        waiting_my_turn: inProgress,
        revision_rejected: revRej,
      };
    }

    // Admin
    let pending = 0;
    let approved = 0;
    let inProgress = 0;
    let revRej = 0;

    for (const r of rawItems) {
      const docSt = r.status?.toUpperCase();
      if (docSt === "APPROVED") {
        approved++;
      } else if (docSt === "REJECTED" || docSt === "REVISION_REQUIRED" || docSt === "REVISION") {
        revRej++;
      } else if (r.current_approver && r.current_approver.sequence > 1) {
        inProgress++;
      } else {
        pending++;
      }
    }

    return {
      todo: pending,
      approved_by_me: approved,
      waiting_my_turn: inProgress,
      revision_rejected: revRej,
    };
  }, [userRole, rawItems]);

  // Card definition for the 5 status cards
  // Approver: "todo" (Perlu Tindakan Saya / Perlu Persetujuan), "approved_by_me" (Sudah Saya Setujui), "waiting_my_turn" (Menunggu Giliran), "revision_rejected" (Revisi / Ditolak), "all" (Semua yang Ditugaskan / Semua Dokumen)
  // Staff: "mine" (Pengajuan Saya / Menunggu Persetujuan), "approved_by_me" (Sudah Disetujui), "waiting_my_turn" (Dalam Proses), "revision_rejected" (Revisi / Ditolak), "all" (Semua Pengajuan / Semua Dokumen)
  // Admin: "all" (Semua Pengajuan / Semua Dokumen)
  const cards = useMemo(() => {
    if (userRole === "approver") {
      return [
        {
          id: "todo",
          title: "Perlu Persetujuan",
          desc: "Perlu Tindakan Saya",
          count: cardCounts.todo,
          icon: Clock,
          accent: "amber",
        },
        {
          id: "approved_by_me",
          title: "Sudah Saya Setujui",
          desc: "Sudah Saya Setujui",
          count: cardCounts.approved_by_me,
          icon: CheckCircle2,
          accent: "green",
        },
        {
          id: "waiting_my_turn",
          title: "Menunggu Giliran",
          desc: "Menunggu Giliran",
          count: cardCounts.waiting_my_turn,
          icon: Hourglass,
          accent: "blue",
        },
        {
          id: "revision_rejected",
          title: "Revisi / Ditolak",
          desc: "Revisi / Ditolak",
          count: cardCounts.revision_rejected,
          icon: FileWarning,
          accent: "red",
        },
        {
          id: "all",
          title: "Semua Dokumen",
          desc: "Semua Dokumen",
          count: rawItems.length,
          icon: FileText,
          accent: "neutral",
        },
      ];
    }
    if (userRole === "staff") {
      return [
        {
          id: "mine",
          title: "Menunggu Persetujuan",
          desc: "Pengajuan Saya",
          count: cardCounts.todo,
          icon: Clock,
          accent: "amber",
        },
        {
          id: "approved_by_me",
          title: "Sudah Disetujui",
          desc: "Sudah Disetujui",
          count: cardCounts.approved_by_me,
          icon: CheckCircle2,
          accent: "green",
        },
        {
          id: "waiting_my_turn",
          title: "Dalam Proses",
          desc: "Dalam Proses",
          count: cardCounts.waiting_my_turn,
          icon: Hourglass,
          accent: "blue",
        },
        {
          id: "revision_rejected",
          title: "Revisi / Ditolak",
          desc: "Revisi / Ditolak",
          count: cardCounts.revision_rejected,
          icon: FileWarning,
          accent: "red",
        },
        {
          id: "all",
          title: "Semua Dokumen",
          desc: "Semua Pengajuan",
          count: rawItems.filter((r) => r.is_requester).length,
          icon: FileText,
          accent: "neutral",
        },
      ];
    }
    // Admin
    return [
      {
        id: "todo",
        title: "Perlu Persetujuan",
        desc: "Perlu Persetujuan",
        count: cardCounts.todo,
        icon: Clock,
        accent: "amber",
      },
      {
        id: "approved_by_me",
        title: "Sudah Disetujui",
        desc: "Sudah Disetujui",
        count: cardCounts.approved_by_me,
        icon: CheckCircle2,
        accent: "green",
      },
      {
        id: "waiting_my_turn",
        title: "Menunggu Giliran",
        desc: "Menunggu Giliran",
        count: cardCounts.waiting_my_turn,
        icon: Hourglass,
        accent: "blue",
      },
      {
        id: "revision_rejected",
        title: "Revisi / Ditolak",
        desc: "Revisi / Ditolak",
        count: cardCounts.revision_rejected,
        icon: FileWarning,
        accent: "red",
      },
      {
        id: "all",
        title: "Semua Dokumen",
        desc: "Semua Pengajuan",
        count: rawItems.length,
        icon: FileText,
        accent: "neutral",
      },
    ];
  }, [userRole, cardCounts, rawItems]);

  const isCardActive = (cardId: string) => {
    if (cardId === "todo") {
      return activeTab === "todo" || (userRole === "staff" && activeTab === "mine");
    }
    if (cardId === "mine") {
      return activeTab === "mine" || activeTab === "todo";
    }
    if (cardId === "approved_by_me") {
      return activeTab === "approved_by_me" || activeTab === "history";
    }
    if (cardId === "waiting_my_turn") {
      return activeTab === "waiting_my_turn";
    }
    if (cardId === "revision_rejected") {
      return activeTab === "revision_rejected";
    }
    if (cardId === "all") {
      return activeTab === "all";
    }
    return activeTab === cardId;
  };

  const activeCategoryTitle = useMemo(() => {
    const activeCard = cards.find((c) => isCardActive(c.id));
    if (activeCard) return activeCard.title;
    if (activeTab === "approved_by_me" || activeTab === "history") {
      return userRole === "staff" ? "Sudah Disetujui" : "Sudah Saya Setujui";
    }
    if (activeTab === "waiting_my_turn") {
      return userRole === "staff" ? "Dalam Proses" : "Menunggu Giliran";
    }
    if (activeTab === "revision_rejected") return "Revisi / Ditolak";
    if (activeTab === "all") return "Semua Dokumen";
    return userRole === "staff" ? "Menunggu Persetujuan" : "Perlu Persetujuan";
  }, [cards, activeTab, userRole]);

  const handleCardClick = (cardId: string) => {
    if (userRole === "staff" && cardId === "todo") {
      setActiveTab("mine");
    } else {
      setActiveTab(cardId);
    }
    setCurrentPage(1);
    setStatusFilter("ALL");
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setStatusFilter("ALL");
  };

  // Filter items by role tab / card selection
  const tabFilteredItems = useMemo(() => {
    if (userRole === "approver") {
      if (activeTab === "todo") {
        // Items requiring my action right now
        return rawItems.filter(
          (r) =>
            r.can_review &&
            (r.status === "PENDING" || r.status === "WAITING") &&
            r.my_step?.status?.toUpperCase() === "PENDING"
        );
      }
      if (activeTab === "approved_by_me" || activeTab === "history") {
        // Items where my approval step is approved (even if overall status is still pending next approvers)
        return rawItems.filter((r) => r.my_step?.status?.toUpperCase() === "APPROVED");
      }
      if (activeTab === "waiting_my_turn") {
        // Items assigned to me that are waiting for earlier approver sequence
        return rawItems.filter(
          (r) =>
            !r.can_review &&
            (r.my_step?.status?.toUpperCase() === "WAITING" ||
              (r.my_step?.status?.toUpperCase() === "PENDING" && !r.can_review)) &&
            r.status === "PENDING"
        );
      }
      if (activeTab === "revision_rejected") {
        // Items relevant to me in revision or rejected
        return rawItems.filter((r) => {
          const mySt = r.my_step?.status?.toUpperCase();
          const docSt = r.status?.toUpperCase();
          return (
            mySt === "REJECTED" ||
            mySt === "REVISION" ||
            mySt === "REVISION_REQUIRED" ||
            docSt === "REJECTED" ||
            docSt === "REVISION_REQUIRED" ||
            docSt === "REVISION"
          );
        });
      }
      // "all": all assigned
      return rawItems;
    }

    if (userRole === "staff") {
      const mine = rawItems.filter((r) => r.is_requester);
      if (activeTab === "todo" || activeTab === "mine") {
        return mine.filter(
          (r) => (r.status === "PENDING" || r.status === "WAITING") && (!r.current_approver || r.current_approver.sequence === 1)
        );
      }
      if (activeTab === "approved_by_me" || activeTab === "history") {
        return mine.filter((r) => r.status === "APPROVED");
      }
      if (activeTab === "waiting_my_turn") {
        return mine.filter(
          (r) => r.status === "PENDING" && r.current_approver && r.current_approver.sequence > 1
        );
      }
      if (activeTab === "revision_rejected") {
        return mine.filter((r) =>
          ["REJECTED", "REVISION_REQUIRED", "REVISION"].includes(r.status?.toUpperCase() || "")
        );
      }
      return mine;
    }

    // Admin sees all
    if (activeTab === "todo") {
      return rawItems.filter((r) => r.status === "PENDING" || r.status === "WAITING");
    }
    if (activeTab === "approved_by_me" || activeTab === "history") {
      return rawItems.filter((r) => r.status === "APPROVED");
    }
    if (activeTab === "waiting_my_turn") {
      return rawItems.filter(
        (r) => r.status === "PENDING" && r.current_approver && r.current_approver.sequence > 1
      );
    }
    if (activeTab === "revision_rejected") {
      return rawItems.filter((r) =>
        ["REJECTED", "REVISION_REQUIRED", "REVISION"].includes(r.status?.toUpperCase() || "")
      );
    }
    return rawItems;
  }, [rawItems, userRole, activeTab]);

  // Role Tab Definitions with dynamic counts matching requirements
  const roleTabs = useMemo(() => {
    if (userRole === "approver") {
      return [
        { id: "todo", label: "Perlu Persetujuan", count: cardCounts.todo },
        { id: "approved_by_me", label: "Sudah Saya Setujui", count: cardCounts.approved_by_me },
        { id: "waiting_my_turn", label: "Menunggu Giliran", count: cardCounts.waiting_my_turn },
        { id: "revision_rejected", label: "Revisi / Ditolak", count: cardCounts.revision_rejected },
        { id: "all", label: "Semua Dokumen", count: rawItems.length },
      ];
    }
    if (userRole === "staff") {
      return [
        { id: "mine", label: "Menunggu Persetujuan", count: cardCounts.todo },
        { id: "approved_by_me", label: "Sudah Disetujui", count: cardCounts.approved_by_me },
        { id: "waiting_my_turn", label: "Dalam Proses", count: cardCounts.waiting_my_turn },
        { id: "revision_rejected", label: "Revisi / Ditolak", count: cardCounts.revision_rejected },
        { id: "all", label: "Semua Dokumen", count: rawItems.filter((r) => r.is_requester).length }, // Semua Pengajuan
      ];
    }
    // Admin
    return [
      { id: "todo", label: "Menunggu Persetujuan", count: cardCounts.todo },
      { id: "approved_by_me", label: "Sudah Disetujui", count: cardCounts.approved_by_me },
      { id: "waiting_my_turn", label: "Menunggu Giliran", count: cardCounts.waiting_my_turn },
      { id: "revision_rejected", label: "Revisi / Ditolak", count: cardCounts.revision_rejected },
      { id: "all", label: "Semua Dokumen", count: rawItems.length },
    ];
  }, [userRole, cardCounts, rawItems]);

  // Compute status counts for the current tab's dataset
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: tabFilteredItems.length,
      PENDING: 0,
      REVISION_REQUIRED: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const r of tabFilteredItems) {
      const docSt = r.status?.toUpperCase();
      const mySt = r.my_step?.status?.toUpperCase();

      if (docSt === "APPROVED" || mySt === "APPROVED") {
        counts.APPROVED++;
      } else if (docSt === "REJECTED" || mySt === "REJECTED") {
        counts.REJECTED++;
      } else if (docSt === "REVISION_REQUIRED" || docSt === "REVISION" || mySt === "REVISION_REQUIRED") {
        counts.REVISION_REQUIRED++;
      } else {
        counts.PENDING++;
      }
    }
    return counts;
  }, [tabFilteredItems]);

  // Status Filter Chips matching Section 4 requirements:
  // Semua, Menunggu, Perlu Revisi, Disetujui, Ditolak
  const statusChips = useMemo(() => {
    return [
      { id: "ALL", label: "Semua", count: statusCounts.ALL },
      { id: "PENDING", label: "Menunggu", count: statusCounts.PENDING },
      { id: "REVISION_REQUIRED", label: "Perlu Revisi", count: statusCounts.REVISION_REQUIRED },
      { id: "APPROVED", label: "Disetujui", count: statusCounts.APPROVED },
      { id: "REJECTED", label: "Ditolak", count: statusCounts.REJECTED },
    ];
  }, [statusCounts]);

  // Final filtered list based on status chip and search query
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tabFilteredItems.filter((item) => {
      // Status match
      if (statusFilter !== "ALL") {
        const itemSt = item.status?.toUpperCase();
        const mySt = item.my_step?.status?.toUpperCase();

        if (statusFilter === "WAIT_NEXT") {
          if (mySt !== "APPROVED" || (itemSt !== "PENDING" && itemSt !== "WAITING")) return false;
        } else if (statusFilter === "FULLY_APPROVED") {
          if (itemSt !== "APPROVED") return false;
        } else if (statusFilter === "APPROVED") {
          if (itemSt !== "APPROVED" && mySt !== "APPROVED") return false;
        } else if (statusFilter === "REJECTED") {
          if (itemSt !== "REJECTED" && mySt !== "REJECTED") return false;
        } else if (statusFilter === "REVISION_REQUIRED") {
          if (
            itemSt !== "REVISION_REQUIRED" &&
            itemSt !== "REVISION" &&
            mySt !== "REVISION_REQUIRED" &&
            mySt !== "REVISION"
          )
            return false;
        } else if (statusFilter === "PENDING") {
          if (mySt === "APPROVED" || mySt === "REJECTED" || itemSt === "APPROVED" || itemSt === "REJECTED")
            return false;
          if (itemSt !== "PENDING" && itemSt !== "WAITING") return false;
        } else if (statusFilter === "WAITING") {
          if (itemSt !== "PENDING" && itemSt !== "WAITING") return false;
        }
      }

      // Search match
      if (q) {
        const matchFile = (item.original_filename || "").toLowerCase().includes(q);
        const matchReq = (item.requester?.nama || "").toLowerCase().includes(q);
        const matchNote = (item.note || "").toLowerCase().includes(q);
        const matchApprover = (item.approvers || []).some((a) =>
          (a.name || "").toLowerCase().includes(q)
        );
        if (!matchFile && !matchReq && !matchNote && !matchApprover) {
          return false;
        }
      }

      return true;
    });
  }, [tabFilteredItems, statusFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedItems.slice(start, start + pageSize);
  }, [displayedItems, currentPage, pageSize]);

  // Open Drawer and load complete details
  const handleOpenDetail = async (id: number) => {
    setSelectedId(id);
    setIsDrawerOpen(true);
    setLoadingDetail(true);

    // Initial item from list for immediate rendering
    const cached = rawItems.find((r) => r.id === id);
    if (cached) {
      setSelectedItem(cached as unknown as ApprovalDetail);
    }

    try {
      const detail = await getApprovalDetail(id);
      setSelectedItem(detail);
    } catch (err: any) {
      showError(err?.message || "Gagal memuat detail approval.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedId(null);
  };

  // Auto-open detail if ?id=... or set tab if ?tab=... is present in URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["todo", "history", "all", "mine"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const idParam = searchParams.get("id");
    if (idParam) {
      const parsedId = parseInt(idParam, 10);
      if (!isNaN(parsedId) && parsedId > 0 && selectedId !== parsedId) {
        handleOpenDetail(parsedId);
      }
    }
  }, [searchParams]);

  const selectedDetail = selectedItem as ApprovalDetail | null;

  const readyArtifacts = useMemo(() => {
    if (!selectedDetail?.artifacts) return [];
    return [...selectedDetail.artifacts]
      .filter((a) => a.status === "READY")
      .sort((a, b) => (b.stage_sequence ?? b.sequence) - (a.stage_sequence ?? a.sequence));
  }, [selectedDetail]);

  const latestReadyArtifact = readyArtifacts.length > 0 ? readyArtifacts[0] : null;

  const failedArtifact = useMemo(() => {
    if (!selectedDetail?.artifacts) return null;
    return selectedDetail.artifacts.find((a) => a.status === "GENERATION_FAILED") || null;
  }, [selectedDetail]);

  const totalApprovers = selectedDetail?.approvers?.length || 3;

  // Safe Authenticated File Download via /file endpoint
  const handleDownloadFile = async (
    item: ApprovalItem | ApprovalDetail,
    options?:
      | {
          revision?: number;
          type?: "original" | "latest";
          artifactId?: number;
          fallbackFilename?: string;
          downloadKey?: string;
        }
      | number,
    legacyFallback?: string
  ) => {
    const revisionNumber = typeof options === "number" ? options : options?.revision;
    let opts: {
      revision?: number;
      type?: "original" | "latest";
      artifactId?: number;
      fallbackFilename?: string;
    } = {};
    let key = "main";
    if (typeof options === "number") {
      opts = { revision: options, fallbackFilename: legacyFallback };
      key = `rev-${options}`;
    } else if (options) {
      opts = options;
      key =
        options.downloadKey ||
        (options.type === "original"
          ? "original"
          : options.type === "latest"
          ? "latest"
          : options.revision
          ? `rev-${options.revision}`
          : "main");
    }
    if (downloadingKey !== null) return;
    setDownloadingKey(key);
    try {
      const resolvedFallback = opts.fallbackFilename || item.original_filename;
      await triggerApprovalFileDownload(item.id, {
        ...opts,
        fallbackFilename: resolvedFallback,
      });
    } catch (err: any) {
      showError(err?.message || "Gagal mengunduh file laporan.");
    } finally {
      setDownloadingKey(null);
    }
  };

  // Confirm Approve Handler
  const handleConfirmApprove = async () => {
    if (!selectedItem) return;
    setIsApproving(true);
    const targetId = selectedItem.id;
    try {
      const res = await approveReport(targetId);
      showSuccess(res.message || "Laporan berhasil disetujui.");
      setIsApproveModalOpen(false);

      // Keep drawer open with updated status & switch view to 'approved_by_me' category
      setActiveTab("approved_by_me");
      setStatusFilter("ALL");
      setCurrentPage(1);

      try {
        const updated = await getApprovalDetail(targetId);
        setSelectedItem(updated);
      } catch {
        setIsDrawerOpen(false);
        setSelectedItem(null);
      }

      loadApprovals(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cms-approval-updated"));
      }
    } catch (err: any) {
      showError(err?.message || "Gagal menyetujui laporan.");
    } finally {
      setIsApproving(false);
    }
  };

  // Confirm Reject Handler
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const cleanReason = rejectReason.trim();
    if (!cleanReason) {
      setRejectError("Alasan penolakan wajib diisi.");
      return;
    }

    setIsRejecting(true);
    setRejectError(null);
    const targetId = selectedItem.id;
    try {
      const res = await rejectReport(targetId, cleanReason);
      showSuccess(res.message || "Pengajuan laporan telah ditolak.");
      setIsRejectModalOpen(false);
      setRejectReason("");

      // Switch view to 'revision_rejected' category and refresh detail
      setActiveTab("revision_rejected");
      setStatusFilter("ALL");
      setCurrentPage(1);

      try {
        const updated = await getApprovalDetail(targetId);
        setSelectedItem(updated);
      } catch {
        setIsDrawerOpen(false);
        setSelectedItem(null);
      }

      loadApprovals(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cms-approval-updated"));
      }
    } catch (err: any) {
      setRejectError(err?.message || "Gagal menolak pengajuan.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Confirm Revision Request Handler
  const handleConfirmRevisionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const cleanComment = revisionComment.trim();
    if (!cleanComment) {
      setRevisionError("Komentar revisi wajib diisi.");
      return;
    }

    setIsSubmittingRevisionRequest(true);
    setRevisionError(null);
    const targetId = selectedItem.id;
    try {
      const res = await requestApprovalRevision(targetId, cleanComment);
      showSuccess(res.message || "Permintaan revisi berhasil dikirim.");
      setIsRevisionModalOpen(false);
      setRevisionComment("");

      // Switch view to 'revision_rejected' category and refresh detail
      setActiveTab("revision_rejected");
      setStatusFilter("ALL");
      setCurrentPage(1);

      try {
        const updated = await getApprovalDetail(targetId);
        setSelectedItem(updated);
      } catch {
        setIsDrawerOpen(false);
        setSelectedItem(null);
      }

      loadApprovals(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cms-approval-updated"));
      }
    } catch (err: any) {
      setRevisionError(err?.message || "Gagal mengirim permintaan revisi.");
    } finally {
      setIsSubmittingRevisionRequest(false);
    }
  };

  // Submit Revised File Handler (Staff / Requester)
  const handleSubmitRevisedFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!revisionFile) {
      setRevisionUploadError("Pilih file revisi terlebih dahulu.");
      return;
    }

    setIsSubmittingRevision(true);
    setRevisionUploadError(null);
    try {
      const res = await submitApprovalRevision(
        selectedItem.id,
        revisionFile,
        revisionNotes.trim() || undefined
      );
      showSuccess(
        res.message || "File revisi berhasil diajukan. Alur approval dimulai kembali dari urutan 1."
      );
      setRevisionFile(null);
      setRevisionNotes("");
      setIsRevisionUploadModalOpen(false);

      // Reload detail and list
      const updated = await getApprovalDetail(selectedItem.id);
      setSelectedItem(updated);
      loadApprovals(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cms-approval-updated"));
      }
    } catch (err: any) {
      setRevisionUploadError(err?.message || "Gagal mengunggah file revisi.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  // Status Pill component matching reference
  const renderStatusPill = (status: string, myStepStatus?: string | null) => {
    const st = status?.toUpperCase();
    if (st === "APPROVED") {
      return <span className="pill s-disetujui">Disetujui</span>;
    }
    if (st === "REJECTED") {
      return <span className="pill s-ditolak">Ditolak</span>;
    }
    if (st === "REVISION_REQUIRED" || st === "REVISION") {
      return <span className="pill s-revisi">Perlu Revisi</span>;
    }
    if (myStepStatus?.toUpperCase() === "APPROVED") {
      return (
        <span
          className="pill s-disetujui"
          title="Anda telah menyetujui, menunggu approver tahap selanjutnya"
        >
          Disetujui Anda
        </span>
      );
    }
    if (st === "WAITING") {
      return <span className="pill s-menunggu">Menunggu Giliran</span>;
    }
    return <span className="pill s-menunggu">Menunggu Approval</span>;
  };

  // Single status badge renderer matching Section 5:
  const renderApprovalRowStatus = (r: ApprovalItem) => {
    const docSt = r.status?.toUpperCase();
    const mySt = r.my_step?.status?.toUpperCase();

    if (docSt === "APPROVED") {
      return <span className="pill s-disetujui">Disetujui</span>;
    }
    if (docSt === "REJECTED") {
      return <span className="pill s-ditolak">Ditolak</span>;
    }
    if (
      docSt === "REVISION_REQUIRED" ||
      docSt === "REVISION" ||
      mySt === "REVISION_REQUIRED" ||
      mySt === "REVISION"
    ) {
      return <span className="pill s-revisi">Perlu Revisi</span>;
    }
    if (docSt === "WAITING") {
      return <span className="pill s-menunggu">Menunggu Giliran</span>;
    }
    return <span className="pill s-menunggu">Menunggu Approval</span>;
  };

  // Subtitle based on role
  const getRoleSubtitle = () => {
    if (userRole === "admin") {
      return "Pantau seluruh proses persetujuan laporan dan riwayat keputusan.";
    }
    if (userRole === "staff") {
      return "Pantau status persetujuan laporan yang telah Anda kirimkan.";
    }
    return "Tinjau laporan yang menunggu tindakan Anda dan lihat riwayat persetujuan.";
  };

  return (
    <div className="approval-redesign-wrap">
      <style>{`
        :root {
          --ap-bg: #f4f3f1;
          --ap-surface: #ffffff;
          --ap-ink: #22201f;
          --ap-ink2: #6b6560;
          --ap-ink3: #9a948e;
          --ap-line: #e6e2dd;
          --ap-hover: #faf8f6;
          --ap-brand: #a51c30;
          --ap-brand-ink: #ffffff;
          --ap-brand-soft: #f9e7ea;
          --ap-wait: #a4620a;
          --ap-wait-bg: #fdf1dc;
          --ap-ok: #1e7a46;
          --ap-ok-bg: #dff3e8;
          --ap-no: #b3261e;
          --ap-no-bg: #fbe4e2;
          --ap-rev: #6a4fb3;
          --ap-rev-bg: #ece7f8;
          --ap-xls: #1e7a46;
          --ap-pdf: #b3261e;
          --ap-shadow: 0 1px 2px rgba(34,32,31,.06), 0 8px 24px -12px rgba(34,32,31,.18);
        }

        .approval-redesign-wrap {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          padding: 0 0 60px;
          color: var(--ap-ink);
        }

        /* 5 STATUS SUMMARY CARDS */
        .ap-cards-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 26px;
        }

        @media (max-width: 1200px) {
          .ap-cards-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .ap-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .ap-cards-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        .ap-stat-card {
          position: relative;
          background: var(--ap-surface);
          border: 1px solid var(--ap-line);
          border-radius: 14px;
          padding: 18px 20px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(34, 32, 31, 0.04);
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 104px;
          user-select: none;
          text-align: left;
        }
        .ap-stat-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px -2px rgba(34, 32, 31, 0.08);
        }
        .ap-stat-card:active {
          transform: translateY(0);
        }
        .ap-stat-card:focus-visible {
          outline: 2px solid var(--ap-brand);
          outline-offset: 2px;
        }
        .ap-stat-card.active {
          border: 1.5px solid var(--ap-brand);
          background: #fffbfa;
          box-shadow: 0 4px 14px -3px rgba(165, 28, 48, 0.12);
        }

        .ap-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .ap-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .ap-card-icon.amber {
          background: #fef3c7;
          color: #b45309;
        }
        .ap-card-icon.green {
          background: #dcfce7;
          color: #166534;
        }
        .ap-card-icon.blue {
          background: #e0f2fe;
          color: #0369a1;
        }
        .ap-card-icon.red {
          background: #fee2e2;
          color: #991b1b;
        }
        .ap-card-icon.neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .ap-card-num {
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--ap-ink);
        }
        .ap-card-title {
          margin: 0;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ap-ink);
          line-height: 1.25;
        }

        /* PAGINATION CONTROLS */
        .ap-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          border-top: 1px solid var(--ap-line);
          background: var(--ap-surface);
          flex-wrap: wrap;
          gap: 10px;
        }
        .ap-page-info {
          font-size: 13px;
          color: var(--ap-ink2);
        }
        .ap-page-btns {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ap-page-btn {
          height: 32px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid var(--ap-line);
          background: var(--ap-surface);
          color: var(--ap-ink);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all .15s;
        }
        .ap-page-btn:hover:not(:disabled) {
          background: var(--ap-hover);
          border-color: var(--ap-ink3);
        }
        .ap-page-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ap-page-btn.active {
          background: var(--ap-brand);
          border-color: var(--ap-brand);
          color: #ffffff;
        }

        /* HEADER */
        .ap-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        .ap-header .mod {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ap-brand);
          font-weight: 700;
          font-size: 13.5px;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }
        .ap-header .mod i {
          width: 18px;
          height: 3px;
          border-radius: 2px;
          background: var(--ap-brand);
          display: inline-block;
        }
        .ap-header h1 {
          margin: 0;
          font-size: clamp(26px, 4vw, 32px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--ap-ink);
        }
        .ap-header .sub {
          margin: 6px 0 0;
          color: var(--ap-ink2);
          font-size: 14.5px;
          max-width: 54ch;
        }
        .ap-header .acts {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* BUTTONS */
        .ap-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 16px;
          border-radius: 9px;
          border: 1px solid var(--ap-line);
          background: var(--ap-surface);
          color: var(--ap-ink);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform .15s, background .2s, border-color .2s;
          text-decoration: none;
        }
        .ap-btn:hover {
          border-color: var(--ap-ink3);
        }
        .ap-btn:active {
          transform: scale(.97);
        }
        .ap-btn.primary {
          background: var(--ap-brand);
          border-color: var(--ap-brand);
          color: var(--ap-brand-ink);
        }
        .ap-btn.primary:hover {
          filter: brightness(1.08);
        }
        .ap-btn.spin svg {
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* MAIN PANEL */
        .ap-panel {
          background: var(--ap-surface);
          border: 1px solid var(--ap-line);
          border-radius: 16px;
          box-shadow: var(--ap-shadow);
          overflow: hidden;
        }

        /* PANEL HEADER */
        .ap-panel-header {
          padding: 22px 28px 18px;
          border-bottom: 1px solid var(--ap-line);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ap-panel-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ap-panel-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--ap-ink);
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        /* SUBFILTERS */
        .ap-subfilters-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ap-seg {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ap-chip {
          height: 36px;
          padding: 0 15px;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-weight: 600;
          font-size: 13.5px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all .15s ease;
        }
        .ap-chip:hover {
          border-color: #cbd5e1;
          color: var(--ap-ink);
        }
        .ap-chip[aria-pressed="true"] {
          background: var(--ap-brand, #a51c30);
          border-color: var(--ap-brand, #a51c30);
          color: #ffffff;
        }
        .ap-chip small {
          font-size: 12px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          transition: background .15s, color .15s;
        }
        .ap-chip[aria-pressed="true"] small {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }
        .ap-search {
          position: relative;
          flex: 0 1 340px;
          width: 100%;
          max-width: 380px;
          display: flex;
          align-items: center;
        }
        .ap-search svg {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          pointer-events: none;
        }
        .ap-search input {
          width: 100%;
          height: 40px;
          padding: 0 38px 0 40px;
          border-radius: 10px;
          border: 1px solid var(--ap-line);
          background: var(--ap-bg);
          font-size: 13.5px;
          color: var(--ap-ink);
          outline: none;
          transition: border-color .15s, box-shadow .15s, background .15s;
          box-sizing: border-box;
        }
        .ap-search input:focus {
          border-color: var(--ap-brand);
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(165, 28, 48, 0.12);
        }
        .ap-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        .ap-search-clear:hover {
          color: var(--ap-ink);
        }

        /* TABLE CONTAINER & LAYOUT */
        .ap-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .ap-table {
          width: 100%;
          min-width: 0;
        }

        /* TABLE COLUMNS & ROWS */
        .ap-cols, .ap-row {
          display: grid;
          grid-template-columns: minmax(180px, 2.6fr) minmax(120px, 1.2fr) minmax(75px, 0.85fr) minmax(135px, 1.35fr) minmax(165px, 1.5fr) minmax(120px, 1.1fr);
          gap: 16px;
          align-items: center;
          padding: 0 24px;
        }
        .ap-cols {
          height: 52px;
          color: var(--ap-ink3);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--ap-line);
        }
        .ap-cols .th-center {
          text-align: center;
        }
        .ap-row {
          min-height: 98px;
          padding: 22px 24px;
          border-bottom: 1px solid var(--ap-line);
          cursor: pointer;
          position: relative;
          transition: background .15s;
        }
        .ap-row:last-child {
          border-bottom: 0;
        }
        .ap-row:hover {
          background: var(--ap-hover);
        }
        .ap-row::before {
          content: "";
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 3.5px;
          border-radius: 0 3px 3px 0;
          background: var(--ap-brand);
          transform: scaleY(0);
          transition: transform .15s;
        }
        .ap-row:hover::before {
          transform: scaleY(1);
        }

        .ap-rows.enter .ap-row {
          animation: apIn .35s cubic-bezier(.2,.7,.2,1) both;
          animation-delay: calc(var(--i) * 35ms);
        }
        @keyframes apIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        /* CELLS */
        .ap-file {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .ap-ft {
          flex: none;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .02em;
        }
        .ap-ft.xlsx {
          background: var(--ap-ok-bg);
          color: var(--ap-xls);
        }
        .ap-ft.pdf {
          background: var(--ap-no-bg);
          color: var(--ap-pdf);
        }
        .ap-ft.zip {
          background: var(--ap-wait-bg);
          color: var(--ap-wait);
        }
        .ap-ft.other {
          background: #e2e8f0;
          color: #475569;
        }
        .ap-file-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 3px;
        }
        .ap-fn {
          font-weight: 600;
          font-size: 14px;
          line-height: 1.4;
          color: var(--ap-ink);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }
        .ap-fs {
          font-size: 12px;
          color: var(--ap-ink3);
        }
        .ap-by {
          font-weight: 500;
          font-size: 14px;
          color: var(--ap-ink);
        }
        .ap-dt-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          line-height: 1.4;
        }
        .ap-dt-time {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ap-ink);
        }
        .ap-dt-date {
          font-size: 12px;
          color: var(--ap-ink2);
        }
        .ap-lbl {
          display: none;
        }
        .ap-stage b {
          display: block;
          font-weight: 600;
          font-size: 14px;
          line-height: 1.35;
          color: var(--ap-ink);
        }
        .ap-stage span {
          color: var(--ap-ink2);
          font-size: 13px;
        }
        .ap-segmented-bar {
          display: flex;
          gap: 5px;
          margin-top: 7px;
          max-width: 140px;
        }
        .ap-seg-block {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: #e2e8f0;
          transition: background .15s;
        }
        .ap-seg-block.approved {
          background: #16a34a;
        }
        .ap-seg-block.pending {
          background: #d97706;
        }
        .ap-seg-block.rejected {
          background: #dc2626;
        }
        .ap-seg-block.revision {
          background: #7c3aed;
        }
        .ap-seg-block.waiting {
          background: #e2e8f0;
        }

        /* STATUS PILLS */
        .ap-st-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 11px;
          border-radius: 15px;
          font-size: 12.5px;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pill::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }
        .s-menunggu {
          background: var(--ap-wait-bg);
          color: var(--ap-wait);
        }
        .s-revisi {
          background: var(--ap-rev-bg);
          color: var(--ap-rev);
        }
        .s-disetujui {
          background: var(--ap-ok-bg);
          color: var(--ap-ok);
        }
        .s-ditolak {
          background: var(--ap-no-bg);
          color: var(--ap-no);
        }

        .ap-act-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ap-detail-btn {
          height: 36px;
          padding: 0 15px;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 9px;
          border: 1px solid var(--ap-line);
          background: #ffffff;
          color: var(--ap-ink);
          box-shadow: 0 1px 2px rgba(34, 32, 31, 0.04);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ap-detail-btn:hover {
          background: var(--ap-hover);
          border-color: var(--ap-ink3);
          color: var(--ap-brand);
        }

        /* FOOTER & EMPTY */
        .ap-foot {
          padding: 14px 20px;
          color: var(--ap-ink3);
          font-size: 13px;
          border-top: 1px solid var(--ap-line);
        }
        .ap-empty {
          padding: 64px 20px;
          text-align: center;
          color: var(--ap-ink2);
        }
        .ap-empty b {
          display: block;
          color: var(--ap-ink);
          font-size: 16.5px;
          margin-bottom: 4px;
        }

        /* DRAWER & SCRIM */
        .ap-scrim {
          position: fixed;
          inset: 0;
          background: rgba(20, 16, 15, 0.45);
          opacity: 0;
          pointer-events: none;
          transition: opacity .25s ease;
          z-index: 100;
        }
        .ap-scrim.on {
          opacity: 1;
          pointer-events: auto;
        }
        .ap-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(820px, 100%);
          background: var(--ap-surface);
          z-index: 101;
          transform: translateX(104%);
          transition: transform .32s cubic-bezier(.2, .8, .2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: -15px 0 35px -10px rgba(0,0,0,.25);
        }
        .ap-drawer.on {
          transform: none;
        }
        .ap-dh {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 22px 24px 16px;
          border-bottom: 1px solid var(--ap-line);
          align-items: flex-start;
        }
        .ap-dh h2 {
          margin: 8px 0 0;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.35;
          overflow-wrap: anywhere;
          color: var(--ap-ink);
        }
        .ap-x {
          flex: none;
          width: 36px;
          height: 36px;
          border-radius: 9px;
          border: 1px solid var(--ap-line);
          background: transparent;
          font-size: 18px;
          line-height: 1;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--ap-ink2);
          transition: background .2s, border-color .2s;
        }
        .ap-x:hover {
          background: var(--ap-bg);
          border-color: var(--ap-ink3);
          color: var(--ap-ink);
        }
        .ap-db {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .ap-meta {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px 20px;
          margin: 0 0 24px;
        }
        .ap-meta dt {
          color: var(--ap-ink2);
          font-size: 13.5px;
          font-weight: 500;
        }
        .ap-meta dd {
          margin: 0;
          font-weight: 600;
          font-size: 13.5px;
          color: var(--ap-ink);
        }
        .ap-db h3 {
          margin: 0 0 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--ap-ink3);
        }

        /* TIMELINE */
        .ap-tl {
          list-style: none;
          margin: 0 0 28px;
          padding: 0;
        }
        .ap-tl li {
          position: relative;
          padding: 0 0 22px 30px;
        }
        .ap-tl li::before {
          content: "";
          position: absolute;
          left: 6px;
          top: 18px;
          bottom: -2px;
          width: 2px;
          background: var(--ap-line);
        }
        .ap-tl li:last-child::before {
          display: none;
        }
        .ap-tl li::after {
          content: "";
          position: absolute;
          left: 0;
          top: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--ap-surface);
          border: 3px solid var(--ap-line);
          box-sizing: border-box;
        }
        .ap-tl li.d::after {
          border-color: var(--ap-ok);
          background: var(--ap-ok);
        }
        .ap-tl li.c::after {
          border-color: var(--ap-wait);
          background: var(--ap-surface);
        }
        .ap-tl li.x::after {
          border-color: var(--ap-no);
          background: var(--ap-no);
        }
        .ap-tl li.r::after {
          border-color: var(--ap-rev);
          background: var(--ap-rev);
        }
        .ap-tl b {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--ap-ink);
        }
        .ap-tl span {
          font-size: 12.5px;
          color: var(--ap-ink2);
        }
        .ap-tl-meta {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ap-ink3);
        }

        /* REVISION BOX IN DRAWER */
        .ap-rev-box {
          background: var(--ap-rev-bg);
          border: 1px solid rgba(106, 79, 179, 0.25);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 24px;
        }
        .ap-rev-box b {
          display: block;
          color: var(--ap-rev);
          font-size: 13.5px;
          margin-bottom: 6px;
        }
        .ap-rev-box p {
          margin: 0;
          font-size: 13px;
          color: var(--ap-ink);
          line-height: 1.4;
        }

        /* REVISION HISTORY LIST */
        .ap-rev-history {
          margin-bottom: 24px;
        }
        .ap-rev-item {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--ap-line);
          background: var(--ap-bg);
          margin-bottom: 8px;
          font-size: 13px;
        }
        .ap-rev-item b {
          color: var(--ap-ink);
          display: block;
          margin-bottom: 2px;
        }

        /* DRAWER FOOTER */
        .ap-df {
          display: flex;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid var(--ap-line);
          background: var(--ap-surface);
          flex-wrap: wrap;
        }
        .ap-df .ap-btn {
          flex: 1;
          justify-content: center;
          min-width: 100px;
        }
        .ap-btn.ok {
          background: var(--ap-ok);
          border-color: var(--ap-ok);
          color: #fff;
        }
        .ap-btn.ok:hover {
          filter: brightness(1.08);
        }
        .ap-btn.no {
          color: var(--ap-no);
          border-color: rgba(179, 38, 30, 0.3);
        }
        .ap-btn.no:hover {
          background: var(--ap-no-bg);
          border-color: var(--ap-no);
        }
        .ap-btn.rev {
          border-color: rgba(106, 79, 179, 0.35);
          color: var(--ap-rev);
        }
        .ap-btn.rev:hover {
          background: var(--ap-rev-bg);
          border-color: var(--ap-rev);
        }

        /* MODAL STYLES */
        .ap-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: grid;
          place-items: center;
          z-index: 200;
          padding: 16px;
        }
        .ap-modal-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid var(--ap-line);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,.25);
          width: 100%;
          max-width: 460px;
          max-height: calc(100vh - 32px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: apModalIn .2s ease-out;
        }
        @keyframes apModalIn {
          from { opacity: 0; transform: scale(.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .ap-modal-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--ap-line);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .ap-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--ap-ink);
        }
        .ap-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }
        .ap-modal-footer {
          padding: 14px 20px;
          border-top: 1px solid var(--ap-line);
          background: var(--ap-hover);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        /* RESPONSIVE BREAKPOINTS */
        @media (max-width: 900px) {
          .ap-cols {
            display: none;
          }
          .ap-row {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "file st"
              "by by"
              "ap ap"
              "dt dt";
            gap: 8px 12px;
            padding: 16px 18px;
          }
          .ap-row > .ap-file { grid-area: file; }
          .ap-row > .ap-st { grid-area: st; justify-self: end; }
          .ap-row > .ap-by { grid-area: by; font-size: 13.5px; }
          .ap-row > .ap-dt { grid-area: dt; font-size: 13px; }
          .ap-row > .ap-stage { grid-area: ap; }
          .ap-row > .ap-detail-btn { display: none; }
          .ap-lbl {
            display: inline;
            color: var(--ap-ink3);
            font-size: 13px;
            margin-right: 6px;
            font-weight: 500;
          }
        }

        @media (max-width: 560px) {
          .approval-redesign-wrap {
            padding: 16px 14px 40px;
          }
          .ap-header .acts {
            width: 100%;
          }
          .ap-header .acts .ap-btn {
            flex: 1;
            justify-content: center;
          }
          .ap-tools {
            padding: 12px 14px;
          }
          .ap-search {
            max-width: none;
            order: -1;
            flex-basis: 100%;
          }
          .ap-seg {
            flex-wrap: nowrap;
            overflow-x: auto;
            margin: 0 -14px;
            padding: 0 14px;
            scrollbar-width: none;
            width: calc(100% + 28px);
          }
          .ap-chip {
            flex: none;
          }
          .ap-df .ap-btn {
            flex-basis: 100%;
          }
          .ap-drawer {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, .ap-row, .ap-drawer, .ap-scrim, .ap-chip, .ap-btn {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* HEADER */}
      <header className="ap-header">
        <div>
          <div className="mod">
            <i></i>
            MODUL PERSETUJUAN
          </div>
          <h1>Approval</h1>
          <p className="sub">{getRoleSubtitle()}</p>
        </div>
        <div className="acts">
          <HeaderMetaBoxes />
          <button
            className={`ap-btn ${refreshing ? "spin" : ""}`}
            onClick={() => loadApprovals(true)}
            disabled={refreshing || loading}
            aria-label="Segarkan data approval"
          >
            <RefreshCw size={16} />
            <span>Segarkan</span>
          </button>

          {/* Ajukan Laporan: Admin & Staff only. Approver must NOT see this button */}
          {(userRole === "admin" || userRole === "staff") && (
            <Link href="/send-report" className="ap-btn primary">
              <Plus size={16} strokeWidth={2.4} />
              <span>Ajukan Laporan</span>
            </Link>
          )}
        </div>
      </header>

      {/* 5 INTERACTIVE STATUS SUMMARY CARDS */}
      <section className="ap-cards-grid" aria-label="Ringkasan Status Approval">
        {cards.map((card) => {
          const active = isCardActive(card.id);
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`ap-stat-card ${card.accent} ${active ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(card.id);
                }
              }}
              aria-pressed={active}
              aria-label={`${card.title}: ${card.count} dokumen.`}
            >
              <div className="ap-card-top">
                <div className={`ap-card-icon ${card.accent}`}>
                  <Icon size={18} strokeWidth={2.4} />
                </div>
                <span className="ap-card-num">{card.count}</span>
              </div>
              <h3 className="ap-card-title">{card.title}</h3>
            </div>
          );
        })}
      </section>

      {/* MAIN PANEL */}
      <section className="ap-panel">
        {/* PANEL HEADER */}
        <div className="ap-panel-header">
          <div className="ap-panel-header-top">
            <h2 className="ap-panel-title">{activeCategoryTitle}</h2>
            <div className="ap-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Cari file atau pengaju"
                aria-label="Cari file atau pengaju"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ap-search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* SUBFILTER PILLS */}
          <div className="ap-subfilters-row">
            <div className="ap-seg" role="toolbar" aria-label="Subfilter status">
              {statusChips.map((chip) => (
                <button
                  key={chip.id}
                  className="ap-chip"
                  aria-pressed={statusFilter === chip.id}
                  onClick={() => {
                    setStatusFilter(chip.id);
                    setCurrentPage(1);
                  }}
                >
                  <span>{chip.label}</span>
                  <small>{chip.count}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABLE CONTAINER WITH LOCAL HORIZONTAL OVERFLOW */}
        <div className="ap-table-wrap">
          <div className="ap-table">
            {/* TABLE COLUMNS */}
            <div className="ap-cols" aria-hidden="true">
              <span>FILE LAPORAN</span>
              <span>DIAJUKAN OLEH</span>
              <span className="th-center">TANGGAL</span>
              <span>TAHAP APPROVER</span>
              <span className="th-center">STATUS</span>
              <span className="th-center">AKSI</span>
            </div>

            {/* ROWS */}
            <div className="ap-rows enter">
              {loading ? (
                <div className="ap-empty">
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                  <b>Memuat data approval...</b>
                  <span>Mengambil pengajuan laporan dari server.</span>
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="ap-empty">
                  <b>Tidak ada laporan</b>
                  <span>
                    {searchQuery
                      ? `Tidak ada hasil untuk "${searchQuery}". Coba kata kunci lain.`
                      : activeTab === "todo" || activeTab === "mine"
                      ? "Tidak ada laporan yang memerlukan tindakan persetujuan Anda saat ini."
                      : activeTab === "approved_by_me" || activeTab === "history"
                      ? "Belum ada laporan yang Anda setujui."
                      : activeTab === "waiting_my_turn"
                      ? "Tidak ada laporan yang sedang menunggu giliran persetujuan Anda."
                      : activeTab === "revision_rejected"
                      ? "Tidak ada laporan dalam status revisi atau ditolak."
                      : "Belum ada laporan pada filter ini."}
                  </span>
                </div>
              ) : (
                paginatedItems.map((r, i) => {
                  const fileType = getFileBadgeType(r.original_filename);
                  const splitDate = formatSplitDate(r.requested_at);
                  const totalApprovers = r.approvers?.length || 1;
                  const activeApprover = r.current_approver;
                  const isApproved = r.status === "APPROVED";
                  const isRejected = r.status === "REJECTED";
                  const isRevision = r.status === "REVISION_REQUIRED" || (r.status as string) === "REVISION";

                  return (
                    <div
                      key={r.id}
                      className="ap-row"
                      tabIndex={0}
                      onClick={() => handleOpenDetail(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleOpenDetail(r.id);
                        }
                      }}
                      style={{ ["--i" as any]: Math.min(i, 10) }}
                    >
                      {/* File column */}
                      <div className="ap-file">
                        <span className={`ap-ft ${fileType.className}`}>{fileType.label}</span>
                        <div className="ap-file-info">
                          <span className="ap-fn" title={r.original_filename}>{r.original_filename}</span>
                          {r.file_size_bytes ? <span className="ap-fs">{formatFileSize(r.file_size_bytes)}</span> : null}
                        </div>
                      </div>

                      {/* Requester column */}
                      <div className="ap-by">
                        {r.requester?.nama || "Tidak diketahui"}
                      </div>

                      {/* Date column (Time on row 1, Date on row 2, Centered) */}
                      <div className="ap-dt-cell">
                        <span className="ap-dt-time">{splitDate.time}</span>
                        <span className="ap-dt-date">{splitDate.date}</span>
                      </div>

                      {/* Stage approver column */}
                      <div className="ap-stage">
                        {r.status === "PENDING" && activeApprover ? (
                          <>
                            <b>{activeApprover.name}</b>
                            <span>
                              Tahap {activeApprover.sequence} dari {totalApprovers}
                            </span>
                          </>
                        ) : isApproved ? (
                          <>
                            <b>{totalApprovers} approver</b>
                            <span>Semua tahap selesai</span>
                          </>
                        ) : isRejected ? (
                          <>
                            <b>{totalApprovers} approver</b>
                            <span>Berhenti di tahap {activeApprover?.sequence || totalApprovers}</span>
                          </>
                        ) : isRevision ? (
                          <>
                            <b>{totalApprovers} approver</b>
                            <span>Kembali ke pengaju</span>
                          </>
                        ) : (
                          <>
                            <b>{totalApprovers} approver</b>
                            <span>{r.status}</span>
                          </>
                        )}

                        {/* Step segmented progress bar */}
                        <div className="ap-segmented-bar" aria-label={`Progress ${totalApprovers} tahap`}>
                          {(r.approvers || []).map((step, idx) => {
                            let segClass = "waiting";
                            if (isApproved || step.status === "APPROVED") {
                              segClass = "approved";
                            } else if (step.status === "PENDING" && r.status === "PENDING") {
                              segClass = "pending";
                            } else if (step.status === "REJECTED") {
                              segClass = "rejected";
                            } else if (step.status === "REVISION" || (step.status as string) === "REVISION_REQUIRED") {
                              segClass = "revision";
                            }
                            return <div key={idx} className={`ap-seg-block ${segClass}`} />;
                          })}
                        </div>
                      </div>

                      {/* Status column (Single clean badge, Centered) */}
                      <div className="ap-st-cell">{renderApprovalRowStatus(r)}</div>

                      {/* Action button (Eye icon + Lihat detail, Centered) */}
                      <div className="ap-act-cell">
                        <button
                          type="button"
                          className="ap-btn ap-detail-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(r.id);
                          }}
                        >
                          <Eye size={14} />
                          <span>Lihat detail</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="ap-pagination">
            <div className="ap-page-info">
              Halaman {currentPage} dari {totalPages} ({displayedItems.length} laporan)
            </div>
            <div className="ap-page-btns">
              <button
                type="button"
                className="ap-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                  if (Math.abs(p - currentPage) === 3) {
                    return (
                      <span key={p} style={{ padding: "0 4px", color: "var(--ap-ink3)" }}>
                        ...
                      </span>
                    );
                  }
                  return null;
                }
                return (
                  <button
                    key={p}
                    type="button"
                    className={`ap-page-btn ${currentPage === p ? "active" : ""}`}
                    onClick={() => setCurrentPage(p)}
                    aria-label={`Ke halaman ${p}`}
                    aria-current={currentPage === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                className="ap-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Halaman berikutnya"
              >
                <span>Selanjutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* RESULT FOOTER */}
        <div className="ap-foot">
          Menampilkan {displayedItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{" "}
          {Math.min(displayedItems.length, currentPage * pageSize)} dari {displayedItems.length} laporan
          {rawItems.length !== displayedItems.length ? ` (Total ${rawItems.length} dokumen)` : ""}
        </div>
      </section>

      {/* SCRIM BACKDROP */}
      <div
        className={`ap-scrim ${isDrawerOpen ? "on" : ""}`}
        onClick={handleCloseDrawer}
        aria-hidden="true"
      />

      {/* RIGHT-SIDE DETAIL DRAWER */}
      <aside
        className={`ap-drawer ${isDrawerOpen ? "on" : ""}`}
        aria-hidden={!isDrawerOpen}
        aria-label="Detail pengajuan approval"
      >
        {selectedItem && (
          <>
            {/* Drawer Header */}
            <div className="ap-dh">
              <div>
                <div style={{ marginBottom: 6 }}>
                  {renderStatusPill(selectedItem.status, selectedItem.my_step?.status)}
                </div>
                <h2>{selectedItem.original_filename}</h2>
              </div>
              <button className="ap-x" onClick={handleCloseDrawer} aria-label="Tutup detail">
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="ap-db">
              {loadingDetail && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--ap-ink2)", fontSize: 13 }}>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  <span>Memperbarui data lengkap...</span>
                </div>
              )}

              {/* QR GENERATION FAILURE ALERT */}
              {failedArtifact && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
                    color: "#991b1b",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} />
                    <span>Approval berhasil, tetapi dokumen bertanda QR gagal dibuat.</span>
                  </div>
                  {failedArtifact.generation_error && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", wordBreak: "break-word" }}>
                      Detail kesalahan: {failedArtifact.generation_error}
                    </p>
                  )}
                </div>
              )}

              {/* Metadata */}
              <dl className="ap-meta">
                <dt>File Asli (File Laporan Terlampir)</dt>
                <dd style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>{formatFileSize(selectedItem.file_size_bytes)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(selectedItem, {
                        type: "original",
                        fallbackFilename: `original-${selectedItem.original_filename}`,
                        downloadKey: "original",
                      })
                    }
                    disabled={downloadingKey !== null}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: downloadingKey === "original" ? "var(--ap-muted)" : "var(--ap-brand)",
                      background: "none",
                      border: "none",
                      cursor: downloadingKey !== null ? "not-allowed" : "pointer",
                      padding: 0,
                      opacity: downloadingKey !== null && downloadingKey !== "original" ? 0.6 : 1,
                    }}
                  >
                    {downloadingKey === "original" ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Mengunduh...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>Unduh File Asli</span>
                      </>
                    )}
                  </button>
                </dd>

                {latestReadyArtifact ? (
                  <>
                    <dt>
                      {selectedItem.status === "APPROVED"
                        ? "Dokumen Approved"
                        : "File Approval Terbaru"}
                    </dt>
                    <dd style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--ap-ink2)" }}>
                        {selectedItem.status === "APPROVED"
                          ? "Semua tanda tangan QR terpasang"
                          : `Tahap ${latestReadyArtifact.stage_sequence ?? latestReadyArtifact.sequence} (${latestReadyArtifact.artifact_type || latestReadyArtifact.stage})`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadFile(selectedItem, {
                            type: "latest",
                            artifactId: latestReadyArtifact.id,
                            fallbackFilename: `approved-${selectedItem.original_filename}`,
                            downloadKey: "latest",
                          })
                        }
                        disabled={downloadingKey !== null}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: downloadingKey === "latest" ? "var(--ap-muted)" : "#16a34a",
                          background: "none",
                          border: "none",
                          cursor: downloadingKey !== null ? "not-allowed" : "pointer",
                          padding: 0,
                          opacity: downloadingKey !== null && downloadingKey !== "latest" ? 0.6 : 1,
                        }}
                      >
                        {downloadingKey === "latest" ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Mengunduh...</span>
                          </>
                        ) : (
                          <>
                            <Download size={13} />
                            <span>Unduh File Approval</span>
                          </>
                        )}
                      </button>
                    </dd>

                    <dt>Versi Approval</dt>
                    <dd>
                      {selectedItem.status === "APPROVED"
                        ? `Selesai (${latestReadyArtifact.stage_sequence ?? latestReadyArtifact.sequence} dari ${totalApprovers})`
                        : `Tahap ${latestReadyArtifact.stage_sequence ?? latestReadyArtifact.sequence} dari ${totalApprovers}`}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>File Approval Terbaru</dt>
                    <dd style={{ fontSize: 12, color: "var(--ap-ink2)" }}>
                      {selectedItem.status === "PENDING"
                        ? "Belum ada tanda tangan QR (Menunggu persetujuan tahap 1)"
                        : "Dokumen belum memiliki arsip QR (Pengajuan sebelum fitur QR)"}
                    </dd>
                  </>
                )}

                <dt>Diajukan Oleh</dt>
                <dd>{selectedItem.requester?.nama || "Tidak diketahui"}</dd>

                <dt>Tanggal Pengajuan</dt>
                <dd>{formatDate(selectedItem.requested_at)}</dd>

                <dt>Format</dt>
                <dd>{getFileExtension(selectedItem.original_filename).replace(".", "").toUpperCase() || "LAPORAN"}</dd>

                <dt>Catatan Pengaju</dt>
                <dd>{selectedItem.note ? selectedItem.note : "Tidak ada catatan"}</dd>
              </dl>

              {/* PREVIEW LAPORAN SECTION (Section 2, 7, 8, 10, 11) */}
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid var(--ap-line, #e2e8f0)",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <FileSpreadsheet size={16} style={{ color: "var(--ap-brand, #b3212f)" }} />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--ap-ink, #0f172a)",
                      }}
                    >
                      PREVIEW LAPORAN
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(selectedItem, {
                        type: "original",
                        fallbackFilename: `original-${selectedItem.original_filename}`,
                        downloadKey: "original",
                      })
                    }
                    disabled={downloadingKey !== null}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: downloadingKey === "original" ? "var(--ap-muted)" : "var(--ap-brand)",
                      background: "none",
                      border: "none",
                      cursor: downloadingKey !== null ? "not-allowed" : "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    <Download size={12} />
                    <span>Unduh File Asli</span>
                  </button>
                </div>

                <ReportPreview
                  approvalId={selectedItem.id}
                  filename={selectedItem.original_filename}
                  mimeType={selectedItem.mime_type}
                  status={selectedItem.status}
                  activeArtifactId={latestReadyArtifact?.id}
                  deliveryType={selectedItem.delivery_type}
                  onDownloadOriginal={() =>
                    handleDownloadFile(selectedItem, {
                      type: "original",
                      fallbackFilename: `original-${selectedItem.original_filename}`,
                      downloadKey: "original",
                    })
                  }
                  isDownloadingOriginal={downloadingKey === "original"}
                />
              </div>

              {/* REVISION ALERT (if status is REVISION_REQUIRED) */}
              {(selectedItem.status === "REVISION_REQUIRED" || (selectedItem.status as string) === "REVISION") && (
                <div className="ap-rev-box">
                  <b>Pengajuan Memerlukan Revisi Laporan</b>
                  {selectedItem.revision_info ? (
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 2 }}>
                        Diminta oleh {selectedItem.revision_info.approver_name}
                        {selectedItem.revision_info.approver_position ? ` (${selectedItem.revision_info.approver_position})` : ""}:
                      </p>
                      <p style={{ fontStyle: "italic", background: "#fff", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(106,79,179,0.2)" }}>
                        &ldquo;{selectedItem.revision_info.revision_comment}&rdquo;
                      </p>
                      {selectedItem.revision_info.reviewed_at && (
                        <span style={{ fontSize: 11.5, color: "var(--ap-ink2)", display: "block", marginTop: 4 }}>
                          Waktu: {formatDate(selectedItem.revision_info.reviewed_at)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p>Laporan ini dikembalikan oleh approver untuk diperbaiki oleh pengaju.</p>
                  )}
                </div>
              )}

              {/* APPROVAL TIMELINE */}
              <h3>PROGRESS APPROVAL BERJENJANG</h3>
              <ol className="ap-tl">
                {(selectedItem.approvers || []).map((step, idx) => {
                  let liClass = "";
                  let statusText = "Menunggu Giliran";

                  if (step.status === "APPROVED") {
                    liClass = "d";
                    statusText = "Disetujui";
                  } else if (step.status === "PENDING") {
                    liClass = "c";
                    statusText = "Sedang ditinjau";
                  } else if (step.status === "REJECTED") {
                    liClass = "x";
                    statusText = "Ditolak";
                  } else if (step.status === "REVISION") {
                    liClass = "r";
                    statusText = "Diminta revisi";
                  }

                  return (
                    <li key={idx} className={liClass}>
                      <b>
                        {step.name}
                        {step.position ? ` · ${step.position}` : ""}
                      </b>
                      <span>
                        Tahap {step.sequence} · {statusText}
                      </span>
                      {step.reviewed_at && (
                        <div className="ap-tl-meta">
                          Diproses: {formatDate(step.reviewed_at)}
                        </div>
                      )}
                      {step.rejection_reason && (
                        <div style={{ marginTop: 4, color: "var(--ap-no)", fontSize: 12, background: "var(--ap-no-bg)", padding: "4px 8px", borderRadius: 4 }}>
                          Alasan penolakan: {step.rejection_reason}
                        </div>
                      )}
                      {step.revision_comment && (
                        <div style={{ marginTop: 4, color: "var(--ap-rev)", fontSize: 12, background: "var(--ap-rev-bg)", padding: "4px 8px", borderRadius: 4 }}>
                          Komentar revisi: {step.revision_comment}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* REVISION HISTORY (if multiple versions exist) */}
              {selectedItem.revisions && selectedItem.revisions.length > 0 && (
                <div className="ap-rev-history">
                  <h3>RIWAYAT REVISI FILE</h3>
                  {selectedItem.revisions.map((rev) => (
                    <div key={rev.id} className="ap-rev-item">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <b>Versi {rev.revision_number}: {rev.original_filename}</b>
                          <span style={{ fontSize: 11.5, color: "var(--ap-ink2)" }}>
                            Diunggah oleh {rev.submitted_by_name || "Pengaju"} · {formatDate(rev.submitted_at)} ({formatFileSize(rev.file_size_bytes)})
                          </span>
                          {rev.note && (
                            <p style={{ margin: "4px 0 0", fontStyle: "italic", fontSize: 12 }}>
                              Catatan: {rev.note}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(selectedItem, rev.revision_number, rev.original_filename)}
                          disabled={downloadingKey !== null}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            color: downloadingKey === `rev-${rev.revision_number}` ? "var(--ap-muted)" : "var(--ap-brand)",
                            background: "none",
                            border: "none",
                            cursor: downloadingKey !== null ? "not-allowed" : "pointer",
                            padding: "2px 6px",
                            opacity: downloadingKey !== null && downloadingKey !== `rev-${rev.revision_number}` ? 0.6 : 1,
                          }}
                        >
                          {downloadingKey === `rev-${rev.revision_number}` ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Mengunduh...</span>
                            </>
                          ) : (
                            <>
                              <Download size={12} />
                              <span>Unduh</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STICKY DRAWER FOOTER */}
            <div className="ap-df">
              {/* Approver Decision Controls: ONLY if user is approver AND can_review is true AND status is PENDING */}
              {userRole === "approver" && selectedItem.can_review && selectedItem.status === "PENDING" ? (
                <>
                  <button
                    type="button"
                    className="ap-btn ok"
                    onClick={() => setIsApproveModalOpen(true)}
                  >
                    <Check size={16} />
                    <span>Setujui</span>
                  </button>
                  <button
                    type="button"
                    className="ap-btn rev"
                    onClick={() => setIsRevisionModalOpen(true)}
                  >
                    <RotateCcw size={15} />
                    <span>Revisi</span>
                  </button>
                  <button
                    type="button"
                    className="ap-btn no"
                    onClick={() => setIsRejectModalOpen(true)}
                  >
                    <XCircle size={15} />
                    <span>Tolak</span>
                  </button>
                </>
              ) : userRole === "staff" &&
                selectedItem.is_requester &&
                (selectedItem.status === "REVISION_REQUIRED" || (selectedItem.status as string) === "REVISION") ? (
                <>
                  <button
                    type="button"
                    className="ap-btn primary"
                    onClick={() => setIsRevisionUploadModalOpen(true)}
                  >
                    <Upload size={16} />
                    <span>Kirim Revisi Laporan</span>
                  </button>
                  <button type="button" className="ap-btn" onClick={handleCloseDrawer}>
                    Tutup
                  </button>
                </>
              ) : (
                <button type="button" className="ap-btn" onClick={handleCloseDrawer}>
                  Tutup
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      {/* MODAL 1: SETUJUI CONFIRMATION */}
      {isApproveModalOpen && selectedItem && (
        <div className="ap-modal-overlay" onClick={() => setIsApproveModalOpen(false)}>
          <div className="ap-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h3>Konfirmasi Persetujuan Laporan</h3>
              <button
                className="ap-x"
                style={{ width: 28, height: 28 }}
                onClick={() => setIsApproveModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="ap-modal-body">
              <p style={{ margin: "0 0 12px", fontSize: 14.5, fontWeight: 600, color: "var(--ap-ink)" }}>
                Setujui laporan ini?
              </p>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ap-ink2)", lineHeight: 1.5 }}>
                {selectedItem.current_approver && selectedItem.current_approver.sequence < (selectedItem.approvers?.length || 1)
                  ? "Setelah disetujui, laporan akan diteruskan ke approver berikutnya dalam urutan persetujuan."
                  : "Anda adalah approver terakhir. Setelah disetujui, status laporan akan berubah menjadi DISETUJUI dan seluruh rangkaian persetujuan selesai."}
              </p>
            </div>
            <div className="ap-modal-footer">
              <button
                type="button"
                className="ap-btn"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isApproving}
              >
                Batal
              </button>
              <button
                type="button"
                className="ap-btn ok"
                onClick={handleConfirmApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <>
                    <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                    <span>Menyetujui...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Setujui</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TOLAK CONFIRMATION */}
      {isRejectModalOpen && selectedItem && (
        <div className="ap-modal-overlay" onClick={() => setIsRejectModalOpen(false)}>
          <div className="ap-modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleConfirmReject}>
              <div className="ap-modal-header">
                <h3>Alasan Penolakan</h3>
                <button
                  type="button"
                  className="ap-x"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setIsRejectModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="ap-modal-body">
                <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ap-ink2)" }}>
                  Pengajuan laporan akan ditolak secara permanen. Mohon cantumkan alasan penolakan yang jelas.
                </p>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Alasan Penolakan <span style={{ color: "var(--ap-no)" }}>*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  rows={4}
                  placeholder="Contoh: Lampiran laporan mingguan tidak lengkap..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${rejectError ? "var(--ap-no)" : "var(--ap-line)"}`,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {rejectError && (
                  <span style={{ display: "block", color: "var(--ap-no)", fontSize: 12, marginTop: 4 }}>
                    {rejectError}
                  </span>
                )}
              </div>
              <div className="ap-modal-footer">
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isRejecting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ap-btn primary"
                  style={{ background: "var(--ap-no)", borderColor: "var(--ap-no)" }}
                  disabled={isRejecting}
                >
                  {isRejecting ? (
                    <>
                      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Menolak...</span>
                    </>
                  ) : (
                    <span>Tolak Laporan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MINTA REVISI CONFIRMATION */}
      {isRevisionModalOpen && selectedItem && (
        <div className="ap-modal-overlay" onClick={() => setIsRevisionModalOpen(false)}>
          <div className="ap-modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleConfirmRevisionRequest}>
              <div className="ap-modal-header">
                <h3>Permintaan Revisi Laporan</h3>
                <button
                  type="button"
                  className="ap-x"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setIsRevisionModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="ap-modal-body">
                <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ap-ink2)" }}>
                  Laporan akan dikembalikan kepada pengaju untuk diperbaiki. Mohon tuliskan instruksi revisi secara spesifik.
                </p>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Komentar Revisi <span style={{ color: "var(--ap-no)" }}>*</span>
                </label>
                <textarea
                  value={revisionComment}
                  onChange={(e) => {
                    setRevisionComment(e.target.value);
                    if (revisionError) setRevisionError(null);
                  }}
                  rows={4}
                  placeholder="Contoh: Angka total kuartal 3 perlu diperiksa ulang."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${revisionError ? "var(--ap-no)" : "var(--ap-line)"}`,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {revisionError && (
                  <span style={{ display: "block", color: "var(--ap-no)", fontSize: 12, marginTop: 4 }}>
                    {revisionError}
                  </span>
                )}
              </div>
              <div className="ap-modal-footer">
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => setIsRevisionModalOpen(false)}
                  disabled={isSubmittingRevisionRequest}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ap-btn primary"
                  style={{ background: "var(--ap-rev)", borderColor: "var(--ap-rev)" }}
                  disabled={isSubmittingRevisionRequest}
                >
                  {isSubmittingRevisionRequest ? (
                    <>
                      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Kirim Permintaan Revisi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPLOAD FILE REVISI (Staff / Requester) */}
      {isRevisionUploadModalOpen && selectedItem && (
        <div className="ap-modal-overlay" onClick={() => setIsRevisionUploadModalOpen(false)}>
          <div className="ap-modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitRevisedFile}>
              <div className="ap-modal-header">
                <h3>Upload File Revisi</h3>
                <button
                  type="button"
                  className="ap-x"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setIsRevisionUploadModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="ap-modal-body">
                <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ap-ink2)" }}>
                  Unggah file laporan yang sudah diperbaiki. Alur approval akan dimulai kembali dari approver tahap pertama.
                </p>

                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  File Revisi (.xlsx, .pdf, .docx, .zip) <span style={{ color: "var(--ap-no)" }}>*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setRevisionFile(e.target.files[0]);
                      if (revisionUploadError) setRevisionUploadError(null);
                    }
                  }}
                  accept=".xlsx,.xls,.pdf,.docx,.doc,.zip,.csv"
                  style={{
                    display: "block",
                    width: "100%",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                />

                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Catatan Revisi (Opsional)
                </label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan keterangan perbaikan yang telah dilakukan..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--ap-line)",
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                {revisionUploadError && (
                  <span style={{ display: "block", color: "var(--ap-no)", fontSize: 12, marginTop: 6 }}>
                    {revisionUploadError}
                  </span>
                )}
              </div>
              <div className="ap-modal-footer">
                <button
                  type="button"
                  className="ap-btn"
                  onClick={() => setIsRevisionUploadModalOpen(false)}
                  disabled={isSubmittingRevision}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ap-btn primary"
                  disabled={isSubmittingRevision}
                >
                  {isSubmittingRevision ? (
                    <>
                      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <span>Kirim Revisi Laporan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApprovalPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "var(--ap-ink2, #64748b)" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--ap-brand, #b3212f)" }} />
        </div>
      }
    >
      <ApprovalPageContent />
    </Suspense>
  );
}
