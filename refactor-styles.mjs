import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  'src/components/PreEvaluationTab.tsx',
  'src/components/IntraoperativeTab.tsx',
  'src/components/RecoveryTab.tsx',
  'src/components/ReviewTab.tsx',
  'src/components/ProceduresManagerModal.tsx',
];

const replaces = [
  {
    from: /bg-white p-5 rounded-xl border border-slate-100 shadow-xs/g,
    to: 'bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-2xl border shadow-sm transition-colors'
  },
  {
    from: /bg-white p-6 rounded-xl border border-slate-100 shadow-xs/g,
    to: 'bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-2xl border shadow-sm transition-colors'
  },
  {
    from: /flex items-center gap-2 border-b border-slate-100 pb-3/g,
    to: 'flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80'
  },
  {
    from: /flex items-center gap-2 border-b border-slate-200 pb-3/g,
    to: 'flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80'
  },
  {
    from: /text-slate-800 text-sm/g,
    to: 'text-slate-800 dark:text-zinc-100 text-sm'
  },
  {
    from: /font-bold text-slate-800/g,
    to: 'font-bold text-slate-800 dark:text-zinc-100'
  },
  {
    from: /text-slate-500/g,
    to: 'text-slate-500 dark:text-zinc-400'
  },
  {
    from: /text-slate-400/g,
    to: 'text-slate-400 dark:text-zinc-500'
  },
  {
    from: /bg-slate-50 border border-slate-200 rounded-lg/g,
    to: 'bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-xl transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900'
  },
  {
    from: /bg-slate-50 border border-slate-300 rounded-lg/g,
    to: 'bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-xl transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900'
  },
  {
    from: /w-full bg-slate-100 border border-slate-200 text-slate-700 rounded-lg/g,
    to: 'w-full rounded-xl border bg-slate-100 border-slate-200 text-slate-700 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300'
  },
  {
    from: /p-3 bg-slate-50 rounded-xl border border-slate-100/g,
    to: 'p-4 rounded-xl border bg-slate-50/80 border-slate-100 dark:bg-zinc-950/50 dark:border-zinc-800/80'
  },
  {
    from: /bg-slate-100/g,
    to: 'bg-slate-100 dark:bg-zinc-900/80'
  },
  {
    from: /bg-indigo-600 hover:bg-indigo-700 text-white/g,
    to: 'bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500'
  },
  {
    from: /bg-teal-600 hover:bg-teal-700 text-white/g,
    to: 'bg-teal-600 hover:bg-teal-500 text-white dark:bg-teal-600 dark:hover:bg-teal-500'
  },
  {
    from: /px-3 py-2/g,
    to: 'px-3 py-2.5'
  },
  {
    from: /px-2 py-2/g,
    to: 'px-2 py-2.5'
  }
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    replaces.forEach(({from, to}) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
