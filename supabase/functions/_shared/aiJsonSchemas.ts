import { INFUSION_RATE_UNITS, MEDICATION_DOSE_UNITS, MEDICATION_ROUTES } from "./voiceUnits.ts";

const nullableNumber = { type: ["number", "string", "null"] };
const nullableString = { type: ["string", "null"] };
const doseUnit = { type: ["string", "null"], enum: [...MEDICATION_DOSE_UNITS, null] };
const rateUnit = { type: ["string", "null"], enum: [...INFUSION_RATE_UNITS, null] };
const routeUnit = { type: ["string", "null"], enum: [...MEDICATION_ROUTES, null] };

export const VOICE_PARSER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    identifiedActions: {
      type: "object",
      additionalProperties: false,
      properties: {
        bolusDrugs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              dose: nullableNumber,
              unit: doseUnit,
              route: routeUnit,
              sourceText: nullableString,
            },
            required: ["name"],
          },
        },
        continuousInfusions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              rate: nullableNumber,
              rateUnit: rateUnit,
              concentration: nullableString,
              sourceText: nullableString,
            },
            required: ["name"],
          },
        },
        inhalationAgents: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              inspiredConc: nullableNumber,
              concentration: nullableNumber,
              sourceText: nullableString,
            },
            required: ["name"],
          },
        },
        events: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              category: { type: "string" },
            },
            required: ["name"],
          },
        },
        vitals: {
          type: "object",
          properties: {
            hr: { type: "number" },
            systolic: { type: "number" },
            diastolic: { type: "number" },
            spo2: { type: "number" },
            etco2: { type: "number" },
            temp: { type: "number" },
          },
        },
        patient: { type: "object" },
        templates: { type: "array", items: { type: "string" } },
        timers: { type: "object" },
      },
    },
    unparsedFragments: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["identifiedActions", "unparsedFragments", "warnings"],
} as const;

export const CLINICAL_REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    alerts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          module: { type: "string" },
        },
        required: ["type", "title", "description", "module"],
      },
    },
  },
  required: ["alerts"],
} as const;

export const NARRATIVE_JSON_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
  },
  required: ["description"],
} as const;
