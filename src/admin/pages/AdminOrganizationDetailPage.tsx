import React from "react";
import { Building2 } from "lucide-react";
import { adminArchiveOrganization, adminGetOrganization, adminUpdateOrganization } from "../api";
import type { AdminRole, OrganizationDetail, OrgPlan, OrgStatus } from "../types";
import { asNumber, formatBRLFromCents, formatDate, formatInt, initialsFromName, ORG_STATUS_LABEL, ORG_TYPE_LABEL } from "../format";
import { navigateAdmin } from "../routes";
import {
  Badge,
  ChartCard,
  ErrorBanner,
  Field,
  LoadingBlock,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  TextInput,
  cardClass,
} from "../components/ui";
import { LineChart, CHART_BRAND } from "../components/charts";

export default function AdminOrganizationDetailPage({
  organizationId,
  isDark,
  role,
}: {
  organizationId: string;
  isDark: boolean;
  role?: AdminRole | string | null;
}) {
  const [org, setOrg] = React.useState<OrganizationDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [section, setSection] = React.useState<"overview" | "members">("overview");
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [plan, setPlan] = React.useState<OrgPlan | string>("trial");
  const [monthlyCents, setMonthlyCents] = React.useState("");
  const [billingCycle, setBillingCycle] = React.useState("monthly");
  const [statusValue, setStatusValue] = React.useState<OrgStatus | string>("active");
  const isSuperAdmin = role !== "CLINIC_ADMIN";

  const fillForm = (row: OrganizationDetail) => {
    setName(row.name);
    setCity(row.city ?? "");
    setState(row.state ?? "");
    setPlan(row.plan);
    setMonthlyCents(String(row.monthly_cents ?? 0));
    setBillingCycle(row.billing_cycle || "monthly");
    setStatusValue(row.status);
  };

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void adminGetOrganization(organizationId)
      .then((row) => {
        if (!cancelled) {
          setOrg(row);
          fillForm(row);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Organização não encontrada.");
          setOrg(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (loading) return <LoadingBlock isDark={isDark} />;
  if (error || !org) {
    return (
      <div>
        <PageHeader
          title="Organização"
          description="Gerencie hospitais, clínicas e grupos vinculados ao AnestFlow."
          breadcrumb={[
            { label: "Administração" },
            { label: "Organizações", onClick: () => navigateAdmin("/admin/organizations") },
          ]}
          isDark={isDark}
        />
        <ErrorBanner message={error ?? "Organização não encontrada."} isDark={isDark} />
      </div>
    );
  }

  const series = org.series ?? [];

  return (
    <div>
      <PageHeader
        title={org.name}
        description={[org.city, org.state].filter(Boolean).join(" · ") || "Instituição cadastrada no AnestFlow."}
        breadcrumb={[
          { label: "Administração" },
          { label: "Organizações", onClick: () => navigateAdmin("/admin/organizations") },
          { label: org.name },
        ]}
        isDark={isDark}
        actions={
          <>
            <SecondaryButton
              isDark={isDark}
              disabled={!isSuperAdmin}
              title={isSuperAdmin ? undefined : "Apenas Super Admin"}
              onClick={() => {
                if (!isSuperAdmin || !org) return;
                fillForm(org);
                setFormError(null);
                setEditing(true);
              }}
            >
              Editar Organização
            </SecondaryButton>
            <SecondaryButton isDark={isDark} disabled title="Faturamento ainda não integrado">
              Gerenciar Planos
            </SecondaryButton>
          </>
        }
      />
      {editing && isSuperAdmin ? (
        <form
          className={cardClass(isDark, "mb-4 space-y-3 p-4")}
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setSaving(true);
              setFormError(null);
              try {
                const next = await adminUpdateOrganization(organizationId, {
                  name: name.trim(),
                  city: city.trim() || null,
                  state: state.trim() || null,
                  plan,
                  monthly_cents: Number(monthlyCents) || 0,
                  billing_cycle: billingCycle,
                  status: statusValue,
                });
                setOrg(next);
                fillForm(next);
                setEditing(false);
              } catch (err: unknown) {
                setFormError(err instanceof Error ? err.message : "Falha ao atualizar organização.");
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          <h2 className="text-sm font-bold">Editar organização</h2>
          {formError ? <ErrorBanner message={formError} isDark={isDark} /> : null}
          <Field label="Nome" isDark={isDark}>
            <TextInput value={name} onChange={setName} isDark={isDark} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cidade" isDark={isDark}>
              <TextInput value={city} onChange={setCity} isDark={isDark} />
            </Field>
            <Field label="UF" isDark={isDark}>
              <TextInput value={state} onChange={setState} isDark={isDark} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plano" isDark={isDark}>
              <select
                value={plan}
                onChange={(event) => setPlan(event.target.value as OrgPlan)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-[#f8f9fa] border-[#e8ecf0]"}`}
              >
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Status" isDark={isDark}>
              <select
                value={statusValue}
                onChange={(event) => setStatusValue(event.target.value as OrgStatus)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-[#f8f9fa] border-[#e8ecf0]"}`}
              >
                <option value="active">Ativo</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspenso</option>
                <option value="archived">Arquivado</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mensalidade (centavos)" isDark={isDark}>
              <TextInput value={monthlyCents} onChange={setMonthlyCents} isDark={isDark} />
            </Field>
            <Field label="Ciclo" isDark={isDark}>
              <select
                value={billingCycle}
                onChange={(event) => setBillingCycle(event.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-[#f8f9fa] border-[#e8ecf0]"}`}
              >
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="submit" disabled={saving || !name.trim()}>
              Salvar
            </PrimaryButton>
            <SecondaryButton isDark={isDark} onClick={() => setEditing(false)}>
              Cancelar
            </SecondaryButton>
            <SecondaryButton
              isDark={isDark}
              disabled={saving || org.status === "archived"}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setFormError(null);
                  try {
                    const next = await adminArchiveOrganization(organizationId);
                    setOrg(next);
                    fillForm(next);
                    setEditing(false);
                  } catch (err: unknown) {
                    setFormError(err instanceof Error ? err.message : "Falha ao arquivar organização.");
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Arquivar
            </SecondaryButton>
          </div>
        </form>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"}`}>
          <Building2 className="h-5 w-5" />
        </span>
        <Badge tone={org.status === "active" ? "success" : org.status === "suspended" ? "danger" : "warning"} isDark={isDark}>
          {ORG_STATUS_LABEL[org.status] ?? org.status}
        </Badge>
        <Badge tone="neutral" isDark={isDark}>
          {ORG_TYPE_LABEL[org.type] ?? org.type}
        </Badge>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatTile isDark={isDark} label="Usuários ativos" value={formatInt(org.members)} />
        <StatTile isDark={isDark} label="Procedimentos mês" value={formatInt(org.procedures_month)} />
        <StatTile isDark={isDark} label="Chamadas IA" value={formatInt(org.ai_calls)} />
        <StatTile isDark={isDark} label="Plano" value={String(org.plan)} />
        <StatTile isDark={isDark} label="Valor" value={`${formatBRLFromCents(org.monthly_cents)}/mês`} />
        <StatTile isDark={isDark} label="Início" value={formatDate(org.created_at)} />
      </div>
      <div className={`mb-4 inline-flex rounded-lg border p-0.5 ${isDark ? "border-zinc-700" : "border-[#e8ecf0]"}`}>
        <button
          type="button"
          onClick={() => setSection("overview")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${section === "overview" ? "bg-[#6c5ce7] text-white" : ""}`}
        >
          Visão Geral
        </button>
        <button
          type="button"
          onClick={() => setSection("members")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${section === "members" ? "bg-[#6c5ce7] text-white" : ""}`}
        >
          Usuários
        </button>
      </div>
      {section === "overview" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ChartCard title="Procedimentos este mês" isDark={isDark}>
            <LineChart
              isDark={isDark}
              labels={series.map((point) => point.day)}
              series={[{ id: "count", label: "Procedimentos", color: CHART_BRAND, values: series.map((point) => asNumber(point.count ?? point.total)) }]}
            />
          </ChartCard>
          <div className={cardClass(isDark, "p-4")}>
            <h2 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
              Anestesistas mais ativos
            </h2>
            {(org.top_anesthetists ?? []).length === 0 ? (
              <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Nenhum procedimento vinculado a esta instituição neste mês.</p>
            ) : (
              <ul className="space-y-3">
                {org.top_anesthetists.map((item) => (
                  <li key={item.user_id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"}`}>
                        {initialsFromName(item.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.full_name || "—"}</p>
                        <p className={`text-[11px] capitalize ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{item.role}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatInt(item.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className={cardClass(isDark, "p-4")}>
          <h2 className="mb-3 text-sm font-bold">Membros</h2>
          {(org.members_list ?? []).length === 0 ? (
            <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Nenhum membro vinculado a esta organização.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: isDark ? "#27272a" : "#e8ecf0" }}>
              {org.members_list.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{member.full_name || "—"}</p>
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{member.email || "—"}</p>
                  </div>
                  <span className={`text-xs capitalize ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{member.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
