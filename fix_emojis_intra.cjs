const fs = require('fs');

let content = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

// replace the emojis with lucide icons
content = content.replace(
  '⚡ Simular Atraso',
  '<Zap className="w-3 h-3" /> Simular Atraso'
);

content = content.replace(
  '{isOverdue ? "⚠️ ALERTA: REGISTRO ATRASADO!" : "PRÓXIMO REGISTRO EM:"}',
  '{isOverdue ? <><AlertTriangle className="w-3.5 h-3.5" /> ALERTA: REGISTRO ATRASADO!</> : "PRÓXIMO REGISTRO EM:"}'
);

content = content.replace(
  'ℹ️ Inicie a anestesia no painel cronológico',
  '<Info className="w-3.5 h-3.5" /> Inicie a anestesia no painel cronológico'
);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', content, 'utf8');
