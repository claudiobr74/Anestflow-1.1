import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { isUuid } from "./procedureMapper";

const CHILD_TABLES = [
  "procedure_vitals",
  "procedure_medications",
  "procedure_fluids",
  "procedure_infusions",
  "procedure_events",
  "procedure_transfers",
  "procedure_amendments",
  "procedure_participants"
] as const;

export function subscribeProcedureRealtime(
  procedureId: string,
  onChange: () => void
): () => void {
  if (!isUuid(procedureId)) return () => {};

  const supabase = getSupabase();
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const emit = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(onChange, 250);
  };

  let channel: RealtimeChannel = supabase.channel(`procedure:${procedureId}`);
  channel = channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "procedures", filter: `id=eq.${procedureId}` },
    emit
  );
  for (const table of CHILD_TABLES) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `procedure_id=eq.${procedureId}` },
      emit
    );
  }
  channel.subscribe();

  return () => {
    if (debounce) clearTimeout(debounce);
    void supabase.removeChannel(channel);
  };
}
