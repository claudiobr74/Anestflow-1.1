export type AdminRange = "today" | "7d" | "30d" | "this_month" | "3m";

export type AdminRole = "SUPER_ADMIN" | "CLINIC_ADMIN" | "USER";

export type OrgType = "hospital" | "clinica" | "grupo" | "outro";
export type OrgPlan = "enterprise" | "standard" | "basic" | "trial";
export type OrgStatus = "active" | "suspended" | "trial" | "archived";

export type ProcedureStatus = "draft" | "in_progress" | "signed";

export type UserAdminStatus =
  | "ativo"
  | "active"
  | "inactive"
  | "suspended"
  | "convite_pendente"
  | "perfil_incompleto";

export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "investigating" | "resolved" | "ignored";

export type SeriesPoint = {
  day: string;
  total?: number;
  completed?: number;
  count?: number;
};

export type NamedCount = {
  name: string;
  count: number;
};

export type HospitalCount = {
  hospital: string;
  count: number;
};

export type AsaCount = {
  asa: string;
  count: number;
};

export type HeatmapCell = {
  dow: number;
  hour: number;
  count: number;
};

export type DashboardMetrics = {
  users_active?: number | null;
  users_registered?: number | null;
  organizations_active: number;
  organizations: number;
  procedures: number;
  procedures_today: number;
  users_active_today: number;
  success_rate_pct: number | null;
  signature_rate_pct?: number | null;
};

export type DashboardKpis = {
  proc_per_room_avg: number | null;
  duration_proc_min: number | null;
  duration_anes_min: number | null;
  completed_pct: number | null;
  in_progress: number;
  cancelled: number | null;
  with_addendum: number;
  with_incident: number;
  drafts: number;
  signed: number;
};

export type DurationAverages = {
  anestesia_min: number | null;
  sala_min: number | null;
  srpa_min: number | null;
  inicio_incisao_min: number | null;
  fim_saida_min: number | null;
};

export type DashboardOverview = {
  range: AdminRange | string;
  updated_at: string;
  metrics: DashboardMetrics;
  kpis: DashboardKpis;
  series: SeriesPoint[];
  hospitals: HospitalCount[];
  techniques: NamedCount[];
  asa: AsaCount[];
  durations: DurationAverages;
  heatmap: HeatmapCell[];
  issues_open: number;
};

export type OrganizationListItem = {
  id: string;
  name: string;
  type: OrgType | string;
  plan: OrgPlan | string;
  status: OrgStatus | string;
  city: string | null;
  state: string | null;
  monthly_cents: number;
  billing_cycle?: string | null;
  created_at: string;
  members: number;
  procedures_month: number;
};

export type OrganizationPatch = {
  name?: string;
  city?: string | null;
  state?: string | null;
  plan?: OrgPlan | string;
  monthly_cents?: number;
  billing_cycle?: string;
  status?: OrgStatus | string;
};

export type OrganizationMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  crm: string | null;
  uf: string | null;
  role: string;
};

export type TopAnesthetist = {
  user_id: string;
  full_name: string | null;
  role: string;
  count: number;
};

export type OrganizationDetail = OrganizationListItem & {
  ai_calls: number;
  members_list: OrganizationMember[];
  series: SeriesPoint[];
  top_anesthetists: TopAnesthetist[];
};

export type AdminUserListItem = {
  id: string;
  full_name: string | null;
  email: string | null;
  crm: string | null;
  uf: string | null;
  hospital: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  status: UserAdminStatus | string;
  account_status?: string | null;
  is_platform_admin: boolean;
  is_clinic_admin?: boolean;
  organization_name: string | null;
  login_provider: string | null;
};

export type AuditLabel = {
  tipo: string;
  descricao: string;
};

export type UserMembership = {
  organization_id: string;
  name: string;
  role: string;
};

export type UserActivityItem = {
  id: string;
  created_at: string;
  action: string;
  label: AuditLabel;
};

export type AdminUserDetail = AdminUserListItem & {
  memberships: UserMembership[];
  recent_activity: UserActivityItem[];
};

export type ProcedureIntegrity = {
  integrity_status?: string;
  snapshot_ok?: boolean | null;
  persisted_ok?: boolean | null;
};

