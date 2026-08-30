import React from "react";
import { adminListIssues } from "../api";
import type { AdminIssue } from "../types";
import { formatDateTime, formatRelative, ISSUE_SEVERITY_LABEL, ISSUE_STATUS_LABEL, uniqueStrings } from "../format";
import { issuesHref, navigateAdmin } from "../routes";
import {
  Badge,
  DataTable,
  ErrorBanner,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  paginate,
  SelectFilter,
} from "../components/ui";
import AdminIssueDrawer from "../components/AdminIssueDrawer";

const PAGE_SIZE = 10;

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

export default function AdminIssuesPage({
  isDark,
  drawerId,
}: {
  isDark: boolean;
  drawerId: string | null;
}) {
  const [rows, setRows] = React.useState<AdminIssue[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [severity, setSeverity] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await adminListIssues());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao listar problemas.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const types = uniqueStrings(rows.map((row) => row.incident_type));
  const filtered = rows.filter((row) => {
    if (severity !== "all" && row.severity !== severity) return false;
    if (status !== "all" && row.status !== status) return false;
    if (type !== "all" && row.incident_type !== type) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [severity, status, type]);

  return (
    <div>
      <PageHeader
        title="Problemas"
        description="Monitore e resolva incidentes operacionais do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Problemas" }]}
        isDark={isDark}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading ? <LoadingBlock isDark={isDark} /> : null}
      {!loading ? (
        <>
          <FilterBar isDark={isDark}>
            <SelectFilter
              isDark={isDark}
              label="Severidade"
              value={severity}
              onChange={setSeverity}
              options={[{ value: "all", label: "Severidade" }, ...Object.entries(ISSUE_SEVERITY_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Tipo"
              value={type}
              onChange={setType}
              options={[{ value: "all", label: "Tipo" }, ...types.map((value) => ({ value, label: value }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "Status" }, ...Object.entries(ISSUE_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
            />
          </FilterBar>
          <h2 className="mb-3 text-sm font-bold">Incidentes ativos</h2>
          <DataTable<AdminIssue>
            isDark={isDark}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(row) => row.id}
            selectedKey={drawerId}
            emptyTitle="Nenhum incidente registrado"
            emptyDescription="A fila de problemas começa vazia. O drawer só abre para uma linha real."
            onRowClick={(row) => navigateAdmin(issuesHref(row.id))}
            columns={[
              {
                key: "sev",
                header: "Severidade",
                render: (row) => (
                  <Badge tone={severityTone(String(row.severity))} isDark={isDark}>
                    {ISSUE_SEVERITY_LABEL[String(row.severity)] ?? row.severity}
                  </Badge>
                ),
              },
              {
                key: "type",
                header: "Tipo de incidente",
                render: (row) => (
                  <div>
                    <p className="font-semibold">{row.title || row.incident_type || "Incidente"}</p>
                    {row.incident_type ? (
                      <p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{row.incident_type}</p>
                    ) : null}
                  </div>
                ),
              },
              { key: "org", header: "Organização", render: (row) => row.organization_name || "—" },
              {
                key: "when",
                header: "Data / horário",
                render: (row) => (
                  <div>
                    <p className="font-semibold">{formatRelative(row.created_at)}</p>
                    <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{formatDateTime(row.created_at)}</p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge tone={statusTone(String(row.status))} isDark={isDark}>
                    {ISSUE_STATUS_LABEL[String(row.status)] ?? row.status}
                  </Badge>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="incidentes" isDark={isDark} />
        </>
      ) : null}
      {drawerId ? (
        <AdminIssueDrawer
          issueId={drawerId}
          isDark={isDark}
          onClose={() => navigateAdmin(issuesHref())}
          onUpdated={(issue) => {
            setRows((current) => current.map((row) => (row.id === issue.id ? issue : row)));
          }}
        />
      ) : null}
    </div>
  );
}
