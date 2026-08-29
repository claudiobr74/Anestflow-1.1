import { canonicalAnesthesiaTerms, DRUG_GROUNDING_ALIASES } from "./anesthesiaVocabulary";

export type VoiceCoverageResult = {
  ok: boolean;
  mentioned: string[];
  parsed: string[];
  missing: string[];
};

type Needle = { canonical: string; needle: string };

function foldCoverageText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

let cachedNeedles: Needle[] | null = null;

function catalogNeedles(): Needle[] {
  if (cachedNeedles) return cachedNeedles;
  const out: Needle[] = [];
  const seen = new Set<string>();
  const add = (canonical: string, needle: string) => {
    const c = foldCoverageText(canonical);
    const n = foldCoverageText(needle);
    if (!c || !n) return;
    const key = `${c}|${n}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ canonical: c, needle: n });
  };
  for (const name of canonicalAnesthesiaTerms()) add(name, name);
  for (const [canonical, aliases] of Object.entries(DRUG_GROUNDING_ALIASES)) {
    add(canonical, canonical);
    for (const alias of aliases) add(canonical, alias);
  }
  out.sort((a, b) => b.needle.length - a.needle.length || a.canonical.localeCompare(b.canonical));
  cachedNeedles = out;
  return out;
}

function overlaps(consumed: Array<[number, number]>, start: number, end: number): boolean {
  return consumed.some(([s, e]) => start < e && end > s);
}

/**
 * Detecta medicamentos/gases do catálogo explicitamente presentes no transcript.
 * Aliases curtos (≤3) exigem fronteira de palavra. Sem fuzzy agressivo.
 */
export function detectMentionedMedications(transcript: string): string[] {
  const hay = ` ${foldCoverageText(transcript)} `;
  if (!hay.trim()) return [];
  const consumed: Array<[number, number]> = [];
  const found: string[] = [];
  const foundSet = new Set<string>();

  for (const { canonical, needle } of catalogNeedles()) {
    if (foundSet.has(canonical)) continue;
    const pat = needle.length <= 3 ? ` ${needle} ` : needle;
    let from = 0;
    while (from < hay.length) {
      const idx = hay.indexOf(pat, from);
      if (idx < 0) break;
      const start = needle.length <= 3 ? idx + 1 : idx;
      const end = start + needle.length;
      if (needle.length > 3) {
        const before = hay[start - 1];
        const after = hay[end];
        if (before && before !== " ") {
          from = idx + 1;
          continue;
        }
        if (after && after !== " ") {
          from = idx + 1;
          continue;
        }
      }
      if (!overlaps(consumed, start, end)) {
        foundSet.add(canonical);
        found.push(canonical);
        consumed.push([start, end]);
        break;
      }
      from = idx + 1;
    }
  }
  return found;
}

export function canonicalMedicationName(name: string): string | null {
  const fold = foldCoverageText(name);
  if (!fold) return null;
  for (const item of catalogNeedles()) {
    if (item.canonical === fold || item.needle === fold) return item.canonical;
  }
  return null;
}

function actionNameLists(actions: unknown): unknown[] {
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) return [];
  const rec = actions as Record<string, unknown>;
  const inner =
    rec.identifiedActions && typeof rec.identifiedActions === "object" && !Array.isArray(rec.identifiedActions)
      ? (rec.identifiedActions as Record<string, unknown>)
      : rec;
  const names: unknown[] = [];
  for (const key of ["bolusDrugs", "continuousInfusions", "inhalationAgents"] as const) {
    const list = inner[key];
    if (Array.isArray(list)) names.push(...list);
  }
  return names;
}

export function parsedMedicationNames(actions: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of actionNameLists(actions)) {
    if (!item || typeof item !== "object") continue;
    const name = (item as { name?: unknown }).name;
    if (typeof name !== "string") continue;
    const canonical = canonicalMedicationName(name);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/**
 * Coverage de medicamentos/gases nesta entrega.
 * Estruturado para no futuro incluir fluidos, vitais e eventos.
 */
export function validateVoiceCommandCoverage(transcript: string, actions: unknown): VoiceCoverageResult {
  const mentioned = detectMentionedMedications(transcript);
  const parsed = parsedMedicationNames(actions);
  const parsedSet = new Set(parsed);
  const missing = mentioned.filter((name) => !parsedSet.has(name));
  return {
    ok: missing.length === 0,
    mentioned,
    parsed,
    missing,
  };
}
