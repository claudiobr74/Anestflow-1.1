import React from "react";
import { DraggablePanel } from "../DraggablePanel";
import ClinicalChart from "../ClinicalChart";
import { useIntraUi } from "./IntraoperativeUiContext";
import { isUuid } from "../../lib/procedureMapper";
import { voidClinicalItem } from "../../lib/clinicalChildren";

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
                vitals: (prev.vitals || []).map((v) =>
                  v.id === id
                    ? {
                        ...v,
                        voidedAt: v.voidedAt || new Date().toISOString(),
                        voidReason: v.voidReason || "Lançamento removido no gráfico"
                      }
                    : v
                )
              }));
              if (isUuid(ficha.id) && isUuid(id)) {
                void voidClinicalItem("vitals", id, "Lançamento removido no gráfico").catch((err) => {
                  console.warn("[chart] void de vital:", err);
                });
              }
            }}
            onUpdateVitalsList={(newVitals) => {
              onUpdateDocument(() => ({ vitals: newVitals }));
            }}
          />
        </div></DraggablePanel>
    );
}
