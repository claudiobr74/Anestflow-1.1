import React from "react";
import { RefreshCw } from "lucide-react";
import { adminDashboardOverview } from "../api";
import type { AdminRange, DashboardOverview } from "../types";
import {
  asNumber,
  formatInt,
  formatMinutes,
  formatPct,
  formatUpdatedAt,
  groupSeriesPoints,
  RANGE_OPTIONS,
  SERIES_GRAIN_OPTIONS,
  type SeriesGrain,
} from "../format";
import {
  ChartCard,
  ErrorBanner,
  LoadingBlock,
  MetricCard,
  PageHeader,
  SecondaryButton,
  SegmentedControl,
  SelectFilter,
  StatTile,
} from "../components/ui";
import { BarChart, DonutChart, Heatmap, LineChart, VerticalBars, CHART_BRAND, CHART_TEAL } from "../components/charts";

export default function AdminOverviewPage({ isDark }: { isDark: boolean }) {
  const [range, setRange] = React.useState<AdminRange>("30d");
  const [grain, setGrain] = React.useState<SeriesGrain>("daily");
  const [data, setData] = React.useState<DashboardOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (nextRange: AdminRange) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminDashboardOverview(nextRange));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar visão geral.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(range);
  }, [load, range]);

  const series = data?.series ?? [];
  const grouped = groupSeriesPoints(series, grain);
  const totals = grouped.totals;
  const completed = grouped.completed;
  const todaySeries = series.slice(-1).map((point) => asNumber(point.total));
  const successSeries = series.map((point) => {
    const total = asNumber(point.total);
    const done = asNumber(point.completed);
    return total > 0 ? (done / total) * 100 : 0;
  });
  const usersActivePresent = data?.metrics.users_active != null;
  const usersLabel = usersActivePresent ? "Usuários ativos" : "Usuários cadastrados";
  const usersValue = usersActivePresent ? data?.metrics.users_active : data?.metrics.users_registered;
  const signatureRate = data?.metrics.signature_rate_pct ?? data?.metrics.success_rate_pct ?? null;

  return (
    <div>
      <PageHeader
        title="Visão Geral"
        description="Acompanhe utilização, instituições, procedimentos, desempenho e saúde operacional do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Visão Geral" }]}
        isDark={isDark}
        meta={data ? <p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{formatUpdatedAt(data.updated_at)}</p> : null}
        actions={
          <>
            <SegmentedControl value={range} options={RANGE_OPTIONS} onChange={setRange} isDark={isDark} />
            <SelectFilter
              isDark={isDark}
              label="Organização"
              value="all"
              onChange={() => undefined}
              options={[{ value: "all", label: "Todas as organizações" }]}
            />
            <SecondaryButton isDark={isDark} onClick={() => void load(range)}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </SecondaryButton>
          </>
        }
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading && !data ? <LoadingBlock isDark={isDark} /> : null}
      {data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              isDark={isDark}
              label={usersLabel}
              value={formatInt(usersValue)}
              hint={usersActivePresent ? undefined : "Contagem de profiles cadastrados no escopo."}
              series={[]}
            />
            <MetricCard isDark={isDark} label="Organizações ativas" value={formatInt(data.metrics.organizations_active)} series={[]} />
            <MetricCard isDark={isDark} label="Procedimentos" value={formatInt(data.metrics.procedures)} series={totals} />
            <MetricCard isDark={isDark} label="Procedimentos hoje" value={formatInt(data.metrics.procedures_today)} series={todaySeries} />
            <MetricCard isDark={isDark} label="Usuários ativos hoje" value={formatInt(data.metrics.users_active_today)} series={[]} />
            <MetricCard isDark={isDark} label="Taxa de assinatura" value={formatPct(signatureRate)} series={successSeries} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile isDark={isDark} label="Proc. por sala avg" value={formatInt(data.kpis.proc_per_room_avg)} />
            <StatTile isDark={isDark} label="Duração média proc." value={formatMinutes(data.kpis.duration_proc_min)} />
            <StatTile isDark={isDark} label="Duração média anestesia" value={formatMinutes(data.kpis.duration_anes_min)} />
            <StatTile isDark={isDark} label="Taxa concluídos" value={formatPct(data.kpis.completed_pct)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile isDark={isDark} label="Em andamento" value={formatInt(data.kpis.in_progress)} tone="brand" />
            <StatTile isDark={isDark} label="Cancelados" value={formatInt(data.kpis.cancelled)} />
            <StatTile isDark={isDark} label="Com adendo" value={formatInt(data.kpis.with_addendum)} />
            <StatTile isDark={isDark} label="Com intercorrência" value={formatInt(data.kpis.with_incident)} tone="warning" />
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ChartCard
              title="Procedimentos ao longo do tempo"
              isDark={isDark}
              actions={<SegmentedControl value={grain} options={SERIES_GRAIN_OPTIONS} onChange={setGrain} isDark={isDark} />}
            >
              <LineChart
                isDark={isDark}
                labels={grouped.labels}
                series={[
                  { id: "total", label: "Total", color: CHART_BRAND, values: totals },
                  { id: "done", label: "Concluídos", color: CHART_TEAL, values: completed },
                ]}
              />
            </ChartCard>
            <ChartCard title="Por instituição" isDark={isDark}>
              <BarChart
                isDark={isDark}
                items={(data.hospitals ?? []).map((row) => ({ label: row.hospital, value: asNumber(row.count) }))}
              />
            </ChartCard>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard title="Técnicas anestésicas" isDark={isDark}>
              <DonutChart
                isDark={isDark}
                items={(data.techniques ?? []).map((row) => ({ label: row.name, value: asNumber(row.count) }))}
                centerLabel={formatInt((data.techniques ?? []).reduce((sum, row) => sum + asNumber(row.count), 0))}
              />
            </ChartCard>
            <ChartCard title="Classificação ASA" isDark={isDark}>
              <VerticalBars
                isDark={isDark}
                items={(data.asa ?? []).map((row) => ({ label: row.asa, value: asNumber(row.count) }))}
              />
            </ChartCard>
            <ChartCard title="Tempos médios" isDark={isDark}>
              <ul className="space-y-3 text-sm">
                <DurationRow label="Anestesia" value={formatMinutes(data.durations.anestesia_min)} isDark={isDark} />
                <DurationRow label="Sala" value={formatMinutes(data.durations.sala_min)} isDark={isDark} />
                <DurationRow label="SRPA" value={formatMinutes(data.durations.srpa_min)} isDark={isDark} />
                <DurationRow label="Início–incisão" value={formatMinutes(data.durations.inicio_incisao_min)} isDark={isDark} />
                <DurationRow label="Fim–saída" value={formatMinutes(data.durations.fim_saida_min)} isDark={isDark} />
              </ul>
            </ChartCard>
          </div>
          <ChartCard title="Distribuição por horário" isDark={isDark}>
            <Heatmap isDark={isDark} cells={data.heatmap ?? []} />
          </ChartCard>
        </div>
      ) : null}
    </div>
  );
}

function DurationRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className={isDark ? "text-zinc-400" : "text-[#636e72]"}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </li>
  );
}
