
import React, { useState, useEffect } from "react";
import { X, Layers, Play, Plus, Edit2, Trash2, Save, ChevronLeft, Search, Syringe, Droplet, Activity, Droplets, Wind, Link, ShieldAlert} from "lucide-react";
import { AnesthesiaTemplate, BolusDrug, ContinuousInfusion } from "../types";
import { PRESET_TEMPLATES } from "./AnesthesiaTemplatesModalData";
import { FAVORITE_DRUGS } from "../mockData";

const EVENT_SUGGESTIONS: Record<string, string[]> = {
  "Procedimento": [
    "Indução Anestésica",
    "Incisão Cirúrgica",
    "Nascimento",
    "Esvaziamento do Pneumoperitônio",
    "Fim da Cirurgia"
  ],
  "Via Aérea": [
    "Intubação Orotraqueal",
    "Intubação Traqueal",
    "Extubação",
    "Máscara Laríngea",
    "Laringoscopia"
  ],
  "Bloqueio": [
    "Punção Subaracnóidea",
    "Punção Epidural",
    "Bloqueio Peribulbar",
    "Bloqueio de Plexo Braquial",
    "Bloqueio Regional Realizado"
  ],
  "Acesso": [
    "Acesso Venoso Periférico",
    "Acesso Venoso Central",
    "Punção Arterial"
  ],
  "Marcador Temporal": [
    "Entrada em Sala",
    "Início da Anestesia",
    "Início do Garroteamento",
    "Término do Garroteamento",
    "Saída de Sala"
  ],
  "Intercorrência": [
    "Hipotensão",
    "Broncoespasmo",
    "Arritmia",
    "Sangramento Importante"
  ],
  "Outro": [
    "Posicionamento Prono",
    "Despertar"
  ]
};

interface Props {
  onClose: () => void;
  onApplyTemplate: (template: AnesthesiaTemplate) => void;
  theme?: "light" | "dark" | "dark-clean";
  initialReviewTemplate?: AnesthesiaTemplate | null;
}

