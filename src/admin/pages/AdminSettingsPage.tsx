import React from "react";
import { adminGetSettings, adminUpdateSettings } from "../api";
import { ADMIN_AI_PROMPT_ROWS, type AdminAiPromptRow } from "../aiCatalog";
import type { AdminFeatureFlags, AdminSettings } from "../types";
import { SESSION_TIMEBOX_MS } from "../../lib/sessionPolicy";
import { MIN_PASSWORD_LENGTH } from "../../lib/passwordPolicy";
import { ADMIN_TIMEZONE } from "../format";
import {
  Badge,
  DataTable,
  ErrorBanner,
  Field,
  LoadingBlock,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  Toggle,
  cardClass,
} from "../components/ui";

const FLAG_LABELS: { key: keyof AdminFeatureFlags; label: string }[] = [
  { key: "voice_scribe", label: "Voice Scribe" },
  { key: "ai_supervisor", label: "Supervisor IA" },
  { key: "narrative_ai", label: "Narrativa IA" },
  { key: "google_login", label: "Google Login" },
  { key: "pdf_final", label: "PDF Final" },
  { key: "experimental", label: "Recurso Experimental" },
];

export default function AdminSettingsPage({ isDark }: { isDark: boolean }) {
  const [settings, setSettings] = React.useState<AdminSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [openPrompt, setOpenPrompt] = React.useState<string | null>(null);

  const sessionHours = Math.round(SESSION_TIMEBOX_MS / (60 * 60 * 1000));

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminGetSettings()
      .then((row) => {
        if (!cancelled) setSettings(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar configurações.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const next = await adminUpdateSettings({
        platform_name: settings.platform_name,
        base_url: settings.base_url,
        timezone: settings.timezone,
        locale: settings.locale,
        password_policy: settings.password_policy,
        support_email: settings.support_email,
      });
      setSettings(next);
      setInfo("Configurações salvas.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = isDark
    ? "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
    : "w-full rounded-lg border border-[#e8ecf0] bg-[#f8f9fa] px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Configure a plataforma, segurança, IA e funcionalidades do AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Configurações" }]}
        isDark={isDark}
        actions={
          <PrimaryButton disabled={saving || !settings} onClick={() => void save()}>
            Salvar
          </PrimaryButton>
        }
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {info ? <p className={`mb-4 text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>{info}</p> : null}
      {loading || !settings ? (
        <LoadingBlock isDark={isDark} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <section className={cardClass(isDark, "space-y-3 p-4")}>
              <h2 className="text-sm font-bold">Plataforma</h2>
              <Field label="Nome da plataforma" isDark={isDark}>
                <TextInput
                  isDark={isDark}
                  value={settings.platform_name}
                  onChange={(value) => setSettings({ ...settings, platform_name: value })}
                />
              </Field>
              <Field label="URL base" isDark={isDark}>
                <TextInput
                  isDark={isDark}
                  value={settings.base_url}
                  onChange={(value) => setSettings({ ...settings, base_url: value })}
                />
              </Field>
              <Field label="Timezone" isDark={isDark} hint="Padrão operacional America/Sao_Paulo.">
                <input className={inputClass} value={settings.timezone || ADMIN_TIMEZONE} readOnly />
              </Field>
              <Field label="Idioma padrão" isDark={isDark}>
                <input className={inputClass} value={settings.locale === "pt-BR" ? "Português - Brasil" : settings.locale} readOnly />
              </Field>
            </section>
            <section className={cardClass(isDark, "space-y-3 p-4")}>
              <h2 className="text-sm font-bold">Segurança</h2>
              <Field
                label="Tempo limite da sessão"
                isDark={isDark}
                hint={`Limite real da sessão clínica (sessionPolicy): ${sessionHours}h. Este campo é informativo e não altera o runtime.`}
              >
                <input className={inputClass} value={`${sessionHours}h`} readOnly />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className={`text-sm ${isDark ? "text-zinc-300" : "text-[#2d3436]"}`}>Dois fatores (2FA) obrigatório</span>
                  <span className={`mt-0.5 block text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Ainda não aplicado ao runtime</span>
                </div>
                <Toggle
                  label="Dois fatores (2FA) obrigatório"
                  checked={Boolean(settings.require_2fa)}
                  disabled
                  onChange={() => undefined}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className={`text-sm ${isDark ? "text-zinc-300" : "text-[#2d3436]"}`}>Modo de manutenção</span>
                  <span className={`mt-0.5 block text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Ainda não aplicado ao runtime</span>
                </div>
                <Toggle
                  label="Modo de manutenção"
                  checked={Boolean(settings.maintenance_mode)}
                  disabled
                  onChange={() => undefined}
                />
              </div>
              <Field
                label="Política de senha"
                isDark={isDark}
                hint={`Runtime clínico: mínimo ${MIN_PASSWORD_LENGTH} caracteres, maiúscula, minúscula e dígito.`}
              >
                <input className={inputClass} value={settings.password_policy || "forte"} readOnly />
              </Field>
            </section>
          </div>
          <div className="space-y-4">
            <section className={cardClass(isDark, "p-4")}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Feature flags</h2>
                <Badge tone="brand" isDark={isDark}>
                  Global
                </Badge>
              </div>
              <p className={`mb-4 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                Configuração por organização disponível em breve.
              </p>
              <ul className="space-y-3">
                {FLAG_LABELS.map((flag) => (
                  <li key={flag.key} className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm">{flag.label}</span>
                      <span className={`mt-0.5 block text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>Ainda não aplicado ao runtime</span>
                    </div>
                    <Toggle
                      label={flag.label}
                      checked={Boolean(settings.feature_flags?.[flag.key])}
                      disabled
                      onChange={() => undefined}
                    />
                  </li>
                ))}
              </ul>
            </section>
            <section className={cardClass(isDark, "p-4")}>
              <h2 className="text-sm font-bold">Prompts de IA</h2>
              <p className={`mb-3 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
                Edição de prompts em produção desabilitada por segurança. Catálogo do runtime (`aiModelConfig`).
              </p>
              <DataTable<AdminAiPromptRow>
                isDark={isDark}
                rows={ADMIN_AI_PROMPT_ROWS}
                rowKey={(row) => row.id}
                emptyTitle="Catálogo indisponível"
                columns={[
                  { key: "prompt", header: "Prompt", render: (row) => <span className="font-mono text-xs">{row.prompt}</span> },
                  { key: "version", header: "Versão", render: (row) => row.version },
                  { key: "model", header: "Modelo", render: (row) => <span className="font-mono text-xs">{row.model}</span> },
                  { key: "schema", header: "Schema", render: (row) => <span className="font-mono text-xs">{row.schema}</span> },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <Badge tone="success" isDark={isDark}>
                        {row.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Ações",
                    render: (row) => (
                      <div className="flex gap-2">
                        <SecondaryButton isDark={isDark} onClick={() => setOpenPrompt(row.id)}>
                          Visualizar
                        </SecondaryButton>
                        <SecondaryButton isDark={isDark} disabled title="Histórico de prompts não persistido.">
                          Histórico
                        </SecondaryButton>
                      </div>
                    ),
                  },
                ]}
              />
              {openPrompt ? (
                <p className={`mt-3 text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
                  {(() => {
                    const row = ADMIN_AI_PROMPT_ROWS.find((item) => item.id === openPrompt);
                    if (!row) return null;
                    return `${row.prompt} · modelo ${row.model} · schema ${row.schema}. Texto do prompt permanece no runtime das Edge Functions.`;
                  })()}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
