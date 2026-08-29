import { getSupabase } from "./supabase";

export type DoctorProfile = {
  name: string;
  crm: string;
  uf: string;
  hospital: string;
  uid: string;
  email?: string | null;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  crm: string | null;
  uf: string | null;
  hospital: string | null;
  email: string | null;
};

export function isProfileComplete(row: ProfileRow | null): boolean {
  if (!row) return false;
  return Boolean(
    row.full_name?.trim() &&
    row.crm?.trim() &&
    row.uf?.trim() &&
    row.hospital?.trim()
  );
}

export function profileToDoctor(row: ProfileRow): DoctorProfile {
  return {
    uid: row.id,
    name: (row.full_name || "").trim(),
    crm: (row.crm || "").trim(),
    uf: (row.uf || "").trim(),
    hospital: (row.hospital || "").trim(),
    email: row.email || null
  };
}

export async function fetchOwnProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, crm, uf, hospital, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function saveOwnProfile(
  userId: string,
  email: string,
  fields: { name: string; crm: string; uf: string; hospital: string }
): Promise<void> {
  const supabase = getSupabase();
  const payload = {
    full_name: fields.name.trim(),
    crm: fields.crm.trim(),
    uf: fields.uf,
    hospital: fields.hospital,
    email: email.trim().toLowerCase()
  };

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("profiles").insert({ id: userId, ...payload });
  if (error) throw error;
}

export async function lookupProfileByEmail(email: string): Promise<{
  id: string;
  full_name: string;
  crm: string;
  uf: string;
} | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("lookup_profile_by_email", {
    p_email: email.trim().toLowerCase()
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; full_name: string; crm: string; uf: string }>;
  return rows[0] ?? null;
}
