"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Check,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { InAppNotification } from "../lib/api";

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "APPROVAL_REQUEST":
    case "REVISION_RESUBMITTED":
      return <FileCheck2 size={16} className="text-amber-600" aria-hidden="true" />;
    case "APPROVAL_PASSED":
      return <CheckCircle2 size={16} className="text-blue-600" aria-hidden="true" />;
    case "APPROVAL_FINAL":
      return <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />;
    case "REVISION_REQUIRED":
      return <AlertTriangle size={16} className="text-amber-500" aria-hidden="true" />;
    case "REJECTED":
      return <XCircle size={16} className="text-rose-600" aria-hidden="true" />;
    case "REPORT_DISTRIBUTION":
      return <FileSpreadsheet size={16} className="text-slate-600" aria-hidden="true" />;
    default:
      return <Bell size={16} className="text-slate-500" aria-hidden="true" />;
  }
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    onClose();
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="carmen-notif-dropdown"
      role="region"
      aria-label="Pemberitahuan Notifikasi"
    >
      {/* Header */}
      <div className="carmen-notif-header">
        <div>
          <h3 className="carmen-notif-title">Notifikasi</h3>
          <p className="carmen-notif-sub">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="carmen-notif-markall-btn"
            title="Tandai semua dibaca"
          >
            <Check size={14} aria-hidden="true" />
            <span>Tandai dibaca</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="carmen-notif-body">
        {isLoading && notifications.length === 0 ? (
          <div className="carmen-notif-loading">
            <Loader2 size={18} className="animate-spin text-slate-400" />
            <span>Memuat notifikasi...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="carmen-notif-empty">
            <Bell size={24} className="text-slate-300 mb-1" />
            <p className="font-medium text-slate-600 text-sm">Belum ada notifikasi.</p>
            <p className="text-xs text-slate-400 mt-0.5">Aktivitas dan pembaruan akan muncul di sini.</p>
          </div>
        ) : (
          <ul className="carmen-notif-list">
            {notifications.slice(0, 7).map((item) => (
              <li key={item.id} className="carmen-notif-item-wrapper">
                <button
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`carmen-notif-item ${!item.is_read ? "unread" : ""}`}
                >
                  <div className="carmen-notif-item-icon">
                    {getNotificationIcon(item.notification_type)}
                  </div>
                  <div className="carmen-notif-item-content">
                    <div className="carmen-notif-item-top">
                      <span className="carmen-notif-item-title">{item.title}</span>
                      <span className="carmen-notif-item-time">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="carmen-notif-item-msg">{item.message}</p>
                  </div>
                  {!item.is_read && <span className="carmen-notif-unread-dot" aria-label="Belum dibaca" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="carmen-notif-footer">
        <Link
          href="/notifications"
          onClick={onClose}
          className="carmen-notif-viewall-link"
        >
          <span>Lihat semua notifikasi</span>
          <ExternalLink size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
