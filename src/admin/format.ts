import type { AdminRange } from "./types";

export const ADMIN_TIMEZONE = "America/Sao_Paulo";
export const ADMIN_LOCALE = "pt-BR";

export const RANGE_OPTIONS: { value: AdminRange; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "3m", label: "Últimos 3 meses" },
];

export const PROCEDURE_STATUS_LABEL: Record<string, string> = {
  draft: "Pendente",
  in_progress: "Em andamento",
  signed: "Concluído",
};

export const ORG_TYPE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  clinica: "Clínica",
  grupo: "Grupo",
  outro: "Outro",
};

export const ORG_PLAN_LABEL: Record<string, string> = {
  enterprise: "Enterprise",
  standard: "Standard",
  basic: "Basic",
  trial: "Trial",
};

export const ORG_STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  trial: "Trial",
};

export const USER_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  convite_pendente: "Convite pendente",
  perfil_incompleto: "Perfil incompleto",
};

export const ISSUE_SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export const ISSUE_STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  investigating: "Investigando",
  resolved: "Resolvido",
};

export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asNumber(value: unknown, fallback = 0): number {
  return asFiniteNumber(value) ?? fallback;
}

export function formatInt(value: unknown): string {
  const n = asFiniteNumber(value);
  if (n == null) return "—";
  return new Intl.NumberFormat(ADMIN_LOCALE).format(n);
}

export function formatPct(value: unknown): string {
  const n = asFiniteNumber(value);
  if (n == null) return "—";
  return `${new Intl.NumberFormat(ADMIN_LOCALE, { maximumFractionDigits: 1 }).format(n)}%`;
}

export function formatBRLFromCents(cents: unknown): string {
  const n = asFiniteNumber(cents) ?? 0;
  return new Intl.NumberFormat(ADMIN_LOCALE, {
    style: "currency",
    currency: "BRL",
  }).format(n / 100);
}

export function formatBRL(amount: unknown): string {
  const n = asFiniteNumber(amount) ?? 0;
  return new Intl.NumberFormat(ADMIN_LOCALE, {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

export function formatMinutes(min: unknown): string {
  const n = asFiniteNumber(min);
  if (n == null) return "—";
  const total = Math.round(n);
  if (total < 0) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function formatMs(ms: unknown): string {
  const n = asFiniteNumber(ms);
  if (n == null) return "—";
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${new Intl.NumberFormat(ADMIN_LOCALE, { maximumFractionDigits: 1 }).format(n / 1000)}s`;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(ADMIN_LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(ADMIN_LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(ADMIN_LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatRelative(value: string | Date | null | undefined, now = new Date()): string {
  const d = parseDate(value);
  if (!d) return "—";
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return formatDateTime(d);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 20) return "há instantes";
  if (sec < 60) return `há ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min === 1) return "há 1 minuto";
  if (min < 60) return `há ${min} minutos`;
  const hrs = Math.floor(min / 60);
  if (hrs === 1) return "há 1 hora";
  if (hrs < 24) return `há ${hrs} horas`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return `Ontem, ${formatClock(d)}`;
  if (days < 7) return `há ${days} dias`;
  return formatDateTime(d);
}

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat(ADMIN_LOCALE, {
    timeZone: ADMIN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatUpdatedAt(value: string | Date | null | undefined, now = new Date()): string {
  const rel = formatRelative(value, now);
  if (rel === "—") return "Última atualização: —";
  return `Última atualização: ${rel}`;
}

export function initialsFromName(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/^\s*(dra?\.?)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.slice(0, 8).toUpperCase();
}

export function procedureStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return PROCEDURE_STATUS_LABEL[status] ?? status;
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  out.sort();
  return out;
}

export function loginProviderLabel(provider: string | null | undefined): string {
  if (!provider) return "—";
  if (provider === "email") return "E-mail";
  if (provider === "google") return "Google";
  return provider;
}
