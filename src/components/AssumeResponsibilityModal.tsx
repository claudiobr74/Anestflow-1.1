import React, { useEffect, useState } from "react";
import { AlertCircle, ShieldAlert, X } from "lucide-react";
import {
  MIN_ASSUME_REASON_LENGTH,
  normalizeAssumeReason,
  validateAssumeReason,
} from "../lib/assumeResponsibility";

interface AssumeResponsibilityModalProps {
  isDark: boolean;
  leadName: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export default function AssumeResponsibilityModal({
  isDark,
  leadName,
  isSubmitting = false,
  onClose,
  onConfirm,
}: AssumeResponsibilityModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setError(null);
  }, []);

  const normalized = normalizeAssumeReason(reason);
  const remaining = Math.max(0, MIN_ASSUME_REASON_LENGTH - normalized.length);
  const canSubmit = remaining === 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAssumeReason(reason);
    if (check.ok === false) {
      setError(check.message);
      return;
    }
    setError(null);
    await onConfirm(check.reason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assume-responsibility-title"
    >
      <div
        className={`relative w-full max-w-md p-6 rounded-lg shadow-md flex flex-col gap-4 ${
          isDark ? "bg-zinc-900 border border-zinc-800 text-zinc-100" : "bg-white text-zinc-900"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className={`absolute top-4 right-4 p-2 rounded-full transition ${
            isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-black"
          }`}
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 id="assume-responsibility-title" className="text-lg font-bold">
              Assunção excepcional
            </h2>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Você vai assumir a ficha atualmente com Dr(a). {leadName}, sem transferência pendente.
              Informe o motivo clínico ou operacional (mínimo {MIN_ASSUME_REASON_LENGTH} caracteres).
            </p>
          </div>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-3">
          <label className="block text-xs font-semibold" htmlFor="assume-reason">
            Motivo da assunção *
          </label>
          <textarea
            id="assume-reason"
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            disabled={isSubmitting}
            placeholder="Ex.: responsável incomunicável no intraoperatório; preciso registrar a conduta agora."
            className={`w-full p-2.5 text-sm rounded-lg border outline-none resize-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-slate-300 text-slate-800"
            }`}
          />
          <p className={`text-xs ${remaining > 0 ? "text-amber-600 dark:text-amber-400" : isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {remaining > 0
              ? `Faltam ${remaining} caractere${remaining === 1 ? "" : "s"}.`
              : "Motivo suficiente para registrar a assunção."}
          </p>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Assumindo..." : "Assumir responsabilidade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
