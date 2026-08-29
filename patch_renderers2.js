import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

const replacementGases = `  const renderGases = () => {
    if (!getIsExpanded('gases')) return renderCollapsedSquare('gases', <Wind className="w-6 h-6" />, 'Gases');
    return (
      <DraggablePanel key="gases" id="gases" isDark={isDark} order={getPanelOrder("gases")} className="w-full">
        <div className={\`\${cardClass} p-5 rounded-xl border transition-all duration-200 relative\`}>
          <button onClick={() => togglePanel('gases')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className="pr-8">
            <GasesPanel 
              isDark={isDark}
              borderClass={borderClass}
              cardClass={cardClass}
              inputClass={inputClass}
              selectClass={selectClass}
              inhalationAgents={inhalationAgents}
              handleStartGas={handleStartGas}
              handleStopGas={handleStopGas}
            />
          </div>
        </div>
      </DraggablePanel>
    );
  };`;

const replacementHydration = `  const renderHydration = () => {
    if (!getIsExpanded('hydration')) return renderCollapsedSquare('hydration', <Droplets className="w-6 h-6 text-blue-500" />, 'Líquidos');
    return (
      <DraggablePanel key="hydration" id="hydration" isDark={isDark} order={getPanelOrder("hydration")} className="w-full">
        <div className="relative">
          <button onClick={() => togglePanel('hydration')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <HydrationPanel 
            isDark={isDark}
            borderClass={borderClass}
            cardClass={cardClass}
            inputClass={inputClass}
            selectClass={selectClass}
            fluids={fluids}
            outputs={outputs}
            patient={patient}
            handleAddFluid={handleAddFluid}
            handleRemoveFluid={handleRemoveFluid}
            handleAddOutput={handleAddOutput}
            handleRemoveOutput={handleRemoveOutput}
          />
        </div>
      </DraggablePanel>
    );
  };`;

const replacementEvents = `  const renderEvents = () => {
    if (!getIsExpanded('events')) return renderCollapsedSquare('events', <FileText className="w-6 h-6" />, 'Eventos e Notas');
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
          <AnesthesiaDescriptionDrawer
            document={document}
            onUpdateDocument={onUpdateDocument}
            isDark={isDark}
            patient={patient}
          />
        </div>
      </DraggablePanel>
    );
  };`;

const extractFunction = (funcName, content) => {
    const startIdx = content.indexOf(`const ${funcName} = () => {`);
    if (startIdx === -1) return -1;
    let braceCount = 0;
    let i = startIdx + `const ${funcName} = () => {`.length;
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
replaceFunc('renderHydration', replacementHydration);
replaceFunc('renderEvents', replacementEvents);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
