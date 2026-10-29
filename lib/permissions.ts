/**
 * frontend/lib/permissions.ts
 * Centralized Role & Capability Management for CARMEN (PT JAI Catering Management).
 *
 * Roles:
 * - admin: System administrator with broad operational visibility and user management.
 * - staff: Internal PT JAI operations staff handling operational inputs and report submissions.
 * - approver: Managerial/SPV authority handling approval reviews only.
 */

import React from "react";
import {
  LayoutGrid,
  FileCheck2,
  Store,
  ClipboardCheck,
  Utensils,
  Clock,
  MessageSquareWarning,
  ClipboardList,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Award,
  Send,
  CalendarDays,
  Settings,
} from "lucide-react";
export interface AuthUserLike {
  id?: number;
  username?: string;
  nama?: string;
  email?: string | null;
  role?: string;
  is_active?: boolean;
}

// Canonical capabilities
export const CAN_MANAGE_USERS = "can_manage_users";
export const CAN_MANAGE_MASTER_DATA = "can_manage_master_data";
export const CAN_INPUT_OPERATIONAL = "can_input_operational";
export const CAN_SUBMIT_APPROVAL = "can_submit_approval";
export const CAN_REVIEW_APPROVAL = "can_review_approval";
export const CAN_VIEW_ALL_APPROVALS = "can_view_all_approvals";
export const CAN_VIEW_OWN_APPROVALS = "can_view_own_approvals";
export const CAN_MANAGE_SMTP = "can_manage_smtp";

export type RoleType = "admin" | "staff" | "approver" | "user";

export const ROLE_CAPABILITIES: Record<string, string[]> = {
  admin: [
    CAN_MANAGE_USERS,
    CAN_MANAGE_MASTER_DATA,
    CAN_INPUT_OPERATIONAL,
    CAN_SUBMIT_APPROVAL,
    CAN_VIEW_ALL_APPROVALS,
    CAN_VIEW_OWN_APPROVALS,
    CAN_MANAGE_SMTP,
  ],
  staff: [
    CAN_MANAGE_MASTER_DATA,
    CAN_INPUT_OPERATIONAL,
    CAN_SUBMIT_APPROVAL,
    CAN_VIEW_ALL_APPROVALS,
    CAN_VIEW_OWN_APPROVALS,
    CAN_MANAGE_SMTP,
  ],
  approver: [
    CAN_REVIEW_APPROVAL,
    CAN_VIEW_OWN_APPROVALS,
  ],
  // Legacy role='user' is NOT canonical and must not be aliased to staff
  user: [],
};

export function normalizeRole(role?: string | null): RoleType {
  if (!role) return "user";
  const r = role.trim().toLowerCase();
  if (r === "admin" || r === "staff" || r === "approver") {
    return r;
  }
  return "user";
}

export function hasCapability(user: AuthUserLike | null | undefined, capability: string): boolean {
  if (!user || user.is_active === false) return false;
  const role = normalizeRole(user.role);
  const caps = ROLE_CAPABILITIES[role] || [];
  return caps.includes(capability);
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

/**
 * Returns role-aware navigation groups for Sidebar rendering.
 */
export function getNavigationForUser(
  userOrRole: AuthUserLike | RoleType | string | null | undefined,
  pendingApprovalCount: number = 0
): NavGroup[] {
  const role = typeof userOrRole === "string" ? normalizeRole(userOrRole) : normalizeRole(userOrRole?.role);
  const approvalBadge = pendingApprovalCount > 0 ? String(pendingApprovalCount) : undefined;

  // 1. APPROVER NAVIGATION: Executive management view
  if (role === "approver") {
    return [
      {
        groupName: "UTAMA",
        items: [
          { href: "/", label: "Dashboard", icon: LayoutGrid },
          { href: "/rencana-menu", label: "Perencanaan Menu Bulanan", icon: CalendarDays },
        ],
      },
      {
        groupName: "ANALISIS KATERING",
        items: [
          { href: "/management/kalori", label: "Kalori", icon: Utensils },
          { href: "/management/punishment", label: "Punishment", icon: FileSpreadsheet },
          { href: "/management/performance", label: "Performance", icon: TrendingUp },
          { href: "/management/reward-punishment", label: "Reward & Punishment", icon: Award },
        ],
      },
      {
        groupName: "LAPORAN",
        items: [
          { href: "/approval", label: "Approval Laporan", icon: FileCheck2, badge: approvalBadge },
        ],
      },
      {
        groupName: "AKUN",
        items: [
          { href: "/pengaturan/akun", label: "Akun Saya", icon: Settings },
        ],
      },
    ];
  }

  // 2. STAFF NAVIGATION: Full operational inputs & report submissions
  if (role === "staff" || role === "user") {
    return [
      {
        groupName: "UTAMA",
        items: [
          { href: "/", label: "Dashboard", icon: LayoutGrid },
          { href: "/rencana-menu", label: "Perencanaan Menu Bulanan", icon: CalendarDays },
          { href: "/daftar-katering", label: "Daftar Katering", icon: Store },
        ],
      },
      {
        groupName: "PENILAIAN & AUDIT",
        items: [
          { href: "/kelayakan", label: "Kelayakan Menu", icon: ClipboardCheck },
          { href: "/kalori-harian", label: "Kalori", icon: Utensils },
          { href: "/keterlambatan", label: "Keterlambatan", icon: Clock },
          { href: "/komplain", label: "Komplain", icon: MessageSquareWarning },
          { href: "/audit", label: "Audit Dapur", icon: ClipboardList },
          { href: "/kebersihan", label: "Kebersihan Kantin", icon: Sparkles },
        ],
      },
      {
        groupName: "LAPORAN",
        items: [
          { href: "/performance", label: "Performance", icon: TrendingUp },
          { href: "/laporan-punishment", label: "Punishment", icon: FileSpreadsheet },
          { href: "/reward-punishment", label: "Reward & Punishment", icon: Award },
          { href: "/send-report", label: "Send Report", icon: Send },
          { href: "/approval", label: "Approval", icon: FileCheck2 },
        ],
      },
      {
        groupName: "PENGATURAN",
        items: [
          { href: "/pengaturan", label: "Pengaturan", icon: Settings },
        ],
      },
    ];
  }

  // 3. ADMIN NAVIGATION: Broad operational visibility + user management + master data
  return [
    {
      groupName: "UTAMA",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutGrid },
        { href: "/rencana-menu", label: "Perencanaan Menu Bulanan", icon: CalendarDays },
        { href: "/daftar-katering", label: "Daftar Katering", icon: Store },
      ],
    },
    {
      groupName: "PENILAIAN & AUDIT",
      items: [
        { href: "/kelayakan", label: "Kelayakan Menu", icon: ClipboardCheck },
        { href: "/kalori-harian", label: "Kalori", icon: Utensils },
        { href: "/keterlambatan", label: "Keterlambatan", icon: Clock },
        { href: "/komplain", label: "Komplain", icon: MessageSquareWarning },
        { href: "/audit", label: "Audit Dapur", icon: ClipboardList },
        { href: "/kebersihan", label: "Kebersihan Kantin", icon: Sparkles },
      ],
    },
    {
      groupName: "LAPORAN",
      items: [
        { href: "/performance", label: "Performance", icon: TrendingUp },
        { href: "/laporan-punishment", label: "Punishment", icon: FileSpreadsheet },
        { href: "/reward-punishment", label: "Reward & Punishment", icon: Award },
        { href: "/send-report", label: "Send Report", icon: Send },
        { href: "/approval", label: "Approval", icon: FileCheck2, badge: approvalBadge },
      ],
    },
    {
      groupName: "PENGATURAN",
      items: [
        { href: "/pengaturan", label: "Pengaturan", icon: Settings },
      ],
    },
  ];
}

