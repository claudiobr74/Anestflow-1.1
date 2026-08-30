import { getSupabase } from "../lib/supabase";
import type {
  AdminIssue,
  AdminListPage,
  AdminRange,
  AdminSettings,
  AdminSettingsPatch,
  AdminUserDetail,
  AdminUserListItem,
  AdminWhoami,
  AiOverview,
  AuditEvent,
  DashboardOverview,
  FinancialOverview,
  OperationsOverview,
  OrganizationDetail,
  OrganizationListItem,
  OrganizationPatch,
  OrgPlan,
  OrgType,
  ProcedureMeta,
} from "./types";

type RpcError = {
  message?: string;
  code?: string;
  details?: string;
};

export class AdminRpcError extends Error {
  code: string;
  constructor(message: string, code = "rpc_error") {
    super(message);
    this.name = "AdminRpcError";
    this.code = code;
  }
}

function parseJson<T>(data: unknown): T {
  if (typeof data === "string") {
    return JSON.parse(data) as T;
  }
  return data as T;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args ?? {});
  if (error) {
    const rpcError = error as RpcError;
    throw new AdminRpcError(rpcError.message ?? fn, rpcError.code ?? "rpc_error");
  }
  return parseJson<T>(data);
}

function asList<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

function paginateLocal<T>(items: T[], page: number, pageSize: number): AdminListPage<T> {
  const safePage = Math.max(page, 1);
  const safeSize = Math.max(pageSize, 1);
  const start = (safePage - 1) * safeSize;
  return {
    total_count: items.length,
    page: safePage,
    page_size: safeSize,
    items: items.slice(start, start + safeSize),
  };
}

function normalizeProcedure(row: ProcedureMeta): ProcedureMeta {
  const nested = row.integrity && typeof row.integrity === "object" ? row.integrity : null;
  return {
    ...row,
    organization_id: row.organization_id ?? null,
    integrity_status: row.integrity_status ?? nested?.integrity_status ?? "not_verified",
    snapshot_ok: row.snapshot_ok ?? nested?.snapshot_ok ?? null,
    persisted_ok: row.persisted_ok ?? nested?.persisted_ok ?? null,
  };
}

function normalizePage<T>(data: AdminListPage<T> | null | undefined, fallbackItems: T[]): AdminListPage<T> {
  if (!data || !Array.isArray(data.items)) {
    return {
      total_count: fallbackItems.length,
      page: 1,
      page_size: fallbackItems.length,
      items: fallbackItems,
    };
  }
  return {
    total_count: Number(data.total_count) || data.items.length,
    page: Number(data.page) || 1,
    page_size: Number(data.page_size) || data.items.length,
    items: data.items,
  };
}

/** Unused no-op. /admin must not promote the first visitor. */
export async function adminBootstrapSelf(): Promise<boolean> {
  return false;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const value = await rpc<boolean>("is_platform_admin");
  return value === true;
}

export async function adminWhoami(): Promise<AdminWhoami> {
  const row = await rpc<AdminWhoami>("admin_whoami");
  return {
    user_id: row?.user_id ?? "",
    role: row?.role ?? "USER",
    organization_ids: Array.isArray(row?.organization_ids) ? row.organization_ids : [],
  };
}

export async function adminDashboardOverview(range: AdminRange): Promise<DashboardOverview> {
  return rpc<DashboardOverview>("admin_dashboard_overview", { p_range: range });
}

export async function adminListOrganizations(): Promise<OrganizationListItem[]> {
  const rows = await rpc<OrganizationListItem[] | null>("admin_list_organizations");
  return asList(rows);
}

export async function adminListOrganizationsPage(
  page = 1,
  pageSize = 10,
  search?: string
): Promise<AdminListPage<OrganizationListItem>> {
  try {
    const data = await rpc<AdminListPage<OrganizationListItem>>("admin_list_organizations_page", {
      p_page: page,
      p_page_size: pageSize,
      p_search: search || null,
    });
    return normalizePage(data, []);
  } catch {
    const q = (search ?? "").trim().toLowerCase();
    const rows = await adminListOrganizations();
    const filtered = q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
    return paginateLocal(filtered, page, pageSize);
  }
}

export async function adminGetOrganization(id: string): Promise<OrganizationDetail> {
  return rpc<OrganizationDetail>("admin_get_organization", { p_id: id });
}

export async function adminCreateOrganization(
  name: string,
  type: OrgType,
  plan: OrgPlan
): Promise<OrganizationDetail> {
  return rpc<OrganizationDetail>("admin_create_organization", {
    p_name: name,
    p_type: type,
    p_plan: plan,
  });
}

export async function adminUpdateOrganization(
  id: string,
  patch: OrganizationPatch
): Promise<OrganizationDetail> {
  return rpc<OrganizationDetail>("admin_update_organization", {
    p_id: id,
    p_patch: patch,
  });
}

export async function adminArchiveOrganization(id: string): Promise<OrganizationDetail> {
  return rpc<OrganizationDetail>("admin_archive_organization", { p_id: id });
}

export async function adminListUsers(): Promise<AdminUserListItem[]> {
  const rows = await rpc<AdminUserListItem[] | null>("admin_list_users");
  return asList(rows);
}

