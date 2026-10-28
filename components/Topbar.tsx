"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UtensilsCrossed, Bell, Settings, Menu } from "lucide-react";
import {
  isSettingsPath,
  resolveSettingsGearTarget,
  CANONICAL_DASHBOARD_PATH,
} from "@/lib/settingsNav";
import { useNotifications } from "@/context/NotificationContext";
import { NotificationDropdown } from "@/components/NotificationDropdown";

interface TopbarProps {
  toggleSidebar?: () => void;
}

export default function Topbar({ toggleSidebar }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettingsActive = isSettingsPath(pathname);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { unreadCount, loadNotifications } = useNotifications();

  const handleGearClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsNotifOpen(false);
    const search = typeof window !== "undefined" ? window.location.search : "";
    const { target } = resolveSettingsGearTarget(pathname, search);
    router.push(target);
  };

  const handleBellClick = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      loadNotifications();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand-group">
        {!isSettingsActive && (
          <button
            type="button"
            className="hamburger-btn"
            onClick={toggleSidebar}
            aria-label="Buka menu navigasi"
            id="topbar-hamburger-btn"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        )}
        <Link
          href={CANONICAL_DASHBOARD_PATH}
          className="topbar-title-link"
          aria-label="Kembali ke Dashboard CARMEN"
          title="Dashboard"
          id="topbar-dashboard-brand-link"
        >
          <div className="topbar-title">
            <UtensilsCrossed
              size={24}
              style={{ color: "var(--red, #C51F32)", flexShrink: 0 }}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span>CARMEN</span>
          </div>
        </Link>
      </div>

      {/* Header Actions: Notifikasi | Pengaturan */}
      <div className="topbar-icons" role="toolbar" aria-label="Aksi Cepat Header" style={{ position: "relative" }}>
        {/* 1. Notifikasi */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={handleBellClick}
            className={`topbar-action-btn ${isNotifOpen ? "active" : ""}`}
            title="Notifikasi"
            aria-label={`Notifikasi sistem ${unreadCount > 0 ? `(${unreadCount} belum dibaca)` : ""}`}
            id="topbar-notif-bell-btn"
          >
            <Bell size={19} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="topbar-notif-badge" id="topbar-notif-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Notifikasi */}
          <NotificationDropdown
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
          />
        </div>

        {/* 2. Pengaturan (Gear) */}
        <button
          type="button"
          onClick={handleGearClick}
          className={`topbar-action-btn ${isSettingsActive ? "active" : ""}`}
          title={isSettingsActive ? "Kembali dari Pengaturan" : "Buka Pengaturan"}
          aria-label={isSettingsActive ? "Kembali dari Pengaturan" : "Buka Pengaturan"}
          id="topbar-settings-gear-btn"
        >
          <Settings size={19} strokeWidth={isSettingsActive ? 2.2 : 1.9} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

