
"use client";

import { useCallback, useState } from "react";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import { DashboardSearchProvider } from "./DashboardSearchContext";

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  return (
    <div className="dashboard-shell">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="dashboard-main">
        <AppHeader
          onMenuClick={() => setSidebarOpen(true)}
          onSearchChange={handleSearchChange}
        />

        <DashboardSearchProvider searchQuery={searchQuery}>
          <main className="dashboard-content">{children}</main>
        </DashboardSearchProvider>
      </div>
    </div>
  );
}
