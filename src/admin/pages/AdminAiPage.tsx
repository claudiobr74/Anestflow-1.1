import React from "react";
import { adminAiOverview } from "../api";
import { ADMIN_AI_MODEL_CARDS } from "../aiCatalog";
import type { AdminRange, AiOverview } from "../types";
import { formatBRL, formatInt, formatMs, formatPct, RANGE_OPTIONS } from "../format";
import {
  Badge,
  ChartCard,
  DataTable,
  ErrorBanner,
  LoadingBlock,
  MetricCard,
  PageHeader,
  SegmentedControl,
  cardClass,
} from "../components/ui";
import { BarChart, LineChart, CHART_BRAND, CHART_TEAL } from "../components/charts";

export default function AdminAiPage({ isDark }: { isDark: boolean }) {
  const [range, setRange] = React.useState<AdminRange>("30d");
  const [data, setData] = React.useState<AiOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [openCard, setOpenCard] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminAiOverview(range)
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar IA.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const errors = Array.isArray(data?.errors) ? data.errors : [];

  return (
    <div>
      <PageHeader
        title="Inteligência Artificial"
        description="Acompanhe utilização, desempenho, erros e custos das funções de IA do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Inteligência Artificial" }]}
        isDark={isDark}
        actions={<SegmentedControl value={range} options={RANGE_OPTIONS} onChange={setRange} isDark={isDark} />}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading && !data ? <LoadingBlock isDark={isDark} /> : null}
      {data ? (
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{data.note}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard isDark={isDark} label="Chamadas IA" value={formatInt(data.total_ai_events)} series={[]} />
            <MetricCard isDark={isDark} label="Taxa de sucesso" value={formatPct(data.success_rate_pct)} series={[]} />
            <MetricCard isDark={isDark} label="Latência p50" value={formatMs(data.latency_p50_ms)} series={[]} />
            <MetricCard isDark={isDark} label="Latência p95" value={formatMs(data.latency_p95_ms)} series={[]} />
            <MetricCard isDark={isDark} label="Custo estimado" value={formatBRL(data.cost_brl)} series={[]} />
            <MetricCard isDark={isDark} label="Custo IA/proc" value={formatBRL(data.cost_per_proc_brl)} series={[]} />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <FeatureCard isDark={isDark} title="Voice Scribe" calls={data.voice_events} />
            <FeatureCard isDark={isDark} title="Supervisor IA" calls={data.review_events} />
            <FeatureCard isDark={isDark} title="Narrativa" calls={data.narrative_events} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold">Modelos ativos & configurações</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ADMIN_AI_MODEL_CARDS.map((card) => (
                <div key={card.id} className={cardClass(isDark, "p-4")}>
                  <p className={`text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                    {card.title}
                  </p>
                  <p className="mt-2 font-mono text-sm font-semibold text-[#6c5ce7]">{card.model}</p>
                  <p className={`mt-2 text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{card.description}</p>
                  {openCard === card.id ? (
                    <dl className={`mt-3 space-y-1 text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
                      {card.thinking ? (
                        <div>
                          Thinking: <span className="font-semibold">{card.thinking}</span>
                        </div>
                      ) : null}
                      {card.mode ? (
                        <div>
                          Mode: <span className="font-semibold">{card.mode}</span>
                        </div>
                      ) : null}
                      {card.prompt ? (
                        <div>
                          Prompt: <span className="font-mono">{card.prompt}</span>
                        </div>
                      ) : null}
                      {card.schema ? (
                        <div>
                          Schema: <span className="font-mono">{card.schema}</span>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  <button
                    type="button"
                    className="mt-3 text-xs font-semibold text-[#6c5ce7]"
                    onClick={() => setOpenCard((current) => (current === card.id ? null : card.id))}
                  >
                    {openCard === card.id ? "Ocultar" : "Visualizar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ChartCard title="Uso de IA ao longo do tempo" isDark={isDark}>
              <LineChart
                isDark={isDark}
                labels={[]}
                series={[
                  { id: "voice", label: "Voice Scribe", color: CHART_BRAND, values: [] },
                  { id: "review", label: "Supervisor IA", color: CHART_TEAL, values: [] },
                ]}
              />
            </ChartCard>
            <ChartCard title="Custo estimado de IA" isDark={isDark}>
              <BarChart
                isDark={isDark}
                items={[
                  { label: "Voice Scribe", value: 0 },
                  { label: "Supervisor IA", value: 0 },
                  { label: "Narrativa", value: 0 },
                ]}
              />
            </ChartCard>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold">Erros recentes de IA</h2>
            <DataTable<{ id: string }>
              isDark={isDark}
              rows={errors as Array<{ id: string }>}
              rowKey={(row) => row.id}
              emptyTitle="Nenhum erro de IA persistido"
              emptyDescription="Telemetria de falhas ainda não é armazenada. Códigos clínicos existem no runtime, sem tabela de usage."
              columns={[
                { key: "time", header: "Horário", render: () => "—" },
                { key: "feature", header: "Feature", render: () => "—" },
                { key: "code", header: "Código do erro", render: () => "—" },
                { key: "org", header: "Organização", render: () => "—" },
                {
                  key: "status",
                  header: "Status",
                  render: () => (
                    <Badge tone="neutral" isDark={isDark}>
                      —
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

function FeatureCard({ isDark, title, calls }: { isDark: boolean; title: string; calls: number | null }) {
  return (
    <div className={cardClass(isDark, "p-4")}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{formatInt(calls)}</p>
      <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>chamadas</p>
      <dl className={`mt-3 grid grid-cols-3 gap-2 text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
        <div>
          <dt>Sucesso</dt>
          <dd className="font-semibold">—</dd>
        </div>
        <div>
          <dt>Latência</dt>
          <dd className="font-semibold">—</dd>
        </div>
        <div>
          <dt>Erros</dt>
          <dd className="font-semibold">{formatInt(0)}</dd>
        </div>
      </dl>
    </div>
  );
}
