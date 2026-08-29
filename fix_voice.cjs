const fs = require('fs');

let content = fs.readFileSync('src/components/VoiceCommandButton.tsx', 'utf8');

content = content.replace(
  '{isRecording ? "🎙️ Gravando..." : "⚡ Processando..."}',
  '{isRecording ? <><Mic className="w-4 h-4" /> Gravando...</> : <><Zap className="w-4 h-4" /> Processando...</>}'
);

if (!content.includes('Mic, Zap')) {
  content = content.replace('import { Mic, Square }', 'import { Mic, Square, Zap }');
}

fs.writeFileSync('src/components/VoiceCommandButton.tsx', content, 'utf8');
