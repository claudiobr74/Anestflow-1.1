import React from "react";
import { Mic, X } from "lucide-react";
import { VOICE_PARSE_INCOMPLETE_MESSAGE } from "../lib/aiErrorCodes";

export interface VoiceCommandConfirmModalProps {
  isOpen: boolean;
  transcription: string;
  summaries: string[];
  warnings?: string[];
  unparsedFragments?: string[];
  missingEntities?: string[];
  incomplete?: boolean;
  canApply: boolean;
  isDark?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function VoiceCommandConfirmModal({
  isOpen,
  transcription,
  summaries,
  warnings = [],
  unparsedFragments = [],
  missingEntities = [],
  incomplete = false,
  canApply,
  isDark = false,
  onConfirm,
  onDismiss,
}: VoiceCommandConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-confirm-title"
    >
      <div
        className={`w-full max-w-md rounded-xl p-5 shadow-lg border text-left transition-all ${
          isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Mic className="h-5 w-5" />
            </span>
            <div>
              <h3 id="voice-confirm-title" className="text-lg font-bold">
                Conferir comando de voz
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Nada é lançado na ficha até você confirmar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {incomplete && (
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
            {VOICE_PARSE_INCOMPLETE_MESSAGE}
            {missingEntities.length > 0 ? ` Itens não extraídos: ${missingEntities.join(", ")}.` : ""}
          </p>
        )}

        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Transcrição original</p>
        <div
          className={`max-h-32 overflow-y-auto rounded-lg border p-3 text-sm leading-relaxed ${
            isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          {transcription.trim() || "O modelo não devolveu transcrição original."}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mt-4 mb-1">
          Lançamentos identificados
        </p>
        {summaries.length > 0 ? (
          <ul className="max-h-40 overflow-y-auto space-y-1.5 text-sm">
            {summaries.map((line, index) => (
              <li
                key={`${index}-${line.slice(0, 24)}`}
                className={`rounded-lg px-3 py-2 ${isDark ? "bg-zinc-900" : "bg-slate-50"}`}
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum lançamento estruturado. Você pode gravar a transcrição original mesmo assim.
          </p>
        )}

        {(warnings.length > 0 || unparsedFragments.length > 0) && (
          <div className="mt-3 space-y-1">
            {warnings.map((line, index) => (
              <p key={`w-${index}`} className="text-xs text-amber-700 dark:text-amber-400">
                {line}
              </p>
            ))}
            {unparsedFragments.map((line, index) => (
              <p key={`u-${index}`} className="text-xs text-zinc-500">
                Trecho não estruturado: {line}
              </p>
            ))}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition ${
              isDark
                ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canApply || incomplete}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-xs"
          >
            {incomplete ? "Confirmar tudo indisponível" : "Lançar na ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}
