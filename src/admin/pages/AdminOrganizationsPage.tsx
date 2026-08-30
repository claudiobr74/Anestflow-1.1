import React from "react";
import { Building2, Plus } from "lucide-react";
import { adminCreateOrganization, adminListOrganizations } from "../api";
import type { OrganizationListItem, OrgPlan, OrgType } from "../types";
import { formatInt, ORG_PLAN_LABEL, ORG_STATUS_LABEL, ORG_TYPE_LABEL } from "../format";
import { navigateAdmin, organizationHref } from "../routes";
import {
  Badge,
  DataTable,
  ErrorBanner,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  paginate,
  PrimaryButton,
  SecondaryButton,
  SelectFilter,
  StatTile,
  TextInput,
  Field,
  cardClass,
} from "../components/ui";

const PAGE_SIZE = 10;

function planTone(plan: string): "brand" | "info" | "warning" | "neutral" {
  if (plan === "enterprise") return "brand";
  if (plan === "standard") return "info";
  if (plan === "trial") return "warning";
  return "neutral";
}

function statusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "suspended") return "danger";
  if (status === "trial") return "warning";
  return "neutral";
}

export default function AdminOrganizationsPage({ isDark }: { isDark: boolean }) {
  const [rows, setRows] = React.useState<OrganizationListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [plan, setPlan] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [formType, setFormType] = React.useState<OrgType>("hospital");
  const [formPlan, setFormPlan] = React.useState<OrgPlan>("trial");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await adminListOrganizations());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao listar organizações.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (type !== "all" && row.type !== type) return false;
    if (status !== "all" && row.status !== status) return false;
    if (plan !== "all" && row.plan !== plan) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, type, status, plan]);

  const createOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await adminCreateOrganization(name.trim(), formType, formPlan);
      setCreating(false);
      setName("");
      setFormType("hospital");
      setFormPlan("trial");
      await load();
      navigateAdmin(organizationHref(created.id));
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Falha ao criar organização.");
    } finally {
      setSaving(false);
    }
  };

  const active = rows.filter((row) => row.status === "active").length;
  const trial = rows.filter((row) => row.plan === "trial" || row.status === "trial").length;

  return (
    <div>
      <PageHeader
        title="Organizações"
        description="Gerencie hospitais, clínicas e grupos vinculados ao AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Organizações" }]}
        isDark={isDark}
        actions={
          <PrimaryButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova Organização
          </PrimaryButton>
        }
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {creating ? (
        <form onSubmit={(event) => void createOrg(event)} className={cardClass(isDark, "mb-4 p-4 space-y-3")}>
          <h2 className="text-sm font-bold">Nova organização</h2>
          {formError ? <ErrorBanner message={formError} isDark={isDark} /> : null}
          <Field label="Nome" isDark={isDark}>
            <TextInput value={name} onChange={setName} isDark={isDark} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo" isDark={isDark}>
              <select
                value={formType}
                onChange={(event) => setFormType(event.target.value as OrgType)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-[#f8f9fa] border-[#e8ecf0]"}`}
              >
                <option value="hospital">Hospital</option>
                <option value="clinica">Clínica</option>
                <option value="grupo">Grupo</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="Plano" isDark={isDark}>
              <select
                value={formPlan}
                onChange={(event) => setFormPlan(event.target.value as OrgPlan)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-[#f8f9fa] border-[#e8ecf0]"}`}
              >
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={saving || !name.trim()}>
              Criar
            </PrimaryButton>
            <SecondaryButton isDark={isDark} onClick={() => setCreating(false)}>
              Cancelar
            </SecondaryButton>
          </div>
        </form>
      ) : null}
      {loading ? <LoadingBlock isDark={isDark} /> : null}
      {!loading ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatTile isDark={isDark} label="Total de organizações" value={formatInt(rows.length)} />
            <StatTile isDark={isDark} label="Ativas" value={formatInt(active)} tone="success" />
            <StatTile isDark={isDark} label="Trial" value={formatInt(trial)} tone="warning" />
          </div>
          <FilterBar search={search} onSearch={setSearch} placeholder="Buscar organização..." isDark={isDark}>
            <SelectFilter
              isDark={isDark}
              label="Tipo"
              value={type}
              onChange={setType}
              options={[{ value: "all", label: "Tipo" }, ...Object.entries(ORG_TYPE_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "Status" }, ...Object.entries(ORG_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Plano"
              value={plan}
              onChange={setPlan}
              options={[{ value: "all", label: "Plano" }, ...Object.entries(ORG_PLAN_LABEL).map(([value, label]) => ({ value, label }))]}
            />
          </FilterBar>
          <DataTable<OrganizationListItem>
            isDark={isDark}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(row) => row.id}
            emptyTitle="Nenhuma organização cadastrada"
            emptyDescription="Hospitais em texto livre na ficha clínica não viram organização automaticamente. Cadastre uma instituição para começar."
            onRowClick={(row) => navigateAdmin(organizationHref(row.id))}
            columns={[
              {
                key: "name",
                header: "Organização",
                render: (row) => (
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"}`}>
                      <Building2 className="h-4 w-4" />
                    </span>
                    {row.name}
                  </span>
                ),
              },
              {
                key: "type",
                header: "Tipo",
                render: (row) => ORG_TYPE_LABEL[row.type] ?? row.type,
              },
              {
                key: "members",
                header: "Usuários",
                render: (row) => formatInt(row.members),
              },
              {
                key: "proc",
                header: "Proc./mês",
                render: (row) => formatInt(row.procedures_month),
              },
              {
                key: "plan",
                header: "Plano",
                render: (row) => (
                  <Badge tone={planTone(String(row.plan))} isDark={isDark}>
                    {ORG_PLAN_LABEL[row.plan] ?? row.plan}
                  </Badge>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge tone={statusTone(String(row.status))} isDark={isDark}>
                    {ORG_STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "Ações",
                render: (row) => (
                  <SecondaryButton
                    isDark={isDark}
                    onClick={() => navigateAdmin(organizationHref(row.id))}
                  >
                    Gerenciar
                  </SecondaryButton>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="organizações" isDark={isDark} />
        </>
      ) : null}
    </div>
  );
}
