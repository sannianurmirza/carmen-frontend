"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
} from "lucide-react";

export interface IndoDatePickerProps {
  value?: string | null; // format: "YYYY-MM-DD"
  onChange?: (e: any) => void;
  min?: string; // format: "YYYY-MM-DD"
  max?: string; // format: "YYYY-MM-DD"
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  id?: string;
  name?: string;
  align?: "left" | "right";
  isError?: boolean;
  displayFormat?: "compact" | "medium" | "full" | "iso"; // "compact": 30/10/2026, "medium": 30 Okt 2026, "full": Jumat, 30 Okt 2026, "iso": 2026-10-30
}

const BULAN_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const BULAN_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// URUTAN RESMI INDONESIA: SENIN SAMPAI MINGGU (Senin = 0, Minggu = 6)
const HARI_HEADER = [
  { short: "Sen", full: "Senin", isWeekend: false },
  { short: "Sel", full: "Selasa", isWeekend: false },
  { short: "Rab", full: "Rabu", isWeekend: false },
  { short: "Kam", full: "Kamis", isWeekend: false },
  { short: "Jum", full: "Jumat", isWeekend: false },
  { short: "Sab", full: "Sabtu", isWeekend: false },
  { short: "Min", full: "Minggu", isWeekend: true },
];

/**
 * Helper to parse "YYYY-MM-DD" into Date components
 */
function parseYMD(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-indexed month
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 0 || m > 11 || d < 1 || d > 31) return null;
  return { year: y, month: m, day: d };
}

/**
 * Format "YYYY-MM-DD" into Indonesian formatted string
 */
function formatIndoDisplay(dateStr?: string | null, format: "compact" | "medium" | "full" | "iso" = "medium"): string {
  if (!dateStr) return "";
  const parsed = parseYMD(dateStr);
  if (!parsed) return dateStr;

  const { year, month, day } = parsed;
  const d = new Date(year, month, day);

  if (format === "iso") {
    return dateStr;
  }

  if (format === "compact") {
    return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
  }

  const dayOfWeekIdx = (d.getDay() + 6) % 7;
  const dayName = HARI_HEADER[dayOfWeekIdx]?.full || "";
  const monthName = format === "full" ? BULAN_NAMES[month] : BULAN_SHORT[month];

  if (format === "full") {
    return `${dayName}, ${day} ${monthName} ${year}`;
  }

  return `${day} ${monthName} ${year}`;
}

