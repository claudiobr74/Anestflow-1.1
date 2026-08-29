const fs = require('fs');

let content = fs.readFileSync('src/components/VitalsPanel.tsx', 'utf8');

// import Zap, AlertTriangle, Info if not present
if (!content.includes('Zap')) {
  content = content.replace('AlertTriangle, ', 'AlertTriangle, Zap, Info, ');
}

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

fs.writeFileSync('src/components/VitalsPanel.tsx', content, 'utf8');
