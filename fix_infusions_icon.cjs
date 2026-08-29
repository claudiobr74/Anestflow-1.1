const fs = require('fs');

// 1. IntraoperativeTab.tsx
let intraTab = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');
intraTab = intraTab.replace(
  "renderCollapsedSquare('infusions', <Droplets className=\"w-6 h-6\"",
  "renderCollapsedSquare('infusions', <Settings className=\"w-6 h-6\""
);
fs.writeFileSync('src/components/IntraoperativeTab.tsx', intraTab, 'utf8');

// 2. ContinuousInfusionsPanel.tsx
let infusionsPanel = fs.readFileSync('src/components/ContinuousInfusionsPanel.tsx', 'utf8');
if (!infusionsPanel.includes('Settings')) {
  infusionsPanel = infusionsPanel.replace('import { Layers,', 'import { Layers, Settings,');
}
infusionsPanel = infusionsPanel.replace(
  '<Layers className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />',
  '<Settings className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />'
);
fs.writeFileSync('src/components/ContinuousInfusionsPanel.tsx', infusionsPanel, 'utf8');