export default function IndoDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pilih tanggal",
  disabled = false,
  required = false,
  className = "",
  style,
  inputStyle,
  id,
  name,
  align = "left",
  isError = false,
  displayFormat = "medium",
}: IndoDatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const parsedValue = useMemo(() => parseYMD(value), [value]);

  // View state (Year & Month being browsed in calendar)
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => parsedValue?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedValue?.month ?? today.getMonth());

  // Synchronize view when value changes from outside
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue?.year, parsedValue?.month]);

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Trigger change event (compatible with both (val: string) => void AND (e: { target: { value: string } }) => void)
  const emitChange = useCallback(
    (newVal: string) => {
      if (!onChange) return;
      const syntheticEvent: any = {
        target: { value: newVal, name: name || id || "" },
        currentTarget: { value: newVal, name: name || id || "" },
        value: newVal,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      // Enable seamless string casting if receiver expects a string directly
      syntheticEvent.toString = () => newVal;
      syntheticEvent.valueOf = () => newVal;

      onChange(syntheticEvent);
    },
    [onChange, name, id]
  );

  // Select a specific date
  const handleSelectDate = (dateStr: string) => {
    if (disabled) return;
    emitChange(dateStr);
    setIsOpen(false);
  };

  // Quick Today
  const handleSelectToday = () => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    handleSelectDate(todayStr);
  };

  // Clear value
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    emitChange("");
  };

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate Year options (current - 10 to current + 10)
  const yearOptions = useMemo(() => {
    const currentY = today.getFullYear();
    const list: number[] = [];
    for (let y = currentY - 10; y <= currentY + 10; y++) {
      list.push(y);
    }
    return list;
  }, [today]);

  // Build Calendar Matrix (Senin = 0, Minggu = 6)
  const calendarDays = useMemo(() => {
    // Total days in viewMonth
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Day of week of 1st day: 0 (Sun), 1 (Mon), ..., 6 (Sat)
    const rawFirstDay = new Date(viewYear, viewMonth, 1).getDay();
    // Normalisasi agar Senin = 0, Selasa = 1, ..., Minggu = 6
    const startOffset = (rawFirstDay + 6) % 7;

    const days: Array<{
      year: number;
      month: number;
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
      isSunday: boolean;
    }> = [];

    // Previous month padding
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeekIdx = days.length % 7;

      days.push({
        year: prevY,
        month: prevM,
        day: d,
        dateStr,
        isCurrentMonth: false,
        isToday:
          prevY === today.getFullYear() &&
          prevM === today.getMonth() &&
          d === today.getDate(),
        isSelected: value === dateStr,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isSunday: dayOfWeekIdx === 6,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeekIdx = days.length % 7;

      days.push({
        year: viewYear,
        month: viewMonth,
        day: d,
        dateStr,
        isCurrentMonth: true,
        isToday:
          viewYear === today.getFullYear() &&
          viewMonth === today.getMonth() &&
          d === today.getDate(),
        isSelected: value === dateStr,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isSunday: dayOfWeekIdx === 6,
      });
    }

    // Next month padding to complete weeks
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeekIdx = days.length % 7;

      days.push({
        year: nextY,
        month: nextM,
        day: d,
        dateStr,
        isCurrentMonth: false,
        isToday:
          nextY === today.getFullYear() &&
          nextM === today.getMonth() &&
          d === today.getDate(),
        isSelected: value === dateStr,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isSunday: dayOfWeekIdx === 6,
      });
    }

    return days;
  }, [viewYear, viewMonth, today, value, min, max]);

  const displayLabel = formatIndoDisplay(value, displayFormat);

  return (
    <div
      ref={containerRef}
      className={`indo-datepicker-container ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        ...style,
      }}
    >
      {/* Hidden standard input for HTML form compatibility */}
      <input
        type="hidden"
        name={name}
        id={id}
        value={value || ""}
        required={required}
      />

      {/* Visible Interactive Input Trigger */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 38,
          borderRadius: 6,
          border: isError
            ? "1.5px solid var(--red, #b3212f)"
            : isOpen
            ? "1.5px solid var(--red, #b3212f)"
            : "1px solid var(--border-strong, #cbd5e1)",
          background: disabled ? "var(--bg-subtle, #f8fafc)" : "var(--card, #ffffff)",
          color: value ? "var(--text, #0f172a)" : "var(--text-muted, #94a3b8)",
          padding: "0 10px",
          fontSize: "13px",
          fontWeight: value ? 500 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: isOpen ? "0 0 0 3px rgba(179, 33, 47, 0.12)" : "none",
          ...inputStyle,
        }}
        title={value ? formatIndoDisplay(value, "full") : placeholder}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}
        >
          {displayLabel || placeholder}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 6 }}>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e as any);
                }
              }}
              title="Hapus tanggal"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--red, #b3212f)";
                e.currentTarget.style.backgroundColor = "rgba(179, 33, 47, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted, #94a3b8)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <X size={12} />
            </span>
          )}
          <CalendarIcon
            size={15}
            style={{
              color: isOpen ? "var(--red, #b3212f)" : "var(--text-muted, #94a3b8)",
              transition: "color 0.15s",
            }}
          />
        </div>
      </div>

      {/* Floating Indonesian Calendar Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            [align === "right" ? "right" : "left"]: 0,
            zIndex: 9999,
            width: 290,
            backgroundColor: "#ffffff",
            borderRadius: 10,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.08)",
            padding: 12,
            fontFamily: "inherit",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Header Bar: Month/Year navigation & selection */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={prevMonth}
              title="Bulan sebelumnya"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid var(--border, #e2e8f0)",
                background: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text, #0f172a)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle, #f8fafc)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Month & Year Dropdowns */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
              {/* Select Month */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                style={{
                  height: 28,
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: "1px solid var(--border, #e2e8f0)",
                  background: "#ffffff",
                  color: "var(--text, #0f172a)",
                  padding: "0 4px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {BULAN_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Select Year */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                style={{
                  height: 28,
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: "1px solid var(--border, #e2e8f0)",
                  background: "#ffffff",
                  color: "var(--text, #0f172a)",
                  padding: "0 4px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              title="Bulan berikutnya"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid var(--border, #e2e8f0)",
                background: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text, #0f172a)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle, #f8fafc)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day of Week Headers: SENIN - MINGGU */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              marginBottom: 4,
              borderBottom: "1px solid var(--border, #e2e8f0)",
              paddingBottom: 4,
            }}
          >
            {HARI_HEADER.map((h) => (
              <div
                key={h.short}
                title={h.full}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: h.isWeekend ? "#dc2626" : "var(--text-secondary, #475569)",
                  padding: "2px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {h.short}
              </div>
            ))}
          </div>

          {/* Calendar Grid (Days) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
            }}
          >
            {calendarDays.map((cell, idx) => {
              const isSelected = cell.isSelected;
              const isToday = cell.isToday;
              const isSunday = cell.isSunday;
              const isDisabled = cell.isDisabled;
              const isCurrentMonth = cell.isCurrentMonth;

              return (
                <button
                  key={`${cell.dateStr}_${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(cell.dateStr)}
                  title={`${HARI_HEADER[idx % 7].full}, ${cell.day} ${BULAN_NAMES[cell.month]} ${cell.year}${isToday ? " (Hari Ini)" : ""}`}
                  style={{
                    height: 32,
                    borderRadius: 6,
                    border: isToday && !isSelected ? "1px solid var(--red, #b3212f)" : "none",
                    backgroundColor: isSelected
                      ? "var(--red, #b3212f)"
                      : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : isDisabled
                      ? "var(--text-disabled, #cbd5e1)"
                      : !isCurrentMonth
                      ? "var(--text-muted, #94a3b8)"
                      : isSunday
                      ? "#dc2626"
                      : "var(--text, #0f172a)",
                    opacity: !isCurrentMonth ? 0.38 : 1,
                    fontSize: "12px",
                    fontWeight: isSelected || isToday ? 700 : isSunday ? 600 : 500,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    transition: "all 0.12s ease",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.backgroundColor = "rgba(179, 33, 47, 0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {cell.day}
                  {isToday && !isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 2,
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: "var(--red, #b3212f)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Bar: Quick "Hari Ini", "Hapus", "Tutup" */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--border, #e2e8f0)",
              fontSize: 11,
            }}
          >
            <button
              type="button"
              onClick={handleSelectToday}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--red, #b3212f)",
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              <RotateCcw size={11} />
              Hari Ini
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-muted, #64748b)",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red, #b3212f)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #64748b)")}
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  background: "#ffffff",
                  color: "var(--text, #0f172a)",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "3px 8px",
                  borderRadius: 5,
                  fontSize: 11,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle, #f8fafc)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
