import { calculateAge } from "../mockData";
import { newClientId } from "./procedureMapper";
import { withInProgressIfAnesthesiaStarted } from "./procedureStatus";
import type {
  AnesthesiaDocument,
  BolusDrug,
  ClinicalEvent,
  ContinuousInfusion,
  InhalationAgent,
} from "../types";

export type InhalationAgentName = InhalationAgent["agent"];

export interface VoiceBolusDrug {
  name: string;
  dose?: string;
  unit?: string;
  route?: string;
}

export interface VoiceInfusion {
  name: string;
  rate?: string;
  rateUnit?: string;
  concentration?: string;
  totalVolumePrepared?: number | string;
  diluent?: string;
}

export interface VoiceInhalationAgent {
  name: string;
  inspiredConc?: number | string;
  flowO2?: number | string;
  concentration?: number | string;
}

export interface VoiceEvent {
  name: string;
  category: string;
}

export interface VoiceVitals {
  hr?: number;
  systolic?: number;
  diastolic?: number;
  spo2?: number;
  etco2?: number;
  temp?: number;
}

export interface VoicePatient {
  fullName?: string;
  age?: string;
  weight?: string;
  recordNumber?: string;
  admissionNumber?: string;
  bed?: string;
  dob?: string;
}

export interface VoiceTimers {
  startAnesthesia?: boolean;
  startSurgery?: boolean;
  startSurgeryMinutes?: number;
  endSurgery?: boolean;
  endAnesthesia?: boolean;
}

export interface SanitizedVoiceActions {
  templates?: string[];
  patient?: VoicePatient;
  timers?: VoiceTimers;
  bolusDrugs?: VoiceBolusDrug[];
  continuousInfusions?: VoiceInfusion[];
  inhalationAgents?: VoiceInhalationAgent[];
  vitals?: VoiceVitals;
  events?: VoiceEvent[];
}

const EVENT_CATEGORIES: ClinicalEvent["category"][] = [
  "Marcador Temporal",
  "Procedimento",
  "Acesso",
  "Via Aérea",
  "Bloqueio",
  "Intercorrência",
  "Outro",
  "Equipe",
];

const INHALATION_ALIASES: Record<string, InhalationAgentName> = {
  sevo: "Sevoflurano",
  sevoflurano: "Sevoflurano",
  sevorane: "Sevoflurano",
  "sevoflurano 2%": "Sevoflurano",
  des: "Desflurano",
  desflurano: "Desflurano",
  suprane: "Desflurano",
  iso: "Isoflurano",
  isoflurano: "Isoflurano",
  isoflorane: "Isoflurano",
  forane: "Isoflurano",
  n2o: "Óxido Nitroso",
  "oxido nitroso": "Óxido Nitroso",
  "óxido nitroso": "Óxido Nitroso",
  nitroso: "Óxido Nitroso",
  o2: "Oxigênio (O₂)",
  oxigenio: "Oxigênio (O₂)",
  oxigênio: "Oxigênio (O₂)",
  "oxigenio o2": "Oxigênio (O₂)",
  "oxigênio (o₂)": "Oxigênio (O₂)",
  "oxigenio (o2)": "Oxigênio (O₂)",
  ar: "Ar Comprimido",
  "ar comprimido": "Ar Comprimido",
};

