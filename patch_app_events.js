import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(\) => \{ window\.dispatchEvent\(new CustomEvent\('expandPanel', \{ detail: 'events' \}\)\); setTimeout\(\(\) => window\.document\.getElementById\('events'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\), 100\); \}\}/g,
  "onClick={() => { window.dispatchEvent(new CustomEvent('expandPanel', { detail: 'events' })); setTimeout(() => window.document.getElementById('events')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100); window.dispatchEvent(new CustomEvent('openNarrativeDrawer')); }}"
);

fs.writeFileSync('src/App.tsx', code);
