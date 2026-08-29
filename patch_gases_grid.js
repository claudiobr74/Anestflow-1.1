import fs from 'fs';
let code = fs.readFileSync('src/components/GasesPanel.tsx', 'utf8');

code = code.replace(
  '<div className={`grid ${isVolatile ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2"} gap-3`}>',
  '<div className="flex flex-wrap gap-3">'
);

// We should also add flex-1 or min-w to the children so they flex nicely
code = code.replace(
  '{!isGas && (\n                    <div className={`p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>\n                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Concentração (%)</div>',
  '{!isGas && (\n                    <div className={`flex-1 min-w-[140px] p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>\n                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Concentração (%)</div>'
);

code = code.replace(
  '<div className={`p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>\n                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">\n                      FGF (L/min)\n                    </div>',
  '<div className={`flex-1 min-w-[140px] p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>\n                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">\n                      FGF (L/min)\n                    </div>'
);

code = code.replace(
  '{isVolatile && consumption && (\n                    <div className={`p-3 rounded-lg border flex flex-col justify-center ${isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50 border-indigo-100"}`}>\n                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">',
  '{isVolatile && consumption && (\n                    <div className={`flex-1 min-w-[140px] p-3 rounded-lg border flex flex-col justify-center ${isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50 border-indigo-100"}`}>\n                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">'
);

fs.writeFileSync('src/components/GasesPanel.tsx', code);
