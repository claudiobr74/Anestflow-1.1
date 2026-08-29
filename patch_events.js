import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

const replacementEvents = `  const renderEvents = () => {
    if (!getIsExpanded('events')) return renderCollapsedSquare('events', <FileText className="w-6 h-6" />, 'Descrição e Eventos');
    return (
      <DraggablePanel key="events" id="events" isDark={isDark} order={getPanelOrder("events")} className="w-full">
        <div className={\`\${cardClass} p-5 rounded-xl border space-y-4 relative\`}>
          <button onClick={() => togglePanel('events')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className={\`flex items-center justify-between pb-2 border-b pr-8 \${borderClass}\`}>
            <div className="flex items-center gap-2">
              <FileText className={\`w-5 h-5 \${isDark ? "text-orange-400" : "text-orange-600"}\`} />
              <div>
                <h3 className={\`font-bold text-sm \${textHeadingClass}\`}>
                  Descrição e Eventos Clínicos
                </h3>
                <p className={\`text-[11px] \${textMutedClass}\`}>
                  Registro de intercorrências, tempos cirúrgicos adicionais e notas de evolução
                </p>
              </div>
            </div>
            <span className={\`text-[11px] px-2 py-0.5 rounded-full font-bold \${isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"}\`}>
              {descriptionSummary}
            </span>
          </div>
          <button
             onClick={() => setIsNarrativeDrawerOpen(true)}
             className={\`w-full py-4 rounded-xl border flex items-center justify-center gap-2 transition active:scale-[0.98] \${isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20" : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"}\`}
           >
             <FileText className="w-5 h-5" />
             <span className="font-bold">Abrir Painel de Descrições e Eventos</span>
           </button>
        </div>
      </DraggablePanel>
    );
  };`;

const extractFunction = (funcName, content) => {
    const startIdx = content.indexOf('const ' + funcName + ' = () => {');
    if (startIdx === -1) return -1;
    let braceCount = 0;
    let i = startIdx + ('const ' + funcName + ' = () => {').length;
    braceCount++; // For the opening brace
    while (i < content.length && braceCount > 0) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') braceCount--;
        i++;
    }
    // include trailing semicolon and newline if present
    if (content[i] === ';') i++;
    if (content[i] === '\n') i++;
    return { start: startIdx, end: i };
};

const replaceFunc = (funcName, newCode) => {
    const pos = extractFunction(funcName, code);
    if (pos.start !== -1) {
        code = code.slice(0, pos.start) + newCode + '\n' + code.slice(pos.end);
    }
};

replaceFunc('renderEvents', replacementEvents);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
