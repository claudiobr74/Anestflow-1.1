import React from "react";
import { X } from "lucide-react";
import { adminGetIssue, adminUpdateIssue } from "../api";
import type { AdminIssue, IssueStatus, IssueTimelineEntry } from "../types";
import { formatDateTime, ISSUE_SEVERITY_LABEL, ISSUE_STATUS_LABEL, shortId } from "../format";
import { Badge, ErrorBanner, LoadingBlock, PrimaryButton, SecondaryButton } from "./ui";

function severityTone(severity: string): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "warning";
  return "neutral";
}

function statusTone(status: string): "danger" | "warning" | "success" | "neutral" {
  if (status === "resolved") return "success";
  if (status === "investigating") return "warning";
  if (status === "open") return "danger";
  return "neutral";
}

function asTimeline(raw: AdminIssue["timeline"]): IssueTimelineEntry[] {
  return Array.isArray(raw) ? (raw as IssueTimelineEntry[]) : [];
}

export default function AdminIssueDrawer({
  issueId,
  isDark,
  onClose,
  onUpdated,
}: {
  issueId: string;
  isDark: boolean;
  onClose: () => void;
  onUpdated?: (issue: AdminIssue) => void;
}) {
  const [issue, setIssue] = React.useState<AdminIssue | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void adminGetIssue(issueId)
      .then((row) => {
        if (!cancelled) setIssue(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar incidente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  const updateStatus = async (status: IssueStatus) => {
    if (!issue) return;
    setSaving(true);
    setError(null);
    try {
      const next = await adminUpdateIssue(issue.id, status);
      setIssue(next);
      onUpdated?.(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
    } finally {
      setSaving(false);
    }
  };

  const panel = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-[#e8ecf0] text-[#2d3436]";

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fechar overlay" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[520px] max-w-[100vw] flex-col border-l shadow-xl ${panel}`}
        aria-labelledby="admin-issue-drawer-title"
      >
        <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? "border-zinc-800" : "border-[#e8ecf0]"}`}>
          <div>
            <h2 id="admin-issue-drawer-title" className="text-base font-bold">
              Detalhes do Incidente
            </h2>
            <p className={`mt-1 font-mono text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{shortId(issue?.id ?? issueId)}</p>
          </div>
          <div className="flex items-center gap-2">
            {issue ? (
              <Badge tone={severityTone(String(issue.severity))} isDark={isDark}>
                {ISSUE_SEVERITY_LABEL[String(issue.severity)] ?? issue.severity}
              </Badge>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 hover:opacity-70">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? <LoadingBlock isDark={isDark} /> : null}
          {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
          {issue ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold">{issue.title || "Incidente"}</h3>
              </div>
              <section>
                <h4 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                  Informações
                </h4>
                <dl className="space-y-2 text-sm">
                  <InfoRow label="Tipo" value={issue.incident_type || "—"} isDark={isDark} />
                  <InfoRow label="Horário" value={formatDateTime(issue.created_at)} isDark={isDark} />
                  <InfoRow label="Organização" value={issue.organization_name || "—"} isDark={isDark} />
                  <InfoRow label="Procedimento" value={issue.procedure_id ? shortId(issue.procedure_id) : "—"} isDark={isDark} />
                  <div className="flex items-start justify-between gap-3">
                    <dt className={isDark ? "text-zinc-500" : "text-[#636e72]"}>Código do erro</dt>
                    <dd className="font-mono text-xs">{issue.error_code || "—"}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h4 className={`mb-2 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                  Contexto técnico
                </h4>
                <p className={`rounded-xl px-3 py-2.5 text-sm ${isDark ? "bg-zinc-950 text-zinc-300" : "bg-[#f8f9fa] text-[#2d3436]"}`}>
                  {issue.technical_context || issue.description || "Sem contexto técnico."}
                </p>
              </section>
              <section>
                <h4 className={`mb-2 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                  Status atual
                </h4>
                <Badge tone={statusTone(String(issue.status))} isDark={isDark}>
                  {ISSUE_STATUS_LABEL[String(issue.status)] ?? issue.status}
                </Badge>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SecondaryButton isDark={isDark} disabled={saving || issue.status === "open"} onClick={() => void updateStatus("open")}>
                    Aberto
                  </SecondaryButton>
                  <SecondaryButton
                    isDark={isDark}
                    disabled={saving || issue.status === "investigating"}
                    onClick={() => void updateStatus("investigating")}
                  >
                    Investigando
                  </SecondaryButton>
                  <PrimaryButton disabled={saving || issue.status === "resolved"} onClick={() => void updateStatus("resolved")}>
                    Resolver
                  </PrimaryButton>
                </div>
              </section>
              <section>
                <h4 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                  Timeline
                </h4>
                {asTimeline(issue.timeline).length === 0 ? (
                  <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Nenhum evento na timeline.</p>
                ) : (
                  <ol className="space-y-3">
                    {asTimeline(issue.timeline).map((entry, index) => (
                      <li key={`${entry.at ?? index}-${entry.status ?? ""}`} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6c5ce7]" />
                        <div>
                          <p className="text-sm font-medium">
                            {ISSUE_STATUS_LABEL[String(entry.status ?? "")] ?? entry.status ?? "Atualização"}
                          </p>
                          <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{formatDateTime(entry.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={isDark ? "text-zinc-500" : "text-[#636e72]"}>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
