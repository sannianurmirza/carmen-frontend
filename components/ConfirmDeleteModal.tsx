"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, AlertCircle, X, Loader2 } from "lucide-react";

export type ConfirmDeleteModalProps = {
  isOpen: boolean;
  title?: string;
  description?: React.ReactNode;
  itemName?: string;
  impactWarning?: React.ReactNode;
  count?: number;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

export default function ConfirmDeleteModal({
  isOpen,
  title = "Konfirmasi Penghapusan",
  description,
  itemName,
  impactWarning,
  count,
  confirmText = "Hapus",
  cancelText = "Batal",
  loadingText = "Menghapus...",
  isLoading = false,
  error = null,
  onConfirm,
  onClose,
  triggerRef,
}: ConfirmDeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management and escape key listener
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element and trigger to restore upon close
    prevActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    const currentTrigger = triggerRef?.current;

    // Safe initial focus on the Cancel button
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isLoading) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]:not([disabled])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      if (currentTrigger && typeof currentTrigger.focus === "function") {
        currentTrigger.focus();
      } else if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === "function") {
        prevActiveElementRef.current.focus();
      }
    };
  }, [isOpen, isLoading, onClose, triggerRef]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const computedTitle = count !== undefined && count > 1 
    ? `Hapus ${count} data terpilih?` 
    : title;

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      style={{ zIndex: 1200 }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        style={{
          maxWidth: 460,
          width: "100%",
          padding: 0,
          overflow: "hidden",
          animation: "scaleIn 0.15s ease-out",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Header with Warning Icon, Title, and Close Button */}
        <div
          className="modal-header"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(220, 38, 38, 0.12)",
                color: "var(--red, #dc2626)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} strokeWidth={2.2} />
            </div>
            <h3
              id="confirm-delete-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "var(--text)",
                lineHeight: 1.3,
              }}
            >
              {computedTitle}
            </h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Tutup"
            style={{
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.4 : 1,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: "20px 22px" }}>
          {/* Item Identification Badge / Highlight */}
          {itemName && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm, 6px)",
                background: "var(--sidebar-bg)",
                border: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 14,
                wordBreak: "break-word",
              }}
            >
              {itemName}
            </div>
          )}

          {/* Description */}
          <div
            id="confirm-delete-desc"
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            {description || (
              <span>
                Apakah Anda yakin ingin menghapus data ini? Tindakan ini akan menghapus data dan{" "}
                <strong style={{ color: "var(--text)" }}>tidak dapat dibatalkan</strong>.
              </span>
            )}
          </div>

          {/* Relational Impact / Cascade Warning */}
          {impactWarning && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: "var(--radius-sm, 6px)",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--red, #dc2626)",
              }}
            >
              {impactWarning}
            </div>
          )}

          {/* Error Message if deletion failed */}
          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm, 6px)",
                background: "rgba(220, 38, 38, 0.12)",
                border: "1px solid var(--red, #dc2626)",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12.5,
                color: "var(--red, #dc2626)",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, wordBreak: "break-word" }}>{error}</div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div
          className="modal-actions"
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--sidebar-bg)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isLoading}
            style={{
              height: 36,
              fontSize: 13,
              fontWeight: 600,
              padding: "0 16px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="btn btn-solid"
            onClick={() => {
              if (!isLoading) onConfirm();
            }}
            disabled={isLoading}
            style={{
              height: 36,
              fontSize: 13,
              fontWeight: 700,
              padding: "0 18px",
              backgroundColor: "var(--red, #dc2626)",
              borderColor: "var(--red, #dc2626)",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.8 : 1,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="spin-icon" style={{ animation: "spin 1s linear infinite" }} />
                <span>{loadingText}</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
