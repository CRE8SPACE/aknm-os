
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  CalendarDays,
  CheckCheck,
  LogOut,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const pageTitles: Record<string, string> = {
  "/": "Command Centre",
  "/planner": "Planner",
  "/achievements": "Achievements",
  "/ventures": "Business Portfolio",
  "/finance": "Finance",
  "/assets": "Assets",
  "/projects": "Projects",
};

type AppHeaderProps = {
  onMenuClick: () => void;
  onSearchChange: (value: string) => void;
};

export default function AppHeader({
  onMenuClick,
  onSearchChange,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [dateLabel, setDateLabel] = useState("");
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const title = useMemo(() => {
    if (pageTitles[pathname]) return pageTitles[pathname];

    const matched = Object.keys(pageTitles)
      .filter((path) => path !== "/")
      .find((path) => pathname.startsWith(`${path}/`));

    return matched ? pageTitles[matched] : "Command Centre";
  }, [pathname]);

  useEffect(() => {
    setDateLabel(
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date())
    );
  }, []);

  useEffect(() => {
    onSearchChange(search);
  }, [search, onSearchChange]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
    setSignOutError("");
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError(error.message);
        setSigningOut(false);
        return;
      }

      setAccountMenuOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError(
        "Sign-out failed. Check your connection and try again."
      );
      setSigningOut(false);
    }
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="icon-button mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={21} />
        </button>

        <div className="header-title-group">
          <div className="header-eyebrow">YOUR EXECUTIVE OVERVIEW</div>
          <h1 className="header-page-title">{title}</h1>
        </div>
      </div>

      <div className="header-actions">
        <label className="header-search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search today's agenda..."
            aria-label="Search today's agenda"
          />
          <kbd>/</kbd>
        </label>

        <div className="header-date">
          <CalendarDays size={16} />
          <span>{dateLabel || "Loading date..."}</span>
        </div>

        <div className="notification-wrapper">
          <button
            type="button"
            className={`icon-button notification-button ${
              notificationsOpen ? "is-selected" : ""
            }`}
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setAccountMenuOpen(false);
              setSignOutError("");
            }}
            aria-label="Toggle notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={19} />
          </button>

          {notificationsOpen && (
            <div className="notification-popover">
              <div className="notification-popover-header">
                <div>
                  <strong>Notifications</strong>
                  <p>Stay on top of your priorities.</p>
                </div>
                <CheckCheck size={18} />
              </div>

              <div className="notification-empty">
                <span className="notification-empty-icon">
                  <Bell size={21} />
                </span>
                <strong>You're all caught up</strong>
                <p>
                  Notifications will appear here when alerts are connected.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="account-menu-wrapper">
          <button
            type="button"
            className={`header-profile ${
              accountMenuOpen ? "is-selected" : ""
            }`}
            onClick={() => {
              setAccountMenuOpen((value) => !value);
              setNotificationsOpen(false);
              setSignOutError("");
            }}
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            title="Account menu"
          >
            <span className="profile-avatar">A</span>
            <ChevronDown
              size={15}
              className={`profile-chevron ${
                accountMenuOpen ? "is-rotated" : ""
              }`}
            />
          </button>

          {accountMenuOpen && (
            <div className="account-menu" role="menu">
              <div className="account-menu-heading">
                <span className="account-menu-icon">
                  <UserRound size={19} />
                </span>
                <div>
                  <strong>Your account</strong>
                  <p>AKNM OS</p>
                </div>
              </div>

              <div className="account-menu-divider" />

              {signOutError && (
                <p className="account-menu-error" role="alert">
                  {signOutError}
                </p>
              )}

              <button
                type="button"
                className="account-signout-button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? (
                  <LoaderCircle className="account-signout-spinner" size={17} />
                ) : (
                  <LogOut size={17} />
                )}

                <span>
                  {signingOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
