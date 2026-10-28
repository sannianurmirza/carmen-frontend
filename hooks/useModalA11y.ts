import { useEffect, useRef } from "react";

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface ActiveModalItem {
  id: symbol;
  onClose: () => void;
  isLoading: boolean;
}

// Stack modal aktif untuk mendukung modal bersarang (misal pratinjau foto di atas modal detail)
const activeModalsStack: ActiveModalItem[] = [];

/**
 * Hook aksesibilitas modal:
 * - Focus management (simpan trigger/activeElement, initial focus, restore focus saat ditutup)
 * - Escape key to close (hanya berlaku pada modal paling atas, dicegah jika sedang isLoading)
 * - Focus trap (Tab / Shift+Tab tetap berada di dalam modalRef)
 * - Dukungan modal bertumpuk (nested modal)
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  isLoading = false,
  initialFocusRef,
  triggerRef,
}: UseModalA11yOptions) {
  const modalRef = useRef<T>(null);
  const modalIdRef = useRef<symbol>(Symbol("modal-a11y"));
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  // Simpan callback dan status terbaru dalam ref agar event listener selalu membaca state termutakhir
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    if (!isOpen) return;

    // Simpan elemen aktif sebelum modal mencuri fokus
    prevActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    const currentTrigger = triggerRef?.current;

    // Daftarkan ke stack modal aktif
    const item: ActiveModalItem = {
      id: modalIdRef.current,
      onClose: () => onCloseRef.current(),
      isLoading: isLoadingRef.current,
    };
    activeModalsStack.push(item);

    // Fokus awal yang aman setelah DOM modal ter-render
    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Jika event sudah dicegah oleh handler lain, abaikan
      if (e.defaultPrevented) return;

      const topModal = activeModalsStack[activeModalsStack.length - 1];
      const isTopModal = topModal && topModal.id === modalIdRef.current;

      // Hanya tangani Escape jika modal ini berada di puncak stack
      if (e.key === "Escape") {
        if (isTopModal) {
          if (!isLoadingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            onCloseRef.current();
          }
        }
        return;
      }

      // Focus trap hanya untuk modal di puncak stack
      if (e.key === "Tab" && isTopModal && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);

      // Hapus dari stack
      const idx = activeModalsStack.findIndex((m) => m.id === modalIdRef.current);
      if (idx !== -1) {
        activeModalsStack.splice(idx, 1);
      }

      // Kembalikan fokus ke trigger atau elemen aktif sebelumnya
      if (currentTrigger && typeof currentTrigger.focus === "function") {
        currentTrigger.focus();
      } else if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === "function") {
        prevActiveElementRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef, triggerRef]);

  return modalRef;
}
