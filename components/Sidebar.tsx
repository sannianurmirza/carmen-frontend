"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Store,
  Utensils,
  ClipboardCheck,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Send,
  X,
  ChevronsLeft,
  ChevronsRight,
  Users,
  UserRound,
  LogOut,
  AlertCircle,
  Clock,
  MessageSquareWarning,
  FileSpreadsheet,
  Sparkles,
  ReceiptText,
  Settings,
  FileCheck2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getPublicUrl, getPendingApprovalCount } from "@/lib/api";
import { getNavigationForUser, NavGroup } from "@/lib/permissions";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "catering_sidebar_collapsed";

export default function Sidebar({
  isOpen = false,
  onClose,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        setInternalCollapsed(stored === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const [pendingApprovalCount, setPendingApprovalCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const loadPendingCount = async () => {
      try {
        const res = await getPendingApprovalCount();
        if (isMounted && typeof res.pending_count === "number") {
          setPendingApprovalCount(res.pending_count);
        }
      } catch {
        // Abaikan kegagalan jaringan di background
      }
    };
    loadPendingCount();
    const handleApprovalUpdated = () => {
      loadPendingCount();
    };
    window.addEventListener("cms-approval-updated", handleApprovalUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener("cms-approval-updated", handleApprovalUpdated);
    };
  }, []);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [logoutModalClosing, setLogoutModalClosing] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const logoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelLogoutBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmLogoutBtnRef = useRef<HTMLButtonElement | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return "AI";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleCloseLogoutModal = useCallback(() => {
    if (isLoggingOut) return;
    setLogoutModalClosing(true);
    setTimeout(() => {
      setShowLogoutModal(false);
      setLogoutModalClosing(false);
      setLogoutError(null);
      logoutTriggerRef.current?.focus();
    }, 180);
  }, [isLoggingOut]);

  // Focus trap & initial focus pada tombol Batal saat modal logout aktif
  useEffect(() => {
    if (showLogoutModal && !logoutModalClosing) {
      const timer = setTimeout(() => {
        cancelLogoutBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (!isLoggingOut) {
            handleCloseLogoutModal();
          }
        } else if (e.key === "Tab") {
          const focusable = [cancelLogoutBtnRef.current, confirmLogoutBtnRef.current].filter(Boolean) as HTMLElement[];
          if (focusable.length === 0) return;

          const firstEl = focusable[0];
          const lastEl = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showLogoutModal, logoutModalClosing, isLoggingOut, handleCloseLogoutModal]);

  const handleOpenLogoutModal = () => {
    setLogoutError(null);
    setLogoutModalClosing(false);
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setShowLogoutModal(false);
      router.replace("/login");
    } catch {
      setLogoutError("Gagal keluar dari sistem. Silakan coba kembali.");
      setIsLoggingOut(false);
    }
  };

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/rencana-menu") return pathname.startsWith("/rencana-menu");
    if (href === "/approval") return pathname.startsWith("/approval");
    if (href === "/daftar-katering") return pathname.startsWith("/daftar-katering");
    if (href === "/kalori-harian") return pathname.startsWith("/kalori-harian");
    if (href === "/minus") return pathname.startsWith("/minus");
    if (href === "/kelayakan") return pathname.startsWith("/kelayakan");
    if (href === "/komplain") return pathname.startsWith("/komplain");
    if (href === "/audit") return pathname.startsWith("/audit");
    if (href === "/kebersihan") return pathname.startsWith("/kebersihan");
    if (href === "/order-catering") return pathname.startsWith("/order-catering");
    if (href === "/performance") return pathname === "/performance";
    if (href === "/laporan-punishment") return pathname.startsWith("/laporan-punishment");
    if (href === "/reward-punishment") return pathname.startsWith("/reward-punishment");
    if (href === "/send-report") return pathname === "/send-report";
    if (href === "/management/kalori") return pathname === "/management/kalori";
    if (href === "/management/punishment") return pathname === "/management/punishment";
    if (href === "/management/performance") return pathname === "/management/performance";
    if (href === "/management/reward-punishment") return pathname === "/management/reward-punishment";
    if (href === "/pengaturan" || href === "/pengaturan/akun") return pathname.startsWith("/pengaturan");
    return pathname === href;
  };

  // Canonical navigation schema:
  // LAPORAN: { href: "/approval", label: "Approval", icon: FileCheck2 }
  const navGroups: NavGroup[] = getNavigationForUser(user, pendingApprovalCount);


  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`sidebar ${isOpen ? "open" : ""} ${
          collapsed ? "sidebar-collapsed" : ""
        }`}
        style={{
          width: collapsed ? 72 : 240,
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Top Header Logo Area: Button Top -> Logo -> Subtitle -> Border */}
        <div
          className="sidebar-header"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            padding: collapsed ? "10px 8px 10px" : "10px 14px 12px",
            flexShrink: 0,
            borderBottom: "1px solid var(--border)",
            boxSizing: "border-box",
          }}
        >
          {collapsed ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: "100%",
              }}
            >
              <button
                type="button"
                className="theme-toggle-btn desktop-only-btn"
                onClick={toggleCollapse}
                title="Expand Sidebar"
                aria-label="Expand Sidebar"
                style={{
                  width: 26,
                  height: 26,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                }}
              >
                <ChevronsRight size={16} />
              </button>
              <img
                src={getPublicUrl("/image/yazaki-jai-logo.png")}
                alt="YAZAKI"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = "true";
                    target.src = getPublicUrl("/yazaki-jai-logo.png");
                  }
                }}
                style={{
                  width: 52,
                  height: 30,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              {/* 1. TOP ROW: Collapse Toggle & Mobile Close (Aligned Right) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  width: "100%",
                  marginBottom: 6,
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  className="theme-toggle-btn desktop-only-btn"
                  onClick={toggleCollapse}
                  title="Collapse Sidebar"
                  aria-label="Collapse Sidebar"
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    borderRadius: 4,
                  }}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  className="sidebar-close-btn"
                  onClick={onClose}
                  aria-label="Close menu"
                  style={{ width: 26, height: 26 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* 2. MIDDLE ROW: YAZAKI Logo Image (100% Centered, ~17% Larger) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "0 2px",
                }}
              >
                <div className="sidebar-brand-wrapper">
                  <img
                    src={getPublicUrl("/image/yazaki-jai-logo.png")}
                    alt="YAZAKI PT. JATIM AUTOCOMP INDONESIA"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.triedFallback) {
                        target.dataset.triedFallback = "true";
                        target.src = getPublicUrl("/yazaki-jai-logo.png");
                      }
                    }}
                    style={{
                      height: 48,
                      maxWidth: 212,
                      width: "auto",
                      objectFit: "contain",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                </div>
              </div>

              {/* 3. BOTTOM ROW: Subtitle CARMEN (100% Centered) */}
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                {user?.role === "approver" ? "CARMEN — Management" : "CARMEN"}
              </span>
            </div>
          )}
        </div>

        {/* Compact Scrollable Navigation Area */}
        <nav
          className="sidebar-nav"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: collapsed ? "16px 8px 12px" : "26px 12px 14px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {navGroups.map((group) => (
            <div
              key={group.groupName}
              style={{ marginBottom: collapsed ? 12 : 14 }}
            >
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    color: "var(--text-muted)",
                    padding: "0 12px 4px",
                    textTransform: "uppercase",
                  }}
                >
                  {group.groupName}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: collapsed ? "8px 0" : "8px 12px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      borderRadius: "6px",
                      marginBottom: 2,
                      boxSizing: "border-box",
                      textDecoration: "none",
                      position: "relative",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} style={{ flexShrink: 0 }} />
                    {!collapsed && (
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 600,
                          letterSpacing: "0.01em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 9999,
                          backgroundColor: active ? "#ffffff" : "var(--primary)",
                          color: active ? "var(--primary)" : "#ffffff",
                          marginLeft: "auto",
                          flexShrink: 0,
                          lineHeight: "14px",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 8,
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: "var(--primary)",
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Profile */}
        <div
          className="sidebar-profile"
          style={{
            flexShrink: 0,
            padding: collapsed ? "12px 8px" : "12px 14px",
            borderTop: "1px solid var(--border)",
            background: "var(--sidebar-bg)",
          }}
        >
          {!collapsed ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                gap: 8,
              }}
            >
              {/* Avatar + Nama dan Role */}
              <Link
                href="/pengaturan/akun"
                onClick={onClose}
                title="Buka Pengaturan Akun"
                aria-label="Buka Pengaturan Akun"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  flex: 1,
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 6,
                  padding: "4px 6px",
                  margin: "-4px -6px",
                  transition: "background 0.15s ease",
                  cursor: "pointer",
                }}
                className="profile-link-btn"
              >
                <div
                  className="avatar"
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 12.5,
                    fontWeight: 700,
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                  title={user?.nama || "Pengguna"}
                >
                  {getInitials(user?.nama)}
                </div>
                <div
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    minWidth: 0,
                  }}
                >
                  <p
                    className="profile-name"
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "var(--text, #0f172a)",
                    }}
                    title={user?.nama || "Pengguna"}
                  >
                    {user?.nama || "Pengguna"}
                  </p>
                  <p
                    className="profile-role"
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted, #64748b)",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user?.role === "admin"
                      ? "ADMINISTRATOR"
                      : user?.role === "approver"
                      ? "SPV / APPROVER"
                      : "STAFF OPERASIONAL"}
                  </p>
                </div>
              </Link>

              {/* Tombol Logout Sederhana Icon-Only */}
              <button
                ref={logoutTriggerRef}
                type="button"
                onClick={handleOpenLogoutModal}
                aria-label="Keluar dari sistem"
                title="Keluar"
                className="sidebar-logout-btn"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: "100%",
              }}
            >
              <Link
                href="/pengaturan/akun"
                onClick={onClose}
                title={`Pengaturan Akun: ${user?.nama || "Pengguna"}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="avatar"
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 12.5,
                    fontWeight: 700,
                    backgroundColor: "#8f1a25",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                  title={user?.nama || "Pengguna"}
                >
                  {getInitials(user?.nama)}
                </div>
              </Link>
              <button
                ref={logoutTriggerRef}
                type="button"
                onClick={handleOpenLogoutModal}
                aria-label="Keluar dari sistem"
                title="Keluar"
                className="sidebar-logout-btn collapsed"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Modal Konfirmasi Logout Formal PT JAI */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-desc"
          className={`corp-modal-backdrop ${logoutModalClosing ? "closing" : ""}`}
          onClick={handleCloseLogoutModal}
        >
          <div
            className={`corp-modal-dialog ${logoutModalClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 430, padding: 24 }}
          >
            {/* Ikon Logout Formal */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2",
                color: "#8f1a25",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
              aria-hidden="true"
            >
              <LogOut size={20} />
            </div>

            {/* Judul & Deskripsi */}
            <h3
              id="logout-dialog-title"
              style={{
                margin: "0 0 8px 0",
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
                textAlign: "left",
              }}
            >
              Keluar dari Sistem?
            </h3>
            <p
              id="logout-dialog-desc"
              style={{
                margin: "0 0 20px 0",
                fontSize: 13.5,
                color: "#475569",
                lineHeight: 1.5,
                textAlign: "left",
              }}
            >
              Anda perlu masuk kembali untuk mengakses CARMEN.
            </p>

            {/* Alert Error jika Logout Gagal */}
            {logoutError && (
              <div
                role="alert"
                aria-live="assertive"
                className="corp-alert-box"
                style={{ marginBottom: 18, padding: "9px 12px", fontSize: 13 }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: "#991b1b" }} />
                <span>{logoutError}</span>
              </div>
            )}

            {/* Tombol Aksi Kanan Bawah */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
              }}
            >
              <button
                ref={cancelLogoutBtnRef}
                type="button"
                onClick={handleCloseLogoutModal}
                disabled={isLoggingOut}
                style={{
                  padding: "9px 18px",
                  height: 40,
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "var(--bg-main, #f8fafc)",
                  color: "var(--text, #334155)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 8,
                  cursor: isLoggingOut ? "not-allowed" : "pointer",
                  transition: "background-color 140ms ease",
                }}
              >
                Batal
              </button>
              <button
                ref={confirmLogoutBtnRef}
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                style={{
                  padding: "9px 20px",
                  height: 40,
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: isLoggingOut ? "#94a3b8" : "#8f1a25",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  cursor: isLoggingOut ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background-color 140ms ease",
                }}
              >
                {isLoggingOut && (
                  <svg
                    style={{
                      width: 15,
                      height: 15,
                      animation: "corpSpin 0.8s linear infinite",
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="31.4 31.4"
                      strokeLinecap="round"
                      opacity="0.4"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
