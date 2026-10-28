"use client";

import { useAuth } from "@/context/AuthContext";
import { normalizeRole } from "@/lib/permissions";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import StaffDashboard from "@/components/dashboard/StaffDashboard";
import ApproverDashboard from "@/components/dashboard/ApproverDashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--text-muted, #64748b)",
          fontSize: 13,
        }}
      >
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        <span>Memuat dashboard...</span>
      </div>
    );
  }

  const role = normalizeRole(user?.role);

  if (role === "approver") {
    return <ApproverDashboard user={user} />;
  }

  if (role === "staff") {
    return <StaffDashboard user={user} />;
  }

  return <AdminDashboard user={user} />;
}
