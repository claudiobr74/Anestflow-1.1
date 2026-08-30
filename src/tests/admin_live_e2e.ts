/**
 * Live E2E do Admin hardening. Paciente fictício. Sem PHI.
 *
 * Uso: .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 * Obrigatório para TEST C/D: ONDA3_TEST_EMAIL_B / ONDA3_TEST_PASSWORD_B
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA3_TEST_PASSWORD || "";
const emailB = (process.env.ONDA3_TEST_EMAIL_B || "").trim();
const passwordB = process.env.ONDA3_TEST_PASSWORD_B || "";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function asObj(data: unknown): Record<string, unknown> {
  if (typeof data === "string") return JSON.parse(data) as Record<string, unknown>;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return {};
}

if (!url || !key || key.includes("xxxxxxxx") || !email || !password) {
  console.log("ADMIN_LIVE_E2E_NOT_RUN sem VITE_SUPABASE_* / ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD");
  process.exit(2);
}
if (!emailB || !passwordB) {
  console.log("ADMIN_LIVE_E2E_NOT_RUN sem ONDA3_TEST_EMAIL_B / ONDA3_TEST_PASSWORD_B");
  process.exit(2);
}

const supabase = getSupabase();

async function signIn(em: string, pw: string) {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
  if (error || !data.user) fail(`login ${em}: ${error?.message || "falhou"}`);
  return data.user;
}

function whoRole(who: unknown): string {
  return String(asObj(who).role || "");
}

const userA = await signIn(email, password);
const uidA = userA.id;
console.log("login A ok", uidA);

const { count: adminsBefore } = await supabase.from("platform_admins").select("user_id", { count: "exact", head: true });
const { data: boot, error: bootErr } = await supabase.rpc("admin_bootstrap_self");
if (bootErr) console.log("bootstrap rpc", bootErr.message);
const { count: adminsAfter } = await supabase.from("platform_admins").select("user_id", { count: "exact", head: true });
if ((adminsAfter ?? 0) > (adminsBefore ?? 0)) fail("TEST A: bootstrap criou platform_admin");
console.log("TEST A PASS bootstrap não promove", boot === true || boot === false);

const { data: who, error: whoErr } = await supabase.rpc("admin_whoami");
if (whoErr) fail(`whoami A: ${whoErr.message}`);
const roleA = whoRole(who);
console.log("whoami A", roleA);
if (roleA !== "SUPER_ADMIN") fail(`TEST B esperado SUPER_ADMIN para A, veio ${roleA}`);

const { data: dash, error: dashErr } = await supabase.rpc("admin_dashboard_overview", { p_range: "30d" });
if (dashErr) fail(`TEST B dashboard: ${dashErr.message}`);
const overview = asObj(dash);
const kpis = asObj(overview.kpis);
if (Object.prototype.hasOwnProperty.call(kpis, "cancelled") && kpis.cancelled === 0) {
  console.log("TEST B note: cancelled ainda 0 — esperado null se domínio não tem cancelado");
}
console.log("TEST B PASS super admin dashboard");

const stamp = Date.now();
const { data: created, error: createErr } = await supabase.rpc("admin_create_organization", {
  p_name: `ORG_A Hardening ${stamp}`,
  p_type: "hospital",
  p_plan: "standard",
});
if (createErr) fail(`create org A: ${createErr.message}`);
const orgA = asObj(created);
const { data: createdB, error: createErrB } = await supabase.rpc("admin_create_organization", {
  p_name: `ORG_B Hardening ${stamp}`,
  p_type: "clinica",
  p_plan: "trial",
});
if (createErrB) fail(`create org B: ${createErrB.message}`);
const orgB = asObj(createdB);
const orgAId = String(orgA.id);
const orgBId = String(orgB.id);
console.log("ORG_A", orgAId);
console.log("ORG_B", orgBId);

const { data: patched, error: patchErr } = await supabase.rpc("admin_update_organization", {
  p_id: orgAId,
  p_patch: { monthly_cents: 150000, billing_cycle: "monthly", city: "São Paulo", state: "SP" },
});
if (patchErr) fail(`update org: ${patchErr.message}`);
const orgPatched = asObj(patched);
if (orgPatched.monthly_cents !== 150000) fail("financeiro contratual não persistiu");
console.log("TEST org/finance PASS");

const { data: getA } = await supabase.rpc("admin_get_organization", { p_id: orgAId });
const { data: getB } = await supabase.rpc("admin_get_organization", { p_id: orgBId });
if (!asObj(getA).id || !asObj(getB).id) fail("SUPER_ADMIN não leu ORG_A/ORG_B");
console.log("SUPER_ADMIN_GLOBAL_ACCESS PASS");

const userB = await (async () => {
  const { data: listed } = await supabase.rpc("admin_list_users");
  const rows = Array.isArray(listed) ? listed : (typeof listed === "string" ? JSON.parse(listed) : []);
  const found = (rows as Array<{ id: string; email?: string }>).find((row) => row.email === emailB);
  if (!found?.id) fail("USER B não encontrado em admin_list_users");
  return found.id;
})();

const { error: addErr } = await supabase.rpc("admin_add_membership", {
  p_user_id: userB,
  p_organization_id: orgBId,
  p_role: "anestesista",
});
if (addErr) fail(`TEST E add membership: ${addErr.message}`);
const { data: userAfterAdd } = await supabase.rpc("admin_get_user", { p_id: userB });
const afterAdd = asObj(userAfterAdd);
const mems = Array.isArray(afterAdd.memberships) ? afterAdd.memberships as Array<{ organization_id: string; role: string }> : [];
if (!mems.some((m) => m.organization_id === orgBId && m.role === "anestesista")) {
  fail("TEST E membership não persistiu");
}

const { error: roleErr } = await supabase.rpc("admin_set_membership_role", {
  p_user_id: userB,
  p_organization_id: orgBId,
  p_role: "coordenador",
});
if (roleErr) fail(`TEST E change role: ${roleErr.message}`);

const { data: auditPage } = await supabase.rpc("admin_list_audit_page", { p_page: 1, p_page_size: 50 });
const audit = asObj(auditPage);
const auditItems = Array.isArray(audit.items) ? audit.items as Array<Record<string, unknown>> : [];
const memberAudit = auditItems.find((ev) => String(ev.action) === "MEMBER_ADDED" || String(ev.action) === "MEMBER_ROLE_CHANGED");
if (!memberAudit) fail("TEST E audit não registrou MEMBER_ADDED/MEMBER_ROLE_CHANGED");
if (!memberAudit.target_type || !memberAudit.target_id) fail("TEST E audit sem target_type/target_id");
if (String(memberAudit.actor_id || "") !== uidA) fail("TEST E audit actor incorreto");
console.log("TEST E PASS membership add/role + audit target");

const { data: page, error: pageErr } = await supabase.rpc("admin_list_procedures_page", {
  p_page: 1,
  p_page_size: 5,
});
if (pageErr) fail(`TEST J page: ${pageErr.message}`);
const pageRow = asObj(page);
if (typeof pageRow.total_count !== "number") fail("TEST J sem total_count");
const items = Array.isArray(pageRow.items) ? pageRow.items as Array<{ id: string; status?: string }> : [];
if (items.length > 5) fail("TEST J page_size ignorado");
const ids = items.map((item) => item.id);
if (new Set(ids).size !== ids.length) fail("TEST J duplicatas");
const blob = JSON.stringify(pageRow);
if (/patient_name|"cpf"|diagnosis|medications|vitals|clinical_notes|signed_canonical/.test(blob)) {
  fail("TEST I PHI vazou na RPC de procedures");
}
console.log("TEST I/J PASS pagination + PHI");

const { error: settingsErr } = await supabase.rpc("admin_update_settings", {
  p_patch: { require_2fa: true, feature_flags: { voice_scribe: false } },
});
if (!settingsErr) fail("TEST H settings não enforced foi aceito");
console.log("TEST H PASS settings não enforced recusado");

const { data: fin } = await supabase.rpc("admin_financial_overview");
const finRow = asObj(fin);
if (Number(finRow.mrr_cents) < 150000) fail("MRR não usa contrato real");
console.log("TEST finance MRR", finRow.mrr_cents);

const signed = items.find((item) => item.status === "signed");
if (signed?.id) {
  const { data: verified, error: verifyErr } = await supabase.rpc("admin_verify_procedure", {
    p_procedure_id: signed.id,
  });
  if (verifyErr) fail(`TEST F verify: ${verifyErr.message}`);
  const report = asObj(verified);
  if (report.integrity_status === "intact" && (report.snapshot_ok !== true || report.persisted_ok !== true)) {
    fail("TEST F intact sem snapshotOk+persistedOk");
  }
  console.log("TEST F verify (pre-tamper)", report.integrity_status);
} else {
  console.log("TEST F note: sem signed na página 1; tamper SQL roda à parte");
}

const adminsMid = adminsAfter ?? 0;

const userBSession = await signIn(emailB, passwordB);
const uidB = userBSession.id;
console.log("login B ok", uidB);

const { data: whoBUser, error: whoBUserErr } = await supabase.rpc("admin_whoami");
if (whoBUserErr) fail(`whoami B user: ${whoBUserErr.message}`);
if (whoRole(whoBUser) !== "USER") fail(`TEST D esperado USER, veio ${whoRole(whoBUser)}`);
const { error: deniedDash } = await supabase.rpc("admin_dashboard_overview", { p_range: "30d" });
if (!deniedDash) fail("TEST D USER acessou dashboard");
const { error: deniedOrgs } = await supabase.rpc("admin_list_organizations");
if (!deniedOrgs) fail("TEST D USER acessou admin_list_organizations");
const { data: bootB } = await supabase.rpc("admin_bootstrap_self");
const { count: adminsAfterB } = await supabase.from("platform_admins").select("user_id", { count: "exact", head: true });
if ((adminsAfterB ?? 0) !== adminsMid) fail("TEST D bootstrap promoveu USER B");
console.log("TEST D PASS USER_ADMIN_RPC DENIED, no self-promotion", bootB);

await signIn(email, password);
const { error: grantErr } = await supabase.rpc("admin_set_membership_role", {
  p_user_id: uidB,
  p_organization_id: orgBId,
  p_role: "anestesista",
});
if (grantErr) console.log("reset role B on B", grantErr.message);
const { error: clinicGrantErr } = await supabase.rpc("admin_add_membership", {
  p_user_id: uidB,
  p_organization_id: orgAId,
  p_role: "admin",
});
if (clinicGrantErr) fail(`grant CLINIC_ADMIN: ${clinicGrantErr.message}`);
const { error: removeBOnB } = await supabase.rpc("admin_remove_membership", {
  p_user_id: uidB,
  p_organization_id: orgBId,
});
if (removeBOnB) fail(`remove B from ORG_B: ${removeBOnB.message}`);
console.log("granted CLINIC_ADMIN of ORG_A to B; removed ORG_B membership");

await signIn(emailB, passwordB);
const { data: whoClinic, error: whoClinicErr } = await supabase.rpc("admin_whoami");
if (whoClinicErr) fail(`whoami clinic: ${whoClinicErr.message}`);
if (whoRole(whoClinic) !== "CLINIC_ADMIN") fail(`TEST C esperado CLINIC_ADMIN, veio ${whoRole(whoClinic)}`);

const { data: ownOrg, error: ownErr } = await supabase.rpc("admin_get_organization", { p_id: orgAId });
if (ownErr) fail(`CLINIC_ADMIN_OWN_ORG: ${ownErr.message}`);
if (String(asObj(ownOrg).id) !== orgAId) fail("CLINIC_ADMIN_OWN_ORG não devolveu ORG_A");
console.log("CLINIC_ADMIN_OWN_ORG PASS");

const { data: crossOrg, error: crossErr } = await supabase.rpc("admin_get_organization", { p_id: orgBId });
if (!crossErr) fail(`CLINIC_ADMIN_CROSS_ORG deveria ser DENIED, veio ${JSON.stringify(crossOrg)}`);
console.log("CLINIC_ADMIN_CROSS_ORG DENIED", crossErr.message);

const { error: finDenied } = await supabase.rpc("admin_financial_overview");
if (!finDenied) fail("CLINIC_ADMIN acessou financeiro global");
const { error: settingsDenied } = await supabase.rpc("admin_update_settings", { p_patch: { support_email: "x@y.z" } });
if (!settingsDenied) fail("CLINIC_ADMIN alterou settings globais");
console.log("TEST C PASS clinic isolation + no global finance/settings");

await signIn(email, password);
await supabase.rpc("admin_remove_membership", { p_user_id: uidB, p_organization_id: orgAId });
await supabase.rpc("admin_archive_organization", { p_id: orgAId });
await supabase.rpc("admin_archive_organization", { p_id: orgBId });
console.log("cleanup orgs archived");

console.log("ADMIN_LIVE_E2E_DONE");
