import React from 'react';
import { AnesthesiaDocument } from '../types';
import { isCurrentResponsible } from '../lib/assertCanEdit';
import { ShieldCheck, Lock, ArrowRightLeft, UserCheck, AlertTriangle } from 'lucide-react';

interface ResponsibilityBannerProps {
  ficha: AnesthesiaDocument;
  user: { uid?: string; name: string; crm: string; uf: string; email?: string } | null;
  isDark: boolean;
  onOpenTransferModal: () => void;
  onClaimResponsibility: () => void;
  isClaiming?: boolean;
}

export default function ResponsibilityBanner({
  ficha,
  user,
  isDark,
  onOpenTransferModal,
  onClaimResponsibility,
  isClaiming = false
}: ResponsibilityBannerProps) {
  const isResponsible = isCurrentResponsible(ficha, user?.uid);

  const leadName = ficha.team?.anesthesiologistLead || "Anestesiologista Responsável";
  const leadCRM = ficha.team?.crmLead ? `CRM ${ficha.team.crmLead}/${ficha.team.ufLead || 'SP'}` : "";

  if (isResponsible) {
    return (
      <div className={`w-full px-3 py-1.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 transition-all ${
        isDark 
          ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200" 
          : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0 text-xs">
            <span className="font-bold tracking-tight mr-1">Responsável Atual:</span>
            <span className="font-medium">Dr(a). {leadName}</span>
            {leadCRM && <span className="opacity-75 text-xs ml-1.5 tabular-nums">({leadCRM})</span>}
            <span className="ml-2 text-xs uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Single-Writer Autorizado
            </span>
          </div>
        </div>

        {ficha.status !== "Signed" && (
          <button
            type="button"
            onClick={onOpenTransferModal}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 shrink-0 ${
              isDark 
                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700" 
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
            <span>Transferir Responsabilidade</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full p-3.5 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm transition-all ${
      isDark 
        ? "bg-amber-950/30 border-amber-800/60 text-amber-100" 
        : "bg-amber-50 border-amber-200 text-amber-950"
    }`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 md:mt-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
              Modo Leitura — Concorrência Protegida
            </span>
            <span className="text-xs font-semibold">
              Responsável: <strong className="underline">{leadName}</strong> {leadCRM && `(${leadCRM})`}
            </span>
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            Você está visualizando as alterações do plantão em tempo real. Apenas o anestesiologista responsável pode registrar medicamentos, sinais vitais e eventos clínicos para evitar conflitos de conduta.
          </p>
        </div>
      </div>

      {ficha.status !== "Signed" && (
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={onClaimResponsibility}
            disabled={isClaiming}
            className="px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-lg shadow transition flex items-center gap-2 disabled:opacity-50"
          >
            {isClaiming ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>Assumir Responsabilidade Clínica</span>
          </button>
        </div>
      )}
    </div>
  );
}
