import React from "react";
import { DraggablePanel } from "../DraggablePanel";
import { useIntraUi } from "./IntraoperativeUiContext";

export default function CollapsedPanelSquare({
  panelId,
  icon,
  title,
}: {
  panelId: string;
  icon: React.ReactNode;
  title: string;
}) {
  const { isDark, togglePanel } = useIntraUi();
  return (
      <DraggablePanel key={panelId} id={panelId} isDark={isDark} className="w-[calc(50%-0.625rem)] xl:w-full max-w-full">
        <div 
          onClick={() => togglePanel(panelId)}
          className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center p-3 gap-2 cursor-pointer border hover:scale-[1.02] active:scale-95 transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-zinc-200/80 text-zinc-700 hover:bg-slate-50 shadow-xs"
          }`}
        >
          <div className={`p-3 rounded-full ${isDark ? "bg-zinc-800/80 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
            {icon}
          </div>
          <span className="text-xs sm:text-xs font-bold text-center leading-tight">
            {title}
          </span>
        </div>
      </DraggablePanel>
    );
}