export type ProcedureMeta = {
  id: string;
  status: ProcedureStatus | string;
  revision: number | null;
  created_at: string;
  updated_at: string | null;
  signed_at: string | null;
  has_hash: boolean;
  organization_id?: string | null;
  integrity_status?: string | null;
  snapshot_ok?: boolean | null;
  persisted_ok?: boolean | null;
  integrity?: ProcedureIntegrity | null;
  responsible_name: string | null;
  responsible_crm: string | null;
  responsible_uf: string | null;
  hospital: string | null;
  duration_anes_min: number | null;
  used_voice: boolean;
  has_incident: boolean;
};

export type AiOverview = {
  range: AdminRange | string;
  note: string;
  voice_events: number | null;
  review_events: number | null;
  narrative_events: number | null;
  total_ai_events: number | null;
  success_rate_pct: number | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  cost_brl: number | null;
  cost_per_proc_brl: number | null;
  errors: unknown[];
};

export type OpsSubsystem = {
  id: string;
  label: string;
  status: string;
  uptime_pct: number | null;
};

export type OpsMetrics24h = {
  atomic_saves: number | null;
  rollbacks: number | null;
  stale_revisions: number | null;
  tab_conflicts: number | null;
  sync_failures: number | null;
  sign_failures: number | null;
  pdf_failures: number | null;
  voice_failures: number | null;
  review_failures: number | null;
  integrity_mismatches: number | null;
  signs: number | null;
};

export type OpsEvent = {
  id: string;
  created_at: string;
  action: string;
  subsystem: string;
  label: string;
};

export type OperationsOverview = {
  range: AdminRange | string;
  subsystems: OpsSubsystem[];
  metrics_24h: OpsMetrics24h;
  by_status: Record<string, number>;
  events: OpsEvent[];
};

export type FinancialContract = {
  id: string;
  name: string;
  plan: string;
  monthly_cents: number;
  cycle: string;
  status: string;
  renewal: string | null;
};

export type FinancialOverview = {
  note: string;
  mrr_cents: number;
  arr_cents: number;
  ticket_cents: number;
  ai_cost_cents: number | null;
  margin_pct: number | null;
  active_paid_orgs: number;
  trial_orgs: number;
  contracts: FinancialContract[];
};

export type IssueTimelineEntry = {
  at?: string;
  status?: string;
  actor_id?: string;
};

export type AdminIssue = {
  id: string;
  title: string;
  incident_type: string;
  description: string;
  technical_context: string;
  error_code: string;
  severity: IssueSeverity | string;
  status: IssueStatus | string;
  occurrences?: number | null;
  last_seen_at?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  organization_id: string | null;
  organization_name: string | null;
  procedure_id: string | null;
  timeline: IssueTimelineEntry[] | unknown;
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  tipo: string;
  descricao: string;
  actor_name: string | null;
  organization_name: string | null;
  ip: string | null;
};

export type AdminFeatureFlags = {
  voice_scribe: boolean;
  ai_supervisor: boolean;
  narrative_ai: boolean;
  google_login: boolean;
  pdf_final: boolean;
  experimental: boolean;
};

export type AdminSettingsEnforcement = Record<string, string>;

export type AdminSettings = {
  id: string;
  platform_name: string;
  base_url: string;
  timezone: string;
  locale: string;
  session_timeout_label: string;
  require_2fa: boolean;
  password_policy: string;
  maintenance_mode: boolean;
  support_email: string;
  feature_flags: AdminFeatureFlags;
  updated_at: string;
  session_policy_hours: number;
  enforcement?: AdminSettingsEnforcement;
};

export type AdminSettingsPatch = {
  platform_name?: string;
  base_url?: string;
  timezone?: string;
  locale?: string;
  require_2fa?: boolean;
  password_policy?: string;
  maintenance_mode?: boolean;
  support_email?: string;
  feature_flags?: Partial<AdminFeatureFlags>;
};

export type AdminWhoami = {
  user_id: string;
  role: AdminRole | string;
  organization_ids: string[];
};

export type AdminListPage<T> = {
  total_count: number;
  page: number;
  page_size: number;
  items: T[];
};

export type AdminTheme = "light" | "dark" | "dark-clean";
