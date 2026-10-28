"use client";

import React from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

export interface ExportExcelButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  selectedCount?: number;
  label?: string;
  variant?: "solid" | "outline";
}

export function ExportExcelButton({
  isLoading = false,
  selectedCount,
  label = "Export",
  disabled,
  className = "",
  style,
  children,
  onClick,
  ...props
}: ExportExcelButtonProps) {
  let displayLabel = label;

  if (isLoading) {
    displayLabel = "Mengunduh...";
  } else if (typeof selectedCount === "number" && selectedCount > 0) {
    displayLabel = `Export (${selectedCount})`;
  } else {
    displayLabel = label;
  }

  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`btn-export-excel ${className}`}
      style={style}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="btn-export-excel-spin" size={15} />
      ) : (
        <FileSpreadsheet size={15} />
      )}
      <span>{displayLabel}</span>
    </button>
  );
}

export default ExportExcelButton;
