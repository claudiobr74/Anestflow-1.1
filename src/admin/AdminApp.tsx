import React from "react";
import LoginScreen from "../components/LoginScreen";
import { beginSession, clearClinicalBrowserCache, clearSessionClock } from "../lib/sessionPolicy";
import { ensureSupabaseConfig, getSupabase, isSupabaseConfigured } from "../lib/supabase";
import type { SessionUser } from "../lib/sessionUser";
import { AdminRpcError, adminBootstrapSelf, adminListIssues, isPlatformAdmin } from "./api";
import { parseAdminRoute, type AdminRoute } from "./routes";
import type { AdminTheme } from "./types";
import AdminShell from "./components/AdminShell";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import AdminOrganizationsPage from "./pages/AdminOrganizationsPage";
import AdminOrganizationDetailPage from "./pages/AdminOrganizationDetailPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminProceduresPage from "./pages/AdminProceduresPage";
import AdminAiPage from "./pages/AdminAiPage";
import AdminFinancialPage from "./pages/AdminFinancialPage";
import AdminOperationsPage from "./pages/AdminOperationsPage";
import AdminIssuesPage from "./pages/AdminIssuesPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";

type Gate = "boot" | "login" | "forbidden" | "ready" | "error";

function readStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem("anesthesia_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

function readTheme(): AdminTheme {
  try {
    const saved = localStorage.getItem("anesthesia_theme");
    if (saved === "dark" || saved === "dark-clean" || saved === "light") return saved;
  } catch {
    /* ignore */
  }
  return "light";
}

export default function AdminApp() {
  const [route, setRoute] = React.useState<AdminRoute>(() => parseAdminRoute());
  const [theme, setTheme] = React.useState<AdminTheme>(() => readTheme());
  const [gate, setGate] = React.useState<Gate>("boot");
  const [gateError, setGateError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<SessionUser | null>(() => readStoredUser());
  const [issuesOpen, setIssuesOpen] = React.useState(0);

  const isDark = theme === "dark" || theme === "dark-clean";

  React.useEffect(() => {
    const onPop = () => setRoute(parseAdminRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const runGate = React.useCallback(async () => {
    setGateError(null);
    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured()) {
        setGate("error");
        setGateError("Supabase não configurado.");
        return;
      }
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (!sessionUser) {
        setGate("login");
        return;
      }
      const bootstrapped = await adminBootstrapSelf();
      const admin = bootstrapped && (await isPlatformAdmin());
      if (!admin) {
        setGate("forbidden");
        return;
      }
      try {
        const issues = await adminListIssues();
        setIssuesOpen(issues.filter((issue) => issue.status !== "resolved").length);
      } catch {
        setIssuesOpen(0);
      }
      setGate("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao autorizar o Admin.";
      if (err instanceof AdminRpcError && /not_authenticated|not_platform_admin/i.test(err.message)) {
        setGate(err.message.includes("not_platform_admin") ? "forbidden" : "login");
        return;
      }
      if (/not_authenticated/i.test(message)) {
        setGate("login");
        return;
      }
      if (/not_platform_admin/i.test(message)) {
        setGate("forbidden");
        return;
      }
      setGate("error");
      setGateError(message);
    }
  }, []);

  React.useEffect(() => {
    void runGate();
  }, [runGate]);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured()) return;
      const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          setGate("login");
          return;
        }
        void runGate();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [runGate]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: AdminTheme = prev === "light" ? "dark-clean" : "light";
      localStorage.setItem("anesthesia_theme", next);
      return next;
    });
  };

  const handleLogin = (doctor: SessionUser) => {
    setUser(doctor);
    try {
      localStorage.setItem("anesthesia_user", JSON.stringify(doctor));
    } catch {
      /* ignore */
    }
    beginSession();
    void runGate();
  };

  const handleLogout = async () => {
    clearSessionClock();
    clearClinicalBrowserCache();
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* ignore */
    }
    setUser(null);
    setGate("login");
  };

  const openClinical = () => {
    window.location.assign("/");
  };

  if (gate === "login") {
    return <LoginScreen onLogin={handleLogin} isDark={isDark} onToggleTheme={toggleTheme} />;
  }

  if (gate === "boot") {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-zinc-950 text-zinc-300" : "bg-[#f8f9fa] text-[#636e72]"}`}>
        <p className="text-sm font-medium">Carregando Admin…</p>
      </div>
    );
  }

  if (gate === "error") {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-[#f8f9fa] text-[#2d3436]"}`}>
        <div className={`max-w-md rounded-2xl border p-6 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-[#e8ecf0] bg-white"}`}>
          <h1 className="mb-2 text-lg font-bold">Não foi possível abrir o Admin</h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{gateError}</p>
          <button type="button" className="mt-4 rounded-lg bg-[#6c5ce7] px-4 py-2 text-sm font-semibold text-white" onClick={() => void runGate()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (gate === "forbidden") {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-[#f8f9fa] text-[#2d3436]"}`}>
        <div className={`max-w-md rounded-2xl border p-6 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-[#e8ecf0] bg-white"}`}>
          <p className="mb-1 text-sm font-semibold text-[#6c5ce7]">403</p>
          <h1 className="mb-2 text-lg font-bold">Acesso negado</h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
            Você não tem permissão de administrador da plataforma.
          </p>
          <button type="button" className="mt-4 rounded-lg bg-[#6c5ce7] px-4 py-2 text-sm font-semibold text-white" onClick={openClinical}>
            Voltar à ficha clínica
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      route={route}
      isDark={isDark}
      userName={user?.name || "Admin"}
      issuesOpen={issuesOpen}
      onToggleTheme={toggleTheme}
      onLogout={() => {
        void handleLogout();
      }}
      onOpenClinical={openClinical}
    >
      {route.tab === "overview" ? <AdminOverviewPage isDark={isDark} /> : null}
      {route.tab === "organizations" && !route.organizationId ? <AdminOrganizationsPage isDark={isDark} /> : null}
      {route.tab === "organizations" && route.organizationId ? (
        <AdminOrganizationDetailPage organizationId={route.organizationId} isDark={isDark} />
      ) : null}
      {route.tab === "users" ? <AdminUsersPage isDark={isDark} drawerId={route.drawerId} /> : null}
      {route.tab === "procedures" ? <AdminProceduresPage isDark={isDark} /> : null}
      {route.tab === "ai" ? <AdminAiPage isDark={isDark} /> : null}
      {route.tab === "financial" ? <AdminFinancialPage isDark={isDark} /> : null}
      {route.tab === "operations" ? <AdminOperationsPage isDark={isDark} /> : null}
      {route.tab === "issues" ? <AdminIssuesPage isDark={isDark} drawerId={route.drawerId} /> : null}
      {route.tab === "audit" ? <AdminAuditPage isDark={isDark} /> : null}
      {route.tab === "settings" ? <AdminSettingsPage isDark={isDark} /> : null}
    </AdminShell>
  );
}
