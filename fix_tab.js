import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

// 1. Fix isInfusionsActive and isGasesActive
code = code.replace(
  "const isInfusionsActive = continuousInfusions?.some(i => i.status === 'running' || i.status === 'paused');",
  "const isInfusionsActive = continuousInfusions?.some(i => i.history?.length > 0 && i.history[i.history.length - 1].status !== 'Finalizado');"
);

code = code.replace(
  "const isGasesActive = inhalationAgents?.some(g => g.status === 'running' || g.status === 'paused');",
  "const isGasesActive = inhalationAgents?.some(g => !g.endTime);"
);

// 2. Fix GasesPanel props in renderGases
const gasesOld = `            inhalationAgents={inhalationAgents}
            handleStartGas={handleStartGas}
            handleStopGas={handleStopGas}`;

const gasesNew = `            inhalationAgents={inhalationAgents}
            newAgent={newAgent}
            setNewAgent={setNewAgent}
            handleStartInhalationAgent={handleStartInhalationAgent}
            handleStopInhalationAgent={handleStopInhalationAgent}
            handleRemoveInhalationAgent={handleRemoveInhalationAgent}
            handleUpdateAgent={handleUpdateInhalationAgent}`;

code = code.replace(gasesOld, gasesNew);

// 3. Fix AnesthesiaDescriptionDrawer
code = code.replace(
  "<AnesthesiaDescriptionDrawer \n              document={document}\n              onUpdateDocument={onUpdateDocument}\n              isDark={isDark}\n              patient={patient}\n            />",
  "<AnesthesiaDescriptionDrawer \n              isOpen={false}\n              onClose={() => {}}\n              document={document}\n              onUpdateDocument={onUpdateDocument}\n              theme={theme}\n            />"
);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
