/**
 * frontend/lib/settingsNav.ts
 * Navigation model and business logic for internal settings sidebar.
 */

export interface SettingsNavItem {
  href: string;
  label: string;
  iconName: "UserRound" | "Utensils" | "Scale" | "Users" | "Mail";
  adminOnly?: boolean;
  badge?: string;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    href: "/pengaturan/akun",
    label: "Akun Saya",
    iconName: "UserRound",
  },
  {
    href: "/pengaturan/kalori",
    label: "Standar Kalori",
    iconName: "Utensils",
  },
  {
    href: "/pengaturan/standar-berat",
    label: "Standar Berat",
    iconName: "Scale",
  },
  {
    href: "/pengaturan/smtp",
    label: "SMTP",
    iconName: "Mail",
  },
  {
    href: "/pengaturan/pengguna",
    label: "Kelola Pengguna",
    iconName: "Users",
    adminOnly: true,
  },
];

export function getVisibleSettingsNavItems(role?: string): SettingsNavItem[] {
  const cleanRole = (role || "").trim().toLowerCase();
  if (cleanRole === "approver") {
    // Approvers are only allowed to see and manage their own account profile
    return SETTINGS_NAV_ITEMS.filter((item) => item.href === "/pengaturan/akun");
  }
  const isAdmin = cleanRole === "admin";
  return SETTINGS_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

export function isSettingsItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === "/pengaturan/akun") {
    return currentPath === "/pengaturan" || currentPath.startsWith("/pengaturan/akun");
  }
  if (itemHref === "/pengaturan/smtp") {
    return currentPath === "/pengaturan/smtp" || currentPath.startsWith("/pengaturan/smtp/");
  }
  return currentPath.startsWith(itemHref);
}

export function resolveSettingsRedirectTarget(tabParam: string | null): string {
  if (tabParam === "kalori") {
    return "/pengaturan/kalori";
  }
  if (tabParam === "standar-berat" || tabParam === "berat") {
    return "/pengaturan/standar-berat";
  }
  if (tabParam === "smtp" || tabParam === "mail" || tabParam === "email") {
    return "/pengaturan/smtp";
  }
  if (tabParam === "users" || tabParam === "pengguna") {
    return "/pengaturan/pengguna";
  }
  return "/pengaturan/akun";
}

export const CANONICAL_DASHBOARD_PATH = "/";
export const SETTINGS_RETURN_STORAGE_KEY = "cateringSettingsReturnTo";

/**
 * Normalizes path by stripping basePath prefix if present and query/hash.
 */
function stripPathPrefix(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  let clean = pathname.trim();
  const queryIdx = clean.indexOf("?");
  if (queryIdx !== -1) clean = clean.substring(0, queryIdx);
  const hashIdx = clean.indexOf("#");
  if (hashIdx !== -1) clean = clean.substring(0, hashIdx);

  const base = "/catering-ir/public";
  if (clean === base || clean.startsWith(`${base}/`)) {
    clean = clean.slice(base.length);
    if (!clean.startsWith("/")) {
      clean = `/${clean}`;
    }
  }
  return clean || "/";
}

/**
 * Returns true if the pathname is an internal settings route.
 */
export function isSettingsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const clean = stripPathPrefix(pathname);
  return clean === "/pengaturan" || clean.startsWith("/pengaturan/");
}

/**
 * Returns true if the global application sidebar should be rendered.
 * In settings routes (/pengaturan/*), the global sidebar is completely hidden.
 */
export function shouldRenderGlobalSidebar(pathname: string | null | undefined): boolean {
  return !isSettingsPath(pathname);
}

/**
 * Validates whether a route is safe to remember as a non-settings return target.
 * Must be a local internal non-settings route (rejects /pengaturan, /login, external URLs, schemes).
 */
export function isValidReturnPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const trimmed = path.trim();

  // Must start with single slash, reject protocol-relative or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Reject scheme-based or dangerous characters
  if (
    trimmed.includes("://") ||
    trimmed.includes("\\") ||
    trimmed.toLowerCase().startsWith("javascript:") ||
    trimmed.toLowerCase().startsWith("data:") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n")
  ) {
    return false;
  }

  // Check pathname part without query or hash
  const pathnameOnly = stripPathPrefix(trimmed);

  // Reject /pengaturan and /pengaturan/*
  if (pathnameOnly === "/pengaturan" || pathnameOnly.startsWith("/pengaturan/")) {
    return false;
  }

  // Reject /login and /login/*
  if (pathnameOnly === "/login" || pathnameOnly.startsWith("/login/")) {
    return false;
  }

  return true;
}

/**
 * Safely persists the last non-settings page in sessionStorage.
 */
export function saveSettingsReturnPath(path: string | null | undefined, storage?: Storage): void {
  const s = storage || (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!s) return;
  if (isValidReturnPath(path)) {
    try {
      s.setItem(SETTINGS_RETURN_STORAGE_KEY, path!.trim());
    } catch {
      // ignore storage errors
    }
  }
}

/**
 * Retrieves the stored return route from sessionStorage, or falls back to Dashboard if none or invalid.
 */
export function getSettingsReturnPath(storage?: Storage): string {
  const s = storage || (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!s) return CANONICAL_DASHBOARD_PATH;
  try {
    const stored = s.getItem(SETTINGS_RETURN_STORAGE_KEY);
    if (isValidReturnPath(stored)) {
      return stored!.trim();
    }
  } catch {
    // ignore storage errors
  }
  return CANONICAL_DASHBOARD_PATH;
}

/**
 * Clears the stored return route.
 */
export function clearSettingsReturnPath(storage?: Storage): void {
  const s = storage || (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!s) return;
  try {
    s.removeItem(SETTINGS_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns the destination when clicking the top-right Settings gear.
 * - Outside settings: remembers current non-settings page and opens /pengaturan/akun
 * - Inside settings: returns to the remembered non-settings page (or dashboard fallback)
 */
export function resolveSettingsGearTarget(
  currentPath: string,
  currentSearch: string = "",
  storage?: Storage
): { target: string; isReturn: boolean } {
  if (isSettingsPath(currentPath)) {
    const returnTarget = getSettingsReturnPath(storage);
    return { target: returnTarget, isReturn: true };
  } else {
    const fullCurrent = `${currentPath}${
      currentSearch ? (currentSearch.startsWith("?") ? currentSearch : `?${currentSearch}`) : ""
    }`;
    saveSettingsReturnPath(fullCurrent, storage);
    return { target: "/pengaturan/akun", isReturn: false };
  }
}

