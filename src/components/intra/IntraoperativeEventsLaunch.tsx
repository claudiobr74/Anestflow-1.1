import React from "react";
import { FileText, ChevronUp } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";

export default function IntraoperativeEventsLaunch() {
  const {
    borderClass, cardClass, descriptionSummary, getIsExpanded, isDark, setIsNarrativeDrawerOpen, textHeadingClass, textMutedClass, togglePanel
  } = useIntraUi();

    if (!getIsExpanded('events')) return <CollapsedPanelSquare panelId="events" icon={<FileText className="w-6 h-6" />} title="Descrição e Eventos" />;
    return (
      <DraggablePanel key="events" id="events" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`${cardClass} p-5 rounded-lg border space-y-4 relative`}>
          <button onClick={() => togglePanel('events')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className={`flex items-center justify-between pb-2 border-b pr-8 ${borderClass}`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-5 h-5 ${isDark ? "text-orange-400" : "text-orange-600"}`} />
              <div>
                <h3 className={`font-bold text-sm ${textHeadingClass}`}>
                  Descrição e Eventos Clínicos
                </h3>
                <p className={`text-xs ${textMutedClass}`}>
                  Registro de intercorrências, tempos cirúrgicos adicionais e notas de evolução
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"}`}>
              {descriptionSummary}
            </span>
          </div>
          <button
             onClick={() => setIsNarrativeDrawerOpen(true)}
             className={`w-full py-4 rounded-lg border flex items-center justify-center gap-2 transition active:scale-[0.98] ${isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20" : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"}`}
           >
             <FileText className="w-5 h-5" />
             <span className="font-bold">Abrir Painel de Descrições e Eventos</span>
           </button>
        </div>
      </DraggablePanel>
    );
}
