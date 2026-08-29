import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/window\.document\.getElementById\('([^']+)'\)\?\.scrollIntoView\(\{behavior: 'smooth', block: 'center'\}\)/g, 
"window.dispatchEvent(new CustomEvent('expandPanel', { detail: '$1' })); setTimeout(() => window.document.getElementById('$1')?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100)");

fs.writeFileSync('src/App.tsx', code);
