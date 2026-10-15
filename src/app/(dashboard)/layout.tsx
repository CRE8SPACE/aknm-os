
import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import "./dashboard.css";
import "./module-placeholder.css";
import "./account-menu.css";

function DashboardLoading() {
  return (
    <div
      role="status"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0d12",
        color: "#b8f36b",
        fontSize: "14px",
      }}
    >
      Loading AKNM OS...
    </div>
  );
}

async function AuthenticatedDashboard({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}
