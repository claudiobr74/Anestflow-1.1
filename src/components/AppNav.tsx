export type AppTabId = "patient" | "preop" | "intra" | "recovery" | "review";

const TABS: { id: AppTabId; label: string; shortLabel: string }[] = [
  { id: "patient", label: "Admissão e Equipe", shortLabel: "Admissão" },
  { id: "preop", label: "Avaliação Pré-Anestésica", shortLabel: "Pré-Anestésica" },
  { id: "intra", label: "Registro Intraoperatório", shortLabel: "Intraop." },
  { id: "recovery", label: "Recuperação (SRPA)", shortLabel: "SRPA" },
  { id: "review", label: "Auditoria", shortLabel: "Auditoria" }
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
    <nav
      className={`relative shrink-0 border-b ${
        isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-[#E5E7EB]"
      }`}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none px-4 py-3 pr-8 md:px-6 md:pr-6 xl:gap-3 xl:px-10 xl:py-4">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-[13px] transition-colors duration-200 select-none cursor-pointer md:px-4 xl:px-5 xl:py-2.5 xl:text-sm ${
                active
                  ? isDark
                    ? "bg-violet-500/15 font-semibold text-violet-300"
                    : "bg-[#F3E8FF] font-semibold text-[#7C3AED]"
                  : isDark
                    ? "font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    : "font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
              }`}
            >
              <span className="xl:hidden">{tab.shortLabel}</span>
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent xl:hidden ${
          isDark ? "from-zinc-950" : "from-white"
        }`}
      />
    </nav>
  );
}
