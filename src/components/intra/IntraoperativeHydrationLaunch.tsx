import React from "react";
import { ChevronUp, Droplets } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import HydrationPanel from "../HydrationPanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";

export default function IntraoperativeHydrationLaunch() {
  const {
    borderClass, cardClass, customFluidTime, fluidTimeMode, fluids, getIsExpanded, getTimeString, handleAddFluid, handleAddOutput, handleRemoveFluid, handleRemoveOutput, isDark, netBalance, newFluid, outputType, outputVal, outputs, setCustomFluidTime, setFluidTimeMode, setNewFluid, setOutputType, setOutputVal, togglePanel, totalInflow, totalOutflow
  } = useIntraUi();

    if (!getIsExpanded('hydration')) return <CollapsedPanelSquare panelId="hydration" icon={<Droplets className="w-6 h-6 text-blue-500" />} title="Líquidos" />;
    return (
      <DraggablePanel key="hydration" id="hydration" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('hydration')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <HydrationPanel 
            isDark={isDark}
            borderClass={borderClass}
            cardClass={cardClass}
            newFluid={newFluid}
            setNewFluid={setNewFluid}
            fluidTimeMode={fluidTimeMode}
            setFluidTimeMode={setFluidTimeMode}
            customFluidTime={customFluidTime}
            setCustomFluidTime={setCustomFluidTime}
            handleAddFluid={handleAddFluid}
            fluids={fluids}
            handleRemoveFluid={handleRemoveFluid}
            getTimeString={getTimeString}
            outputType={outputType}
            setOutputType={setOutputType}
            outputVal={outputVal}
            setOutputVal={setOutputVal}
            handleAddOutput={handleAddOutput}
            outputs={outputs}
            handleRemoveOutput={handleRemoveOutput}
            totalInflow={totalInflow}
            totalOutflow={totalOutflow}
            netBalance={netBalance}
          />
        </div>
      </DraggablePanel>
    );
}
