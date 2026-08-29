import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\('expandPanel', \{ detail: 'drugs' \}\)\); setTimeout\(\(\) => window\.document\.getElementById\('drugs'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\), 100\)\}/g,
  "onClick={() => { window.dispatchEvent(new CustomEvent('expandPanel', { detail: 'drugs' })); setTimeout(() => window.document.getElementById('drugs')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100); }}");

code = code.replace(/onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\('expandPanel', \{ detail: 'hydration' \}\)\); setTimeout\(\(\) => window\.document\.getElementById\('hydration'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\), 100\)\}/g,
  "onClick={() => { window.dispatchEvent(new CustomEvent('expandPanel', { detail: 'hydration' })); setTimeout(() => window.document.getElementById('hydration')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100); }}");

code = code.replace(/onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\('expandPanel', \{ detail: 'vitals' \}\)\); setTimeout\(\(\) => window\.document\.getElementById\('vitals'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\), 100\)\}/g,
  "onClick={() => { window.dispatchEvent(new CustomEvent('expandPanel', { detail: 'vitals' })); setTimeout(() => window.document.getElementById('vitals')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100); }}");

code = code.replace(/onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\('expandPanel', \{ detail: 'events' \}\)\); setTimeout\(\(\) => window\.document\.getElementById\('events'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\), 100\)\}/g,
  "onClick={() => { window.dispatchEvent(new CustomEvent('expandPanel', { detail: 'events' })); setTimeout(() => window.document.getElementById('events')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100); }}");

fs.writeFileSync('src/App.tsx', code);
