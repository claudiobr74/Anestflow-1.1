import fs from 'fs';
let code = fs.readFileSync('src/components/GasesPanel.tsx', 'utf8');

code = code.replace(
  '<div className="space-y-5">',
  '<div className={`${cardClass} p-5 rounded-xl border ${borderClass} shadow-xs space-y-5`}>\n      <div className="flex items-center gap-2 mb-2">\n        <Wind className={`w-5 h-5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />\n        <h3 className={`font-bold text-sm tracking-wide uppercase flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-slate-800"}`}>\n          Gases e Anestésicos Inalatórios\n        </h3>\n      </div>'
);

fs.writeFileSync('src/components/GasesPanel.tsx', code);
