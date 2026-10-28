"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, RotateCcw, Check, Palette, Sparkles } from "lucide-react";
import { getContrastTextColor } from "@/lib/colorUtils";

export interface CateringColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cateringName: string;
  initialColorHex?: string | null;
  onSave: (colorHex: string | null) => Promise<void>;
}

// 18 Curated Preset Color Families with 3 rich shades each (light, standard, dark)
const PRESET_FAMILIES = [
  { name: "Red", shades: ["#FDA4AF", "#E11D48", "#9F1239"] },
  { name: "Orange", shades: ["#FDBA74", "#EA580C", "#9A3412"] },
  { name: "Amber", shades: ["#FCD34D", "#D97706", "#78350F"] },
  { name: "Yellow", shades: ["#FDE047", "#CA8A04", "#713F12"] },
  { name: "Lime", shades: ["#BEF264", "#65A30D", "#365314"] },
  { name: "Green", shades: ["#86EFAC", "#16A34A", "#14532D"] },
  { name: "Emerald", shades: ["#6EE7B7", "#059669", "#064E3B"] },
  { name: "Teal", shades: ["#5EEAD4", "#0D9488", "#115E59"] },
  { name: "Cyan", shades: ["#67E8F9", "#0891B2", "#155E75"] },
  { name: "Sky", shades: ["#7DD3FC", "#0284C7", "#075985"] },
  { name: "Blue", shades: ["#93C5FD", "#2563EB", "#1E3A8A"] },
  { name: "Indigo", shades: ["#A5B4FC", "#4F46E5", "#312E81"] },
  { name: "Violet", shades: ["#C4B5FD", "#7C3AED", "#4C1D95"] },
  { name: "Purple", shades: ["#D8B4FE", "#9333EA", "#581C87"] },
  { name: "Fuchsia", shades: ["#F0ABFC", "#C026D3", "#701A75"] },
  { name: "Pink", shades: ["#F472B6", "#DB2777", "#831843"] },
  { name: "Rose", shades: ["#FB7185", "#E11D48", "#881337"] },
  { name: "Gray", shades: ["#CBD5E1", "#475569", "#0F172A"] },
];

// Convert HSV (H: 0-360, S: 0-1, V: 0-1) to HEX (#RRGGBB)
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    const clamped = Math.max(0, Math.min(255, val));
    return clamped.toString(16).padStart(2, "0").toUpperCase();
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert HEX to HSV
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { h: 217, s: 0.85, v: 0.92 }; // default nice blue
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

