import type { AiThinkingLevel } from "./aiModelConfig";

const OBSOLETE_36_KEYS = ["temperature", "top_p", "top_k", "topP", "topK", "candidate_count", "candidateCount", "thinking_budget", "thinkingBudget"] as const;

export type InteractionAudioInput = {
  type: "audio";
  mime_type: string;
  data: string;
};

export function buildGemini36InteractionBody(options: {
  model: string;
  input: unknown;
  systemInstruction?: string;
  thinkingLevel: AiThinkingLevel;
  responseSchema?: Record<string, unknown>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    store: false,
    input: options.input,
    generation_config: {
      thinking_level: options.thinkingLevel,
      thinking_summaries: "none",
    },
  };
  if (options.systemInstruction) {
    body.system_instruction = options.systemInstruction;
  }
  if (options.responseSchema) {
    body.response_format = {
      type: "text",
      mime_type: "application/json",
      schema: options.responseSchema,
    };
  }
  return body;
}

export function buildTranscriptionInteractionBody(options: {
  model: string;
  mimeType: string;
  data: string;
  vocabulary: string[];
}): Record<string, unknown> {
  return {
    model: options.model,
    store: false,
    input: [
      {
        type: "audio",
        mime_type: options.mimeType,
        data: options.data,
      } satisfies InteractionAudioInput,
    ],
    generation_config: {
      transcription_config: {
        language_hints: ["pt-BR"],
        custom_vocabulary: options.vocabulary,
        mode: { type: "verbatim" },
      },
    },
  };
}

export function assertNoObsoleteGemini36Sampling(body: Record<string, unknown>): void {
  const serialized = JSON.stringify(body);
  for (const key of OBSOLETE_36_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`Parâmetro obsoleto no caminho Gemini 3.6: ${key}`);
    }
  }
  if (serialized.includes("previous_interaction_id")) {
    throw new Error("Memória clínica não pode usar previous_interaction_id.");
  }
  const parsed = JSON.parse(serialized) as { store?: unknown };
  if (parsed.store !== false) {
    throw new Error("Interactions clínicas devem usar store: false.");
  }
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (Array.isArray(content)) {
    return content.map((item) => textFromContent(item)).join("");
  }
  if (typeof content === "object") {
    const rec = content as Record<string, unknown>;
    if (rec.type === "thought" || rec.type === "thinking") return "";
    if (typeof rec.text === "string") return rec.text;
    if (rec.content !== undefined) return textFromContent(rec.content);
  }
  return "";
}

/**
 * Extrai texto útil da Interactions API sem persistir thinking/CoT.
 */
export function extractInteractionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const rec = payload as Record<string, unknown>;
  if (typeof rec.output_text === "string" && rec.output_text.trim()) {
    return rec.output_text.trim();
  }
  const outputs = rec.outputs ?? rec.output;
  const fromOutputs = textFromContent(outputs).trim();
  if (fromOutputs) return fromOutputs;

  const steps = rec.steps;
  if (Array.isArray(steps)) {
    const chunks: string[] = [];
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if (s.type === "thought" || s.type === "thinking") continue;
      const piece = textFromContent(s.content ?? s.output ?? s.text).trim();
      if (piece) chunks.push(piece);
    }
    if (chunks.length) return chunks.join("\n").trim();
  }

  const candidates = rec.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const legacy = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return legacy.trim();
}

export function stripJsonFence(text: string): string {
  const fence = text.trim().match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : text.trim();
}

export function parseTranscriptText(text: string): string {
  const trimmed = stripJsonFence(text);
  if (!trimmed) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate =
        parsed.transcript_original ??
        parsed.transcript ??
        parsed.text ??
        parsed.output_text;
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}
