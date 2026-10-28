"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  InAppNotification,
  getNotificationsApi,
  getUnreadNotificationCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from "../lib/api";
import { useAuth } from "./AuthContext";

interface NotificationContextType {
  notifications: InAppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refreshUnreadCount: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await getUnreadNotificationCountApi();
      setUnreadCount(res.unread_count || 0);
    } catch {
      // Graceful error isolation
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await getNotificationsApi({ limit: 20, offset: 0 });
      setNotifications(res.items || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(
    async (id: number) => {
      try {
        const res = await markNotificationReadApi(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: res.read_at || new Date().toISOString() } : n))
        );
        setUnreadCount(res.unread_count ?? Math.max(0, unreadCount - 1));
      } catch {
        // Fallback
      }
    },
    [unreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Fallback
    }
  }, []);

  // Periodic polling (30s) + visibility / focus refresh
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    // Initial fetch
    refreshUnreadCount();

    // 30 seconds interval
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshUnreadCount();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshUnreadCount();
      }
    };

    const handleFocus = () => {
      refreshUnreadCount();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        refreshUnreadCount,
        loadNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
