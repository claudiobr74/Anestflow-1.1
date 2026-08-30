export type AdminTabId =
  | "overview"
  | "organizations"
  | "users"
  | "procedures"
  | "ai"
  | "financial"
  | "operations"
  | "issues"
  | "audit"
  | "settings";

export type AdminRoute = {
  tab: AdminTabId;
  organizationId: string | null;
  drawerId: string | null;
  pathname: string;
  search: string;
};

export const ADMIN_TABS: { id: AdminTabId; label: string; href: string }[] = [
  { id: "overview", label: "Visão Geral", href: "/admin" },
  { id: "organizations", label: "Organizações", href: "/admin/organizations" },
  { id: "users", label: "Usuários", href: "/admin/users" },
  { id: "procedures", label: "Procedimentos", href: "/admin/procedures" },
  { id: "ai", label: "Inteligência Artificial", href: "/admin/ai" },
  { id: "financial", label: "Financeiro", href: "/admin/financial" },
  { id: "operations", label: "Operação", href: "/admin/operations" },
  { id: "issues", label: "Problemas", href: "/admin/issues" },
  { id: "audit", label: "Auditoria", href: "/admin/audit" },
  { id: "settings", label: "Configurações", href: "/admin/settings" },
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAdminPathname(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function readSearchParam(search: string, key: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = params.get(key);
  return value && value.trim() ? value.trim() : null;
}

export function parseAdminRoute(pathname = window.location.pathname, search = window.location.search): AdminRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  const drawerId = readSearchParam(search, "id");

  if (path === "/admin" || path === "/admin/overview") {
    return { tab: "overview", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/organizations") {
    return { tab: "organizations", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path.startsWith("/admin/organizations/")) {
    const id = path.slice("/admin/organizations/".length);
    return {
      tab: "organizations",
      organizationId: UUID_RE.test(id) ? id : id || null,
      drawerId: null,
      pathname: path,
      search,
    };
  }
  if (path === "/admin/users") {
    return { tab: "users", organizationId: null, drawerId, pathname: path, search };
  }
  if (path === "/admin/procedures") {
    return { tab: "procedures", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/ai") {
    return { tab: "ai", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/financial") {
    return { tab: "financial", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/operations") {
    return { tab: "operations", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/issues") {
    return { tab: "issues", organizationId: null, drawerId, pathname: path, search };
  }
  if (path === "/admin/audit") {
    return { tab: "audit", organizationId: null, drawerId: null, pathname: path, search };
  }
  if (path === "/admin/settings") {
    return { tab: "settings", organizationId: null, drawerId: null, pathname: path, search };
  }
  return { tab: "overview", organizationId: null, drawerId: null, pathname: path, search };
}

export function navigateAdmin(href: string): void {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) {
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usersHref(drawerId?: string | null): string {
  return drawerId ? `/admin/users?id=${encodeURIComponent(drawerId)}` : "/admin/users";
}

export function issuesHref(drawerId?: string | null): string {
  return drawerId ? `/admin/issues?id=${encodeURIComponent(drawerId)}` : "/admin/issues";
}

export function organizationHref(id: string): string {
  return `/admin/organizations/${encodeURIComponent(id)}`;
}
