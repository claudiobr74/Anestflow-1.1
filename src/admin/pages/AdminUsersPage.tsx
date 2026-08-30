import React from "react";
import { adminListUsers } from "../api";
import type { AdminUserListItem } from "../types";
import { formatInt, formatRelative, initialsFromName, uniqueStrings, USER_STATUS_LABEL } from "../format";
import { navigateAdmin, usersHref } from "../routes";
import {
  Badge,
  DataTable,
  ErrorBanner,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  paginate,
  SecondaryButton,
  SelectFilter,
  StatTile,
} from "../components/ui";
import AdminUserDrawer from "../components/AdminUserDrawer";

const PAGE_SIZE = 10;

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "ativo") return "success";
  if (status === "perfil_incompleto" || status === "convite_pendente") return "warning";
  return "neutral";
}

export default function AdminUsersPage({
  isDark,
  drawerId,
}: {
  isDark: boolean;
  drawerId: string | null;
}) {
  const [rows, setRows] = React.useState<AdminUserListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [uf, setUf] = React.useState("all");
  const [org, setOrg] = React.useState("all");
  const [perfil, setPerfil] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [inviteHint, setInviteHint] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminListUsers()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao listar usuários.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ufs = uniqueStrings(rows.map((row) => row.uf));
  const orgs = uniqueStrings(rows.map((row) => row.organization_name));
  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const blob = `${row.full_name ?? ""} ${row.email ?? ""} ${row.crm ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (status !== "all" && row.status !== status) return false;
    if (uf !== "all" && row.uf !== uf) return false;
    if (org !== "all" && row.organization_name !== org) return false;
    if (perfil === "admin" && !row.is_platform_admin) return false;
    if (perfil === "anestesista" && row.is_platform_admin) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, status, uf, org, perfil]);

  const active = rows.filter((row) => row.status === "ativo").length;
  const pending = rows.filter((row) => row.status === "convite_pendente").length;
  const incomplete = rows.filter((row) => row.status === "perfil_incompleto").length;

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie anestesiologistas, coordenadores e equipes vinculadas ao AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Usuários" }]}
        isDark={isDark}
        actions={
          <SecondaryButton isDark={isDark} onClick={() => setInviteHint(true)}>
            Novo Usuário
          </SecondaryButton>
        }
      />
      {inviteHint ? (
        <p className={`mb-4 text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
          Convites administrativos ainda não estão disponíveis. Novos usuários entram pelo cadastro da ficha clínica.
        </p>
      ) : null}
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading ? <LoadingBlock isDark={isDark} /> : null}
      {!loading ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile isDark={isDark} label="Total usuários" value={formatInt(rows.length)} />
            <StatTile isDark={isDark} label="Ativos" value={formatInt(active)} tone="success" />
            <StatTile isDark={isDark} label="Convite pendente" value={formatInt(pending)} tone="warning" />
            <StatTile isDark={isDark} label="Perfil incompleto" value={formatInt(incomplete)} tone="warning" />
          </div>
          <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome, email ou CRM..." isDark={isDark}>
            <SelectFilter
              isDark={isDark}
              label="Organização"
              value={org}
              onChange={setOrg}
              options={[{ value: "all", label: "Organização" }, ...orgs.map((value) => ({ value, label: value }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "Status" }, ...Object.entries(USER_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Perfil"
              value={perfil}
              onChange={setPerfil}
              options={[
                { value: "all", label: "Perfil" },
                { value: "anestesista", label: "Anestesiologista" },
                { value: "admin", label: "Super Admin" },
              ]}
            />
            <SelectFilter
              isDark={isDark}
              label="UF"
              value={uf}
              onChange={setUf}
              options={[{ value: "all", label: "UF" }, ...ufs.map((value) => ({ value, label: value }))]}
            />
          </FilterBar>
          <DataTable<AdminUserListItem>
            isDark={isDark}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(row) => row.id}
            selectedKey={drawerId}
            emptyTitle="Nenhum usuário encontrado"
            emptyDescription="A lista reflete os perfis clínicos cadastrados."
            onRowClick={(row) => navigateAdmin(usersHref(row.id))}
            columns={[
              {
                key: "user",
                header: "Usuário",
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"}`}>
                      {initialsFromName(row.full_name)}
                    </span>
                    <div>
                      <p className="font-semibold">{row.full_name || "Sem nome"}</p>
                      <p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{row.email || "—"}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "crm",
                header: "CRM",
                render: (row) => (row.crm ? `${row.crm}/${row.uf || "—"}` : "—"),
              },
              {
                key: "uf",
                header: "UF",
                render: (row) => row.uf || "—",
              },
              {
                key: "org",
                header: "Organização",
                render: (row) => row.organization_name || "—",
              },
              {
                key: "profile",
                header: "Perfil",
                render: (row) => (row.is_platform_admin ? "Super Admin" : "Anestesiologista"),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge tone={statusTone(String(row.status))} isDark={isDark}>
                    {USER_STATUS_LABEL[String(row.status)] ?? row.status}
                  </Badge>
                ),
              },
              {
                key: "last",
                header: "Último acesso",
                render: (row) => (row.last_sign_in_at ? formatRelative(row.last_sign_in_at) : "Nunca acessou"),
              },
              {
                key: "actions",
                header: "Ações",
                render: (row) => (
                  <SecondaryButton isDark={isDark} onClick={() => navigateAdmin(usersHref(row.id))}>
                    Gerenciar
                  </SecondaryButton>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="usuários" isDark={isDark} />
        </>
      ) : null}
      {drawerId ? (
        <AdminUserDrawer userId={drawerId} isDark={isDark} onClose={() => navigateAdmin(usersHref())} />
      ) : null}
    </div>
  );
}
