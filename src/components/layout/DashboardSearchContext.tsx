
"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type DashboardSearchContextValue = {
  searchQuery: string;
};

const DashboardSearchContext =
  createContext<DashboardSearchContextValue>({
    searchQuery: "",
  });

export function DashboardSearchProvider({
  searchQuery,
  children,
}: {
  searchQuery: string;
  children: ReactNode;
}) {
  return (
    <DashboardSearchContext.Provider value={{ searchQuery }}>
      {children}
    </DashboardSearchContext.Provider>
  );
}

export function useDashboardSearch() {
  return useContext(DashboardSearchContext);
}
