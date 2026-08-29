import { z } from "zod";

const nullableString = z.union([z.string(), z.null()]).optional();
const nullableNumber = z.union([z.number(), z.string(), z.null()]).optional();

export const voiceBolusDrugSchema = z
  .object({
    name: z.string().min(1),
    dose: nullableNumber,
    unit: nullableString,
    route: nullableString,
    sourceText: nullableString,
  })
  .passthrough();

export const voiceInfusionSchema = z
  .object({
    name: z.string().min(1),
    rate: nullableNumber,
    rateUnit: nullableString,
    concentration: nullableString,
    totalVolumePrepared: nullableNumber,
    diluent: nullableString,
    sourceText: nullableString,
  })
  .passthrough();

export const voiceInhalationSchema = z
  .object({
    name: z.string().min(1),
    inspiredConc: nullableNumber,
    flowO2: nullableNumber,
    concentration: nullableNumber,
    sourceText: nullableString,
  })
  .passthrough();

export const voiceEventSchema = z
  .object({
    name: z.string().min(1),
    category: z.string().optional(),
    sourceText: nullableString,
  })
  .passthrough();

export const identifiedActionsSchema = z
  .object({
    bolusDrugs: z.array(voiceBolusDrugSchema).optional(),
    continuousInfusions: z.array(voiceInfusionSchema).optional(),
    inhalationAgents: z.array(voiceInhalationSchema).optional(),
    events: z.array(voiceEventSchema).optional(),
    vitals: z.record(z.unknown()).nullable().optional(),
    patient: z.record(z.unknown()).nullable().optional(),
    templates: z.array(z.string()).optional(),
    timers: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

export const voiceParserOutputSchema = z
  .object({
    identifiedActions: identifiedActionsSchema.optional().default({}),
    unparsedFragments: z.array(z.string()).optional().default([]),
    warnings: z.array(z.string()).optional().default([]),
  })
  .passthrough();

export const clinicalReviewAlertSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  module: z.string().min(1),
});

export const clinicalReviewOutputSchema = z
  .object({
    alerts: z.array(clinicalReviewAlertSchema),
  })
  .passthrough();

export const narrativeOutputSchema = z
  .object({
    description: z.string().min(1),
  })
  .passthrough();

export type VoiceParserOutput = z.infer<typeof voiceParserOutputSchema>;
export type ClinicalReviewOutput = z.infer<typeof clinicalReviewOutputSchema>;
export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