export default function CateringColorPickerModal({
  isOpen,
  onClose,
  cateringName,
  initialColorHex,
  onSave,
}: CateringColorPickerModalProps) {
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState<string>("");
  const [hexError, setHexError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Wheel state
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>({
    h: 217,
    s: 0.85,
    v: 0.92,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  // Synchronize initial state on modal open
  useEffect(() => {
    if (isOpen) {
      const normalizedInitial =
        initialColorHex && /^#[0-9A-Fa-f]{6}$/.test(initialColorHex)
          ? initialColorHex.toUpperCase()
          : null;
      setSelectedHex(normalizedInitial);
      setHexInput(normalizedInitial || "");
      setHexError(null);
      if (normalizedInitial) {
        setHsv(hexToHsv(normalizedInitial));
      } else {
        setHsv({ h: 217, s: 0.85, v: 0.92 });
      }
    }
  }, [isOpen, initialColorHex]);

  // Draw interactive circular color wheel canvas
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;
    ctx.clearRect(0, 0, width, height);

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * width + x) * 4;

        if (dist <= radius) {
          // Angle in degrees: 0 to 360
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const sat = Math.min(1, dist / radius);
          const val = hsv.v; // current brightness / value

          // Inline HSV to RGB for performance
          const c = val * sat;
          const hNorm = angle / 60;
          const xVal = c * (1 - Math.abs((hNorm % 2) - 1));
          const m = val - c;

          let r = 0,
            g = 0,
            b = 0;
          if (hNorm >= 0 && hNorm < 1) {
            r = c;
            g = xVal;
            b = 0;
          } else if (hNorm >= 1 && hNorm < 2) {
            r = xVal;
            g = c;
            b = 0;
          } else if (hNorm >= 2 && hNorm < 3) {
            r = 0;
            g = c;
            b = xVal;
          } else if (hNorm >= 3 && hNorm < 4) {
            r = 0;
            g = xVal;
            b = c;
          } else if (hNorm >= 4 && hNorm < 5) {
            r = xVal;
            g = 0;
            b = c;
          } else {
            r = c;
            g = 0;
            b = xVal;
          }

          data[idx] = Math.round((r + m) * 255);
          data[idx + 1] = Math.round((g + m) * 255);
          data[idx + 2] = Math.round((b + m) * 255);
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw selection indicator (small white & dark ring)
    const angleRad = (hsv.h * Math.PI) / 180;
    const dist = hsv.s * radius;
    const pickX = radius + dist * Math.cos(angleRad);
    const pickY = radius + dist * Math.sin(angleRad);

    ctx.beginPath();
    ctx.arc(pickX, pickY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pickX, pickY, 4.5, 0, 2 * Math.PI);
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [hsv]);

  useEffect(() => {
    if (isOpen) {
      drawWheel();
    }
  }, [isOpen, drawWheel]);

  // Handle interaction with the circular wheel
  const handleWheelPointer = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const radius = rect.width / 2;
      const dx = x - radius;
      const dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      const sat = Math.max(0, Math.min(1, dist / radius));
      const newHsv = { h: Math.round(angle), s: sat, v: hsv.v };
      setHsv(newHsv);

      const computedHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      setSelectedHex(computedHex);
      setHexInput(computedHex);
      setHexError(null);
    },
    [hsv.v]
  );

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleWheelPointer(e);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      handleWheelPointer(e);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Brightness/Value slider handler
  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newV = parseFloat(e.target.value);
    const newHsv = { ...hsv, v: newV };
    setHsv(newHsv);
    const computedHex = hsvToHex(newHsv.h, newHsv.s, newV);
    setSelectedHex(computedHex);
    setHexInput(computedHex);
    setHexError(null);
  };

  // Direct HEX input change handler
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);

    // Format validation
    const trimmed = raw.trim();
    if (!trimmed) {
      setHexError("HEX tidak boleh kosong saat mengetik (gunakan Reset untuk default).");
      return;
    }

    // Auto-prefix # if user types 6 digits
    const formatted = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

    if (!/^#[0-9A-Fa-f]{6}$/.test(formatted)) {
      setHexError("Format HEX harus 6 digit: #RRGGBB (contoh: #E11D48).");
      return;
    }

    setHexError(null);
    const upper = formatted.toUpperCase();
    setSelectedHex(upper);
    setHsv(hexToHsv(upper));
  };

  // Preset click
  const handlePresetSelect = (hex: string) => {
    const upper = hex.toUpperCase();
    setSelectedHex(upper);
    setHexInput(upper);
    setHexError(null);
    setHsv(hexToHsv(upper));
  };

  // Reset to default (sets color_hex back to null)
  const handleResetToDefault = () => {
    setSelectedHex(null);
    setHexInput("");
    setHexError(null);
  };

  // Save handler
  const handleSave = async () => {
    if (hexError) return;
    setSaving(true);
    try {
      await onSave(selectedHex);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const displayHex = selectedHex || "#3B82F6";
  const previewTextColor = getContrastTextColor(displayHex);
  const isDefault = selectedHex === null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="color-picker-title"
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          width: "100%",
          maxWidth: 620,
          maxHeight: "92vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Palette size={18} />
            </div>
            <div>
              <h2
                id="color-picker-title"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                Pilih Warna Katering
              </h2>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                Kustomisasi warna visual untuk <strong>{cateringName}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            style={{
              background: "none",
              border: "none",
              padding: 6,
              borderRadius: 6,
              cursor: "pointer",
              color: "#64748B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* SECTION 1: LIVE PREVIEW */}
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#475569",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Live Preview
            </div>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                backgroundColor: displayHex,
                color: previewTextColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                transition: "background-color 0.15s ease",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      backgroundColor: displayHex,
                    }}
                  />
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>
                    {cateringName}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 1 }}>
                    {isDefault ? "Menggunakan Warna Default Sistem" : `Warna Kustom Aktif`}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  backgroundColor: previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.04em",
                }}
              >
                {isDefault ? "DEFAULT (#3B82F6)" : displayHex}
              </div>
            </div>
          </div>

          {/* TWO COLUMNS: CUSTOM WHEEL (LEFT) & PRESET PALETTE (RIGHT) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "190px 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* SECTION 2: CUSTOM COLOR (Interactive Wheel + Brightness) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#F8FAFC",
                padding: "14px 12px",
                borderRadius: 10,
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#475569",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  alignSelf: "flex-start",
                }}
              >
                Custom Color
              </div>

              {/* Circular Color Wheel Canvas */}
              <canvas
                ref={canvasRef}
                width={150}
                height={150}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handleWheelPointer}
                onTouchMove={handleWheelPointer}
                style={{
                  borderRadius: "50%",
                  cursor: "crosshair",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                  touchAction: "none",
                }}
                title="Pilih spektrum warna dan saturasi"
              />

              {/* Brightness / Value Slider */}
              <div style={{ width: "100%", marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#64748B",
                    marginBottom: 4,
                  }}
                >
                  <span>Kecerahan</span>
                  <span>{Math.round(hsv.v * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.01"
                  value={hsv.v}
                  onChange={handleBrightnessChange}
                  style={{
                    width: "100%",
                    cursor: "pointer",
                    accentColor: displayHex,
                  }}
                  title="Atur tingkat terang/gelap"
                />
              </div>
            </div>

            {/* SECTION 3: PRESET COLORS */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#F8FAFC",
                padding: "14px 14px",
                borderRadius: 10,
                border: "1px solid #E2E8F0",
                minHeight: 250,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: "#475569",
                    textTransform: "uppercase",
                  }}
                >
                  Preset Colors (18 Rona & Gradasi)
                </div>
                <span style={{ fontSize: 10.5, color: "#94A3B8" }}>Pilih swatch</span>
              </div>

              {/* Swatches Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 6,
                  maxHeight: 180,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {PRESET_FAMILIES.map((family) =>
                  family.shades.map((shade) => {
                    const isSelected = selectedHex === shade.toUpperCase();
                    return (
                      <button
                        key={`${family.name}-${shade}`}
                        type="button"
                        onClick={() => handlePresetSelect(shade)}
                        title={`${family.name} (${shade})`}
                        style={{
                          height: 26,
                          borderRadius: 6,
                          backgroundColor: shade,
                          border: isSelected ? "2px solid #0F172A" : "1px solid rgba(0,0,0,0.12)",
                          boxShadow: isSelected ? "0 0 0 2px #FFFFFF, 0 2px 4px rgba(0,0,0,0.2)" : "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          transition: "transform 0.1s ease",
                        }}
                      >
                        {isSelected && (
                          <Check
                            size={14}
                            style={{
                              color: getContrastTextColor(shade),
                              strokeWidth: 3,
                            }}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: HEX INPUT & RESET ACTION */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              paddingTop: 4,
              borderTop: "1px solid #F1F5F9",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                htmlFor="hex-color-input"
                style={{
                  display: "block",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                Input Kode HEX (#RRGGBB)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="hex-color-input"
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  placeholder="#E11D48"
                  maxLength={7}
                  style={{
                    width: 140,
                    height: 36,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: hexError ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: 700,
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 6,
                    backgroundColor: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Kembalikan warna katering ke warna standar aplikasi"
                >
                  <RotateCcw size={13} />
                  <span>Reset ke Default</span>
                </button>
              </div>

              {hexError && (
                <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4, fontWeight: 500 }}>
                  {hexError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #E2E8F0",
            backgroundColor: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              backgroundColor: "#FFFFFF",
              color: "#475569",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !!hexError}
            style={{
              height: 36,
              padding: "0 18px",
              borderRadius: 6,
              border: "none",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: saving || !!hexError ? "not-allowed" : "pointer",
              opacity: saving || !!hexError ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {saving ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <Check size={14} />
                <span>Simpan Warna</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