export function extractNumber(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  const parsed = parseFloat(String(val).replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseDateToYYYYMMDD(val: string | undefined | null): string | undefined {
  if (!val) return undefined;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
  }

  const months: Record<string, string> = {
    janeiro: "01",
    fev: "02",
    fevereiro: "02",
    mar: "03",
    marco: "03",
    março: "03",
    abr: "04",
    abril: "04",
    mai: "05",
    maio: "05",
    jun: "06",
    junho: "06",
    jul: "07",
    julho: "07",
    ago: "08",
    agosto: "08",
    set: "09",
    setembro: "09",
    out: "10",
    outubro: "10",
    nov: "11",
    novembro: "11",
    dez: "12",
    dezembro: "12",
  };

  const textMatch = str
    .toLowerCase()
    .match(/^(\d{1,2})\s+(?:de\s+)?([a-zçáéíóú]+)\s+(?:de\s+)?(\d{4})$/i);
  if (textMatch) {
    const monthNum = months[textMatch[2]];
    if (monthNum) {
      return `${textMatch[3]}-${monthNum}-${textMatch[1].padStart(2, "0")}`;
    }
  }

  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  return str;
}

function foldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[%]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function extractPercent(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const match = String(raw).match(/(\d+(?:[.,]\d+)?)\s*%/);
  return match ? extractNumber(match[1]) : undefined;
}

function extractFlowLpm(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const match = String(raw).match(/(\d+(?:[.,]\d+)?)\s*(?:l\/min|lpm|litros(?:\s+por\s+minuto)?)/i);
  return match ? extractNumber(match[1]) : undefined;
}

function notInformed(label: string, feminine = true): string {
  return `${label}: não informad${feminine ? "a" : "o"}`;
}

export function mapInhalationAgentName(raw: string | undefined | null): InhalationAgentName | null {
  if (!raw) return null;
  const key = foldKey(raw);
  if (!key) return null;
  if (INHALATION_ALIASES[key]) return INHALATION_ALIASES[key];

  for (const token of key.split(" ")) {
    if (INHALATION_ALIASES[token]) return INHALATION_ALIASES[token];
  }

  const padded = ` ${key} `;
  const aliases = Object.entries(INHALATION_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, agent] of aliases) {
    if (alias.length < 3) continue;
    if (padded.includes(` ${alias} `)) return agent;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const rec = asRecord(item);
      const name = rec?.name;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter(Boolean);
}

export function sanitizeVoiceCommand(actions: unknown): SanitizedVoiceActions | null {
  const source = asRecord(actions);
  if (!source) return null;

  const result: SanitizedVoiceActions = {};
  let hasValidData = false;

  const templates = stringList(source.templates);
  if (templates.length > 0) {
    result.templates = templates;
    hasValidData = true;
  }

  const patient = asRecord(source.patient);
  if (patient && Object.keys(patient).length > 0) {
    result.patient = patient as VoicePatient;
    hasValidData = true;
  }

  const timers = asRecord(source.timers);
  if (timers && Object.keys(timers).length > 0) {
    result.timers = timers as VoiceTimers;
    hasValidData = true;
  }

  if (Array.isArray(source.bolusDrugs) && source.bolusDrugs.length > 0) {
    result.bolusDrugs = source.bolusDrugs as VoiceBolusDrug[];
    hasValidData = true;
  }
  if (Array.isArray(source.continuousInfusions) && source.continuousInfusions.length > 0) {
    result.continuousInfusions = source.continuousInfusions as VoiceInfusion[];
    hasValidData = true;
  }
  if (Array.isArray(source.inhalationAgents) && source.inhalationAgents.length > 0) {
    result.inhalationAgents = source.inhalationAgents as VoiceInhalationAgent[];
    hasValidData = true;
  }
  const vitals = asRecord(source.vitals);
  if (vitals && Object.keys(vitals).length > 0) {
    result.vitals = vitals as VoiceVitals;
    hasValidData = true;
  }
  if (Array.isArray(source.events) && source.events.length > 0) {
    result.events = source.events as VoiceEvent[];
    hasValidData = true;
  }

  return hasValidData ? result : null;
}

function patientProp(patient: VoicePatient, keys: string[]): unknown {
  const rec = patient as Record<string, unknown>;
  for (const key of keys) {
    if (rec[key] !== undefined && rec[key] !== null) return rec[key];
  }
  return undefined;
}

function mapEventCategory(raw: string | undefined): ClinicalEvent["category"] {
  if (!raw) return "Outro";
  const match = EVENT_CATEGORIES.find((item) => foldKey(item) === foldKey(raw));
  return match || "Outro";
}

function isFlowGas(agent: InhalationAgentName): boolean {
  return agent === "Oxigênio (O₂)" || agent === "Ar Comprimido";
}

function bolusUnit(raw: string | undefined): BolusDrug["unit"] | undefined {
  if (!raw || !String(raw).trim()) return undefined;
  const value = String(raw).toLowerCase();
  if (value === "mcg" || value === "µg" || value === "ug") return "mcg";
  if (value === "g") return "g";
  if (value === "ui") return "UI";
  if (value === "ml" || value === "mL") return "ml";
  if (value === "mg") return "mg";
  if (value === "ampola") return "ampola";
  if (value === "meq") return "mEq";
  return undefined;
}

function bolusRoute(raw: string | undefined): BolusDrug["route"] | undefined {
  if (!raw || !String(raw).trim()) return undefined;
  const value = foldKey(raw);
  if (!value) return undefined;
  if (value === "im") return "IM";
  if (value === "sc") return "SC";
  if (value === "io") return "IO";
  if (value === "ev" || value === "iv" || value.includes("endoven")) return "EV";
  if (value.includes("raqui")) return "Raqui";
  if (value.includes("peridural") || value.includes("epidural")) return "Peridural";
  if (value.includes("bloqueio")) return "Bloqueio";
  if (value.includes("inal")) return "Inalatório";
  return undefined;
}

function infusionUnit(raw: string | undefined): ContinuousInfusion["unit"] | undefined {
  if (!raw || !String(raw).trim()) return undefined;
  const value = String(raw).replace(/\s/g, "");
  const allowed: ContinuousInfusion["unit"][] = [
    "mcg/kg/min",
    "mcg/kg/h",
    "mg/kg/min",
    "mg/kg/h",
    "mg/h",
    "ml/h",
    "mcg/min",
  ];
  return allowed.find((item) => item === value);
}

export function summarizeVoiceActions(actions: SanitizedVoiceActions): string[] {
  const lines: string[] = [];

  if (actions.patient) {
    const bits = [
      actions.patient.fullName,
      actions.patient.age ? `${actions.patient.age}a` : "",
      actions.patient.weight ? `${actions.patient.weight} kg` : "",
      actions.patient.recordNumber ? `pront. ${actions.patient.recordNumber}` : "",
    ].filter(Boolean);
    if (bits.length) lines.push(`Paciente: ${bits.join(", ")}`);
  }

  if (actions.timers?.startAnesthesia) lines.push("Timer: início da anestesia");
  if (actions.timers?.startSurgeryMinutes != null) {
    lines.push(`Timer: início da cirurgia em ${actions.timers.startSurgeryMinutes} min`);
  } else if (actions.timers?.startSurgery) {
    lines.push("Timer: início da cirurgia");
  }
  if (actions.timers?.endSurgery) lines.push("Timer: fim da cirurgia");
  if (actions.timers?.endAnesthesia) lines.push("Timer: fim da anestesia");

  for (const drug of actions.bolusDrugs || []) {
    const bits = [`Bolus: ${drug.name}`];
    if (drug.dose) bits.push(`${drug.dose}${drug.unit ? ` ${drug.unit}` : ""}`);
    else bits.push(notInformed("Dose"));
    if (!drug.unit) bits.push(notInformed("Unidade"));
    if (drug.route) bits.push(drug.route);
    else bits.push(notInformed("Via"));
    lines.push(bits.join(" · "));
  }
  for (const inf of actions.continuousInfusions || []) {
    const bits = [`Infusão: ${inf.name}`];
    if (inf.rate) bits.push(`${inf.rate}${inf.rateUnit ? ` ${inf.rateUnit}` : ""}`);
    else bits.push(notInformed("Velocidade"));
    if (!inf.rateUnit) bits.push(notInformed("Unidade"));
    if (inf.concentration) bits.push(`Concentração ${inf.concentration}`);
    else bits.push(notInformed("Concentração"));
    if (inf.totalVolumePrepared != null && String(inf.totalVolumePrepared).trim() !== "") {
      bits.push(`Volume ${inf.totalVolumePrepared} mL`);
    } else {
      bits.push(notInformed("Volume", false));
    }
    lines.push(bits.join(" · "));
  }
  for (const gas of actions.inhalationAgents || []) {
    const mapped = mapInhalationAgentName(gas.name);
    const agent = mapped || gas.name;
    const flowAgent = mapped ? isFlowGas(mapped) : false;
    const conc = extractNumber(gas.inspiredConc) ?? extractNumber(gas.concentration) ?? extractPercent(gas.name);
    const flow = extractNumber(gas.flowO2) ?? extractFlowLpm(gas.name);
    const bits = [`Gás: ${agent}`];
    if (flowAgent) {
      if (flow !== undefined) bits.push(`${flow} L/min`);
      else bits.push(notInformed("Fluxo", false));
    } else if (conc !== undefined) {
      bits.push(`${conc}%`);
    } else {
      bits.push(notInformed("Concentração"));
    }
    lines.push(bits.join(" · "));
  }
  if (actions.vitals) {
    const v = actions.vitals;
    const bits = [
      v.hr != null ? `FC ${v.hr}` : "",
      v.systolic != null && v.diastolic != null ? `PA ${v.systolic}/${v.diastolic}` : "",
      v.spo2 != null ? `SpO₂ ${v.spo2}` : "",
      v.etco2 != null ? `EtCO₂ ${v.etco2}` : "",
      v.temp != null ? `Temp ${v.temp}` : "",
    ].filter(Boolean);
    if (bits.length) lines.push(`Vitais: ${bits.join(", ")}`);
  }
  for (const event of actions.events || []) {
    lines.push(`Evento: ${event.name}${event.category ? ` (${event.category})` : ""}`);
  }
  for (const template of actions.templates || []) {
    lines.push(`Protocolo: ${template}`);
  }

  return lines;
}

export function applyVoiceActionsToDocument(
  prev: AnesthesiaDocument,
  actions: SanitizedVoiceActions,
  selectedMinutes: number | null,
  now = new Date(),
): AnesthesiaDocument {
  if (prev.status === "Signed") return prev;

  let newDoc: AnesthesiaDocument = { ...prev };
  const nowIso = now.toISOString();

  if (actions.patient) {
    const rawFullName = patientProp(actions.patient, [
      "fullName",
      "fullname",
      "full_name",
      "nome",
      "nome_completo",
      "nomeCompleto",
    ]);
    const rawDob = patientProp(actions.patient, [
      "dob",
      "birthDate",
      "birthdate",
      "birth_date",
      "data_nascimento",
      "dataNascimento",
      "nascimento",
    ]);
    const rawAge = patientProp(actions.patient, ["age", "idade"]);
    const rawWeight = patientProp(actions.patient, ["weight", "peso"]);
    const rawRecordNumber = patientProp(actions.patient, [
      "recordNumber",
      "recordnumber",
      "record_number",
      "prontuario",
      "prontuário",
      "numero_prontuario",
    ]);
    const rawAdmissionNumber = patientProp(actions.patient, [
      "admissionNumber",
      "admissionnumber",
      "admission_number",
      "atendimento",
      "numero_atendimento",
    ]);
    const rawBed = patientProp(actions.patient, ["bed", "leito", "quarto"]);

    const parsedDob = parseDateToYYYYMMDD(rawDob == null ? undefined : String(rawDob));
    const newAge =
      rawAge !== undefined && rawAge !== null
        ? extractNumber(rawAge)
        : parsedDob
          ? calculateAge(parsedDob)
          : undefined;
    const newWeight = extractNumber(rawWeight);

    newDoc = {
      ...newDoc,
      patient: {
        ...newDoc.patient,
        ...(rawFullName != null && { fullName: String(rawFullName) }),
        ...(newAge !== undefined && { age: newAge }),
        ...(newWeight !== undefined && { weight: newWeight }),
        ...(rawRecordNumber != null && { recordNumber: String(rawRecordNumber) }),
        ...(rawAdmissionNumber != null && { admissionNumber: String(rawAdmissionNumber) }),
        ...(rawBed != null && { bed: String(rawBed) }),
        ...(parsedDob && { birthDate: parsedDob }),
      },
    };
  }

  if (actions.timers) {
    newDoc = { ...newDoc, timers: { ...newDoc.timers } };
    const pushTemporal = (name: string, at: Date) => {
      newDoc = {
        ...newDoc,
        events: [
          ...(newDoc.events || []),
          {
            id: newClientId(),
            timestamp: at.toISOString(),
            category: "Marcador Temporal",
            name,
          },
        ],
      };
    };

    if (actions.timers.startAnesthesia) {
      newDoc.timers.startAnesthesia = nowIso;
      pushTemporal("Início Anestesia", now);
    }
    if (actions.timers.startSurgeryMinutes !== undefined && actions.timers.startSurgeryMinutes !== null) {
      const futureTime = new Date(now.getTime() + actions.timers.startSurgeryMinutes * 60000);
      newDoc.timers.startSurgery = futureTime.toISOString();
      pushTemporal("Início Cirurgia", futureTime);
    } else if (actions.timers.startSurgery) {
      newDoc.timers.startSurgery = nowIso;
      pushTemporal("Início Cirurgia", now);
    }
    if (actions.timers.endSurgery) {
      newDoc.timers.endSurgery = nowIso;
      pushTemporal("Fim Cirurgia", now);
    }
    if (actions.timers.endAnesthesia) {
      newDoc.timers.endAnesthesia = nowIso;
      pushTemporal("Fim Anestesia", now);
    }
  }

  const targetMins =
    selectedMinutes !== null
      ? selectedMinutes
      : newDoc.timers.startAnesthesia
        ? Math.floor((now.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000)
        : 0;

  if (actions.bolusDrugs?.length) {
    const added: BolusDrug[] = [];
    for (const drug of actions.bolusDrugs) {
      if (!drug.name) continue;
      const dose = extractNumber(drug.dose);
      const unit = bolusUnit(drug.unit);
      const route = bolusRoute(drug.route);
      added.push({
        id: newClientId(),
        timestamp: nowIso,
        minutesFromStart: targetMins,
        name: String(drug.name || ""),
        ...(dose !== undefined ? { dose } : {}),
        ...(unit ? { unit } : {}),
        ...(route ? { route } : {}),
      });
    }
    if (added.length) {
      newDoc = {
        ...newDoc,
        bolusDrugs: [...(newDoc.bolusDrugs || []), ...added],
      };
    }
  }

  if (actions.continuousInfusions?.length) {
    const added: ContinuousInfusion[] = [];
    for (const inf of actions.continuousInfusions) {
      if (!inf.name) continue;
      const rate = extractNumber(inf.rate);
      const unit = infusionUnit(inf.rateUnit);
      const volume = extractNumber(inf.totalVolumePrepared);
      const concentration = inf.concentration ? String(inf.concentration).trim() : "";
      added.push({
        id: newClientId(),
        name: String(inf.name || ""),
        concentration,
        diluent: inf.diluent ? String(inf.diluent) : "",
        ...(volume !== undefined ? { totalVolumePrepared: volume } : {}),
        ...(unit ? { unit } : {}),
        history: rate === undefined
          ? []
          : [
              {
                timestamp: nowIso,
                minutesFromStart: targetMins,
                rate,
                status: "Iniciado" as const,
              },
            ],
      });
    }
    if (added.length) {
      newDoc = {
        ...newDoc,
        continuousInfusions: [...(newDoc.continuousInfusions || []), ...added],
      };
    }
  }

  if (actions.inhalationAgents?.length) {
    const existing = [...(newDoc.inhalationAgents || [])];
    const extraEvents: ClinicalEvent[] = [];
    for (const item of actions.inhalationAgents) {
      const agent = mapInhalationAgentName(item.name);
      if (!agent) continue;
      if (existing.some((row) => row.agent === agent)) continue;
      const flow = isFlowGas(agent);
      const inspiredConc = flow
        ? undefined
        : extractNumber(item.inspiredConc) ?? extractNumber(item.concentration) ?? extractPercent(item.name);
      const flowO2 = flow
        ? extractNumber(item.flowO2) ?? extractFlowLpm(item.name)
        : undefined;
      const row: InhalationAgent = {
        id: newClientId(),
        agent,
        startTime: nowIso,
        ...(inspiredConc !== undefined ? { inspiredConc } : {}),
        ...(flowO2 !== undefined ? { flowO2 } : {}),
      };
      existing.push(row);
      let eventName: string = agent;
      if (flow && flowO2 !== undefined) {
        eventName = agent === "Oxigênio (O₂)"
          ? `O₂ ${Number(flowO2).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L/min`
          : `Ar Comprimido ${Number(flowO2).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L/min`;
      } else if (!flow && inspiredConc !== undefined) {
        eventName = `${agent} ${Number(inspiredConc).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`;
      }
      extraEvents.push({
        id: newClientId(),
        name: eventName,
        timestamp: nowIso,
        category: "Procedimento",
      });
    }
    newDoc = {
      ...newDoc,
      inhalationAgents: existing,
      events: extraEvents.length ? [...(newDoc.events || []), ...extraEvents] : newDoc.events,
    };
  }

  if (actions.vitals) {
    const snappedMinutes = newDoc.timers.startAnesthesia
      ? Math.round(
          Math.floor((now.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000) / 5,
        ) * 5
      : 0;
    const mins = selectedMinutes !== null ? selectedMinutes : Math.max(0, snappedMinutes);
    const vitalsUpdate: Record<string, number> = {};
    if (actions.vitals.hr) vitalsUpdate.fc = Number(actions.vitals.hr);
    if (actions.vitals.systolic) vitalsUpdate.pas = Number(actions.vitals.systolic);
    if (actions.vitals.diastolic) vitalsUpdate.pad = Number(actions.vitals.diastolic);
    if (actions.vitals.spo2) vitalsUpdate.spo2 = Number(actions.vitals.spo2);
    if (actions.vitals.etco2) vitalsUpdate.etco2 = Number(actions.vitals.etco2);
    if (actions.vitals.temp) vitalsUpdate.temp = Number(actions.vitals.temp);

    const existingVitals = [...(newDoc.vitals || [])];
    const existingIndex = existingVitals.findIndex((row) => row.minutesFromStart === mins);
    let finalPas: number | undefined = vitalsUpdate.pas;
    let finalPad: number | undefined = vitalsUpdate.pad;
    if (existingIndex >= 0) {
      if (finalPas === undefined) finalPas = existingVitals[existingIndex].pas;
      if (finalPad === undefined) finalPad = existingVitals[existingIndex].pad;
    }
    if (finalPas !== undefined && finalPad !== undefined) {
      vitalsUpdate.pam = Math.round(finalPad + (finalPas - finalPad) / 3);
    }
    if (existingIndex >= 0) {
      existingVitals[existingIndex] = { ...existingVitals[existingIndex], ...vitalsUpdate };
      newDoc = { ...newDoc, vitals: existingVitals };
    } else {
      newDoc = {
        ...newDoc,
        vitals: [
          ...existingVitals,
          {
            id: newClientId(),
            timestamp: nowIso,
            minutesFromStart: mins,
            ...vitalsUpdate,
          },
        ],
      };
    }
  }

  if (actions.events?.length) {
    newDoc = {
      ...newDoc,
      events: [
        ...(newDoc.events || []),
        ...actions.events.map((event) => ({
          id: newClientId(),
          timestamp: nowIso,
          category: mapEventCategory(event.category),
          name: String(event.name || ""),
        })),
      ],
    };
  }

  return withInProgressIfAnesthesiaStarted(newDoc);
}
