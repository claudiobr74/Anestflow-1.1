export const UNREGISTERED = "Não registrado";

export function isRecordedNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function firstRecorded(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (isRecordedNumber(value)) return value;
  }
  return undefined;
}

export function displayVital(value: unknown, suffix = ""): string {
  if (!isRecordedNumber(value)) return UNREGISTERED;
  return `${value}${suffix}`;
}

export function displayBloodPressure(pas: unknown, pad: unknown): string {
  if (!isRecordedNumber(pas) && !isRecordedNumber(pad)) return UNREGISTERED;
  const left = isRecordedNumber(pas) ? String(pas) : UNREGISTERED;
  const right = isRecordedNumber(pad) ? String(pad) : UNREGISTERED;
  return `${left}/${right}`;
}

export function displayAldreteScore(value: unknown, max = 2): string {
  if (!isRecordedNumber(value)) return UNREGISTERED;
  return `${value}/${max}`;
}

export function sumAldreteScores(values: unknown[]): { sum: number; complete: boolean } {
  let sum = 0;
  let complete = true;
  for (const value of values) {
    if (!isRecordedNumber(value)) {
      complete = false;
      continue;
    }
    sum += value;
  }
  return { sum, complete };
}

export function displayAldreteTotal(values: unknown[], max = 10): string {
  const { sum, complete } = sumAldreteScores(values);
  if (!complete) return UNREGISTERED;
  return `${sum}/${max}`;
}

export type VitalBaselineSource = {
  pas?: number;
  pad?: number;
  fc?: number;
  spo2?: number;
  temp?: number;
};

export function resolveRecoveryBaseline(
  recovery: VitalBaselineSource | null | undefined,
  latestIntra: VitalBaselineSource | null | undefined
): VitalBaselineSource {
  return {
    pas: firstRecorded(recovery?.pas, latestIntra?.pas),
    pad: firstRecorded(recovery?.pad, latestIntra?.pad),
    fc: firstRecorded(recovery?.fc, latestIntra?.fc),
    spo2: firstRecorded(recovery?.spo2, latestIntra?.spo2),
    temp: firstRecorded(recovery?.temp, latestIntra?.temp),
  };
}

export function qmentumRange(
  baseline: unknown,
  deviationPct: number
): { min: number; max: number } | null {
  if (!isRecordedNumber(baseline) || !Number.isFinite(deviationPct)) return null;
  return {
    min: Math.round(baseline * (1 - deviationPct / 100)),
    max: Math.round(baseline * (1 + deviationPct / 100)),
  };
}

export function displayQmentumRange(
  range: { min: number; max: number } | null,
  unit = ""
): string {
  if (!range) return UNREGISTERED;
  const suffix = unit ? ` ${unit}` : "";
  return `${range.min} - ${range.max}${suffix}`;
}

export function displayTemperature(value: unknown): string {
  if (!isRecordedNumber(value)) return UNREGISTERED;
  return `${value.toFixed(1)}°C`;
}

export const ALDRETE_UNREGISTERED_LABEL = UNREGISTERED;
