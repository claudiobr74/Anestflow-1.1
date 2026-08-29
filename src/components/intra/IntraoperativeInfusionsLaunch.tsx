import React from "react";
import { ChevronUp, Droplets } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import ContinuousInfusionsPanel from "../ContinuousInfusionsPanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";

export default function IntraoperativeInfusionsLaunch() {
  const {
    borderClass, cardClass, continuousInfusions, ficha, getIsExpanded, handleRemoveInfusion, handleStartInfusion, handleUpdateInfusion, handleUpdateInfusionStatus, isDark, newInfusion, patient, setNewInfusion, togglePanel
  } = useIntraUi();

    if (!getIsExpanded('infusions')) return <CollapsedPanelSquare panelId="infusions" icon={<Droplets className="w-6 h-6" />} title="Bombas de Infusão" />;
    return (
      /* CONTINUOUS INFUSION PUMPS CONTROL (NÍVEL 1) */
      <DraggablePanel key="infusions" id="infusions" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('infusions')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <ContinuousInfusionsPanel 
        isDark={isDark}
        borderClass={borderClass}
        cardClass={cardClass}
        continuousInfusions={continuousInfusions}
        newInfusion={newInfusion}
        setNewInfusion={setNewInfusion}
        handleStartInfusion={handleStartInfusion}
        handleUpdateInfusionStatus={handleUpdateInfusionStatus}
        handleUpdateInfusion={handleUpdateInfusion}
        handleRemoveInfusion={handleRemoveInfusion}
        patientWeight={ficha.patient?.weight}
      /></div></DraggablePanel>
    );
}
