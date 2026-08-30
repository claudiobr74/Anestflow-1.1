import React from "react";
import { Building2, X } from "lucide-react";
import {
  adminAddMembership,
  adminGetUser,
  adminRemoveMembership,
  adminSetMembershipRole,
  adminSetUserStatus,
} from "../api";
import type { AdminRole, AdminUserDetail } from "../types";
import { formatDate, formatRelative, initialsFromName, loginProviderLabel, USER_STATUS_LABEL } from "../format";
import { Badge, ErrorBanner, Field, LoadingBlock, SecondaryButton, TextInput } from "./ui";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ativo" || status === "active") return "success";
  if (status === "perfil_incompleto") return "warning";
  if (status === "convite_pendente") return "warning";
  if (status === "inactive" || status === "suspended") return "danger";
  return "neutral";
}

function isInactiveStatus(user: AdminUserDetail): boolean {
  const status = String(user.account_status || user.status);
  return status === "inactive" || status === "suspended";
}

export default function AdminUserDrawer({
  userId,
  isDark,
  role,
  onClose,
  onUpdated,
}: {
  userId: string;
  isDark: boolean;
  role?: AdminRole | string | null;
  onClose: () => void;
  onUpdated?: (user: AdminUserDetail) => void;
}) {
  const [user, setUser] = React.useState<AdminUserDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [orgId, setOrgId] = React.useState("");
  const [memberRole, setMemberRole] = React.useState("anestesista");
  const isSuperAdmin = role !== "CLINIC_ADMIN";

  const applyUser = (row: AdminUserDetail) => {
    setUser(row);
    onUpdated?.(row);
  };

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void adminGetUser(userId)
      .then((row) => {
        if (!cancelled) setUser(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar usuário.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const panel = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-[#e8ecf0] text-[#2d3436]";

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<AdminUserDetail>) => {
    setSaving(true);
    setError(null);
    try {
      applyUser(await fn());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuário.");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = isDark
    ? "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
    : "w-full rounded-lg border border-[#e8ecf0] bg-[#f8f9fa] px-3 py-2 text-sm";

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-[100vw] flex-col border-l shadow-xl ${panel}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-user-drawer-title"
    >
      <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? "border-zinc-800" : "border-[#e8ecf0]"}`}>
        <h2 id="admin-user-drawer-title" className="text-base font-bold">
          Detalhes do Usuário
        </h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? <LoadingBlock isDark={isDark} /> : null}
        {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
        {user ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold ${
                  isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"
                }`}
              >
                {initialsFromName(user.full_name)}
              </span>
              <h3 className="mt-3 text-lg font-bold">{user.full_name || "Sem nome"}</h3>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{user.email || "—"}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Badge tone={statusTone(String(user.status))} isDark={isDark}>
                  {USER_STATUS_LABEL[String(user.status)] ?? user.status}
                </Badge>
                {user.crm ? (
                  <span className={`text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
                    CRM {user.crm}/{user.uf || "—"}
                  </span>
                ) : null}
                {user.is_platform_admin ? (
                  <Badge tone="brand" isDark={isDark}>
                    Super Admin
                  </Badge>
                ) : null}
                {user.is_clinic_admin && !user.is_platform_admin ? (
                  <Badge tone="brand" isDark={isDark}>
                    Clinic Admin
                  </Badge>
                ) : null}
              </div>
              {isSuperAdmin && !user.is_platform_admin ? (
                <div className="mt-3">
                  <SecondaryButton
                    isDark={isDark}
                    disabled={saving}
                    onClick={() => void run(() => adminSetUserStatus(user.id, isInactiveStatus(user) ? "active" : "inactive"))}
                  >
                    {isInactiveStatus(user) ? "Ativar" : "Desativar"}
                  </SecondaryButton>
                </div>
              ) : null}
            </div>

            <section>
              <h4 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                Informações
              </h4>
              <dl className="space-y-2 text-sm">
                <Row label="UF de Registro" value={user.uf || "—"} isDark={isDark} />
                <Row
                  label="Perfil de Acesso"
                  value={user.is_platform_admin ? "Super Admin" : user.is_clinic_admin ? "Clinic Admin" : "Anestesiologista"}
                  accent
                  isDark={isDark}
                />
                <Row label="Data de Cadastro" value={formatDate(user.created_at)} isDark={isDark} />
                <Row label="Último Acesso" value={user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : "Nunca acessou"} isDark={isDark} />
                <Row label="Provedor de Login" value={loginProviderLabel(user.login_provider)} isDark={isDark} />
              </dl>
            </section>

            <section>
              <h4 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                Organizações vinculadas
              </h4>
              {(user.memberships ?? []).length === 0 ? (
                user.organization_name ? (
                  <OrgCard name={user.organization_name} role="—" isDark={isDark} />
                ) : (
                  <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Nenhuma organização vinculada.</p>
                )
              ) : (
                <div className="space-y-2">
                  {(user.memberships ?? []).map((membership) => (
                    <div key={membership.organization_id} className="space-y-2">
                      <OrgCard name={membership.name} role={membership.role} isDark={isDark} />
                      {isSuperAdmin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label="Papel"
                            value={membership.role}
                            disabled={saving}
                            onChange={(event) =>
                              void run(() => adminSetMembershipRole(user.id, membership.organization_id, event.target.value))
                            }
                            className={selectClass}
                          >
                            <option value="anestesista">Anestesista</option>
                            <option value="coordenador">Coordenador</option>
                            <option value="residente">Residente</option>
                            <option value="admin">Clinic Admin</option>
                          </select>
                          <SecondaryButton
                            isDark={isDark}
                            disabled={saving}
                            onClick={() => void run(() => adminRemoveMembership(user.id, membership.organization_id))}
                          >
                            Remover
                          </SecondaryButton>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {isSuperAdmin ? (
                <div className="mt-3 space-y-2">
                  <Field label="ID da organização" isDark={isDark}>
                    <TextInput isDark={isDark} value={orgId} onChange={setOrgId} />
                  </Field>
                  <Field label="Papel" isDark={isDark}>
                    <select
                      value={memberRole}
                      onChange={(event) => setMemberRole(event.target.value)}
                      className={selectClass}
                    >
                      <option value="anestesista">Anestesista</option>
                      <option value="coordenador">Coordenador</option>
                      <option value="residente">Residente</option>
                      <option value="admin">Clinic Admin</option>
                    </select>
                  </Field>
                  <SecondaryButton
                    isDark={isDark}
                    disabled={saving || !orgId.trim()}
                    onClick={() => {
                      const id = orgId.trim();
                      if (!id) return;
                      void run(() => adminAddMembership(user.id, id, memberRole)).then(() => setOrgId(""));
                    }}
                  >
                    Adicionar vínculo
                  </SecondaryButton>
                </div>
              ) : null}
            </section>

            <section>
              <h4 className={`mb-3 text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                Atividade recente
              </h4>
              {(user.recent_activity ?? []).length === 0 ? (
                <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Nenhum evento de auditoria para este usuário.</p>
              ) : (
                <ol className="space-y-3">
                  {(user.recent_activity ?? []).map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6c5ce7]" />
                      <div>
                        <p className="text-sm">{item.label?.descricao || item.action}</p>
                        <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{formatRelative(item.created_at)}</p>
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
  );
}

function Row({
  label,
  value,
  accent,
  isDark,
}: {
  label: string;
  value: string;
  accent?: boolean;
  isDark: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={isDark ? "text-zinc-500" : "text-[#636e72]"}>{label}</dt>
      <dd className={`text-right font-medium ${accent ? "text-[#6c5ce7]" : ""}`}>{value}</dd>
    </div>
  );
}

function OrgCard({ name, role, isDark }: { name: string; role: string; isDark: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isDark ? "border-zinc-800" : "border-[#e8ecf0]"}`}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-violet-500/15 text-violet-300" : "bg-[#efeaff] text-[#6c5ce7]"}`}>
        <Building2 className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className={`text-[11px] capitalize ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{role}</p>
      </div>
    </div>
  );
}
