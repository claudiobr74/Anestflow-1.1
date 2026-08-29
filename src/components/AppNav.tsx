export type AppTabId = "patient" | "preop" | "intra" | "recovery" | "review";

const TABS: { id: AppTabId; label: string; shortLabel: string }[] = [
  { id: "patient", label: "Admissão e Equipe", shortLabel: "Admissão" },
  { id: "preop", label: "Avaliação Pré-Anestésica", shortLabel: "Pré-Anestésica" },
  { id: "intra", label: "Registro Intraoperatório", shortLabel: "Intraoperatório" },
  { id: "recovery", label: "Recuperação (SRPA)", shortLabel: "SRPA" },
  { id: "review", label: "Auditoria & Assinatura", shortLabel: "Auditoria" }
];

export default function AppNav({
  activeTab,
  onChangeTab,
  isDark
}: {
  activeTab: AppTabId;
  onChangeTab: (tab: AppTabId) => void;
  isDark: boolean;
}) {
  return (
    <nav className={`border-b px-4 py-2 shrink-0 transition ${
      isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
    }`}>
      <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 select-none cursor-pointer flex items-center justify-center ${
                  active
                    ? isDark
                      ? "bg-indigo-500/10 text-indigo-300"
                      : "bg-indigo-50 text-indigo-700"
                    : isDark
                      ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
