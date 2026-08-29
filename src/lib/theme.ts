export const getThemeClasses = (theme?: "light" | "dark" | "dark-clean") => {
  const isDark = theme === "dark" || theme === "dark-clean";

  return {
    isDark,
    appBg: isDark ? "bg-[#09090B] text-zinc-100" : "bg-slate-50 text-slate-900",
    headerBg: isDark ? "bg-[#18181B] border-zinc-800" : "bg-white border-slate-200",
    navBg: isDark ? "bg-[#1C1C1E]/50 border-zinc-800" : "bg-white/80 backdrop-blur-xl border-slate-200/80 shadow-xs",
    tabContainer: isDark ? "bg-[#000000] border-zinc-800/80" : "bg-slate-100/50 border-slate-200/50",
    tabActive: isDark ? "bg-zinc-800 text-white shadow-xs" : "bg-white text-indigo-700 shadow-sm",
    tabInactive: isDark ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-800",

    card: `p-6 rounded-2xl border shadow-sm transition-colors ${
      isDark ? "bg-zinc-900/50 border-zinc-800/60" : "bg-white border-slate-200/60"
    }`,
    cardHeader: `flex items-center gap-2 border-b pb-4 mb-5 ${
      isDark ? "border-zinc-800/80" : "border-slate-100"
    }`,
    cardHeading: `font-bold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`,
    cardIcon: `w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`,

    label: `block text-xs font-semibold mb-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`,
    input: `w-full rounded-xl px-3 py-2.5 text-sm transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
      isDark 
        ? "bg-zinc-950 border border-zinc-800 text-zinc-200 focus:bg-zinc-900 focus:border-zinc-700" 
        : "bg-slate-50/50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-300"
    }`,
    
    subCard: `p-4 rounded-xl border ${
      isDark ? "bg-zinc-950/50 border-zinc-800/80" : "bg-slate-50/80 border-slate-100"
    }`,
  };
};
