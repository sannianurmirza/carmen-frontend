"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, LucideIcon } from "lucide-react";

export type ActionCardTone = "red" | "blue" | "green" | "amber" | "purple" | "default";

export interface ActionCardProps {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  iconTone?: ActionCardTone;
  title: string;
  description?: string;
  buttonLabel?: string;
  buttonVariant?: "primary" | "outline";
  buttonIcon?: LucideIcon | null;
  badgeCount?: number;
  badgeLabel?: string;
  badgeTitle?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const ICON_TONE_STYLES: Record<ActionCardTone, { bg: string; color: string }> = {
  red: {
    bg: "rgba(143, 26, 37, 0.08)",
    color: "var(--red-dark, #8f1a25)",
  },
  blue: {
    bg: "rgba(37, 99, 235, 0.08)",
    color: "#1d4ed8",
  },
  green: {
    bg: "rgba(22, 163, 74, 0.08)",
    color: "#16a34a",
  },
  amber: {
    bg: "rgba(217, 119, 6, 0.08)",
    color: "#d97706",
  },
  purple: {
    bg: "rgba(147, 51, 234, 0.08)",
    color: "#9333ea",
  },
  default: {
    bg: "rgba(143, 26, 37, 0.08)",
    color: "var(--red-dark, #8f1a25)",
  },
};

export function ActionCard({
  href,
  onClick,
  icon: Icon,
  iconTone = "default",
  title,
  description = "",
  buttonLabel,
  buttonVariant = "outline",
  buttonIcon,
  badgeCount = 0,
  badgeLabel = "Belum Dilengkapi",
  badgeTitle = "Jumlah laporan yang belum dilengkapi",
  disabled = false,
  className = "",
  style,
}: ActionCardProps) {
  const router = useRouter();
  const tone = ICON_TONE_STYLES[iconTone] || ICON_TONE_STYLES.default;
  const ButtonIcon = buttonIcon === undefined ? ArrowRight : buttonIcon;

  // Sensible default for button label if not provided
  const resolvedButtonLabel =
    buttonLabel ||
    (buttonVariant === "primary" ? `Mulai ${title}` : `Buka ${title}`);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If the click originated from an interactive link or button inside, do nothing extra
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) {
      return;
    }
    if (disabled) return;

    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <div
      className={`panel action-card-standard ${className}`}
      onClick={handleCardClick}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "28px 24px",
        borderRadius: "var(--radius, 10px)",
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        position: "relative",
        cursor: (href || onClick) && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    >
      <div>
        {/* Top Header Row with Icon & Optional Badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: tone.bg,
              color: tone.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={26} strokeWidth={2.2} />
          </div>

          {badgeCount > 0 && (
            <span
              title={badgeTitle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 9999,
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                fontSize: 12,
                fontWeight: 700,
                pointerEvents: "none",
              }}
            >
              <AlertCircle size={13} />
              <span>
                {badgeCount} {badgeLabel}
              </span>
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 8px 0",
            color: "var(--text)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>

        {/* Description */}
        {description ? (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: "0 0 24px 0",
            }}
          >
            {description}
          </p>
        ) : (
          <div style={{ marginBottom: 24 }} />
        )}
      </div>

      {/* Bottom CTA Button */}
      <div style={{ marginTop: "auto" }}>
        {href ? (
          <Link
            href={disabled ? "#" : href}
            tabIndex={disabled ? -1 : 0}
            className={buttonVariant === "primary" ? "btn-primary" : "btn-outline"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "11px 18px",
              fontSize: "13.5px",
              fontWeight: 700,
              textDecoration: "none",
              borderRadius: "6px",
              pointerEvents: disabled ? "none" : "auto",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <span>{resolvedButtonLabel}</span>
            {ButtonIcon && <ButtonIcon size={16} />}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={buttonVariant === "primary" ? "btn-primary" : "btn-outline"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "11px 18px",
              fontSize: "13.5px",
              fontWeight: 700,
              borderRadius: "6px",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <span>{resolvedButtonLabel}</span>
            {ButtonIcon && <ButtonIcon size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

export const LandingMenuCard = ActionCard;
export default ActionCard;
