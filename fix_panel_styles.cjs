const fs = require('fs');

function processFile(path) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    
    // Replace p-4 rounded-lg border with transparent background
    // BolusDrugsPanel
    content = content.replace(
      /p-4 rounded-lg border space-y-3\.5 \$\{\n\s*isDark \? "bg-zinc-950 border-zinc-800\/80" : "bg-slate-50\/50 border-slate-200"\n\s*\}/g,
      'p-4 rounded-lg border border-transparent dark:border-transparent space-y-3.5 ${isDark ? "bg-zinc-900/30" : "bg-slate-50/50"}'
    );
    
    // ContinuousInfusionsPanel
    content = content.replace(
      /p-4 rounded-lg border \$\{isDark \? "bg-indigo-950\/20 border-indigo-900\/40" : "bg-indigo-50\/50 border-indigo-100"\} mb-4/g,
      'p-4 rounded-lg mb-4 ${isDark ? "bg-indigo-900/10" : "bg-indigo-50/30"}'
    );
    content = content.replace(
      /p-4 rounded-lg border \$\{isDark \? "bg-indigo-950\/20 border-indigo-900\/40" : "bg-indigo-50\/60 border-indigo-200"\} space-y-4/g,
      'p-4 rounded-lg space-y-4 ${isDark ? "bg-indigo-900/10" : "bg-indigo-50/30"}'
    );
    
    // HydrationPanel
    content = content.replace(
      /p-4 rounded-lg border space-y-3\.5 \$\{\n\s*isDark \? "bg-sky-950\/20 border-sky-900\/40" : "bg-sky-50\/60 border-sky-200"\n\s*\}/g,
      'p-4 rounded-lg space-y-3.5 ${isDark ? "bg-sky-900/10" : "bg-sky-50/30"}'
    );
    
    content = content.replace(
      /\$\{isDark \? 'bg-sky-950\/20 border-sky-900\/40' : 'bg-sky-50\/60 border-sky-200'\} p-4 rounded-lg border space-y-3\.5/g,
      '${isDark ? "bg-sky-900/10" : "bg-sky-50/30"} p-4 rounded-lg space-y-3.5'
    );
    
    // GasesPanel
    content = content.replace(
      /p-4 rounded-lg border \$\{isDark \? "bg-teal-950\/20 border-teal-900\/40" : "bg-teal-50\/60 border-teal-200"\} space-y-4/g,
      'p-4 rounded-lg space-y-4 ${isDark ? "bg-teal-900/10" : "bg-teal-50/30"}'
    );

    fs.writeFileSync(path, content, 'utf8');
  }
}

['src/components/BolusDrugsPanel.tsx', 'src/components/ContinuousInfusionsPanel.tsx', 'src/components/HydrationPanel.tsx', 'src/components/GasesPanel.tsx'].forEach(processFile);
