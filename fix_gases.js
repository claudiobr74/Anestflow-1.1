import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

const replacementGases = `  const renderGases = () => {
    if (!getIsExpanded('gases')) return renderCollapsedSquare('gases', <Wind className="w-6 h-6" />, 'Gases');
    return (
      <DraggablePanel key="gases" id="gases" isDark={isDark} order={getPanelOrder("gases")} className="w-full">
        <div className="relative">
          <button onClick={() => togglePanel('gases')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <GasesPanel 
            isDark={isDark}
            borderClass={borderClass}
            cardClass={cardClass}
            inhalationAgents={inhalationAgents}
            newAgent={newAgent}
            setNewAgent={setNewAgent}
            handleStartInhalationAgent={handleStartInhalationAgent}
            handleStopInhalationAgent={handleStopInhalationAgent}
            handleRemoveInhalationAgent={handleRemoveInhalationAgent}
            handleUpdateAgent={handleUpdateInhalationAgent}
          />
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

replaceFunc('renderGases', replacementGases);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
