
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Trophy,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Landmark,
  Rocket,
  Settings2,
  X,
  Command,
} from "lucide-react";

const navigation = [
  { label: "Command Centre", href: "/", icon: LayoutDashboard },
  { label: "Planner", href: "/planner", icon: CalendarCheck },
  { label: "Achievements", href: "/achievements", icon: Trophy },
  { label: "Ventures", href: "/ventures", icon: BriefcaseBusiness },
  { label: "Finance", href: "/finance", icon: ChartNoAxesCombined },
  { label: "Assets", href: "/assets", icon: Landmark },
  { label: "Projects", href: "/projects", icon: Rocket },
];

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function AppSidebar({
  open,
  onClose,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation overlay"
        className={`sidebar-overlay ${open ? "is-visible" : ""}`}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />

      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Link
            href="/"
            className="brand-lockup"
            onClick={onClose}
            aria-label="AKNM OS Command Centre"
          >
            <span className="brand-mark">
              <Command size={23} strokeWidth={2.3} />
            </span>

            <span className="brand-copy">
              <span className="brand-name">AKNM OS</span>
              <span className="brand-caption">FOUNDER OPERATING SYSTEM</span>
            </span>
          </Link>

          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close sidebar"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
                {active && <span className="sidebar-active-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-indicator" />
            <span>PERSONAL COMMAND CENTRE</span>
          </div>

          <div className="sidebar-footer">
            <span className="sidebar-footer-mark">A</span>
            <div className="sidebar-footer-copy">
              <span className="sidebar-footer-name">Akonam</span>
              <span className="sidebar-footer-role">Founder / CEO</span>
            </div>
            <Settings2 size={17} className="sidebar-settings-icon" />
          </div>
        </div>
      </aside>
    </>
  );
}
