import fs from 'fs';

const modalCode = `
import React, { useState } from "react";
import { X, Layers, Play, Plus, Edit2, Trash2, Save, ChevronLeft } from "lucide-react";
import { AnesthesiaTemplate } from "../types";
import { PRESET_TEMPLATES } from "./AnesthesiaTemplatesModalData"; // I will extract the presets to another file

interface Props {
  onClose: () => void;
  onApplyTemplate: (template: AnesthesiaTemplate) => void;
  theme?: "light" | "dark" | "dark-clean";
}

export default function AnesthesiaTemplatesModal({ onClose, onApplyTemplate, theme = "light" }: Props) {
  const isDark = theme === "dark" || theme === "dark-clean";
  const [templates, setTemplates] = useState<AnesthesiaTemplate[]>(() => {
    try {
      const stored = localStorage.getItem("anesthesia_templates");
      if (stored) {
        return [...PRESET_TEMPLATES, ...JSON.parse(stored)];
      }
    } catch (e) {}
    return PRESET_TEMPLATES;
  });

  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editingTemplate, setEditingTemplate] = useState<Partial<AnesthesiaTemplate>>({});

  const saveTemplates = (newTemplates: AnesthesiaTemplate[]) => {
    setTemplates(newTemplates);
    const custom = newTemplates.filter(t => t.userId !== "system");
    localStorage.setItem("anesthesia_templates", JSON.stringify(custom));
  };

  const handleCreateNew = () => {
    setEditingTemplate({
      id: "tpl-" + Date.now(),
      userId: "user",
      name: "",
      description: "",
      bolusDrugs: [],
      continuousInfusions: [],
      events: []
    });
    setMode("edit");
  };

  const handleEdit = (tpl: AnesthesiaTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    setMode("edit");
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este template?")) {
      saveTemplates(templates.filter(t => t.id !== id));
    }
  };

  const handleSave = () => {
    if (!editingTemplate.name) return alert("Dê um nome ao template.");
    const tpl = { ...editingTemplate, updatedAt: new Date().toISOString() } as AnesthesiaTemplate;
    if (!tpl.createdAt) tpl.createdAt = new Date().toISOString();
    
    const existingIdx = templates.findIndex(t => t.id === tpl.id);
    let newTemplates = [...templates];
    if (existingIdx >= 0) {
      newTemplates[existingIdx] = tpl;
    } else {
      newTemplates.push(tpl);
    }
    saveTemplates(newTemplates);
    setMode("list");
  };

  if (mode === "edit") {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className={\`w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl border transition-all max-h-[85vh] \${
          isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        }\`}>
          <div className={\`flex items-center justify-between p-4 border-b \${isDark ? "border-zinc-800" : "border-slate-100"}\`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setMode("list")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold">
                {editingTemplate.name ? "Editar Template" : "Novo Template"}
              </h2>
            </div>
          </div>
          
          <div className="p-4 overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-bold uppercase mb-1 block">Nome do Template</label>
              <input 
                className={\`w-full p-2 rounded-lg border \${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200"}\`}
                value={editingTemplate.name || ""}
                onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                placeholder="Ex: Anestesia Geral Balanceada..."
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase mb-1 block">Descrição</label>
              <input 
                className={\`w-full p-2 rounded-lg border \${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200"}\`}
                value={editingTemplate.description || ""}
                onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})}
                placeholder="Ex: Para cirurgias abdominais..."
              />
            </div>
            
            <div className="p-3 border rounded-xl border-dashed border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium text-center">
                Nota: A edição de itens detalhados (drogas, infusões) pelo editor completo será implementada em futuras atualizações. 
                Por enquanto, personalize o nome e descrição, ou crie cópias dos presets.
              </p>
            </div>
          </div>

          <div className={\`p-4 border-t flex justify-end gap-3 \${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50"}\`}>
            <button onClick={() => setMode("list")} className="px-4 py-2 text-sm font-bold border rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition flex items-center gap-2">
              <Save className="w-4 h-4" />
              Salvar Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className={\`w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl border transition-all max-h-[85vh] \${
        isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
      }\`}>
        <div className={\`flex items-center justify-between p-4 border-b \${isDark ? "border-zinc-800" : "border-slate-100"}\`}>
          <div className="flex items-center gap-2">
            <Layers className={\`w-5 h-5 \${isDark ? "text-indigo-400" : "text-indigo-600"}\`} />
            <h2 className="text-lg font-bold">Templates de Anestesia</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateNew} className={\`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 \${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}\`}>
              <Plus className="w-4 h-4" />
              Novo
            </button>
            <button onClick={onClose} className={\`p-1.5 rounded-full transition \${isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"}\`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <p className={\`text-sm \${isDark ? "text-zinc-400" : "text-slate-500"}\`}>
            Selecione um template para carregar os fármacos, infusões e eventos padronizados para o momento atual (ou tempo 0).
          </p>

          <div className="grid grid-cols-1 gap-3">
            {templates.map(tpl => (
              <div key={tpl.id} className={\`p-4 rounded-xl border flex flex-col gap-3 transition \${
                isDark ? "bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/50" : "bg-slate-50 border-slate-200 hover:border-indigo-300"
              }\`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{tpl.name}</h3>
                      {tpl.userId === "system" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold uppercase tracking-wider">Sistema</span>
                      )}
                    </div>
                    <p className={\`text-xs mt-1 \${isDark ? "text-zinc-400" : "text-slate-500"}\`}>{tpl.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tpl.userId !== "system" && (
                      <>
                        <button onClick={() => handleEdit(tpl)} className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(tpl.id)} className="p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        onApplyTemplate(tpl);
                        onClose();
                      }}
                      className={\`px-3 py-1.5 flex items-center gap-1.5 text-sm font-bold rounded-lg transition \${
                        isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }\`}
                    >
                      <Play className="w-4 h-4" />
                      Aplicar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tpl.bolusDrugs?.map((d, i) => (
                    <span key={i} className={\`text-[10px] px-2 py-0.5 rounded-full \${isDark ? "bg-zinc-800 text-zinc-300" : "bg-white border text-slate-600"}\`}>
                      {d.name} ({d.dose}{d.unit})
                    </span>
                  ))}
                  {tpl.continuousInfusions?.map((d, i) => (
                    <span key={i} className={\`text-[10px] px-2 py-0.5 rounded-full \${isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-50 border text-indigo-700"}\`}>
                      {d.name} {d.rate ? \`(\${d.rate} \${d.rateUnit})\` : ''}
                    </span>
                  ))}
                  {tpl.inhalationAgents?.map((d, i) => (
                    <span key={i} className={\`text-[10px] px-2 py-0.5 rounded-full \${isDark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 border text-emerald-700"}\`}>
                      Gás: {d.name}
                    </span>
                  ))}
                  {tpl.events?.map((e, i) => (
                    <span key={i} className={\`text-[10px] px-2 py-0.5 rounded-full \${isDark ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 border text-amber-700"}\`}>
                      {e.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/AnesthesiaTemplatesModal.tsx', modalCode);

const dataCode = `
import { AnesthesiaTemplate } from "../types";

