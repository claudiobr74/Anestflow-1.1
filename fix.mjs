import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  'src/components/PreEvaluationTab.tsx',
  'src/components/IntraoperativeTab.tsx',
  'src/components/RecoveryTab.tsx',
  'src/components/ReviewTab.tsx',
  'src/components/ProceduresManagerModal.tsx',
];

const replaces = [
  {
    from: /py-2\.5\.5/g,
    to: 'py-2.5'
  },
  {
    from: /px-2\.5\.5/g,
    to: 'px-2.5'
  }
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    replaces.forEach(({from, to}) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