export default function AnesthesiaTemplatesModal({ onClose, onApplyTemplate, theme = "light", initialReviewTemplate }: Props) {
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

  const [mode, setMode] = useState<"list" | "edit" | "review">(initialReviewTemplate ? "review" : "list");
  const [reviewTemplate, setReviewTemplate] = useState<AnesthesiaTemplate | null>(initialReviewTemplate || null);
  const [selectedItems, setSelectedItems] = useState<{
    bolusDrugs: boolean[];
    continuousInfusions: boolean[];
    inhalationAgents: boolean[];
    events: boolean[];
  }>(initialReviewTemplate ? {
    bolusDrugs: new Array(initialReviewTemplate.bolusDrugs?.length || 0).fill(true),
    continuousInfusions: new Array(initialReviewTemplate.continuousInfusions?.length || 0).fill(true),
    inhalationAgents: new Array(initialReviewTemplate.inhalationAgents?.length || 0).fill(true),
    events: new Array(initialReviewTemplate.events?.length || 0).fill(true)
  } : {
    bolusDrugs: [],
      continuousInfusions: [],
      inhalationAgents: [],
      events: [],
      fluids: [],
      accesses: [],
      blocks: [],
      airway: undefined
  });
  const [editingTemplate, setEditingTemplate] = useState<AnesthesiaTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "system" | "user">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGas, setSelectedGas] = useState("Sevorane");
  const [newEventCategory, setNewEventCategory] = useState("Cirúrgico");
  const [newEventName, setNewEventName] = useState("");
  const [customEventName, setCustomEventName] = useState("");

  const categorizedDrugs = React.useMemo(() => {
    const cats = new Set(FAVORITE_DRUGS.map(d => d.category || "Outros"));
    const sortedCats = Array.from(cats).sort();
    const groups: Record<string, string[]> = {};
    sortedCats.forEach(cat => {
      groups[cat] = FAVORITE_DRUGS.filter(d => (d.category || "Outros") === cat).map(d => d.name);
    });
    return { sortedCats, groups };
  }, []);

  const saveTemplates = (newTemplates: AnesthesiaTemplate[]) => {
    setTemplates(newTemplates);
    const customOnly = newTemplates.filter(t => t.userId !== "system");
    try {
      localStorage.setItem("anesthesia_templates", JSON.stringify(customOnly));
    } catch (e) {}
  };

  const allAvailableDrugs = React.useMemo(() => FAVORITE_DRUGS.map(d => ({
    name: d.name,
    defaultDose: d.defaultDose,
    defaultUnit: d.defaultUnit,
    defaultRoute: d.defaultRoute || "EV"
  })), []);

  const filteredTemplates = templates.filter(tpl => {
    if (activeTab === "system" && tpl.userId !== "system") return false;
    if (activeTab === "user" && tpl.userId === "system") return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q);
    }
    return true;
  });

  useEffect(() => {
    if (initialReviewTemplate) {
      setMode("review");
      setReviewTemplate(initialReviewTemplate);
      setSelectedItems({
        bolusDrugs: new Array(initialReviewTemplate.bolusDrugs?.length || 0).fill(true),
        continuousInfusions: new Array(initialReviewTemplate.continuousInfusions?.length || 0).fill(true),
        inhalationAgents: new Array(initialReviewTemplate.inhalationAgents?.length || 0).fill(true),
        events: new Array(initialReviewTemplate.events?.length || 0).fill(true),
        fluids: new Array(initialReviewTemplate.fluids?.length || 0).fill(true),
        accesses: new Array(initialReviewTemplate.accesses?.length || 0).fill(true),
        blocks: new Array(initialReviewTemplate.blocks?.length || 0).fill(true),
        airway: !!initialReviewTemplate.airway
      });
    }
  }, [initialReviewTemplate]);

  const handleCreateNew = () => {
    setEditingTemplate({
      id: crypto.randomUUID(),
      userId: "user",
      name: "",
      description: "",
      bolusDrugs: [],
      continuousInfusions: [],
      inhalationAgents: [],
      events: [],
      fluids: [],
      accesses: [],
      blocks: [],
      airway: undefined
    });
    setMode("edit");
  };

  const handleEdit = (tpl: AnesthesiaTemplate) => {
    setEditingTemplate({ ...tpl, id: tpl.userId === "system" ? crypto.randomUUID() : tpl.id });
    setMode("edit");
  };

  const handleOpenReview = (tpl: AnesthesiaTemplate) => {
    setReviewTemplate(tpl);
    setSelectedItems({
      bolusDrugs: new Array(tpl.bolusDrugs?.length || 0).fill(true),
      continuousInfusions: new Array(tpl.continuousInfusions?.length || 0).fill(true),
      inhalationAgents: new Array(tpl.inhalationAgents?.length || 0).fill(true),
      events: new Array(tpl.events?.length || 0).fill(true),
      fluids: new Array(tpl.fluids?.length || 0).fill(true),
      accesses: new Array(tpl.accesses?.length || 0).fill(true),
      blocks: new Array(tpl.blocks?.length || 0).fill(true),
      airway: !!tpl.airway
    });
    setMode("review");
  };

  const handleConfirmReview = () => {
    if (!reviewTemplate) return;
    
    const finalTemplate: AnesthesiaTemplate = {
      ...reviewTemplate,
      bolusDrugs: reviewTemplate.bolusDrugs?.filter((_, i) => selectedItems.bolusDrugs[i]) || [],
      continuousInfusions: reviewTemplate.continuousInfusions?.filter((_, i) => selectedItems.continuousInfusions[i]) || [],
      inhalationAgents: reviewTemplate.inhalationAgents?.filter((_, i) => selectedItems.inhalationAgents[i]) || [],
      events: reviewTemplate.events?.filter((_, i) => selectedItems.events[i]) || [],
      fluids: reviewTemplate.fluids?.filter((_, i) => selectedItems.fluids[i]) || [],
      accesses: reviewTemplate.accesses?.filter((_, i) => selectedItems.accesses[i]) || [],
      blocks: reviewTemplate.blocks?.filter((_, i) => selectedItems.blocks[i]) || [],
      airway: selectedItems.airway ? reviewTemplate.airway : undefined
    };
    
    onApplyTemplate(finalTemplate);
    onClose();
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

  const renderEditForm = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Nome do Template</label>
            <input 
              type="text" 
              value={editingTemplate.name || ""}
              onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
              placeholder="Ex: Colecistectomia Laparoscópica"
            />
          </div>
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Descrição</label>
            <textarea 
              value={editingTemplate.description || ""}
              onChange={(e) => setEditingTemplate({...editingTemplate, description: e.target.value})}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none h-16 ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
              placeholder="Breve descrição dos fármacos..."
            />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-bold mb-3 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>Fármacos em Bolus</h4>
          <div className="space-y-2 mb-3">
            {editingTemplate.bolusDrugs?.map((d, i) => (
              <div key={i} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
                <span className="flex-1 min-w-[120px] text-sm font-semibold">{d.name}</span>
                <input 
                  type="number" 
                  value={d.dose} 
                  onChange={(e) => {
                    const newDrugs = [...(editingTemplate.bolusDrugs || [])];
                    newDrugs[i].dose = e.target.value;
                    setEditingTemplate({...editingTemplate, bolusDrugs: newDrugs});
                  }}
                  className={`w-20 px-2 py-1 rounded text-sm border ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}
                />
                <span className="text-xs tabular-nums">{d.unit}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{d.route}</span>
                <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 tabular-nums">T(min)</span>
                  <input
                    type="number"
                    value={d.timeOffset || 0}
                    onChange={(e) => {
                      const newDrugs = [...(editingTemplate.bolusDrugs || [])];
                      newDrugs[i].timeOffset = parseInt(e.target.value) || 0;
                      setEditingTemplate({...editingTemplate, bolusDrugs: newDrugs});
                    }}
                    className={`w-12 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newDrugs = [...(editingTemplate.bolusDrugs || [])];
                    newDrugs.splice(i, 1);
                    setEditingTemplate({...editingTemplate, bolusDrugs: newDrugs});
                  }}
                  className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select id="new-drug-select" className={`flex-1 px-2 py-1.5 rounded-lg text-sm border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
              {categorizedDrugs.sortedCats.map(cat => (
                <optgroup key={cat} label={cat}>
                  {categorizedDrugs.groups[cat].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button 
              onClick={() => {
                const select = document.getElementById("new-drug-select") as HTMLSelectElement;
                if (!select) return;
                const drug = allAvailableDrugs.find(d => d.name === select.value);
                if (drug) {
                  const newDrugs = [...(editingTemplate.bolusDrugs || []), {
                    name: drug.name,
                    dose: drug.defaultDose?.toString() || "0",
                    unit: drug.defaultUnit,
                    route: drug.defaultRoute
                  }];
                  setEditingTemplate({...editingTemplate, bolusDrugs: newDrugs});
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-100 text-indigo-700"}`}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-bold mb-3 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>Infusões Contínuas</h4>
          <div className="space-y-2 mb-3">
            {editingTemplate.continuousInfusions?.map((d, i) => (
              <div key={i} className={`flex flex-col gap-2 p-2 rounded-lg border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[120px] text-sm font-semibold">{d.name}</span>
                  <input 
                    type="number" 
                    value={d.rate} 
                    onChange={(e) => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf[i].rate = e.target.value;
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    placeholder="Taxa"
                    className={`w-16 px-2 py-1 rounded text-sm border ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}
                  />
                  <select 
                    value={d.rateUnit} 
                    onChange={(e) => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf[i].rateUnit = e.target.value;
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    className={`w-24 px-1 py-1 rounded text-xs border ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-slate-800"}`}
                  >
                    <option value="mcg/kg/min">mcg/kg/min</option>
                    <option value="mcg/kg/h">mcg/kg/h</option>
                    <option value="mg/kg/min">mg/kg/min</option>
                    <option value="mg/kg/h">mg/kg/h</option>
                    <option value="mg/h">mg/h</option>
                    <option value="ml/h">ml/h</option>
                    <option value="mcg/min">mcg/min</option>
                  </select>
                  <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                    <span className="text-xs text-zinc-500 tabular-nums">T(min)</span>
                    <input
                      type="number"
                      value={d.timeOffset || 0}
                      onChange={(e) => {
                        const newInf = [...(editingTemplate.continuousInfusions || [])];
                        newInf[i].timeOffset = parseInt(e.target.value) || 0;
                        setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                      }}
                      className={`w-10 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf.splice(i, 1);
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={d.concentration || ""}
                    onChange={(e) => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf[i].concentration = e.target.value;
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    placeholder="Conc. (ex: 10mg/ml)"
                    className={`flex-1 min-w-[100px] px-2 py-1 rounded text-xs border ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}
                  />
                  <input
                    type="text"
                    value={d.diluent || ""}
                    onChange={(e) => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf[i].diluent = e.target.value;
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    placeholder="Diluente (ex: SF 0.9% 50ml)"
                    className={`flex-1 min-w-[120px] px-2 py-1 rounded text-xs border ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}
                  />
                  <input
                    type="number"
                    value={d.totalVolumePrepared || ""}
                    onChange={(e) => {
                      const newInf = [...(editingTemplate.continuousInfusions || [])];
                      newInf[i].totalVolumePrepared = parseInt(e.target.value) || 0;
                      setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
                    }}
                    placeholder="Vol (ml)"
                    className={`w-16 px-2 py-1 rounded text-xs border ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select id="new-infusion-select" className={`flex-1 px-2 py-1.5 rounded-lg text-sm border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
              {categorizedDrugs.sortedCats.map(cat => (
                <optgroup key={cat} label={cat}>
                  {categorizedDrugs.groups[cat].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button 
              onClick={() => {
                const select = document.getElementById("new-infusion-select") as HTMLSelectElement;
                if (!select) return;
                const drug = allAvailableDrugs.find(d => d.name === select.value);
                
                let defaultRateUnit = "mcg/kg/min";
                let defaultConc = "1 mg/ml";
                if (drug) {
                  if (drug.defaultUnit === "mg") {
                    defaultRateUnit = "mg/h";
                    defaultConc = `1 mg/ml`;
                  } else if (drug.defaultUnit === "ml") {
                    defaultRateUnit = "ml/h";
                    defaultConc = `1 ml/ml`;
                  } else if (drug.defaultUnit === "mcg") {
                    defaultRateUnit = "mcg/kg/min";
                    defaultConc = `50 mcg/ml`;
                  }
                }

                const newInf = [...(editingTemplate.continuousInfusions || []), {
                  name: select.value,
                  concentration: defaultConc,
                  rate: "0",
                  rateUnit: defaultRateUnit,
                  diluent: "Puro", totalVolumePrepared: 50
                }];
                setEditingTemplate({...editingTemplate, continuousInfusions: newInf});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-100 text-indigo-700"}`}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>

        {/* Agentes Inalatórios */}
        <div className={`p-4 rounded-lg border ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-bold mb-3 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Agentes Inalatórios (Gases)</h4>
          <div className="space-y-2 mb-3">
            {(editingTemplate.inhalationAgents || []).map((g, i) => (
              <div key={i} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
                <span className="flex-1 min-w-[100px] text-sm font-semibold">{g.name}</span>
                
                <div className="flex items-center gap-1 border rounded px-1.5 py-1 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 tabular-nums">Conc(%)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={g.inspiredConc || ""}
                    onChange={(e) => {
                      const newGases = [...(editingTemplate.inhalationAgents || [])];
                      newGases[i].inspiredConc = parseFloat(e.target.value) || 0;
                      setEditingTemplate({...editingTemplate, inhalationAgents: newGases});
                    }}
                    className={`w-12 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                  />
                </div>
                
                <div className="flex items-center gap-1 border rounded px-1.5 py-1 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 tabular-nums">FGF(L/min)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={g.flowO2 || ""}
                    onChange={(e) => {
                      const newGases = [...(editingTemplate.inhalationAgents || [])];
                      newGases[i].flowO2 = parseFloat(e.target.value) || 0;
                      setEditingTemplate({...editingTemplate, inhalationAgents: newGases});
                    }}
                    className={`w-10 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                  />
                </div>

                <div className="flex items-center gap-1 border rounded px-1.5 py-1 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 tabular-nums">T(min)</span>
                  <input
                    type="number"
                    value={g.timeOffset || 0}
                    onChange={(e) => {
                      const newGases = [...(editingTemplate.inhalationAgents || [])];
                      newGases[i].timeOffset = parseInt(e.target.value) || 0;
                      setEditingTemplate({...editingTemplate, inhalationAgents: newGases});
                    }}
                    className={`w-10 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newGases = [...(editingTemplate.inhalationAgents || [])];
                    newGases.splice(i, 1);
                    setEditingTemplate({...editingTemplate, inhalationAgents: newGases});
                  }}
                  className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedGas}
              onChange={(e) => setSelectedGas(e.target.value)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-sm border ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
            >
              <option value="Sevoflurano">Sevoflurano</option>
              <option value="Desflurano">Desflurano</option>
              <option value="Isoflurano">Isoflurano</option>
              <option value="Óxido Nitroso">Óxido Nitroso</option>
              <option value="Oxigênio (O₂)">Oxigênio (O₂)</option>
              <option value="Ar Comprimido">Ar Comprimido</option>
            </select>
            <button 
              onClick={() => {
                const alreadyExists = (editingTemplate.inhalationAgents || []).some(g => g.name === selectedGas);
                if (alreadyExists) return;
                const isGas = selectedGas === "Oxigênio (O₂)" || selectedGas === "Ar Comprimido";
                const newGases = [...(editingTemplate.inhalationAgents || []), { name: selectedGas, inspiredConc: isGas ? undefined : 2.0, flowO2: isGas ? 2.0 : undefined, timeOffset: 0 }];
                setEditingTemplate({...editingTemplate, inhalationAgents: newGases});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isDark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </div>

        {/* Eventos / Procedimentos do Intraoperatório */}
        <div className={`p-4 rounded-lg border ${isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
          <h4 className={`text-sm font-bold mb-3 ${isDark ? "text-amber-400" : "text-amber-600"}`}>Procedimentos e Eventos</h4>
          <div className="space-y-2 mb-3">
            {(editingTemplate.events || []).map((e, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-semibold">{e.name}</span>
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Categoria: {e.category}</span>
                </div>
                <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 tabular-nums">T(min)</span>
                  <input
                    type="number"
                    value={e.timeOffset || 0}
                    onChange={(ev) => {
                      const newEvents = [...(editingTemplate.events || [])];
                      newEvents[i].timeOffset = parseInt(ev.target.value) || 0;
                      setEditingTemplate({...editingTemplate, events: newEvents});
                    }}
                    className={`w-12 px-1 text-xs bg-transparent outline-none text-center ${isDark ? "text-white" : "text-slate-800"}`}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newEvents = [...(editingTemplate.events || [])];
                    newEvents.splice(i, 1);
                    setEditingTemplate({...editingTemplate, events: newEvents});
                  }}
                  className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={`block text-xs font-bold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Categoria</label>
                <select 
                  value={newEventCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setNewEventCategory(cat);
                    const list = EVENT_SUGGESTIONS[cat] || [];
                    setNewEventName(list[0] || "custom");
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs border ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                >
                  <option value="Procedimento">Procedimento</option>
                  <option value="Via Aérea">Via Aérea</option>
                  <option value="Bloqueio">Bloqueio</option>
                  <option value="Acesso">Acesso</option>
                  <option value="Marcador Temporal">Marcador Temporal</option>
                  <option value="Intercorrência">Intercorrência</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={`block text-xs font-bold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Evento / Procedimento</label>
                <select 
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs border ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                >
                  {(EVENT_SUGGESTIONS[newEventCategory] || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="custom">Outro (Digitar...)</option>
                </select>
              </div>
            </div>

            {newEventName === "custom" && (
              <div className="space-y-1">
                <label className={`block text-xs font-bold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Nome Personalizado</label>
                <input 
                  type="text"
                  placeholder="Ex: Dissecção Arterial"
                  value={customEventName}
                  onChange={(e) => setCustomEventName(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs border ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                />
              </div>
            )}

            <button 
              onClick={() => {
                const finalName = newEventName === "custom" ? customEventName.trim() : newEventName;
                if (!finalName) return;
                const newEvents = [...(editingTemplate.events || []), {
                  name: finalName,
                  category: newEventCategory as any
                }];
                setEditingTemplate({...editingTemplate, events: newEvents});
                setCustomEventName("");
              }}
              className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${isDark ? "bg-amber-900/40 text-amber-300 hover:bg-amber-900/60" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Evento / Procedimento
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (mode === "review" && reviewTemplate) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className={`w-full max-w-2xl rounded-lg flex flex-col shadow-lg border transition-all max-h-[85vh] ${
          isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setMode("list")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Revisão: <span className={isDark ? "text-indigo-400" : "text-indigo-600"}>{reviewTemplate.name}</span>
              </h2>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-full transition ${isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto space-y-6">
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
              Selecione os itens que deseja aplicar ao prontuário.
            </p>

            {/* Bolus Drugs */}
            {reviewTemplate.bolusDrugs && reviewTemplate.bolusDrugs.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Syringe className="w-4 h-4" /> Fármacos em Bolus
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.bolusDrugs.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.bolusDrugs!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.bolusDrugs[i]} onChange={() => {
                        const newArr = [...selectedItems.bolusDrugs];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, bolusDrugs: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="text-xs opacity-70 tabular-nums mt-0.5 flex gap-2">
                          <span>Dose: {d.dose}{d.unit}</span>
                          <span>Via: {d.route}</span>
                          {d.timeOffset !== undefined && d.timeOffset !== 0 && <span>T: {d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}min</span>}
                          {d.inspiredConc !== undefined && <span>Conc: {d.inspiredConc}%</span>}
                          {d.flowO2 !== undefined && <span>FGF(O2): {d.flowO2}L/min</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Continuous Infusions */}
            {reviewTemplate.continuousInfusions && reviewTemplate.continuousInfusions.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Droplet className="w-4 h-4" /> Infusões Contínuas
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.continuousInfusions.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.continuousInfusions!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.continuousInfusions[i]} onChange={() => {
                        const newArr = [...selectedItems.continuousInfusions];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, continuousInfusions: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="text-xs opacity-70 tabular-nums mt-0.5 flex gap-2">
                          <span>Taxa: {d.rate} {d.rateUnit}</span>
                          {d.concentration && <span>Conc: {d.concentration}</span>}
                          {d.diluent && <span>Diluente: {d.diluent}</span>}
                          {d.timeOffset !== undefined && d.timeOffset !== 0 && <span>T: {d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}min</span>}
                          {d.inspiredConc !== undefined && <span>Conc: {d.inspiredConc}%</span>}
                          {d.flowO2 !== undefined && <span>FGF(O2): {d.flowO2}L/min</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Gases */}
            {reviewTemplate.inhalationAgents && reviewTemplate.inhalationAgents.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Wind className="w-4 h-4" /> Agentes Inalatórios
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.inhalationAgents.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.inhalationAgents!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.inhalationAgents[i]} onChange={() => {
                        const newArr = [...selectedItems.inhalationAgents];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, inhalationAgents: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="text-xs opacity-70 tabular-nums mt-0.5 flex gap-2">
                          {d.timeOffset !== undefined && d.timeOffset !== 0 && <span>T: {d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}min</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {reviewTemplate.events && reviewTemplate.events.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Activity className="w-4 h-4" /> Eventos
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.events.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.events!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.events[i]} onChange={() => {
                        const newArr = [...selectedItems.events];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, events: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="text-xs opacity-70 tabular-nums mt-0.5 flex gap-2">
                          <span>Categoria: {d.category}</span>
                          {d.timeOffset !== undefined && d.timeOffset !== 0 && <span>T: {d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}min</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            

            {/* Fluids */}
            {reviewTemplate.fluids && reviewTemplate.fluids.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Droplets className="w-4 h-4" /> Líquidos e Hemoderivados
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.fluids.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.fluids!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.fluids[i]} onChange={() => {
                        const newArr = [...selectedItems.fluids];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, fluids: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="text-xs opacity-70 mt-0.5">{d.type} - {d.volume}ml</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {/* Airway */}
            {reviewTemplate.airway && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Wind className="w-4 h-4" /> Via Aérea
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                    <label className={`flex items-center gap-3 p-3 cursor-pointer transition ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.airway} onChange={() => {
                        setSelectedItems({...selectedItems, airway: !selectedItems.airway});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{reviewTemplate.airway.ventilationType}</div>
                        {reviewTemplate.airway.deviceInfo && <div className="text-xs opacity-70 mt-0.5">{reviewTemplate.airway.deviceInfo}</div>}
                      </div>
                    </label>
                </div>
              </div>
            )}
            
            {/* Accesses */}
            {reviewTemplate.accesses && reviewTemplate.accesses.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <Link className="w-4 h-4" /> Acessos
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.accesses.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.accesses!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.accesses[i]} onChange={() => {
                        const newArr = [...selectedItems.accesses];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, accesses: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.type} ({d.site})</div>
                        {d.gauge && <div className="text-xs opacity-70 mt-0.5">Calibre: {d.gauge}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {/* Blocks */}
            {reviewTemplate.blocks && reviewTemplate.blocks.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  <ShieldAlert className="w-4 h-4" /> Bloqueios
                </h4>
                <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
                  {reviewTemplate.blocks.map((d, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 cursor-pointer transition ${i !== reviewTemplate.blocks!.length - 1 ? (isDark ? "border-b border-zinc-800/50" : "border-b border-slate-100") : ""} ${isDark ? "hover:bg-zinc-800/50" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selectedItems.blocks[i]} onChange={() => {
                        const newArr = [...selectedItems.blocks];
                        newArr[i] = !newArr[i];
                        setSelectedItems({...selectedItems, blocks: newArr});
                      }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{d.type} - {d.site}</div>
                        {d.drugs && <div className="text-xs opacity-70 mt-0.5">{d.drugs}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {(!reviewTemplate.bolusDrugs?.length && !reviewTemplate.continuousInfusions?.length && !reviewTemplate.inhalationAgents?.length && !reviewTemplate.events?.length && !reviewTemplate.fluids?.length && !reviewTemplate.accesses?.length && !reviewTemplate.blocks?.length && !reviewTemplate.airway) && (
              <div className={`text-center py-8 text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                Este template não possui itens para aplicar.
              </div>
            )}
          </div>
          
          <div className={`p-4 border-t flex justify-end gap-2 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50"}`}>
            <button onClick={() => setMode("list")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${isDark ? "hover:bg-zinc-800 text-zinc-300" : "hover:bg-slate-200 text-slate-700"}`}>
              Cancelar
            </button>
            <button 
              onClick={handleConfirmReview} 
              className={`px-6 py-2 flex items-center gap-2 rounded-lg text-sm font-bold transition ${isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
            >
              <Play className="w-4 h-4" /> Confirmar Aplicação
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className={`w-full max-w-2xl rounded-lg flex flex-col shadow-lg border transition-all max-h-[85vh] ${
          isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
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
            {renderEditForm()}
          </div>

          <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50"}`}>
            <button onClick={() => setMode("list")} className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition flex items-center gap-2">
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
      <div className={`w-full max-w-2xl rounded-lg flex flex-col shadow-lg border transition-all max-h-[85vh] ${
        isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
          <div className="flex items-center gap-2">
            <Layers className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            <h2 className="text-lg font-bold">Templates de Anestesia</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateNew} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}>
              <Plus className="w-4 h-4" />
              Novo
            </button>
            <button onClick={onClose} className={`p-1.5 rounded-full transition ${isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b flex flex-col gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-zinc-500" : "text-slate-400"}`} />
            <input 
              type="text" 
              placeholder="Buscar templates por nome ou descrição..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? "bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"}`}
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab("all")} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "all" ? (isDark ? "bg-indigo-600 text-white" : "bg-indigo-600 text-white") : (isDark ? "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200")}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveTab("system")} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "system" ? (isDark ? "bg-indigo-600 text-white" : "bg-indigo-600 text-white") : (isDark ? "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200")}`}
            >
              Padrões (Sistema)
            </button>
            <button 
              onClick={() => setActiveTab("user")} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "user" ? (isDark ? "bg-indigo-600 text-white" : "bg-indigo-600 text-white") : (isDark ? "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200")}`}
            >
              Meus Templates
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className={`text-center py-8 text-sm ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
              Nenhum template encontrado com esses filtros.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredTemplates.map(tpl => (
              <div key={tpl.id} className={`p-4 rounded-lg border flex flex-col gap-3 transition ${
                isDark ? "bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/50" : "bg-slate-50 border-slate-200 hover:border-indigo-300"
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{tpl.name}</h3>
                      {tpl.userId === "system" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold uppercase tracking-wider">Sistema</span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>{tpl.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(tpl)} className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition" title={tpl.userId === "system" ? "Duplicar para Editar" : "Editar"}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {tpl.userId !== "system" && (
                      <button onClick={() => handleDelete(tpl.id)} className="p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenReview(tpl)}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-sm font-bold rounded-lg transition ${
                        isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      Aplicar
                    </button>
                  </div>
                </div>
                  <div className="flex flex-col gap-2 mt-3">
                  {/* Bolus Drugs */}
                  {tpl.bolusDrugs && tpl.bolusDrugs.length > 0 && (
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded-md ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-slate-100 text-slate-500"}`}>
                        <Syringe className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {tpl.bolusDrugs.map((d, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-medium border ${isDark ? "bg-zinc-800/50 border-zinc-700 text-zinc-300" : "bg-white border-slate-200 text-slate-600 shadow-sm"}`}>
                            {d.name} <span className="opacity-60 ml-0.5 tabular-nums">{d.dose}{d.unit}</span>
                            {d.timeOffset !== undefined && d.timeOffset !== 0 && (
                              <span className="ml-1 opacity-75 tabular-nums text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">T{d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continuous Infusions */}
                  {tpl.continuousInfusions && tpl.continuousInfusions.length > 0 && (
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded-md ${isDark ? "bg-indigo-900/50 text-indigo-400" : "bg-indigo-50 text-indigo-500"}`}>
                        <Droplet className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {tpl.continuousInfusions.map((d, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-medium border ${isDark ? "bg-indigo-950/50 border-indigo-800 text-indigo-300" : "bg-indigo-50/50 border-indigo-100 text-indigo-700 shadow-sm"}`}>
                            {d.name} {d.rate && <span className="opacity-60 ml-0.5 tabular-nums">{d.rate} {d.rateUnit}</span>} {d.concentration && <span className="opacity-60 ml-0.5 tabular-nums text-xs">({d.concentration})</span>}
                            {d.timeOffset !== undefined && d.timeOffset !== 0 && (
                              <span className="ml-1 opacity-75 tabular-nums text-xs bg-indigo-200 dark:bg-indigo-900 px-1 rounded">T{d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inhalation Agents */}
                  {tpl.inhalationAgents && tpl.inhalationAgents.length > 0 && (
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded-md ${isDark ? "bg-emerald-900/50 text-emerald-400" : "bg-emerald-50 text-emerald-500"}`}>
                        <Wind className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {tpl.inhalationAgents.map((d, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-medium border ${isDark ? "bg-emerald-950/50 border-emerald-800 text-emerald-300" : "bg-emerald-50/50 border-emerald-100 text-emerald-700 shadow-sm"}`}>
                            {d.name} {d.inspiredConc !== undefined && <span className="opacity-60 ml-0.5 tabular-nums text-xs">({d.inspiredConc}%)</span>}
                            {d.timeOffset !== undefined && d.timeOffset !== 0 && (
                              <span className="ml-1 opacity-75 tabular-nums text-xs bg-emerald-200 dark:bg-emerald-900 px-1 rounded">T{d.timeOffset > 0 ? `+${d.timeOffset}` : d.timeOffset}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Events */}
                  {tpl.events && tpl.events.length > 0 && (
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded-md ${isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-50 text-amber-500"}`}>
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {tpl.events.map((e, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-medium border ${isDark ? "bg-amber-950/50 border-amber-800 text-amber-300" : "bg-amber-50/50 border-amber-100 text-amber-700 shadow-sm"}`}>
                            {e.name}
                            {e.timeOffset !== undefined && e.timeOffset !== 0 && (
                              <span className="ml-1 opacity-75 tabular-nums text-xs bg-amber-200 dark:bg-amber-900 px-1 rounded">T{e.timeOffset > 0 ? `+${e.timeOffset}` : e.timeOffset}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
