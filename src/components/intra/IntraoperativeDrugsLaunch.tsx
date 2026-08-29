import React from "react";
import { Syringe, ChevronUp } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import IntraoperativeDrugsPanel from "../IntraoperativeDrugsPanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";

export default function IntraoperativeDrugsLaunch() {
  const {
    allAvailableDrugs, bolusDrugs, borderClass, cardClass, continuousInfusions, customDose, customRoute, customTime, drugEditorData, drugEditorMode, drugSearchQuery, ficha, getIsExpanded, handleConfirmLaunch, handleRemoveBolusDrugByName, handleRemoveInfusion, inputClass, isDark, isDrugListExpanded, onUpdateDocument, patient, selectClass, selectedDrug, selectedDrugCategory, setCustomDose, setCustomRoute, setCustomTime, setDrugEditorData, setDrugEditorMode, setDrugSearchQuery, setEditingBolusDrugName, setEditingBolusDrugsList, setEditingInfusionData, setEditingInfusionId, setIsDrugListExpanded, setSelectedDrug, setSelectedDrugCategory, setShowDrugEditor, setTimeMode, showDrugEditor, timeMode, togglePanel
  } = useIntraUi();

    if (!getIsExpanded('drugs')) return <CollapsedPanelSquare panelId="drugs" icon={<Syringe className="w-6 h-6 text-rose-500" />} title="Fármacos" />;
    return (
      <DraggablePanel key="drugs" id="drugs" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('drugs')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <IntraoperativeDrugsPanel
            isDark={isDark}
            cardClass={cardClass}
            borderClass={borderClass}
            inputClass={inputClass}
            selectClass={selectClass}
            ficha={ficha}
            onUpdateDocument={onUpdateDocument}
            patient={patient}
            allAvailableDrugs={allAvailableDrugs}
            bolusDrugs={bolusDrugs}
            continuousInfusions={continuousInfusions}
            selectedDrug={selectedDrug}
            setSelectedDrug={setSelectedDrug}
            customDose={customDose}
            setCustomDose={setCustomDose}
            customRoute={customRoute}
            setCustomRoute={setCustomRoute}
            customTime={customTime}
            setCustomTime={setCustomTime}
            timeMode={timeMode}
            setTimeMode={setTimeMode}
            isDrugListExpanded={isDrugListExpanded}
            setIsDrugListExpanded={setIsDrugListExpanded}
            drugSearchQuery={drugSearchQuery}
            setDrugSearchQuery={setDrugSearchQuery}
            selectedDrugCategory={selectedDrugCategory}
            setSelectedDrugCategory={setSelectedDrugCategory}
            showDrugEditor={showDrugEditor}
            setShowDrugEditor={setShowDrugEditor}
            drugEditorMode={drugEditorMode}
            setDrugEditorMode={setDrugEditorMode}
            drugEditorData={drugEditorData}
            setDrugEditorData={setDrugEditorData}
            handleConfirmLaunch={handleConfirmLaunch}
            handleRemoveBolusDrugByName={handleRemoveBolusDrugByName}
            setEditingBolusDrugName={setEditingBolusDrugName}
            setEditingBolusDrugsList={setEditingBolusDrugsList}
            handleRemoveInfusion={handleRemoveInfusion}
            setEditingInfusionId={setEditingInfusionId}
            setEditingInfusionData={setEditingInfusionData}
          />
        </div>
      </DraggablePanel>
    );
}
