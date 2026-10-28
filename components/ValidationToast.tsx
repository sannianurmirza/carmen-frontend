"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";

export interface ToastData {
  type: "error" | "warning" | "success" | "info";
  title?: string;
  fields?: string[]; // Specific list of missing field names
  message?: string;
  autoCloseMs?: number;
}

interface ValidationToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

const TOAST_COLORS: Record<string, string> = {
  success: "#065f46", // Emerald green from Daftar Katering
  error: "#991b1b",   // Deep red from Daftar Katering
  warning: "#b45309", // Deep amber
  info: "#1e40af",    // Deep blue
};

export default function ValidationToast({ toast, onClose }: ValidationToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(4500);
  const isPausedRef = useRef<boolean>(false);

  const duration =
    toast?.autoCloseMs !== undefined
      ? toast.autoCloseMs
      : toast?.type === "error"
      ? 6000
      : 4500;

  // Smooth exit transition: plays 220ms before calling onClose()
  const triggerExit = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    exitTimerRef.current = setTimeout(() => {
      onClose();
    }, 220);
  }, [isExiting, onClose]);

  const startTimer = useCallback(
    (ms: number) => {
      if (ms <= 0) return;
      startTimeRef.current = Date.now();
      remainingTimeRef.current = ms;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        triggerExit();
      }, ms);
    },
    [triggerExit]
  );

  const handlePause = useCallback(() => {
    if (isPausedRef.current || isExiting) return;
    isPausedRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(1500, remainingTimeRef.current - elapsed);
  }, [isExiting]);

  const handleResume = useCallback(() => {
    if (!isPausedRef.current || isExiting) return;
    isPausedRef.current = false;
    startTimer(remainingTimeRef.current);
  }, [isExiting, startTimer]);

  useEffect(() => {
    if (!toast) return;
    setIsExiting(false);
    startTimer(duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [toast, duration, startTimer]);

  if (!toast) return null;

  const type = toast.type || "success";
  const bgColor = TOAST_COLORS[type] || TOAST_COLORS.success;
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
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 99999,
        maxWidth: 420,
        width: "calc(100vw - 48px)",
        backgroundColor: bgColor,
        color: "#ffffff",
        borderRadius: 6,
        padding: "12px 18px",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
        display: "flex",
        alignItems: hasMultipleLines ? "flex-start" : "center",
        gap: 10,
        fontSize: 13.5,
        fontWeight: 600,
        boxSizing: "border-box",
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: hasMultipleLines ? 2 : 0,
        }}
      >
        {type === "success" && <CheckCircle2 size={18} />}
        {type === "error" && <AlertCircle size={18} />}
        {type === "warning" && <AlertTriangle size={18} />}
        {type === "info" && <CheckCircle2 size={18} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: "#ffffff",
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
              color: "#ffffff",
              lineHeight: 1.45,
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
              color: "rgba(255, 255, 255, 0.95)",
              lineHeight: 1.5,
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

      <button
        type="button"
        onClick={triggerExit}
        aria-label="Tutup notifikasi"
        tabIndex={0}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#ffffff",
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
