const fs = require('fs');

let content = fs.readFileSync('src/components/PreEvaluationTab.tsx', 'utf8');

// The jejum div: `<div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">`
// Let's replace it dynamically based on fasting status, but the easiest is to just use a neutral style for the container.

content = content.replace(
  'className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"',
  'className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"'
);

content = content.replace(
  'className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-amber-800 mb-2 gap-1 min-h-[2.5rem]"',
  'className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 gap-1 min-h-[2.5rem]"'
);

content = content.replace(
  'className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-amber-800 mb-2 gap-1 min-h-[2.5rem]"',
  'className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 gap-1 min-h-[2.5rem]"'
);

fs.writeFileSync('src/components/PreEvaluationTab.tsx', content, 'utf8');
