"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound, Utensils, Scale, Users, Mail, FlaskConical } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getVisibleSettingsNavItems,
  isSettingsItemActive,
  SettingsNavItem,
} from "@/lib/settingsNav";

const ICON_MAP: Record<SettingsNavItem["iconName"], React.ElementType> = {
  UserRound,
  Utensils,
  Scale,
  Users,
  Mail,
  FlaskConical,
};

export default function PengaturanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = getVisibleSettingsNavItems(user?.role);

  return (
    <div className="settings-shell" style={{ width: "100%", paddingBottom: 48 }}>
      {/* Flat Secondary Settings Navigation Rail */}
      <aside
        className="settings-sidebar"
        aria-label="Navigasi Pengaturan"
        id="settings-internal-sidebar"
      >
        <div className="settings-rail-header">
          <span className="settings-rail-eyebrow">PENGATURAN</span>
        </div>

        <nav className="settings-sidebar-nav" aria-label="Menu Pengaturan">
          {visibleItems.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            const isActive = isSettingsItemActive(item.href, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`settings-nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                id={`settings-link-${item.href.replace("/pengaturan/", "")}`}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className="settings-nav-icon"
                />
                <span className="settings-nav-label">{item.label}</span>
                {item.badge && (
                  <span
                    className="settings-nav-badge"
                    style={{
                      marginLeft: "auto",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fde68a",
                      lineHeight: 1,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content Area for Child Settings Pages */}
      <main className="settings-content" id="settings-main-content">
        {children}
      </main>
    </div>
  );
}
