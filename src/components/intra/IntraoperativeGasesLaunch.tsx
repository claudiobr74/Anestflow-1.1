import React from "react";
import { Wind, ChevronUp } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import GasesPanel from "../GasesPanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";

export default function IntraoperativeGasesLaunch() {
  const {
    borderClass, cardClass, getIsExpanded, handleRemoveInhalationAgent, handleStartInhalationAgent, handleStopInhalationAgent, handleUpdateInhalationAgent, inhalationAgents, isDark, newAgent, setNewAgent, togglePanel
  } = useIntraUi();

    if (!getIsExpanded('gases')) return <CollapsedPanelSquare panelId="gases" icon={<Wind className="w-6 h-6" />} title="Gases" />;
    return (
      <DraggablePanel key="gases" id="gases" isDark={isDark} className="w-full max-w-full min-w-0">
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
}
