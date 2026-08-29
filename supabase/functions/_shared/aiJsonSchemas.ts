const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "string", "null"] };

export const VOICE_PARSER_JSON_SCHEMA = {
  type: "object",
  properties: {
    identifiedActions: {
      type: "object",
      properties: {
        bolusDrugs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              dose: nullableNumber,
              unit: nullableString,
              route: nullableString,
              sourceText: nullableString,
            },
            required: ["name"],
          },
        },
        continuousInfusions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              rate: nullableNumber,
              rateUnit: nullableString,
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
