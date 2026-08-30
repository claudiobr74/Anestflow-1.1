import React from "react";
import { Bell, HeartPulse, LogOut, Moon, Sun, Stethoscope } from "lucide-react";
import { ADMIN_TABS, navigateAdmin, type AdminRoute } from "../routes";
import { initialsFromName } from "../format";

export default function AdminShell({
  route,
  isDark,
  userName,
  issuesOpen,
  onToggleTheme,
  onLogout,
  onOpenClinical,
  children,
}: {
  route: AdminRoute;
  isDark: boolean;
  userName: string;
  issuesOpen: number;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenClinical: () => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const headerBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#e8ecf0]";
  const pageBg = isDark ? "bg-zinc-950 text-zinc-100" : "bg-[#f8f9fa] text-[#2d3436]";

  return (
    <div className={`flex min-h-screen flex-col font-sans antialiased ${pageBg}`}>
      <header className={`sticky top-0 z-40 ${headerBg}`}>
        <div className={`flex h-[68px] items-center justify-between border-b px-8 py-4 ${isDark ? "border-zinc-800" : "border-[#e8ecf0]"}`}>
          <div className="flex items-center gap-2.5">
            <HeartPulse className="h-7 w-7 text-[#6c5ce7]" strokeWidth={2.25} aria-hidden />
            <div className="flex items-baseline gap-1.5 text-[18px] leading-none">
              <span className="font-bold text-[#6c5ce7]">AnestFlow</span>
              <span className={`font-normal ${isDark ? "text-zinc-200" : "text-[#2d3436]"}`}>Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Problemas"
              onClick={() => navigateAdmin("/admin/issues")}
              className={`relative rounded-lg p-2 ${isDark ? "hover:bg-zinc-800" : "hover:bg-[#f8f9fa]"}`}
            >
              <Bell className={`h-5 w-5 ${isDark ? "text-zinc-300" : "text-[#2d3436]"}`} />
              {issuesOpen > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500" />
              ) : null}
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg px-1 py-1"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"
                  }`}
                >
                  {initialsFromName(userName)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight">{userName || "Admin"}</span>
                  <span className={`block text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Super Admin</span>
                </span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className={`absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border shadow-lg ${
                    isDark ? "border-zinc-800 bg-zinc-900" : "border-[#e8ecf0] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenClinical();
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${isDark ? "hover:bg-zinc-800" : "hover:bg-[#f8f9fa]"}`}
                  >
                    <Stethoscope className="h-4 w-4" /> Ficha clínica
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleTheme();
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${isDark ? "hover:bg-zinc-800" : "hover:bg-[#f8f9fa]"}`}
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{" "}
                    {isDark ? "Modo Claro" : "Modo Escuro"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 ${isDark ? "hover:bg-zinc-800 text-rose-400" : "hover:bg-[#f8f9fa]"}`}
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <nav
          className={`flex h-12 items-stretch gap-5 overflow-x-auto border-b px-8 ${isDark ? "border-zinc-800" : "border-[#e8ecf0]"}`}
          aria-label="Admin"
        >
          {ADMIN_TABS.map((tab) => {
            const active = route.tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigateAdmin(tab.href)}
                className={`relative shrink-0 text-[14px] leading-none ${
                  active
                    ? "font-semibold text-[#6c5ce7]"
                    : isDark
                      ? "font-medium text-zinc-400 hover:text-zinc-200"
                      : "font-medium text-[#2d3436] hover:text-[#6c5ce7]"
                }`}
              >
                {tab.label}
                {active ? <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#6c5ce7]" /> : null}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
