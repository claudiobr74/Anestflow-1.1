const fs = require('fs');

let intraTsx = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

intraTsx = intraTsx.replace(
  'const cardClass = isDark\n    ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100 shadow-sm"\n    : "bg-white border-zinc-200/80 text-zinc-900 shadow-xs";',
  'const cardClass = isDark\n    ? "bg-[#1C1C1E]/90 backdrop-blur-md border-zinc-800/80 text-zinc-100 shadow-glass"\n    : "bg-white/90 backdrop-blur-md border-zinc-200/60 text-zinc-900 shadow-glass";'
);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', intraTsx, 'utf8');