export const PRESET_TEMPLATES: AnesthesiaTemplate[] = [
  {
    id: "tpl-1",
    userId: "system",
    name: "Anestesia Geral Balanceada",
    description: "Indução padrão com Propofol, Fentanil, Rocurônio e manutenção inalatória.",
    isPublic: true,
    bolusDrugs: [
      { name: "Fentanil", dose: "3", unit: "mcg/kg", route: "EV" },
      { name: "Propofol", dose: "2", unit: "mg/kg", route: "EV" },
      { name: "Rocurônio", dose: "0.6", unit: "mg/kg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" }
    ],
    inhalationAgents: [
      { name: "Sevoflurano" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" },
      { name: "Intubação Orotraqueal", category: "Via Aérea" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-2",
    userId: "system",
    name: "Raquianestesia",
    description: "Bloqueio subaracnóideo com Bupivacaína pesada e opioides.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "15", unit: "mg", route: "Subaracnóideo" },
      { name: "Morfina", dose: "100", unit: "mcg", route: "Subaracnóideo" },
      { name: "Midazolam", dose: "2", unit: "mg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" }
    ],
    events: [
      { name: "Punção Subaracnóidea", category: "Bloqueio" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-3",
    userId: "system",
    name: "Geral Venosa Total (TIVA)",
    description: "Indução e manutenção com Propofol e Remifentanil (TCI).",
    isPublic: true,
    continuousInfusions: [
      { name: "Propofol", concentration: "10", rate: "3.0", rateUnit: "mcg/ml", route: "EV" },
      { name: "Remifentanil", concentration: "50", rate: "4.0", rateUnit: "ng/ml", route: "EV" }
    ],
    bolusDrugs: [
      { name: "Rocurônio", dose: "0.6", unit: "mg/kg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" },
      { name: "Intubação Orotraqueal", category: "Via Aérea" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];
`;
fs.writeFileSync('src/components/AnesthesiaTemplatesModalData.ts', dataCode);
