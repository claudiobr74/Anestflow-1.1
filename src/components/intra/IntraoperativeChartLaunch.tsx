import React from "react";
import { DraggablePanel } from "../DraggablePanel";
import ClinicalChart from "../ClinicalChart";
import { useIntraUi } from "./IntraoperativeUiContext";

export default function IntraoperativeChartLaunch() {
  const {
    ficha, isDark, onTimeSelect, onUpdateDocument, selectedMinutes, theme, vitals
  } = useIntraUi();

    return (
      /* INTEGRATED VITAL PLOTTER */
      <DraggablePanel key="chart" id="chart" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="flex-1 min-h-[420px]">
          <ClinicalChart
            ficha={ficha}
            onTimeSelect={onTimeSelect}
            selectedMinutes={selectedMinutes}
            theme={theme}
            onAddVitalRecord={(record) => {
              onUpdateDocument((prev) => ({ vitals: [...(prev.vitals || []), record] }));
            }}
            onUpdateVitalRecord={(id, updates) => {
              onUpdateDocument((prev) => ({
                vitals: (prev.vitals || []).map(v => v.id === id ? { ...v, ...updates } : v)
              }));
            }}
            onRemoveVitalRecord={(id) => {
              onUpdateDocument((prev) => ({
                vitals: (prev.vitals || []).filter(v => v.id !== id)
              }));
            }}
            onUpdateVitalsList={(newVitals) => {
              onUpdateDocument(() => ({ vitals: newVitals }));
            }}
          />
        </div></DraggablePanel>
    );
}
