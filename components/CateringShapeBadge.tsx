"use client";

import React from "react";
import {
  CateringShape,
  CateringColor,
  CATERING_COLOR_CONFIG,
  CATERING_SHAPE_LABELS,
} from "@/lib/api";

export { CATERING_SHAPE_LABELS };

export const SHAPE_LABELS: Record<string, string> = {
  circle: "Bundar",
  rectangle: "Kotak",
  // Fallbacks for any legacy records
  square: "Kotak",
  triangle: "Bundar",
  diamond: "Kotak",
  hexagon: "Kotak",
};

export const AVAILABLE_SHAPES: CateringShape[] = [
  "circle",
  "rectangle",
];

interface CateringShapeBadgeProps {
  shape?: CateringShape | string;
  color?: CateringColor | string;
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
  showLabel?: boolean;
  border?: boolean;
  shadow?: boolean;
}

export default function CateringShapeBadge({
  shape = "circle",
  color = "biru",
  size = "md",
  className = "",
  showLabel = false,
  border = true,
  shadow = false,
}: CateringShapeBadgeProps) {
  const normalizedShape: CateringShape =
    shape === "rectangle" ? "rectangle" : "circle";

  const colorConfig = CATERING_COLOR_CONFIG[color as CateringColor];
  const displayHex = colorConfig ? colorConfig.hex : color.startsWith("#") ? color : "#3B82F6";
  const colorLabel = colorConfig ? colorConfig.label : "Warna";

  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 14
      : size === "lg"
      ? 28
      : size === "xl"
      ? 40
      : 20;

  const getShapeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: pixelSize,
      height: pixelSize,
      backgroundColor: displayHex,
      display: "inline-block",
      flexShrink: 0,
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      boxShadow: shadow ? "0 2px 6px rgba(0,0,0,0.15)" : undefined,
    };

    switch (normalizedShape) {
      case "circle":
        return {
          ...base,
          borderRadius: "50%",
          border: border ? "1.5px solid rgba(0,0,0,0.18)" : undefined,
        };
      case "rectangle":
        return {
          ...base,
          width: Math.round(pixelSize * 1.55),
          borderRadius: "3px",
          border: border ? "1.5px solid rgba(0,0,0,0.18)" : undefined,
        };
      default:
        return {
          ...base,
          borderRadius: "50%",
        };
    }
  };

  const label = CATERING_SHAPE_LABELS[normalizedShape] || "Bundar";

  return (
    <span
      className={`catering-shape-badge-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        verticalAlign: "middle",
      }}
      title={`${label} (${colorLabel})`}
      aria-label={`${label} berwarna ${colorLabel}`}
    >
      <span style={getShapeStyle()} aria-hidden="true" />
      {showLabel && (
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {label}
        </span>
      )}
    </span>
  );
}
