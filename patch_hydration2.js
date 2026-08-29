import fs from 'fs';
let code = fs.readFileSync('src/components/HydrationPanel.tsx', 'utf8');

// Remove isExpanded state
code = code.replace(/const \[isExpanded, setIsExpanded\] = useState\(false\);\n/, '');

const startStr = `<button \n        onClick={() => setIsExpanded(!isExpanded)}`;
const endStr = `<div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-5">`;

const startIdx = code.indexOf('<button');
// find the specific button
const buttonIdx = code.indexOf(startStr);
if (buttonIdx !== -1) {
  const endIdx = code.indexOf(endStr, buttonIdx) + endStr.length;
  
  const newHeader = `<div className="flex items-center gap-2 mb-4">\n        <Droplets className={\`w-5 h-5 \${isDark ? "text-sky-400" : "text-sky-600"}\`} />\n        <h3 className={\`font-bold text-sm tracking-wide uppercase flex items-center gap-2 \${isDark ? "text-zinc-100" : "text-slate-800"}\`}>\n          Cristaloides, Sangue e Balanço Hídrico\n        </h3>\n      </div>\n      <div className="space-y-5">`;

  code = code.slice(0, buttonIdx) + newHeader + code.slice(endIdx);
}

// Remove the closing tags for the `isExpanded && (` part
const endReplace = `</div>\n      )}\n      {/* Active and Recorded Fluids/Outputs List */}`;
code = code.replace(endReplace, `</div>\n      {/* Active and Recorded Fluids/Outputs List */}`);

code = code.replace(/\{`space-y-4 \$\{!isExpanded \? 'pt-2' : ''\}`\}/g, `"space-y-4"`);

fs.writeFileSync('src/components/HydrationPanel.tsx', code);
