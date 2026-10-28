"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  shouldRenderGlobalSidebar,
  saveSettingsReturnPath,
  isValidReturnPath,
} from "@/lib/settingsNav";

const SIDEBAR_COLLAPSED_KEY = "catering_sidebar_collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { consumeJustLoggedInUser } = useAuth();
  const { showSuccess } = useToast();
  const loginToastShownRef = useRef(false);

  const showGlobalSidebar = shouldRenderGlobalSidebar(pathname);

  // Track whether the user manually toggled the sidebar collapse in this session
  const userManualToggleRef = useRef(false);

  // Responsive sidebar collapse: auto-collapse on tablet / high zoom (< 1180px)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) {
        setSidebarCollapsed(stored === "true");
        userManualToggleRef.current = true;
      }
    } catch {
      // ignore
    }

    const mql = window.matchMedia("(max-width: 1180px)");
    const handleViewportChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Only auto-collapse if user hasn't manually un-collapsed on a narrow screen
      if (!userManualToggleRef.current) {
        setSidebarCollapsed(e.matches);
      } else if (e.matches && window.innerWidth <= 1024) {
        // Under 1024px, always collapse to prevent content crushing
        setSidebarCollapsed(true);
      }
    };

    if (!userManualToggleRef.current && mql.matches) {
      setSidebarCollapsed(true);
    }

    mql.addEventListener("change", handleViewportChange);
    return () => mql.removeEventListener("change", handleViewportChange);
  }, []);

  // Update return path continuously while on normal valid pages
  useEffect(() => {
    if (showGlobalSidebar && isValidReturnPath(pathname)) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      saveSettingsReturnPath(pathname + search);
    }
  }, [pathname, showGlobalSidebar]);

  useEffect(() => {
    if (loginToastShownRef.current) return;
    const u = consumeJustLoggedInUser();
    if (u?.nama) {
      loginToastShownRef.current = true;
      showSuccess(`Selamat datang, ${u.nama}.`, "Berhasil masuk", { autoCloseMs: 3500 });
    }
  }, [consumeJustLoggedInUser, showSuccess]);

  useEffect(() => {
    setMounted(true);
    try {
      localStorage.removeItem("theme");
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Close mobile sidebar drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close mobile sidebar drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [sidebarOpen]);

  const handleToggleCollapse = () => {
    userManualToggleRef.current = true;
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className={`shell ${!showGlobalSidebar ? "shell-settings" : ""}`}>
      {showGlobalSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      )}
      <div className={`main ${!showGlobalSidebar ? "main-settings" : ""}`}>
        <Topbar
          toggleSidebar={toggleSidebar}
        />
        <main className={`content ${!showGlobalSidebar ? "content-settings" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

