import React from "react";
import { HandHelping, ChevronUp, ChevronDown } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import CollapsedPanelSquare from "./CollapsedPanelSquare";
import type { EquipmentConfig } from "../../types";

export default function IntraoperativeSupportLaunch() {
  const {
    airway, borderClass, cardClass, currentCentralSite, currentHasIncidents, currentIncidentsText, currentPeripheralCount, equipmentConfig, expandedSupportPanels, getIsExpanded, getSelectedTechnique, handleAirwayUpdate, handleEquipmentOtherTextChange, handleEquipmentToggle, handlePeripheralCountChange, handleTechniqueChange, handleTechniqueOtherTextChange, handleUpdatePeripheralAccessItem, handleVascularAccessUpdate, inputClass, isDark, peripheralAccesses, selectClass, setExpandedSupportPanels, technique, togglePanel
  } = useIntraUi();

    if (!getIsExpanded('support')) return <CollapsedPanelSquare panelId="support" icon={<HandHelping className="w-6 h-6" />} title="Suporte" />;
    return (
      <DraggablePanel key="support" id="support" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`${cardClass} p-5 rounded-lg border space-y-4 relative`}>
          <button onClick={() => togglePanel('support')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className={`flex items-center gap-2 pb-2 border-b pr-8 ${borderClass}`}>
            <HandHelping className={`w-5 h-5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />
            <div>
              <h3 className={`font-bold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
                Suporte, Acessos e Técnica Anestésica
              </h3>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-400 dark:text-zinc-500"}`}>
                Registre as técnicas, os equipamentos de apoio e os acessos vasculares utilizados no intraoperatório
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* TIPO DE ANESTESIA */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['tipo']
                ? isDark
                  ? "bg-teal-950/20 border-teal-900/60 shadow-xs"
                  : "bg-teal-50/40 border-teal-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'tipo': !prev['tipo'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Tipo de Anestesia
                  </h4>
                </div>
                {expandedSupportPanels['tipo'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['tipo'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2">
                    <select
                      value={getSelectedTechnique()}
                      onChange={(e) => handleTechniqueChange(e.target.value)}
                      className={`w-full text-xs px-3 py-2.5 rounded-lg border outline-none font-semibold transition ${selectClass}`}
                    >
                      <option value="Geral Balanceada">Geral Balanceada</option>
                      <option value="Geral Venosa">Geral Venosa</option>
                      <option value="Geral Inalatória">Geral Inalatória</option>
                      <option value="Sedação">Sedação</option>
                      <option value="Local">Local</option>
                      <option value="Raquianestesia">Raquianestesia</option>
                      <option value="Peridural">Peridural</option>
                      <option value="Bloqueio Regional de Plexo/Nervo">Bloqueio Regional de Plexo/Nervo</option>
                      <option value="Combinada Geral + Regional">Combinada Geral + Regional</option>
                      <option value="Outra">Outra técnica...</option>
                    </select>

                    {(getSelectedTechnique() as string) === "Outra" && (
                      <input
                        type="text"
                        value={technique.other}
                        onChange={(e) => handleTechniqueOtherTextChange(e.target.value)}
                        placeholder="Descreva a técnica..."
                        className={`w-full text-xs px-3 py-2.5 border rounded-lg outline-none font-semibold transition ${inputClass}`}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* VIA AÉREA & VENTILAÇÃO */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['via']
                ? isDark
                  ? "bg-cyan-950/20 border-cyan-900/60 shadow-xs"
                  : "bg-cyan-50/40 border-cyan-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'via': !prev['via'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Via Aérea & Ventilação
                  </h4>
                </div>
                {expandedSupportPanels['via'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['via'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2 text-xs">
                    {/* Modo de Ventilação */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Modo de Ventilação</span>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {[
                          { value: "Espontânea", label: "Espontânea" },
                          { value: "VCM", label: "VCM" },
                          { value: "VCV", label: "VCV" },
                          { value: "PCV", label: "PCV" }
                        ].map((m) => {
                          const active = (airway.ventilationMode === m.value) || (!airway.ventilationMode && m.value === "Espontânea");
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => handleAirwayUpdate({ ventilationMode: m.value as any })}
                              className={`px-2 py-1 rounded text-center font-bold transition ${
                                active
                                  ? isDark
                                    ? "bg-cyan-950/40 border border-cyan-500 text-cyan-300"
                                    : "bg-cyan-50 border border-cyan-400 text-cyan-800"
                                  : isDark
                                    ? "bg-zinc-950 border border-zinc-850 text-zinc-500 hover:border-zinc-700"
                                    : "bg-white border border-slate-200 text-slate-500 dark:text-zinc-400 hover:border-slate-300"
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dispositivo de Via Aérea */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-2`}>
                      <div>
                        <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block mb-1">Dispositivo</label>
                        <select
                          value={airway.ventilationType || "Espontânea"}
                          onChange={(e) => {
                            const newType = e.target.value as any;
                            // Clear device size when changing type, as sizes are different
                            handleAirwayUpdate({ ventilationType: newType, deviceSize: "" });
                          }}
                          className={`w-full text-xs px-2 py-1.5 rounded border outline-none font-semibold ${selectClass}`}
                        >
                          <option value="Espontânea">Espontânea (Nenhum)</option>
                          <option value="Máscara Facial">Máscara Facial / Cateter O₂</option>
                          <option value="Cânula Nasal">Cânula Nasal / Óculos O₂</option>
                          <option value="Cânula Orofaríngea">Cânula Orofaríngea (Guedel)</option>
                          <option value="Dispositivo Supraglótico">Máscara Laríngea</option>
                          <option value="Intubação Orotraqueal">Intubação Orotraqueal</option>
                          <option value="Intubação Nasotraqueal">Intubação Nasotraqueal</option>
                          <option value="Tubo Duplo Lúmen">Tubo Duplo Lúmen</option>
                          <option value="Traqueostomia">Traqueostomia</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>

                      {/* Detalhes do Dispositivo */}
                      {airway.ventilationType !== "Espontânea" && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-dashed border-slate-200/40">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Calibre / Nº</label>
                            <input
                              type="text"
                              list="airway-device-sizes"
                              value={airway.deviceSize || ""}
                              onChange={(e) => handleAirwayUpdate({ deviceSize: e.target.value })}
                              placeholder="Selecione ou digite"
                              className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                            />
                            <datalist id="airway-device-sizes">
                              {(airway.ventilationType === "Máscara Facial" ? ["0", "1", "2", "3", "4", "5", "6"] :
                                airway.ventilationType === "Cânula Nasal" ? ["Recém-nascido", "Infantil", "Pediátrico", "Adulto", "P", "M", "G"] :
                                airway.ventilationType === "Cânula Orofaríngea" ? ["000", "00", "0", "1", "2", "3", "4", "5", "6"] :
                                airway.ventilationType === "Dispositivo Supraglótico" ? ["1", "1.5", "2", "2.5", "3", "4", "5", "6"] :
                                (airway.ventilationType?.includes("Intubação") || airway.ventilationType === "Intubação Orotraqueal") ? ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"] :
                                airway.ventilationType === "Tubo Duplo Lúmen" ? ["26", "28", "32", "35", "37", "39", "41"] :
                                airway.ventilationType === "Traqueostomia" ? ["4", "5", "6", "7", "8", "9", "10"] : []).map(size => (
                                <option key={size} value={size} />
                              ))}
                            </datalist>
                          </div>
                          
                          {/* Depth / Fixação - Only for tube intubations */}
                          {(airway.ventilationType?.includes("Intubação") || airway.ventilationType?.includes("Tubo") || airway.ventilationType === "Intubação Orotraqueal") ? (
                            <div>
                              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Fixação (cm)</label>
                              <input
                                type="text"
                                value={airway.fixationDepth || ""}
                                onChange={(e) => handleAirwayUpdate({ fixationDepth: e.target.value })}
                                placeholder="Ex: 22"
                                className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-end">
                              <span className="text-xs text-slate-400 dark:text-zinc-500 italic">Dispositivo supraglótico/facial</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cuff details for tubes */}
                      {(airway.ventilationType?.includes("Intubação") || airway.ventilationType?.includes("Tubo") || airway.ventilationType === "Traqueostomia" || airway.ventilationType === "Intubação Orotraqueal") && (
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                            <input
                              type="checkbox"
                              checked={!!airway.hasCuff}
                              onChange={(e) => handleAirwayUpdate({ hasCuff: e.target.checked })}
                              className="rounded border-zinc-300 accent-indigo-600"
                            />
                            Com Cuff
                          </label>
                          {airway.hasCuff && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={airway.cuffPressure ?? 20}
                                onChange={(e) => handleAirwayUpdate({ cuffPressure: parseInt(e.target.value) || 0 })}
                                className={`w-14 text-xs px-1 py-0.5 border rounded text-center outline-none ${inputClass}`}
                              />
                              <span className="text-xs text-zinc-400 font-bold uppercase">cmH₂O</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Facilidade / Predição de Dificuldade */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Facilidade de Intubação</span>
                      <div className="flex gap-2">
                        {[
                          { value: "Fácil", label: "Fácil" },
                          { value: "Difícil", label: "Difícil" }
                        ].map((opt) => {
                          const active = airway.predictionEasy === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleAirwayUpdate({ predictionEasy: opt.value as any })}
                              className={`flex-1 py-1 rounded text-xs font-bold text-center transition ${
                                active
                                  ? opt.value === "Fácil"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-rose-500 text-white animate-pulse"
                                  : isDark
                                    ? "bg-zinc-800 text-zinc-400 border border-zinc-800"
                                    : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Intercorrências de Via Aérea */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Intercorrências (V.A.)</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAirwayUpdate({ incidents: "" })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              !airway.incidents
                                ? "bg-emerald-500 text-white"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!airway.incidents) {
                                handleAirwayUpdate({ incidents: "Sim" });
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              airway.incidents
                                ? "bg-rose-500 text-white animate-pulse"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Sim
                          </button>
                        </div>
                      </div>

                      {airway.incidents && (
                        <input
                          type="text"
                          value={airway.incidents === "Sim" ? "" : airway.incidents}
                          onChange={(e) => handleAirwayUpdate({ incidents: e.target.value })}
                          placeholder="Quais intercorrências ocorreram?"
                          className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* EQUIPAMENTOS E MATERIAIS */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['equipamentos']
                ? isDark
                  ? "bg-indigo-950/20 border-indigo-900/60 shadow-xs"
                  : "bg-indigo-50/40 border-indigo-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'equipamentos': !prev['equipamentos'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Equipamentos e Materiais
                  </h4>
                </div>
                {expandedSupportPanels['equipamentos'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['equipamentos'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "infusionPump", label: "Bomba Infusão" },
                      { key: "urinaryCatheter", label: "Sonda Vesical" },
                      { key: "gastricTube", label: "Sonda Gástrica" },
                      { key: "thermalBlanket", label: "Manta Térmica" },
                      { key: "thermalMattress", label: "Colchão Térmico" },
                      { key: "defibrillator", label: "Desfibrilador" }
                    ].map((item) => {
                      const active = !!(equipmentConfig as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleEquipmentToggle(item.key as keyof EquipmentConfig)}
                          className={`px-2.5 py-1.5 rounded-lg border text-left font-semibold transition ${
                            active
                              ? isDark
                                ? "bg-indigo-950/40 border-indigo-500 text-indigo-300"
                                : "bg-indigo-50 border-indigo-400 text-indigo-800"
                              : isDark
                                ? "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                : "bg-slate-50 border-slate-200 text-slate-500 dark:text-zinc-400 hover:border-slate-300"
                          }`}
                        >
                          {item.label} {active ? "✓" : ""}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={equipmentConfig.other || ""}
                    onChange={(e) => handleEquipmentOtherTextChange(e.target.value)}
                    placeholder="Outro material (ex: manta, etc)..."
                    className={`w-full text-xs px-3 py-1.5 border rounded-lg outline-none font-semibold transition ${inputClass}`}
                  />
                </div>
              )}
            </div>

            {/* ACESSO VENOSO */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['acessos']
                ? isDark
                  ? "bg-violet-950/20 border-violet-900/60 shadow-xs"
                  : "bg-violet-50/40 border-violet-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'acessos': !prev['acessos'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Acesso Venoso
                  </h4>
                </div>
                {expandedSupportPanels['acessos'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['acessos'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2 text-xs">
                    {/* Peripheral Access Block */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-2`}>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Acesso Periférico</span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={currentPeripheralCount}
                            onChange={(e) => handlePeripheralCountChange(parseInt(e.target.value))}
                            className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${selectClass}`}
                          >
                            <option value={0}>0 acessos</option>
                            <option value={1}>1 acesso</option>
                            <option value={2}>2 acessos</option>
                            <option value={3}>3 acessos</option>
                            <option value={4}>4 acessos</option>
                          </select>
                        </div>
                      </div>

                      {peripheralAccesses.map((acc, index) => (
                        <div key={acc.id} className="space-y-1.5 border-t border-dashed border-slate-200/60 pt-2 first:border-0 first:pt-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-500 uppercase">Linha #{index + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Tipo */}
                              <div className="space-y-0.5">
                                <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Tipo</label>
                                <input
                                  type="text"
                                  value={acc.type}
                                  onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { type: e.target.value })}
                                  placeholder="Ex: Venoso Periférico"
                                  className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                                />
                              </div>
                              {/* Calibre */}
                              <div className="space-y-0.5">
                                <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Calibre</label>
                                <input
                                  type="text"
                                  value={acc.gauge}
                                  onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { gauge: e.target.value })}
                                  placeholder="Ex: 18G, 16G"
                                  className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                                />
                              </div>
                            </div>
                            {/* Local */}
                            <div className="space-y-0.5">
                              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Local da Punção</label>
                              <input
                                type="text"
                                value={acc.site}
                                onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { site: e.target.value })}
                                placeholder="Ex: Fossa Cubital"
                                className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Central Access Block */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Via Central</span>
                      <select
                        value={currentCentralSite === "Nenhum" ? "Nenhum" : currentCentralSite}
                        onChange={(e) => handleVascularAccessUpdate({ centralSite: e.target.value })}
                        className={`w-full text-xs px-2 py-1 rounded border font-semibold ${selectClass}`}
                      >
                        <option value="Nenhum">Sem acesso central</option>
                        <option value="Veia Jugular Interna Direita (VJI D)">VJI Direita</option>
                        <option value="Veia Jugular Interna Esquerda (VJI E)">VJI Esquerda</option>
                        <option value="Veia Subclávia Direita (VSC D)">Subclávia Direita</option>
                        <option value="Veia Subclávia Esquerda (VSC E)">Subclávia Esquerda</option>
                        <option value="Veia Femoral Direita">Femoral Direita</option>
                        <option value="Veia Femoral Esquerda">Femoral Esquerda</option>
                        <option value="Outra via">Outra via central</option>
                      </select>
                      {currentCentralSite !== "Nenhum" && currentCentralSite !== "Veia Jugular Interna Direita (VJI D)" && currentCentralSite !== "Veia Jugular Interna Esquerda (VJI E)" && currentCentralSite !== "Veia Subclávia Direita (VSC D)" && currentCentralSite !== "Veia Subclávia Esquerda (VSC E)" && currentCentralSite !== "Veia Femoral Direita" && currentCentralSite !== "Veia Femoral Esquerda" && (
                        <input
                          type="text"
                          value={currentCentralSite}
                          onChange={(e) => handleVascularAccessUpdate({ centralSite: e.target.value })}
                          placeholder="Especifique a via central..."
                          className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>

                    {/* Intercorrências de Acesso */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Intercorrências de Acesso</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleVascularAccessUpdate({ hasIncidents: false })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              !currentHasIncidents
                                ? "bg-emerald-500 text-white"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVascularAccessUpdate({ hasIncidents: true })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              currentHasIncidents
                                ? "bg-rose-500 text-white animate-pulse"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Sim
                          </button>
                        </div>
                      </div>

                      {currentHasIncidents && (
                        <input
                          type="text"
                          value={currentIncidentsText}
                          onChange={(e) => handleVascularAccessUpdate({ incidentsText: e.target.value })}
                          placeholder="Quais intercorrências ocorreram?"
                          className={`w-full text-xs px-2 py-1.5 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DraggablePanel>
    );
}
