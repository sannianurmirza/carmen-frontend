"use client";

import React, { useState, useEffect } from "react";
import { getBaseUrl } from "@/lib/api";

interface ProtectedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackText?: string;
}

export default function ProtectedImage({
  src,
  alt = "Gambar",
  fallbackText = "Gambar tidak tersedia",
  style,
  className,
  ...rest
}: ProtectedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setLoading(false);
      setHasError(true);
      return;
    }

    // Jika bukan gambar upload internal, gunakan langsung
    if (!src.includes("/uploads/") && !src.includes("/audit-findings/photos/")) {
      setBlobUrl(src);
      setLoading(false);
      setHasError(false);
      return;
    }

    let isMounted = true;
    let currentObjectUrl: string | null = null;
    setLoading(true);
    setHasError(false);

    const fullUrl =
      src.startsWith("http://") || src.startsWith("https://")
        ? src
        : `${getBaseUrl()}${src.startsWith("/") ? "" : "/"}${src}`;

    fetch(fullUrl, {
      credentials: "include", // Pastikan cookie dikirim
      cache: "default",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cType = res.headers.get("content-type") || "";
        // Tolak bila respons server adalah JSON/HTML error
        if (cType.includes("json") || cType.includes("html") || !cType.startsWith("image/")) {
          throw new Error("Respons bukan format gambar valid.");
        }
        return res.blob();
      })
      .then((blob) => {
        if (!isMounted) return;
        currentObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(currentObjectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 120,
          backgroundColor: "var(--border, #f1f5f9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted, #94a3b8)",
          fontSize: 12,
          borderRadius: 6,
          ...style,
        }}
      >
        <span>Memuat gambar...</span>
      </div>
    );
  }

  if (hasError || !blobUrl) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 120,
          backgroundColor: "var(--bg-main, #f8fafc)",
          border: "1px dashed var(--border, #cbd5e1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted, #94a3b8)",
          fontSize: 12,
          borderRadius: 6,
          padding: 12,
          textAlign: "center",
          ...style,
        }}
      >
        <span>{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      style={style}
      className={className}
      {...rest}
    />
  );
}
