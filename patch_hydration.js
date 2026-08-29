import fs from 'fs';
let code = fs.readFileSync('src/components/HydrationPanel.tsx', 'utf8');

// Remove isExpanded state
code = code.replace(/const \[isExpanded, setIsExpanded\] = useState\(false\);\n/, '');

// Replace the button and wrapper
const replaceStart = `<button \n        onClick={() => setIsExpanded(!isExpanded)}\n        className={\`w-full flex items-center justify-between group \${isExpanded ? \`border-b pb-4 mb-4 \${borderClass}\` : ""}\`}\n      >\n        <div className="flex items-center gap-2">\n          <Droplets className={\`w-5 h-5 \${isDark ? "text-sky-400" : "text-sky-600"}\`} />\n          <h3 className={\`font-bold text-sm tracking-wide uppercase flex items-center gap-2 \${isDark ? "text-zinc-100" : "text-slate-800"}\`}>\n            Cristaloides, Sangue e Balanço Hídrico\n          </h3>\n        </div>\n        <div className="flex items-center gap-3">\n          {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300" />}\n        </div>\n      </button>\n      {isExpanded && (\n        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-5">`;

const replaceEnd = `</div>\n      )}\n      {/* Active and Recorded Fluids/Outputs List */}`;

const newHeader = `<div className="flex items-center gap-2 mb-4">\n        <Droplets className={\`w-5 h-5 \${isDark ? "text-sky-400" : "text-sky-600"}\`} />\n        <h3 className={\`font-bold text-sm tracking-wide uppercase flex items-center gap-2 \${isDark ? "text-zinc-100" : "text-slate-800"}\`}>\n          Cristaloides, Sangue e Balanço Hídrico\n        </h3>\n      </div>\n      <div className="space-y-5">`;

code = code.replace(replaceStart, newHeader);

code = code.replace(replaceEnd, `</div>\n      {/* Active and Recorded Fluids/Outputs List */}`);

code = code.replace(/\{`space-y-4 \$\{!isExpanded \? 'pt-2' : ''\}`\}/g, `"space-y-4"`);

fs.writeFileSync('src/components/HydrationPanel.tsx', code);
