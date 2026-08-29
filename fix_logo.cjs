const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '{/* IDENTIFICAÇÃO DO PACIENTE */}',
  '<AnestFlowLogo height={28} className="shrink-0 hidden lg:block mr-2" />\n          {/* IDENTIFICAÇÃO DO PACIENTE */}'
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
