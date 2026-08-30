import React from "react";
import { Plus } from "lucide-react";
import { adminListUsersPage, adminSetUserStatus } from "../api";
import type { AdminRole, AdminUserListItem } from "../types";
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
  PrimaryButton,
  SecondaryButton,
  SelectFilter,
  StatTile,
} from "../components/ui";
import AdminUserDrawer from "../components/AdminUserDrawer";

const PAGE_SIZE = 10;

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ativo" || status === "active") return "success";
  if (status === "perfil_incompleto" || status === "convite_pendente") return "warning";
  if (status === "inactive" || status === "suspended") return "danger";
  return "neutral";
}

function isInactiveStatus(row: AdminUserListItem): boolean {
  const status = String(row.account_status || row.status);
  return status === "inactive" || status === "suspended";
}

const USER_STATUS_FILTERS = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "suspended", label: "Suspenso" },
  { value: "convite_pendente", label: "Convite pendente" },
  { value: "perfil_incompleto", label: "Perfil incompleto" },
];

export default function AdminUsersPage({
  isDark,
  drawerId,
  role,
}: {
  isDark: boolean;
  drawerId: string | null;
  role?: AdminRole | string | null;
}) {
  const [rows, setRows] = React.useState<AdminUserListItem[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [uf, setUf] = React.useState("all");
  const [org, setOrg] = React.useState("all");
  const [perfil, setPerfil] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [inviteHint, setInviteHint] = React.useState(false);
  const isSuperAdmin = role !== "CLINIC_ADMIN";

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListUsersPage(page, PAGE_SIZE, search);
      setRows(result.items);
      setTotalCount(result.total_count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao listar usuários.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void reload().finally(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const toggleStatus = async (row: AdminUserListItem) => {
    setError(null);
    try {
      const next = await adminSetUserStatus(row.id, isInactiveStatus(row) ? "active" : "inactive");
      setRows((current) => current.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
    }
  };

  const ufs = uniqueStrings(rows.map((row) => row.uf));
  const orgs = uniqueStrings(rows.map((row) => row.organization_name));
  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const blob = `${row.full_name ?? ""} ${row.email ?? ""} ${row.crm ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (status !== "all") {
      const current = String(row.status);
      const account = String(row.account_status ?? "");
      if (status === "active") {
        if (current !== "active" && current !== "ativo") return false;
      } else if (current !== status && account !== status) {
        return false;
      }
    }
    if (uf !== "all" && row.uf !== uf) return false;
    if (org !== "all" && row.organization_name !== org) return false;
    if (perfil === "admin" && !row.is_platform_admin) return false;
    if (perfil === "anestesista" && row.is_platform_admin) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, status, uf, org, perfil]);

  const active = rows.filter((row) => row.status === "ativo" || row.status === "active").length;
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
          <PrimaryButton onClick={() => setInviteHint(true)}>
            <Plus className="h-4 w-4" /> Novo Usuário
          </PrimaryButton>
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
            <StatTile isDark={isDark} label="Total usuários" value={formatInt(totalCount)} />
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
              options={[{ value: "all", label: "Status" }, ...USER_STATUS_FILTERS]}
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
            rows={filtered}
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
                render: (row) =>
                  row.is_platform_admin ? "Super Admin" : row.is_clinic_admin ? "Clinic Admin" : "Anestesiologista",
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
                  <div className="flex flex-wrap gap-2">
                    {isSuperAdmin && !row.is_platform_admin ? (
                      <SecondaryButton isDark={isDark} onClick={() => void toggleStatus(row)}>
                        {isInactiveStatus(row) ? "Ativar" : "Desativar"}
                      </SecondaryButton>
                    ) : null}
                    <SecondaryButton isDark={isDark} onClick={() => navigateAdmin(usersHref(row.id))}>
                      Gerenciar
                    </SecondaryButton>
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={status !== "all" || uf !== "all" || org !== "all" || perfil !== "all" ? filtered.length : totalCount}
            onPage={setPage}
            noun="usuários"
            isDark={isDark}
          />
        </>
      ) : null}
      {drawerId ? (
        <AdminUserDrawer
          userId={drawerId}
          isDark={isDark}
          role={role}
          onClose={() => navigateAdmin(usersHref())}
          onUpdated={(user) => {
            setRows((current) => current.map((row) => (row.id === user.id ? { ...row, ...user } : row)));
          }}
        />
      ) : null}
    </div>
  );
}
