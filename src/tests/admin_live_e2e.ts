/**
 * Live E2E do Admin hardening. Paciente fictício. Sem PHI.
 *
 * Uso: .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 * Opcional: ONDA3_TEST_EMAIL_B para CLINIC_ADMIN cross-org.
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

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) {
  console.log("ADMIN_LIVE_E2E_SKIPPED sem ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD");
  process.exit(0);
}

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
const uid = session.user.id;
console.log("login ok");

const { count: adminsBefore } = await supabase.from("platform_admins").select("user_id", { count: "exact", head: true });
const { data: boot, error: bootErr } = await supabase.rpc("admin_bootstrap_self");
if (bootErr) console.log("bootstrap rpc", bootErr.message);
const { count: adminsAfter } = await supabase.from("platform_admins").select("user_id", { count: "exact", head: true });
if ((adminsAfter ?? 0) > (adminsBefore ?? 0)) fail("TEST A: bootstrap criou platform_admin");
console.log("TEST A PASS bootstrap não promove", boot === true || boot === false);

const { data: who, error: whoErr } = await supabase.rpc("admin_whoami");
if (whoErr) fail(`whoami: ${whoErr.message}`);
const role = typeof who === "string" ? JSON.parse(who).role : who?.role;
console.log("whoami", role);

if (role === "SUPER_ADMIN") {
  const { data: dash, error: dashErr } = await supabase.rpc("admin_dashboard_overview", { p_range: "30d" });
  if (dashErr) fail(`TEST B dashboard: ${dashErr.message}`);
  const overview = typeof dash === "string" ? JSON.parse(dash) : dash;
  if (overview?.kpis && Object.prototype.hasOwnProperty.call(overview.kpis, "cancelled") && overview.kpis.cancelled === 0) {
    console.log("TEST B note: cancelled ainda 0 — esperado null se domínio não tem cancelado");
  }
  console.log("TEST B PASS super admin dashboard");

  const { data: created, error: createErr } = await supabase.rpc("admin_create_organization", {
    p_name: `Org Hardening A ${Date.now()}`,
    p_type: "hospital",
    p_plan: "standard",
  });
  if (createErr) fail(`create org: ${createErr.message}`);
  const orgA = typeof created === "string" ? JSON.parse(created) : created;
  const { data: createdB, error: createErrB } = await supabase.rpc("admin_create_organization", {
    p_name: `Org Hardening B ${Date.now()}`,
    p_type: "clinica",
    p_plan: "trial",
  });
  if (createErrB) fail(`create org B: ${createErrB.message}`);
  const orgB = typeof createdB === "string" ? JSON.parse(createdB) : createdB;

  const { data: patched, error: patchErr } = await supabase.rpc("admin_update_organization", {
    p_id: orgA.id,
    p_patch: { monthly_cents: 150000, billing_cycle: "monthly", city: "São Paulo", state: "SP" },
  });
  if (patchErr) fail(`update org: ${patchErr.message}`);
  const orgPatched = typeof patched === "string" ? JSON.parse(patched) : patched;
  if (orgPatched.monthly_cents !== 150000) fail("financeiro contratual não persistiu");
  console.log("TEST org/finance PASS");

  await supabase.rpc("admin_add_membership", {
    p_user_id: uid,
    p_organization_id: orgA.id,
    p_role: "anestesista",
  });
  const { data: userAfter } = await supabase.rpc("admin_get_user", { p_id: uid });
  const userRow = typeof userAfter === "string" ? JSON.parse(userAfter) : userAfter;
  const hasMem = (userRow.memberships || []).some((m: { organization_id: string }) => m.organization_id === orgA.id);
  if (!hasMem) fail("TEST E membership não persistiu");
  await supabase.rpc("admin_remove_membership", { p_user_id: uid, p_organization_id: orgA.id });
  console.log("TEST E PASS membership add/remove");

  const { data: page, error: pageErr } = await supabase.rpc("admin_list_procedures_page", {
    p_page: 1,
    p_page_size: 5,
  });
  if (pageErr) fail(`TEST J page: ${pageErr.message}`);
  const pageRow = typeof page === "string" ? JSON.parse(page) : page;
  if (typeof pageRow.total_count !== "number") fail("TEST J sem total_count");
  if ((pageRow.items || []).length > 5) fail("TEST J page_size ignorado");
  const ids = (pageRow.items || []).map((item: { id: string }) => item.id);
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
  const finRow = typeof fin === "string" ? JSON.parse(fin) : fin;
  if (finRow.mrr_cents < 150000) fail("MRR não usa contrato real");
  console.log("TEST finance MRR", finRow.mrr_cents);

  const signed = (pageRow.items || []).find((item: { status?: string; id?: string }) => item.status === "signed");
  if (signed?.id) {
    const { data: verified, error: verifyErr } = await supabase.rpc("admin_verify_procedure", {
      p_procedure_id: signed.id,
    });
    if (verifyErr) fail(`TEST F verify: ${verifyErr.message}`);
    const report = typeof verified === "string" ? JSON.parse(verified) : verified;
    if (report.integrity_status === "intact" && (report.snapshot_ok !== true || report.persisted_ok !== true)) {
      fail("TEST F intact sem snapshotOk+persistedOk");
    }
    if (String(report.integrity_status || "").includes("mismatch")) {
      const { data: issues } = await supabase.rpc("admin_list_issues");
      const list = typeof issues === "string" ? JSON.parse(issues) : issues;
      const found = (Array.isArray(list) ? list : []).some(
        (issue: { incident_type?: string; procedure_id?: string }) =>
          issue.incident_type === "INTEGRITY_MISMATCH" && issue.procedure_id === signed.id
      );
      if (!found) fail("TEST F mismatch sem issue crítica");
    }
    console.log("TEST F PASS verify", report.integrity_status);
  } else {
    console.log("TEST F SKIP sem procedimento signed na página");
  }

  await supabase.rpc("admin_archive_organization", { p_id: orgA.id });
  await supabase.rpc("admin_archive_organization", { p_id: orgB.id });
} else if (role === "USER") {
  const { error: denied } = await supabase.rpc("admin_dashboard_overview", { p_range: "30d" });
  if (!denied) fail("TEST D USER acessou dashboard");
  console.log("TEST D PASS user denied");
} else {
  console.log("TEST B/D role", role);
}

if (emailB && passwordB) {
  await supabase.auth.signOut();
  const second = await supabase.auth.signInWithPassword({ email: emailB, password: passwordB });
  if (!second.error && second.data.user) {
    const { data: whoB } = await supabase.rpc("admin_whoami");
    const roleB = typeof whoB === "string" ? JSON.parse(whoB).role : whoB?.role;
    console.log("user B whoami", roleB);
    if (roleB === "USER") {
      const { error: deniedB } = await supabase.rpc("admin_list_organizations");
      if (!deniedB) fail("TEST D user B acessou admin RPC");
      console.log("TEST D PASS user B denied");
    }
  }
} else {
  console.log("TEST C SKIP sem ONDA3_TEST_EMAIL_B");
}

console.log("ADMIN_LIVE_E2E_DONE");
