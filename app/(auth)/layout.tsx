import React from "react";

export const metadata = {
  title: "Masuk ke Sistem - CARMEN PT JAI",
  description: "Halaman login autentikasi CARMEN PT Jatim Autocomp Indonesia",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--content-bg, #f8fafc)",
      }}
    >
      {children}
    </main>
  );
}
