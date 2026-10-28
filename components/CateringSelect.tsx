"use client";

import React from "react";

export interface CateringOption {
  id: number | string;
  nama: string;
}

export interface CateringSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  caterings: CateringOption[];
  value: number | string;
  onChange: (val: string) => void;
  context?: "filter" | "input";
  allLabel?: string;
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
  selectClassName?: string;
}

export function CateringSelect({
  caterings,
  value,
  onChange,
  context = "filter",
  allLabel = "Semua Katering",
  placeholder = "Pilih Katering",
  label = "KATERING",
  showLabel = false,
  selectClassName = "select-input",
  className = "",
  style,
  disabled,
  ...props
}: CateringSelectProps) {
  const isInput = context === "input";

  return (
    <div className={`catering-select-container ${className}`} style={{ width: "100%", ...style }}>
      {showLabel && (
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            marginBottom: "6px",
            color: "var(--text-muted, #6b7280)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </label>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClassName}
        style={{
          width: "100%",
          height: "38px",
          borderRadius: "8px",
          border: "1px solid var(--border, #d1d5db)",
          backgroundColor: "var(--bg-card, #ffffff)",
          color: "var(--text-main, #111827)",
          padding: "0 12px",
          fontSize: "13px",
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          opacity: disabled ? 0.6 : 1,
        }}
        {...props}
      >
        {isInput ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : (
          <option value="">{allLabel}</option>
        )}
        {caterings.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nama}
          </option>
        ))}
      </select>
    </div>
  );
}

export default CateringSelect;
