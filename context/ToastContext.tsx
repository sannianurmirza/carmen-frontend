"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  fields?: string[];
  autoCloseMs?: number;
}

export interface ToastPayload extends ToastOptions {
  id?: string;
  type?: ToastType;
  message?: string;
  text?: string;
}

export interface ActiveToast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  fields?: string[];
  autoCloseMs: number;
  isExiting?: boolean;
}

interface ToastContextValue {
  showToast: (
    input: string | ToastPayload,
    typeOrOptions?: ToastType | ToastOptions,
    options?: ToastOptions
  ) => void;
  showSuccess: (message: string, title?: string, options?: ToastOptions) => void;
  showError: (message: string, title?: string, options?: ToastOptions) => void;
  showWarning: (message: string, title?: string, options?: ToastOptions) => void;
  showInfo: (message: string, title?: string, options?: ToastOptions) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4500,
  info: 4500,
  warning: 5500,
  error: 6000,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: "#065f46", // Emerald green from Daftar Katering
  error: "#991b1b",   // Deep red from Daftar Katering
  warning: "#b45309", // Deep amber
  info: "#1e40af",    // Deep blue
};

interface ToastCardProps {
  toast: ActiveToast;
  onRemove: (id: string) => void;
}

function ToastCard({ toast, onRemove }: ToastCardProps) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.autoCloseMs);
  const isPausedRef = useRef<boolean>(false);

  // Smooth exit transition: plays 220ms CSS transition before DOM removal
  const triggerExit = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    exitTimerRef.current = setTimeout(() => {
      onRemove(toast.id);
    }, 220);
  }, [isExiting, onRemove, toast.id]);

  // Start or resume the countdown timer
  const startTimer = useCallback(
    (ms: number) => {
      if (ms <= 0) return;
      startTimeRef.current = Date.now();
      remainingTimeRef.current = ms;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        triggerExit();
      }, ms);
    },
    [triggerExit]
  );

  // Pause timer on hover or focus
  const handlePause = useCallback(() => {
    if (isPausedRef.current || isExiting) return;
    isPausedRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const elapsed = Date.now() - startTimeRef.current;
    // Maintain remaining time with a comfortable minimum of 1500ms on resume
    remainingTimeRef.current = Math.max(1500, remainingTimeRef.current - elapsed);
  }, [isExiting]);

  // Resume timer on mouse leave or blur
  const handleResume = useCallback(() => {
    if (!isPausedRef.current || isExiting) return;
    isPausedRef.current = false;
    startTimer(remainingTimeRef.current);
  }, [isExiting, startTimer]);

  useEffect(() => {
    startTimer(toast.autoCloseMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [toast.autoCloseMs, startTimer]);

  // When marked as exiting from outside (e.g. hideToast or clearAllToasts)
  useEffect(() => {
    if (toast.isExiting && !isExiting) {
      triggerExit();
    }
  }, [toast.isExiting, isExiting, triggerExit]);

  const hasMultipleLines = Boolean(
    (toast.title && toast.message) ||
      (toast.fields && toast.fields.length > 0)
  );

  return (
    <div
      className={`toast-item ${isExiting ? "toast-item-exiting" : ""}`}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
      role={toast.type === "error" ? "alert" : "status"}
      style={{
        pointerEvents: isExiting ? "none" : "auto",
        backgroundColor: TOAST_COLORS[toast.type],
        color: "#ffffff",
        padding: "12px 18px",
        borderRadius: 6,
        boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: hasMultipleLines ? "flex-start" : "center",
        gap: 10,
        fontSize: 13.5,
        fontWeight: 600,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 420,
      }}
    >
      {/* Type Icon from Daftar Katering */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: hasMultipleLines ? 2 : 0,
        }}
      >
        {toast.type === "success" && <CheckCircle2 size={18} />}
        {toast.type === "error" && <AlertCircle size={18} />}
        {toast.type === "warning" && <AlertTriangle size={18} />}
        {toast.type === "info" && <Info size={18} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div
            style={{
              fontWeight: 800,
              fontSize: 13.5,
              marginBottom:
                toast.message || (toast.fields && toast.fields.length > 0)
                  ? 3
                  : 0,
              letterSpacing: "-0.01em",
            }}
          >
            {toast.title}
          </div>
        )}
        {toast.message && (
          <div
            style={{
              fontSize: hasMultipleLines ? 12.5 : 13.5,
              fontWeight: hasMultipleLines ? 500 : 600,
              lineHeight: 1.45,
              color: "#ffffff",
            }}
          >
            {toast.message}
          </div>
        )}
        {toast.fields && toast.fields.length > 0 && (
          <ul
            style={{
              margin: "6px 0 0 0",
              paddingLeft: 16,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.5,
              color: "rgba(255, 255, 255, 0.95)",
            }}
          >
            {toast.fields.map((f, i) => (
              <li key={i}>
                <strong>{f}</strong> wajib diisi
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={triggerExit}
        aria-label="Tutup notifikasi"
        tabIndex={0}
        style={{
          background: "none",
          border: "none",
          color: "#ffffff",
          cursor: "pointer",
          padding: 4,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          opacity: 0.8,
          transition: "opacity 0.15s ease",
          marginTop: hasMultipleLines ? 2 : 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const lastToastRef = useRef<{ key: string; time: number } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts((prev) =>
      prev.map((t) => ({ ...t, isExiting: true }))
    );
    setTimeout(() => {
      setToasts([]);
    }, 230);
  }, []);

  const showToast = useCallback(
    (
      input: string | ToastPayload,
      typeOrOptions?: ToastType | ToastOptions,
      optionsParam?: ToastOptions
    ) => {
      let resolvedType: ToastType = "success";
      let resolvedMessage = "";
      let resolvedTitle: string | undefined;
      let resolvedFields: string[] | undefined;
      let resolvedAutoCloseMs: number | undefined;

      if (typeof input === "string") {
        resolvedMessage = input;
        if (typeof typeOrOptions === "string") {
          resolvedType = typeOrOptions;
          if (optionsParam) {
            resolvedTitle = optionsParam.title;
            resolvedFields = optionsParam.fields;
            resolvedAutoCloseMs = optionsParam.autoCloseMs;
          }
        } else if (typeof typeOrOptions === "object" && typeOrOptions !== null) {
          resolvedTitle = typeOrOptions.title;
          resolvedFields = typeOrOptions.fields;
          resolvedAutoCloseMs = typeOrOptions.autoCloseMs;
        }
      } else if (typeof input === "object" && input !== null) {
        resolvedMessage = input.message || input.text || "";
        resolvedType = input.type || "success";
        resolvedTitle = input.title;
        resolvedFields = input.fields;
        resolvedAutoCloseMs = input.autoCloseMs;
      }

      if (!resolvedMessage && (!resolvedFields || resolvedFields.length === 0)) {
        return;
      }

      // Deduplication check: prevent identical toast within 1.2s
      const dedupKey = `${resolvedType}:${resolvedTitle || ""}:${resolvedMessage}:${(resolvedFields || []).join(",")}`;
      const now = Date.now();
      if (
        lastToastRef.current &&
        lastToastRef.current.key === dedupKey &&
        now - lastToastRef.current.time < 1200
      ) {
        return;
      }
      lastToastRef.current = { key: dedupKey, time: now };

      const toastId = `toast-${now}-${Math.random().toString(36).substr(2, 6)}`;
      const duration = resolvedAutoCloseMs || DEFAULT_DURATIONS[resolvedType];

      const newToast: ActiveToast = {
        id: toastId,
        type: resolvedType,
        title: resolvedTitle,
        message: resolvedMessage,
        fields: resolvedFields,
        autoCloseMs: duration,
        isExiting: false,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        if (updated.length > 4) {
          // Gracefully trigger exit for the oldest toast
          updated[0] = { ...updated[0], isExiting: true };
        }
        return updated;
      });
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, title?: string, options?: ToastOptions) => {
      showToast(message, "success", { ...options, title });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, title?: string, options?: ToastOptions) => {
      showToast(message, "error", { ...options, title });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string, options?: ToastOptions) => {
      showToast(message, "warning", { ...options, title });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string, options?: ToastOptions) => {
      showToast(message, "info", { ...options, title });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
        clearAllToasts,
      }}
    >
      {children}

      {/* Centralized Toast Stack: Top-right position from Minus, visuals from Daftar Katering */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: 420,
          width: "calc(100vw - 48px)",
        }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
