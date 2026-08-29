import React from "react";
import { EquipmentConfig } from "../types";

interface SupportPanelProps {
  isDark: boolean;
  borderClass: string;
  selectClass: string;
  inputClass: string;
  getSelectedTechnique: () => string;
  handleTechniqueChange: (val: string) => void;
  technique: any;
  handleTechniqueOtherTextChange: (val: string) => void;
  equipmentConfig: any;
  handleEquipmentToggle: (key: keyof EquipmentConfig) => void;
  handleEquipmentOtherTextChange: (val: string) => void;
  peripheralAccesses: any[];
  currentPeripheralCount: number;
  handlePeripheralCountChange: (val: number) => void;
  handleUpdatePeripheralAccessItem: (id: string, updates: any) => void;
  currentCentralSite: string;
  handleVascularAccessUpdate: (updates: any) => void;
  currentHasIncidents: boolean;
  currentIncidentsText: string;
}

export default function SupportPanel({
  isDark,
  borderClass,
  selectClass,
  inputClass,
  getSelectedTechnique,
  handleTechniqueChange,
  technique,
  handleTechniqueOtherTextChange,
  equipmentConfig,
  handleEquipmentToggle,
  handleEquipmentOtherTextChange,
  peripheralAccesses,
  currentPeripheralCount,
  handlePeripheralCountChange,
  handleUpdatePeripheralAccessItem,
  currentCentralSite,
  handleVascularAccessUpdate,
  currentHasIncidents,
  currentIncidentsText,
}: SupportPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {/* TIPO DE ANESTESIA */}
      <div className="space-y-3">
        <h4 className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
          Tipo de Anestesia
        </h4>
        <div className="space-y-2">
          <select
            value={getSelectedTechnique()}
            onChange={(e) => handleTechniqueChange(e.target.value)}
            className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-semibold transition ${selectClass}`}
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

          {getSelectedTechnique() === "Outra" && (
            <input
              type="text"
              value={technique.other}
              onChange={(e) => handleTechniqueOtherTextChange(e.target.value)}
              placeholder="Descreva a técnica..."
              className={`w-full text-xs px-3 py-2 border rounded-lg outline-none font-semibold transition ${inputClass}`}
            />
          )}
        </div>
      </div>

      {/* EQUIPAMENTOS E MATERIAIS */}
      <div className="space-y-3">
        <h4 className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          Equipamentos e Materiais
        </h4>
        
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
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
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

      {/* ACESSO VENOSO */}
      <div className="space-y-3">
        <h4 className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
          Acesso Venoso
        </h4>

        <div className="space-y-2 text-xs">
          {/* Peripheral Access Block */}
          <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-2`}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase">Acesso Periférico</span>
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
                      <label className="text-xs font-semibold text-slate-400 uppercase block">Tipo</label>
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
                      <label className="text-xs font-semibold text-slate-400 uppercase block">Calibre</label>
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
                    <label className="text-xs font-semibold text-slate-400 uppercase block">Local da Punção</label>
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
            <span className="text-xs font-bold text-slate-400 uppercase block">Via Central</span>
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
              <span className="text-xs font-bold text-slate-400 uppercase">Intercorrências de Acesso</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleVascularAccessUpdate({ hasIncidents: false })}
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    !currentHasIncidents
                      ? "bg-emerald-500 text-white"
                      : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500"
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
                      : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500"
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
    </div>
  );
}
