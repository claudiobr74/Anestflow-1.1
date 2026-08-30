import React from "react";
import { adminFinancialOverview } from "../api";
import type { FinancialContract, FinancialOverview } from "../types";
import { formatBRLFromCents, formatInt, formatPct, ORG_PLAN_LABEL, ORG_STATUS_LABEL } from "../format";
import {
  Badge,
  ChartCard,
  DataTable,
  ErrorBanner,
  LoadingBlock,
  MetricCard,
  PageHeader,
} from "../components/ui";
import { LineChart, CHART_BRAND, CHART_TEAL } from "../components/charts";

function planTone(plan: string): "brand" | "info" | "warning" | "neutral" {
  if (plan === "enterprise") return "brand";
  if (plan === "standard") return "info";
  if (plan === "trial") return "warning";
  return "neutral";
}

export default function AdminFinancialPage({ isDark }: { isDark: boolean }) {
  const [data, setData] = React.useState<FinancialOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminFinancialOverview()
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar financeiro.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Acompanhe receita, contratos, custos e margem operacional do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Financeiro" }]}
        isDark={isDark}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading && !data ? <LoadingBlock isDark={isDark} /> : null}
      {data ? (
        <div className="space-y-4">
          <p className={`rounded-xl border px-4 py-3 text-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-[#e8ecf0] bg-white text-[#636e72]"}`}>
            {data.note || "Faturamento ainda não integrado"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard isDark={isDark} label="Receita mensal recorrente" value={formatBRLFromCents(data.mrr_cents)} series={[]} />
            <MetricCard isDark={isDark} label="Receita contratada" value={formatBRLFromCents(data.arr_cents)} series={[]} />
            <MetricCard isDark={isDark} label="Ticket médio" value={formatBRLFromCents(data.ticket_cents)} series={[]} />
            <MetricCard isDark={isDark} label="Receita por organização" value={formatBRLFromCents(data.mrr_cents)} series={[]} />
            <MetricCard isDark={isDark} label="Custo de IA" value={formatBRLFromCents(data.ai_cost_cents)} series={[]} />
            <MetricCard isDark={isDark} label="Margem estimada" value={formatPct(data.margin_pct)} series={[]} />
          </div>
          <ChartCard title="Receita vs custo operacional" isDark={isDark}>
            <LineChart
              isDark={isDark}
              labels={[]}
              series={[
                { id: "rev", label: "Receita", color: CHART_BRAND, values: [] },
                { id: "ai", label: "IA", color: "#e17055", values: [] },
                { id: "infra", label: "Infraestrutura", color: CHART_TEAL, values: [] },
              ]}
            />
          </ChartCard>
          <div>
            <h2 className="mb-3 text-sm font-bold">Planos e contratos</h2>
            <p className={`mb-3 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
              Organizações ativas pagas: {formatInt(data.active_paid_orgs)} · Trial: {formatInt(data.trial_orgs)}
            </p>
            <DataTable<FinancialContract>
              isDark={isDark}
              rows={data.contracts ?? []}
              rowKey={(row) => row.id}
              emptyTitle="Nenhum contrato"
              emptyDescription="Não há organizações com faturamento. Valores permanecem R$ 0,00 até a integração."
              columns={[
                { key: "org", header: "Organização", render: (row) => row.name },
                {
                  key: "plan",
                  header: "Plano",
                  render: (row) => (
                    <Badge tone={planTone(row.plan)} isDark={isDark}>
                      {ORG_PLAN_LABEL[row.plan] ?? row.plan}
                    </Badge>
                  ),
                },
                { key: "value", header: "Valor", render: (row) => formatBRLFromCents(row.monthly_cents) },
                { key: "cycle", header: "Ciclo", render: (row) => row.cycle || "mensal" },
                { key: "renewal", header: "Próxima renovação", render: (row) => row.renewal || "—" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge tone={row.status === "active" ? "success" : row.status === "trial" ? "warning" : "neutral"} isDark={isDark}>
                      {ORG_STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  ),
                },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