/**
 * Route-level permission evaluator for frontend route protection.
 */
export function isRouteAllowed(
  userOrRole: AuthUserLike | RoleType | string | null | undefined,
  pathname: string
): boolean {
  if (!userOrRole) return false;
  const user: AuthUserLike =
    typeof userOrRole === "string"
      ? { role: userOrRole, is_active: true }
      : userOrRole;
  if (user.is_active === false) return false;
  const role = normalizeRole(user.role);

  // Strip trailing slashes and query strings
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // Public authenticated pages
  if (cleanPath === "/" || cleanPath === "/dashboard" || cleanPath === "/approval" || cleanPath.startsWith("/approval/") || cleanPath === "/notifications" || cleanPath.startsWith("/notifications/")) {
    return true;
  }

  // Management analytics pages (Approver, Admin & Staff read-only management view)
  if (cleanPath === "/management" || cleanPath.startsWith("/management/")) {
    return role === "approver" || role === "admin" || role === "staff";
  }

  // User management settings page
  if (cleanPath === "/pengaturan/pengguna" || cleanPath.startsWith("/pengaturan/pengguna/")) {
    return hasCapability(user, CAN_MANAGE_USERS);
  }

  // Master data settings pages
  if (cleanPath === "/pengaturan/kalori" || cleanPath === "/pengaturan/standar-berat") {
    return hasCapability(user, CAN_MANAGE_MASTER_DATA);
  }

  // SMTP configuration settings page (Admin and Staff only)
  if (cleanPath === "/pengaturan/smtp" || cleanPath.startsWith("/pengaturan/smtp/")) {
    return hasCapability(user, CAN_MANAGE_SMTP);
  }

  // General settings (Akun Saya)
  if (cleanPath === "/pengaturan" || cleanPath === "/pengaturan/akun" || cleanPath.startsWith("/pengaturan/akun/")) {
    return true;
  }

  // Partner catering catalog (Admin & Staff)
  if (cleanPath === "/daftar-katering" || cleanPath.startsWith("/daftar-katering/")) {
    return role === "admin" || role === "staff";
  }

  // Operational input modules
  const operationalPrefixes = [
    "/rencana-menu",
    "/kelayakan",
    "/kalori-harian",
    "/keterlambatan",
    "/komplain",
    "/audit",
    "/kebersihan",
    "/order-catering",
    "/minus",
  ];
  if (operationalPrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
    // Approver diizinkan membaca halaman rencana-menu (read-only view)
    if (cleanPath === "/rencana-menu" || cleanPath.startsWith("/rencana-menu/")) {
      return role === "admin" || role === "staff" || role === "approver";
    }
    return hasCapability(user, CAN_INPUT_OPERATIONAL);
  }

  // Reports
  const reportPrefixes = [
    "/performance",
    "/laporan-punishment",
    "/reward-punishment",
    "/send-report",
  ];
  if (reportPrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
    return hasCapability(user, CAN_INPUT_OPERATIONAL);
  }

  // Default fallback
  return false;
}
