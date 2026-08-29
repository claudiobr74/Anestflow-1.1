const fs = require('fs');

// 1. Upgrade index.css variables for premium feel
let indexCss = fs.readFileSync('src/index.css', 'utf8');

indexCss = indexCss.replace('--radius-card: 0.75rem;', '--radius-card: 1rem;');
indexCss = indexCss.replace('--radius-modal: 1rem;', '--radius-modal: 1.25rem;');
if (!indexCss.includes('--shadow-glass:')) {
  indexCss = indexCss.replace(
    '--shadow-card: 0 1px 2px 0 rgb(0 0 0 / 0.05);',
    '--shadow-card: 0 2px 8px -2px rgb(0 0 0 / 0.05), 0 4px 12px -4px rgb(0 0 0 / 0.05);\n  --shadow-glass: 0 8px 32px 0 rgb(0 0 0 / 0.05);'
  );
}
fs.writeFileSync('src/index.css', indexCss, 'utf8');

// 2. Add glassmorphism to App.tsx header and tabs
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

appTsx = appTsx.replace(
  'header className={`relative shrink-0 transition-colors duration-300 border-b z-10 ${',
  'header className={`relative shrink-0 transition-all duration-300 border-b z-10 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 ${'
);
appTsx = appTsx.replace(
  'isDark ? "bg-[#17191C] border-zinc-800" : "bg-white border-slate-200"',
  'isDark ? "border-zinc-800/60 shadow-glass" : "border-slate-200/60 shadow-glass"'
);

// Tweak the active tab indicator for premium look
appTsx = appTsx.replace(
  'className={`w-full py-2.5 sm:py-3 px-2 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-all duration-300 border-b-2',
  'className={`w-full py-2.5 sm:py-3 px-2 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm tracking-tight transition-all duration-300 ease-out border-b-2'
);

fs.writeFileSync('src/App.tsx', appTsx, 'utf8');

console.log("Premium UI tweaks applied.");
