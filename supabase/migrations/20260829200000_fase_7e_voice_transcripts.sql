-- Fase 7E: transcrições originais de voz.
-- A interpretação da IA não substitui o que foi ouvido.
-- voiceTranscripts só entra no JSON selado quando há itens — selos V1
-- já gravados (sem a chave) continuam byte-idênticos na checagem B.

alter table public.procedures
  add column if not exists voice_transcripts jsonb not null default '[]'::jsonb;

comment on column public.procedures.voice_transcripts is
  'Transcrições originais do escriba por voz (transcriptOriginal). A interpretação da IA não substitui o que foi ouvido.';

create or replace function private.build_signed_record_v1(
  p_procedure_id uuid,
  p_signed_at timestamptz,
  p_signer jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  r public.procedures;
  v_revision integer;
  v_record jsonb;
  v_transcripts jsonb;
begin
  select * into r
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Na primeira selagem o UPDATE incrementa revision; na verificação a linha
  -- já está signed e o valor atual é o selado.
  if r.status = 'signed' then
    v_revision := coalesce(r.revision, 1);
  else
    v_revision := coalesce(r.revision, 1) + 1;
  end if;

  v_record := jsonb_build_object(
    'schema', 'SignedAnesthesiaRecordV1',
    'schemaVersion', 1,
    'integrityAlgo', 'SHA-256',
    'procedureId', r.id,
    'status', 'signed',
    'revision', v_revision,
    'documentSchemaVersion', coalesce(r.schema_version, '2.0.0'),
    'createdBy', r.created_by,
    'responsibleId', r.responsible_id,
    'createdAt', r.created_at,
    'updatedAt', p_signed_at,
    'signedAt', p_signed_at,
    'signedBy', coalesce(p_signer, '{}'::jsonb),
    'patient', coalesce(r.patient, '{}'::jsonb),
    'procedure', jsonb_build_object(
      'scheduled', coalesce(r.patient->>'scheduledProcedure', ''),
      'actual', coalesce(r.patient->>'actualProcedure', ''),
      'diagnosis', coalesce(r.patient->>'diagnosis', '')
    ),
    'team', coalesce(r.team, '{}'::jsonb),
    'preEvaluation', coalesce(r.pre_evaluation, '{}'::jsonb),
    'technique', coalesce(r.technique, '{}'::jsonb),
    'airway', coalesce(r.airway, '{}'::jsonb),
    'monitorConfig', coalesce(r.monitor_config, '{}'::jsonb),
    'equipmentConfig', coalesce(r.equipment_config, '{}'::jsonb),
    'vascularAccesses', coalesce(r.vascular_accesses, '[]'::jsonb),
    'vitals', private.jsonb_child_rows(p_procedure_id, 'vitals'),
    'bolusDrugs', private.jsonb_child_rows(p_procedure_id, 'medications'),
    'continuousInfusions', private.jsonb_child_rows(p_procedure_id, 'infusions'),
    'inhalationAgents', coalesce(r.inhalation_agents, '[]'::jsonb),
    'fluids', private.jsonb_child_rows(p_procedure_id, 'fluids'),
    'outputs', coalesce(r.outputs, '[]'::jsonb),
    'events', private.jsonb_child_rows(p_procedure_id, 'events'),
    'incidents', coalesce(r.incidents, '[]'::jsonb),
    'timers', coalesce(r.timers, '{}'::jsonb),
    'transfers', private.jsonb_child_rows(p_procedure_id, 'transfers'),
    'checklist', coalesce(r.checklist, '{}'::jsonb),
    'recovery', coalesce(r.recovery, '{}'::jsonb),
    'handover', coalesce(r.handover, '{}'::jsonb),
    'narrativeLaunches', coalesce(r.narratives, '[]'::jsonb)
  );

  v_transcripts := coalesce(r.voice_transcripts, '[]'::jsonb);
  if jsonb_typeof(v_transcripts) = 'array' and jsonb_array_length(v_transcripts) > 0 then
    v_record := v_record || jsonb_build_object('voiceTranscripts', v_transcripts);
  end if;

  return v_record;
end;
$$;

revoke all on function private.build_signed_record_v1(uuid, timestamptz, jsonb) from public, anon, authenticated;
