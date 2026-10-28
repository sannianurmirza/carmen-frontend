"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  AuthUser,
  LoginPayload,
  loginApi,
  getMeApi,
  logoutApi,
  fetchCsrfTokenApi,
} from "@/lib/api";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSlowConnection: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  consumeJustLoggedInUser: () => AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [justLoggedInUser, setJustLoggedInUser] = useState<AuthUser | null>(null);

  // Ref untuk mendeteksi unmount agar tidak ada update state setelah unmount
  const isMountedRef = useRef(true);
  // Counter request untuk mencegah race condition jika refreshUser dipanggil berulang
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const currentRequestId = ++activeRequestIdRef.current;
    if (isMountedRef.current) {
      setIsLoading(true);
    }

    try {
      const currentUser = await getMeApi();
      // Pastikan request ini adalah request terbaru dan komponen masih mounted
      if (isMountedRef.current && currentRequestId === activeRequestIdRef.current) {
        setUser(currentUser);
        setIsSlowConnection(false);
        setIsLoading(false);
      }
      return currentUser;
    } catch {
      if (isMountedRef.current && currentRequestId === activeRequestIdRef.current) {
        setUser(null);
        setIsSlowConnection(false);
        setIsLoading(false);
      }
      return null;
    }
  }, []);

  const consumeJustLoggedInUser = useCallback((): AuthUser | null => {
    if (!justLoggedInUser) return null;
    const u = justLoggedInUser;
    setJustLoggedInUser(null);
    return u;
  }, [justLoggedInUser]);

  useEffect(() => {
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    // Timer hanya menandai koneksi lambat untuk UX feedback, TIDAK mengakhiri isLoading atau logout palsu
    slowTimer = setTimeout(() => {
      if (isMountedRef.current && isLoading) {
        setIsSlowConnection(true);
      }
    }, 4000);

    // Muat sesi awal saat aplikasi dibuka
    refreshUser().finally(() => {
      if (slowTimer) {
        clearTimeout(slowTimer);
      }
    });

    // Pastikan token CSRF siap di latar belakang
    fetchCsrfTokenApi().catch(() => {});

    // Tangani event sesi kedaluwarsa dari lib/api.ts
    const handleUnauthorized = () => {
      if (isMountedRef.current) {
        setUser(null);
        setJustLoggedInUser(null);
        setIsSlowConnection(false);
        setIsLoading(false);
      }
    };

    window.addEventListener("cms-auth-unauthorized", handleUnauthorized);
    return () => {
      if (slowTimer) {
        clearTimeout(slowTimer);
      }
      window.removeEventListener("cms-auth-unauthorized", handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (payload: LoginPayload): Promise<AuthUser> => {
    if (isMountedRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await loginApi(payload);
      if (isMountedRef.current) {
        setUser(res.user);
        setJustLoggedInUser(res.user);
        setIsSlowConnection(false);
      }
      return res.user;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const logout = async (): Promise<void> => {
    if (isMountedRef.current) {
      setIsLoading(true);
    }
    try {
      await logoutApi();
    } catch {
      // Tetap lanjutkan pembersihan state lokal meskipun server gagal
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setJustLoggedInUser(null);
        setIsSlowConnection(false);
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isSlowConnection,
        login,
        logout,
        refreshUser,
        consumeJustLoggedInUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