export async function adminListUsersPage(
  page = 1,
  pageSize = 10,
  search?: string
): Promise<AdminListPage<AdminUserListItem>> {
  try {
    const data = await rpc<AdminListPage<AdminUserListItem>>("admin_list_users_page", {
      p_page: page,
      p_page_size: pageSize,
      p_search: search || null,
    });
    return normalizePage(data, []);
  } catch {
    const q = (search ?? "").trim().toLowerCase();
    const rows = await adminListUsers();
    const filtered = q
      ? rows.filter((row) => `${row.full_name ?? ""} ${row.email ?? ""} ${row.crm ?? ""}`.toLowerCase().includes(q))
      : rows;
    return paginateLocal(filtered, page, pageSize);
  }
}

export async function adminGetUser(id: string): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_get_user", { p_id: id });
}

export async function adminSetUserStatus(userId: string, status: string): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_set_user_status", {
    p_user_id: userId,
    p_status: status,
  });
}

export async function adminAddMembership(
  userId: string,
  organizationId: string,
  role = "anestesista"
): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_add_membership", {
    p_user_id: userId,
    p_organization_id: organizationId,
    p_role: role,
  });
}

export async function adminRemoveMembership(userId: string, organizationId: string): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_remove_membership", {
    p_user_id: userId,
    p_organization_id: organizationId,
  });
}

export async function adminSetMembershipRole(
  userId: string,
  organizationId: string,
  role: string
): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_set_membership_role", {
    p_user_id: userId,
    p_organization_id: organizationId,
    p_role: role,
  });
}

export async function adminListProceduresMeta(limit = 100): Promise<ProcedureMeta[]> {
  const rows = await rpc<ProcedureMeta[] | null>("admin_list_procedures_meta", { p_limit: limit });
  return asList(rows).map(normalizeProcedure);
}

export async function adminListProceduresPage(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  organizationId?: string | null;
} = {}): Promise<AdminListPage<ProcedureMeta>> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  try {
    const data = await rpc<AdminListPage<ProcedureMeta>>("admin_list_procedures_page", {
      p_page: page,
      p_page_size: pageSize,
      p_search: opts.search || null,
      p_status: opts.status && opts.status !== "all" ? opts.status : null,
      p_organization_id: opts.organizationId || null,
    });
    const normalized = normalizePage(data, []);
    return { ...normalized, items: normalized.items.map(normalizeProcedure) };
  } catch {
    const rows = await adminListProceduresMeta(100);
    const q = (opts.search ?? "").trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (opts.status && opts.status !== "all" && row.status !== opts.status) return false;
      if (opts.organizationId && row.organization_id !== opts.organizationId) return false;
      if (q) {
        const blob = `${row.id} ${row.responsible_name ?? ""} ${row.hospital ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const paged = paginateLocal(filtered, page, pageSize);
    return { ...paged, items: paged.items.map(normalizeProcedure) };
  }
}

export async function adminAiOverview(range: AdminRange): Promise<AiOverview> {
  return rpc<AiOverview>("admin_ai_overview", { p_range: range });
}

export async function adminOperationsOverview(range: AdminRange): Promise<OperationsOverview> {
  return rpc<OperationsOverview>("admin_operations_overview", { p_range: range });
}

export async function adminFinancialOverview(): Promise<FinancialOverview> {
  return rpc<FinancialOverview>("admin_financial_overview");
}

export async function adminListIssues(): Promise<AdminIssue[]> {
  const rows = await rpc<AdminIssue[] | null>("admin_list_issues");
  return asList(rows);
}

export async function adminListIssuesPage(page = 1, pageSize = 10): Promise<AdminListPage<AdminIssue>> {
  try {
    const data = await rpc<AdminListPage<AdminIssue>>("admin_list_issues_page", {
      p_page: page,
      p_page_size: pageSize,
    });
    return normalizePage(data, []);
  } catch {
    return paginateLocal(await adminListIssues(), page, pageSize);
  }
}

export async function adminGetIssue(id: string): Promise<AdminIssue> {
  return rpc<AdminIssue>("admin_get_issue", { p_id: id });
}

export async function adminUpdateIssue(id: string, status: string): Promise<AdminIssue> {
  return rpc<AdminIssue>("admin_update_issue", { p_id: id, p_status: status });
}

export async function adminListAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const rows = await rpc<AuditEvent[] | null>("admin_list_audit_events", { p_limit: limit });
  return asList(rows);
}

export async function adminListAuditPage(page = 1, pageSize = 10): Promise<AdminListPage<AuditEvent>> {
  try {
    const data = await rpc<AdminListPage<AuditEvent>>("admin_list_audit_page", {
      p_page: page,
      p_page_size: pageSize,
    });
    return normalizePage(data, []);
  } catch {
    return paginateLocal(await adminListAuditEvents(200), page, pageSize);
  }
}

export async function adminGetSettings(): Promise<AdminSettings> {
  return rpc<AdminSettings>("admin_get_settings");
}

export async function adminUpdateSettings(patch: AdminSettingsPatch): Promise<AdminSettings> {
  return rpc<AdminSettings>("admin_update_settings", { p_patch: patch });
}
