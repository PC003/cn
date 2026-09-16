import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun, Network, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS } from "../types/nav";
import { useTheme } from "../hooks/useTheme";
import { BackendStatus } from "./BackendStatus";
import { StatusPill } from "./StatusPill";

export function Layout() {
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-surface transition-all duration-200 md:flex ${
          collapsed ? "w-16" : "w-72"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <Network className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">Netflix Streaming</p>
              <p className="truncate text-xs leading-tight text-text-muted">Transport Lab</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-text-muted hover:bg-surface-alt hover:text-text"
                }`
              }
              title={item.description}
            >
              {!collapsed ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.status === "planned" && (
                    <span className="shrink-0 rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      R{item.reviewMilestone}
                    </span>
                  )}
                </>
              ) : (
                <span className="mx-auto text-xs font-semibold">{item.label.slice(0, 2)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs text-text-muted hover:bg-surface-alt"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Network className="h-5 w-5 shrink-0 text-primary" />
            <select
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
              value={location.pathname}
              onChange={(e) => navigate(e.target.value)}
            >
              {NAV_ITEMS.map((item) => (
                <option key={item.path} value={item.path}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden text-xs text-text-muted md:block">
            Computer Networks Case Study &mdash; Interactive Simulation Prototype
          </div>
          <div className="flex items-center gap-4">
            <BackendStatus />
            <button
              onClick={toggle}
              className="rounded-md border border-border p-1.5 text-text-muted hover:bg-surface-alt"
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-text-muted md:px-8">
          Educational simulation inspired by publicly documented Netflix architecture &mdash; not affiliated with
          or reproducing Netflix's production systems.{" "}
          <StatusPillInlineLegend />
        </footer>
      </div>
    </div>
  );
}

function StatusPillInlineLegend() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle">
      <StatusPill status="ready" />
      <StatusPill status="planned" />
    </span>
  );
}
