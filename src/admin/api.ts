import { getSupabase } from "../lib/supabase";
import type {
  AdminIssue,
  AdminRange,
  AdminSettings,
  AdminSettingsPatch,
  AdminUserDetail,
  AdminUserListItem,
  AiOverview,
  AuditEvent,
  DashboardOverview,
  FinancialOverview,
  OperationsOverview,
  OrganizationDetail,
  OrganizationListItem,
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

export async function adminBootstrapSelf(): Promise<boolean> {
  const value = await rpc<boolean>("admin_bootstrap_self");
  return value === true;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const value = await rpc<boolean>("is_platform_admin");
  return value === true;
}

export async function adminDashboardOverview(range: AdminRange): Promise<DashboardOverview> {
  return rpc<DashboardOverview>("admin_dashboard_overview", { p_range: range });
}

export async function adminListOrganizations(): Promise<OrganizationListItem[]> {
  const rows = await rpc<OrganizationListItem[] | null>("admin_list_organizations");
  return Array.isArray(rows) ? rows : [];
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

export async function adminListUsers(): Promise<AdminUserListItem[]> {
  const rows = await rpc<AdminUserListItem[] | null>("admin_list_users");
  return Array.isArray(rows) ? rows : [];
}

export async function adminGetUser(id: string): Promise<AdminUserDetail> {
  return rpc<AdminUserDetail>("admin_get_user", { p_id: id });
}

export async function adminListProceduresMeta(limit = 100): Promise<ProcedureMeta[]> {
  const rows = await rpc<ProcedureMeta[] | null>("admin_list_procedures_meta", { p_limit: limit });
  return Array.isArray(rows) ? rows : [];
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
  return Array.isArray(rows) ? rows : [];
}

export async function adminGetIssue(id: string): Promise<AdminIssue> {
  return rpc<AdminIssue>("admin_get_issue", { p_id: id });
}

export async function adminUpdateIssue(id: string, status: string): Promise<AdminIssue> {
  return rpc<AdminIssue>("admin_update_issue", { p_id: id, p_status: status });
}

export async function adminListAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const rows = await rpc<AuditEvent[] | null>("admin_list_audit_events", { p_limit: limit });
  return Array.isArray(rows) ? rows : [];
}

export async function adminGetSettings(): Promise<AdminSettings> {
  return rpc<AdminSettings>("admin_get_settings");
}

export async function adminUpdateSettings(patch: AdminSettingsPatch): Promise<AdminSettings> {
  return rpc<AdminSettings>("admin_update_settings", { p_patch: patch });
}
