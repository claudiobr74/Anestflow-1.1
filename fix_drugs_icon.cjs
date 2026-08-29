const fs = require('fs');

let intraPanel = fs.readFileSync('src/components/IntraoperativeDrugsPanel.tsx', 'utf8');

if (!intraPanel.includes('Syringe')) {
  intraPanel = intraPanel.replace('import { Layers,', 'import { Layers, Syringe,');
}

intraPanel = intraPanel.replace(
  '<Layers className="w-4 h-4 text-rose-500" />',
  '<Syringe className="w-4 h-4 text-rose-500" />'
);

fs.writeFileSync('src/components/IntraoperativeDrugsPanel.tsx', intraPanel, 'utf8');

let intraTab = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');
intraTab = intraTab.replace(
  "renderCollapsedSquare('drugs', <ShieldAlert className=\"w-6 h-6 text-rose-500\"",
  "renderCollapsedSquare('drugs', <Syringe className=\"w-6 h-6 text-rose-500\""
);
fs.writeFileSync('src/components/IntraoperativeTab.tsx', intraTab, 'utf8');
