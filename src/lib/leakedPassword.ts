/**
 * Consulta HaveIBeenPwned (Pwned Passwords) com k-anonymity:
 * só os 5 primeiros hex do SHA-1 saem do dispositivo.
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * O Auth hospedado só rejeita senha vazada com o toggle do Dashboard (Pro+).
 * Esta checagem cobre o cadastro no cliente enquanto o toggle não estiver ON.
 * Se a API falhar, o cadastro segue (fail-open) — o Auth ainda aplica tamanho/complexidade.
 */

export const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 8_000;

export async function sha1HexUpper(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Linhas `SUFFIX:COUNT`. Padding (count 0) não conta como vazamento. */
export function matchHibpRangeBody(body: string, suffix: string): boolean {
  const want = suffix.trim().toUpperCase();
  if (!want) return false;
  for (const line of body.split(/\r?\n/)) {
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const hashSuffix = line.slice(0, colon).trim().toUpperCase();
    const count = Number(line.slice(colon + 1).trim());
    if (hashSuffix === want && Number.isFinite(count) && count > 0) return true;
  }
  return false;
}

export type LeakCheck = {
  leaked: boolean;
  checked: boolean;
};

export async function checkLeakedPassword(
  password: string,
  fetchImpl: typeof fetch = fetch
): Promise<LeakCheck> {
  if (!password) return { leaked: false, checked: false };
  try {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });
    if (!res.ok) return { leaked: false, checked: false };
    const leaked = matchHibpRangeBody(await res.text(), suffix);
    return { leaked, checked: true };
  } catch {
    return { leaked: false, checked: false };
  }
}
