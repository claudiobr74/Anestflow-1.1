import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

code = code.replace(
  "window.addEventListener('expandPanel', handleExpandPanel);",
  "window.addEventListener('expandPanel', handleExpandPanel);\n    const handleOpenNarrativeDrawer = () => setIsNarrativeDrawerOpen(true);\n    window.addEventListener('openNarrativeDrawer', handleOpenNarrativeDrawer);"
);

code = code.replace(
  "return () => window.removeEventListener('expandPanel', handleExpandPanel);",
  "return () => {\n      window.removeEventListener('expandPanel', handleExpandPanel);\n      window.removeEventListener('openNarrativeDrawer', handleOpenNarrativeDrawer);\n    };"
);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
