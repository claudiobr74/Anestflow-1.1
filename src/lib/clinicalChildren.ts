import { getSupabase } from "./supabase";
import {
  AnesthesiaDocument,
  AnesthesiologistTransfer,
  BolusDrug,
  ClinicalEvent,
  ContinuousInfusion,
  FluidRecord,
  VitalRecord
} from "../types";
import {
  clinicalAtFromItem,
  isUuid,
  newClientId,
  payloadToItem,
  transferFromRow
} from "./procedureMapper";
import { throwClinical } from "./clinicalErrors";

type ChildTable =
  | "procedure_vitals"
  | "procedure_medications"
  | "procedure_fluids"
  | "procedure_infusions"
  | "procedure_events";

type ExistingChild = { id: string; payload: Record<string, unknown> | null; created_by: string };

function minutesFrom(item: Record<string, unknown>): number | null {
  const value = item.minutesFromStart;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

async function loadExisting(table: string, procedureId: string): Promise<ExistingChild[]> {
  const { data, error } = await getSupabase()
    .from(table)
    .select("id, payload, created_by")
    .eq("procedure_id", procedureId);
  if (error) throwClinical(error, `Erro ao ler ${table}.`);
  return (data || []) as ExistingChild[];
}

function resolvePk(item: { id?: string }, existingByClientId: Map<string, ExistingChild>): string {
  if (item.id && isUuid(item.id)) return item.id;
  if (item.id && existingByClientId.get(item.id)) return existingByClientId.get(item.id)!.id;
  return newClientId();
}

async function upsertChildren(
  table: ChildTable,
  procedureId: string,
  userId: string,
  items: Array<Record<string, unknown>> | undefined,
  withMinutes: boolean
): Promise<void> {
  if (!items || items.length === 0) return;
  const existing = await loadExisting(table, procedureId);
  const byClientId = new Map<string, ExistingChild>();
  for (const row of existing) {
    const clientId = row.payload?.id;
    if (typeof clientId === "string" && clientId) byClientId.set(clientId, row);
    byClientId.set(row.id, row);
  }

  const rows = items.filter(Boolean).map((item) => {
    const payload = { ...item, id: item.id || newClientId() };
    const existingRow = typeof payload.id === "string" ? byClientId.get(payload.id) : undefined;
    const id = resolvePk(payload as { id?: string }, byClientId);
    payload.id = typeof payload.id === "string" ? payload.id : id;
    const createdBy = existingRow?.created_by || userId;
    const row: Record<string, unknown> = {
      id,
      procedure_id: procedureId,
      created_by: createdBy,
      clinical_at: clinicalAtFromItem(payload),
      payload
    };
    if (withMinutes) row.minutes_from_start = minutesFrom(payload);
    return row;
  });

  const { error } = await getSupabase().from(table).upsert(rows, { onConflict: "id" });
  if (error) throwClinical(error, `Erro ao gravar ${table}.`);
}

export async function persistClinicalChildren(
  doc: AnesthesiaDocument,
  userId: string
): Promise<void> {
  await Promise.all([
    upsertChildren("procedure_vitals", doc.id, userId, doc.vitals as unknown as Record<string, unknown>[], true),
    upsertChildren("procedure_medications", doc.id, userId, doc.bolusDrugs as unknown as Record<string, unknown>[], true),
    upsertChildren("procedure_fluids", doc.id, userId, doc.fluids as unknown as Record<string, unknown>[], false),
    upsertChildren("procedure_infusions", doc.id, userId, doc.continuousInfusions as unknown as Record<string, unknown>[], false),
    upsertChildren("procedure_events", doc.id, userId, doc.events as unknown as Record<string, unknown>[], false)
  ]);
}

export async function loadClinicalChildren(procedureId: string): Promise<{
  vitals: VitalRecord[];
  bolusDrugs: BolusDrug[];
  fluids: FluidRecord[];
  continuousInfusions: ContinuousInfusion[];
  events: ClinicalEvent[];
  transfers: AnesthesiologistTransfer[];
}> {
  const supabase = getSupabase();
  const [vitals, meds, fluids, infusions, events, transfers] = await Promise.all([
    supabase.from("procedure_vitals").select("id, clinical_at, minutes_from_start, payload").eq("procedure_id", procedureId).order("clinical_at"),
    supabase.from("procedure_medications").select("id, clinical_at, minutes_from_start, payload").eq("procedure_id", procedureId).order("clinical_at"),
    supabase.from("procedure_fluids").select("id, clinical_at, payload").eq("procedure_id", procedureId).order("clinical_at"),
    supabase.from("procedure_infusions").select("id, clinical_at, payload").eq("procedure_id", procedureId).order("clinical_at"),
    supabase.from("procedure_events").select("id, clinical_at, payload").eq("procedure_id", procedureId).order("clinical_at"),
    supabase.from("procedure_transfers").select("id, clinical_at, outgoing_user_id, incoming_user_id, payload").eq("procedure_id", procedureId).order("clinical_at")
  ]);

  for (const result of [vitals, meds, fluids, infusions, events, transfers]) {
    if (result.error) throwClinical(result.error, "Erro ao carregar eventos clínicos.");
  }

  const mapItems = <T extends { id?: string; minutesFromStart?: number }>(
    rows: Array<{ id: string; payload?: Record<string, unknown> | null; minutes_from_start?: number | null; clinical_at?: string }> | null
  ): T[] => {
    return (rows || []).map((row) => {
      const item = payloadToItem<T>(row);
      if (row.minutes_from_start != null && item.minutesFromStart == null) {
        item.minutesFromStart = row.minutes_from_start;
      }
      return item;
    });
  };

  const vitalItems = mapItems<VitalRecord>(vitals.data);
  vitalItems.sort((a, b) => (a.minutesFromStart || 0) - (b.minutesFromStart || 0));
  const medItems = mapItems<BolusDrug>(meds.data);
  medItems.sort((a, b) => ((a as { minutesFromStart?: number }).minutesFromStart || 0) - ((b as { minutesFromStart?: number }).minutesFromStart || 0));

  return {
    vitals: vitalItems,
    bolusDrugs: medItems,
    fluids: mapItems<FluidRecord>(fluids.data),
    continuousInfusions: mapItems<ContinuousInfusion>(infusions.data),
    events: mapItems<ClinicalEvent>(events.data),
    transfers: (transfers.data || []).map(transferFromRow)
  };
}

export type ClinicalSubcollectionName = "vitals" | "medications" | "fluids" | "infusions" | "clinicalEvents" | "transfers";

const TABLE_BY_SUB: Record<ClinicalSubcollectionName, string> = {
  vitals: "procedure_vitals",
  medications: "procedure_medications",
  fluids: "procedure_fluids",
  infusions: "procedure_infusions",
  clinicalEvents: "procedure_events",
  transfers: "procedure_transfers"
};

export async function addClinicalEventItem(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName,
  itemData: Record<string, unknown>,
  userId: string
): Promise<void> {
  const table = TABLE_BY_SUB[subcollectionName];
  const payload: Record<string, unknown> = { ...itemData, id: (itemData.id as string) || newClientId() };
  const id = isUuid(payload.id as string) ? (payload.id as string) : newClientId();
  const row: Record<string, unknown> = {
    id,
    procedure_id: procedureId,
    created_by: userId,
    clinical_at: clinicalAtFromItem(payload),
    payload
  };
  if (subcollectionName === "vitals" || subcollectionName === "medications") {
    row.minutes_from_start = minutesFrom(payload);
  }
  if (subcollectionName === "transfers") {
    throw new Error("Transferências só entram via RPC de responsabilidade.");
  }
  const { error } = await getSupabase().from(table).upsert(row, { onConflict: "id" });
  if (error) throwClinical(error);
}

export async function deleteClinicalEventItem(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName,
  itemId: string
): Promise<void> {
  const table = TABLE_BY_SUB[subcollectionName];
  const { error } = await getSupabase().from(table).delete().eq("procedure_id", procedureId).eq("id", itemId);
  if (error) throwClinical(error);
}

export async function getClinicalEventItems<T extends { id?: string }>(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName
): Promise<T[]> {
  const table = TABLE_BY_SUB[subcollectionName];
  const { data, error } = await getSupabase().from(table).select("id, payload").eq("procedure_id", procedureId);
  if (error) {
    console.warn(`[getClinicalEventItems] ${subcollectionName}:`, error.message);
    return [];
  }
  return (data || []).map((row) => payloadToItem<T>(row as { id: string; payload?: Record<string, unknown> | null }));
}
