import React from "react";
import { 
  Cloud,
  WifiOff, 
  AlertTriangle,
  Check
} from "lucide-react";
import { SyncStatus } from "../lib/syncEngine";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  statusText: string;
  isOnline: boolean;
  pendingCount: number;
  lastSavedAt: Date | null;
  errorMessage?: string | null;
  onRetry: () => void;
  isDark?: boolean;
  compact?: boolean;
  variant?: "chip" | "plain";
}

export default function SyncStatusBadge({
  status,
  statusText,
  isOnline,
  pendingCount,
  lastSavedAt,
  errorMessage,
  onRetry,
  isDark = false,
  compact = false,
  variant = "chip"
}: SyncStatusBadgeProps) {

  const formatLastSaved = (date: Date | null) => {
    if (!date) return "agora";
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutesAgo < 1) return "agora";
    return `há ${minutesAgo}m`;
  };

  // 1. OFFLINE State
  if (!isOnline || status === "offline") {
    return (
      <div 
        onClick={onRetry}
        title="Sem conexão. As alterações ficam nesta aba até a nuvem responder; fechar a aba antes de sincronizar descarta a fila."
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-all duration-300 ${
          isDark 
            ? "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20" 
            : "bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100"
        }`}
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="truncate">
          {compact ? "Offline" : "Offline — nesta aba"}
        </span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-500/20 text-amber-500">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // 2. ERROR State
  if (status === "error") {
    return (
      <button
        onClick={onRetry}
        title={errorMessage ? `Erro: ${errorMessage}. Clique para reenviar.` : "Erro de sincronização com a nuvem. Clique para tentar novamente."}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-300 active:scale-95 ${
          isDark 
            ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20" 
            : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        <span className="truncate">Erro ao sincronizar</span>
        <span className="ml-1 text-xs font-semibold tracking-wide underline">Tentar</span>
      </button>
    );
  }

  // 3. SAVED & SYNCING States
  const isSyncing = status === "syncing";
  const savedTitle = `Salvo ${formatLastSaved(lastSavedAt)}`;

  if (variant === "plain") {
    return (
      <div
        title={savedTitle}
        className={`inline-flex items-center gap-1 text-xs font-medium text-[#10B981] ${
          isSyncing ? "animate-pulse" : ""
        }`}
      >
        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span>{isSyncing ? "Salvando" : "Salvo"}</span>
      </div>
    );
  }

  return (
    <div 
      title={savedTitle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-300 ${
        isDark 
          ? "bg-zinc-800/80 border-zinc-700 text-zinc-300" 
          : "bg-slate-100/90 border-slate-200 text-slate-700"
      }`}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <Cloud 
          className={`w-3.5 h-3.5 transition-all duration-300 ${
            isSyncing 
              ? "text-indigo-500 animate-pulse" 
              : "text-emerald-500"
          }`} 
        />
        <span 
          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isSyncing 
              ? "bg-indigo-500 animate-ping opacity-75" 
              : "bg-emerald-500"
          }`} 
        />
      </div>

      <span className="font-semibold text-slate-700 dark:text-zinc-200">
        Salvo
      </span>

      {!compact && (
        <span className="text-xs opacity-60 font-sans hidden sm:inline transition-opacity duration-300">
          ({formatLastSaved(lastSavedAt)})
        </span>
      )}
    </div>
  );
}

