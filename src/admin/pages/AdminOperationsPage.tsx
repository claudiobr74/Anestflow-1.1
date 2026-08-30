import React from "react";
import { adminOperationsOverview } from "../api";
import type { AdminRange, OperationsOverview, OpsEvent } from "../types";
import { formatInt, formatRelative, formatTime, RANGE_OPTIONS } from "../format";
import {
  ChartCard,
  DataTable,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SegmentedControl,
  StatTile,
  cardClass,
} from "../components/ui";

function statusLabel(status: string): { text: string; className: string } {
  if (status === "operational") {
    return { text: "Operacional", className: "text-emerald-600" };
  }
  if (status === "unknown") {
    return { text: "Sem telemetria", className: "text-amber-600" };
  }
  return { text: status, className: "" };
}

const METRIC_KEYS: { key: keyof OperationsOverview["metrics_24h"]; label: string; alert?: boolean }[] = [
  { key: "atomic_saves", label: "Atomic saves" },
  { key: "rollbacks", label: "Rollbacks", alert: true },
  { key: "stale_revisions", label: "Stale revisions", alert: true },
  { key: "tab_conflicts", label: "Conflitos multiaba", alert: true },
  { key: "sync_failures", label: "Falhas de sync", alert: true },
  { key: "sign_failures", label: "Falhas de assinatura", alert: true },
  { key: "pdf_failures", label: "Falhas de PDF", alert: true },
  { key: "voice_failures", label: "Falhas de Voice", alert: true },
  { key: "review_failures", label: "Falhas de Review", alert: true },
  { key: "integrity_mismatches", label: "Integridade / mismatches", alert: true },
];

export default function AdminOperationsPage({ isDark }: { isDark: boolean }) {
  const [range, setRange] = React.useState<AdminRange>("30d");
  const [data, setData] = React.useState<OperationsOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (nextRange: AdminRange) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminOperationsOverview(nextRange));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar operação.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(range);
  }, [load, range]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void adminOperationsOverview(range)
        .then(setData)
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [range]);

  return (
    <div>
      <PageHeader
        title="Operação"
        description="Central de observabilidade e saúde operacional do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Operação" }]}
        isDark={isDark}
        meta={<p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Atualização automática ativada (a cada 15s)</p>}
        actions={<SegmentedControl value={range} options={RANGE_OPTIONS} onChange={setRange} isDark={isDark} />}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading && !data ? <LoadingBlock isDark={isDark} /> : null}
      {data ? (
        <div className="space-y-4">
          <ChartCard title="Status dos subsistemas" isDark={isDark}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(data.subsystems ?? []).map((item) => {
                const status = statusLabel(item.status);
                return (
                  <div key={item.id} className={cardClass(isDark, "p-3")}>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className={`mt-2 text-sm font-semibold ${status.className}`}>{status.text}</p>
                    <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                      Uptime {item.uptime_pct == null ? "—" : `${item.uptime_pct}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </ChartCard>
          <div>
            <h2 className="mb-3 text-sm font-bold">Métricas operacionais (últimas 24h)</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {METRIC_KEYS.map((metric) => {
                const value = data.metrics_24h[metric.key];
                const warn = Boolean(metric.alert && Number(value) > 0);
                return (
                  <div key={metric.key}>
                    <StatTile
                      isDark={isDark}
                      label={metric.label}
                      value={formatInt(value)}
                      tone={warn ? "warning" : "default"}
                    />
                  </div>
                );
              })}
            </div>
            <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
              Assinaturas no período de 24h: {formatInt(data.metrics_24h.signs)}
            </p>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold">Eventos de operação</h2>
            <DataTable<OpsEvent>
              isDark={isDark}
              rows={data.events ?? []}
              rowKey={(row) => row.id}
              emptyTitle="Nenhum evento no período"
              emptyDescription="Os logs vêm de audit_events (ação, horário). Sem IP e sem descrição clínica."
              columns={[
                {
                  key: "ts",
                  header: "Timestamp",
                  render: (row) => (
                    <div>
                      <p className="font-medium tabular-nums">{formatTime(row.created_at)}</p>
                      <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{formatRelative(row.created_at)}</p>
                    </div>
                  ),
                },
                { key: "sub", header: "Subsistema", render: (row) => row.subsystem },
                { key: "label", header: "Descrição do evento", render: (row) => row.label || row.action },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
