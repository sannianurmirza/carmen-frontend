"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Check,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  InAppNotification,
  getNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";

function formatFullTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "APPROVAL_REQUEST":
    case "REVISION_RESUBMITTED":
      return <FileCheck2 size={18} className="text-amber-600" aria-hidden="true" />;
    case "APPROVAL_PASSED":
      return <CheckCircle2 size={18} className="text-blue-600" aria-hidden="true" />;
    case "APPROVAL_FINAL":
      return <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />;
    case "REVISION_REQUIRED":
      return <AlertTriangle size={18} className="text-amber-500" aria-hidden="true" />;
    case "REJECTED":
      return <XCircle size={18} className="text-rose-600" aria-hidden="true" />;
    case "REPORT_DISTRIBUTION":
      return <FileSpreadsheet size={18} className="text-slate-600" aria-hidden="true" />;
    default:
      return <Bell size={18} className="text-slate-500" aria-hidden="true" />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNotificationsApi({
        status: activeTab,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setUnreadTotal(res.unread_count || 0);
      refreshUnreadCount();
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, refreshUnreadCount]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleTabChange = (tab: "all" | "unread" | "read") => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleItemClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      try {
        await markNotificationReadApi(notif.id);
        setItems((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        refreshUnreadCount();
      } catch {}
    }
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsReadApi();
      fetchList();
    } catch {}
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="carmen-notif-page-container">
      {/* Header bar */}
      <div className="carmen-notif-page-header">
        <div className="carmen-notif-page-header-left">
          <button
            type="button"
            onClick={() => router.back()}
            className="carmen-notif-back-btn"
            title="Kembali"
            aria-label="Kembali ke halaman sebelumnya"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <h1 className="carmen-notif-page-title">Pemberitahuan & Notifikasi</h1>
            <p className="carmen-notif-page-desc">
              Pusat notifikasi aktivitas laporan, approval, dan distribusi internal CARMEN.
            </p>
          </div>
        </div>

        {unreadTotal > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="carmen-notif-page-markall-btn"
          >
            <Check size={16} aria-hidden="true" />
            <span>Tandai Semua Dibaca</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="carmen-notif-page-tabs">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`carmen-notif-tab ${activeTab === "all" ? "active" : ""}`}
        >
          Semua
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("unread")}
          className={`carmen-notif-tab ${activeTab === "unread" ? "active" : ""}`}
        >
          Belum Dibaca {unreadTotal > 0 && <span className="carmen-notif-tab-badge">{unreadTotal}</span>}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("read")}
          className={`carmen-notif-tab ${activeTab === "read" ? "active" : ""}`}
        >
          Sudah Dibaca
        </button>
      </div>

      {/* Main List */}
      <div className="carmen-notif-page-card">
        {isLoading ? (
          <div className="carmen-notif-page-loading">
            Memuat daftar notifikasi...
          </div>
        ) : items.length === 0 ? (
          <div className="carmen-notif-page-empty">
            <Bell size={32} className="carmen-notif-empty-icon" />
            <p className="carmen-notif-empty-title">Tidak ada notifikasi.</p>
            <p className="carmen-notif-empty-subtitle">
              {activeTab === "unread"
                ? "Seluruh notifikasi telah Anda baca."
                : "Belum ada riwayat aktivitas yang tercatat."}
            </p>
          </div>
        ) : (
          <div className="carmen-notif-page-list">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`carmen-notif-full-row ${!item.is_read ? "unread" : ""}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleItemClick(item);
                  }
                }}
              >
                <div className="carmen-notif-full-icon">
                  {getNotificationIcon(item.notification_type)}
                </div>
                <div className="carmen-notif-full-body">
                  <div className="carmen-notif-full-header">
                    <span className="carmen-notif-full-title">
                      {item.title}
                    </span>
                    <span className="carmen-notif-full-date">
                      {formatFullTime(item.created_at)}
                    </span>
                  </div>
                  <p className="carmen-notif-full-msg">{item.message}</p>
                </div>
                {!item.is_read && (
                  <span className="carmen-notif-unread-dot" title="Belum dibaca" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="carmen-notif-pagination">
            <span className="carmen-notif-pagination-info">
              Halaman {page} dari {totalPages} ({total} total)
            </span>
            <div className="carmen-notif-pagination-controls">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="carmen-notif-page-btn"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="carmen-notif-page-btn"
                title="Halaman Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
