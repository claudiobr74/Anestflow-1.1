import React, { useState, useEffect } from "react";
import { AnesthesiaDocument, AnestheticNarrativeLaunch } from "../types";
import { X, Check, Plus, Edit2, Copy, RotateCcw, FileText, Trash2, Star, Download, Upload, Clock, User, Shield, AlertCircle, FileDown, Eye, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { SYSTEM_MODELS, compileNarrativeDraft, AnesthesiaModel } from "../utils/narrativeTemplates";
import { invokeAiFunction } from "../lib/aiFunctions";
import { toAIClinicalContext } from "../lib/aiClinicalContext";

interface AnesthesiaDescriptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ficha: AnesthesiaDocument;
  onUpdateDocument: (doc: Partial<AnesthesiaDocument>) => void;
  theme?: "light" | "dark" | "dark-clean";
  startAiSupervisor?: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor?: (reason: string) => void;
}

export default function AnesthesiaDescriptionDrawer({
  isOpen,
  onClose,
  ficha,
  onUpdateDocument,
  theme = "light",
  startAiSupervisor,
  stopAiSupervisor
}: AnesthesiaDescriptionDrawerProps) {
  const isDark = theme === "dark" || theme === "dark-clean";

  // State for active narrative launches
  const launches: AnestheticNarrativeLaunch[] = ficha.narrativeLaunches || [];

  // Active form states
  const [launchType, setLaunchType] = useState<"Descrição Principal" | "Evento Cronológico">("Descrição Principal");
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [editingText, setEditingText] = useState<string>("");
  const [eventCategory, setEventCategory] = useState<string>("Entrada em sala");
  const [customEventTime, setCustomEventTime] = useState<string>("");
  const [eventTimeMode, setEventTimeMode] = useState<"now" | "custom">("now");

  // Models Management State
  const [models, setModels] = useState<AnesthesiaModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [favoriteModelId, setFavoriteModelId] = useState<string>("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState<string>("");
  const [editModelText, setEditModelText] = useState<string>("");
  const [editModelCategory, setEditModelCategory] = useState<"Geral" | "Regional" | "Local" | "Outro">("Outro");

  // Create New Model States
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelCategory, setNewModelCategory] = useState<"Geral" | "Regional" | "Local" | "Outro">("Outro");
  const [newModelText, setNewModelText] = useState("");

  // Editing existing launch state
  const [editingLaunchId, setEditingLaunchId] = useState<string | null>(null);
  const [editJustification, setEditJustification] = useState<string>("");
  const [editTempText, setEditTempText] = useState<string>("");

  // Tab state for the model manager vs custom launch
  const [activeTab, setActiveTab] = useState<"launch" | "models" | "preview">("launch");

  // Load and merge models from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("anesthesia_narrative_models");
    const fav = localStorage.getItem("anesthesia_favorite_model");
    if (fav) setFavoriteModelId(fav);

    if (saved) {
      try {
        const parsed: AnesthesiaModel[] = JSON.parse(saved);
        // Retain user models and filter out older system models
        const userModels = parsed.filter(m => !m.isSystem);
        // Merge latest SYSTEM_MODELS with user custom models
        setModels([...SYSTEM_MODELS, ...userModels]);
      } catch (e) {
        setModels(SYSTEM_MODELS);
      }
    } else {
      setModels(SYSTEM_MODELS);
    }
  }, []);

  // Save models to localStorage helper
  const saveModels = (updatedModels: AnesthesiaModel[]) => {
    setModels(updatedModels);
    localStorage.setItem("anesthesia_narrative_models", JSON.stringify(updatedModels));
  };

  // Preset Event Categories (Section 5.2)
  const PRESET_CATEGORIES = [
    "Entrada em sala",
    "Monitorização iniciada",
    "Acesso vascular",
    "Início da anestesia",
    "Indução",
    "Intubação",
    "Inserção de dispositivo supraglótico",
    "Bloqueio regional",
    "Mudança de posição",
    "Início da cirurgia",
    "Alteração ventilatória",
    "Início de infusão",
    "Coleta de exame",
    "Transfusão",
    "Intercorrência",
    "Tratamento realizado",
    "Término da cirurgia",
    "Extubação",
    "Término da anestesia",
    "Encaminhamento"
  ];

  // Load automatic narrative draft when techniques or pre-fill is clicked
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateDescriptionAI = async () => {
    setIsGeneratingAI(true);
    setEditingText("Analisando os dados do procedimento e gerando a descrição anestésica...");
    const controller = new AbortController();

    // Register with the AI Supervisor
    if (startAiSupervisor) {
      startAiSupervisor("Geração de Descrição", () => {
        controller.abort();
      });
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 55000); // 55s component-level safety timeout (letting central supervisor handle 60s)

    try {
      const data = await invokeAiFunction<{ description?: string }>(
        "generate-description",
        { document: toAIClinicalContext(ficha), models },
        controller.signal
      );
      clearTimeout(timeoutId);
      if (data.description) {
        setEditingText(data.description);
      } else {
        setEditingText("");
        alert("Não foi possível gerar a descrição.");
      }

      if (stopAiSupervisor) {
        stopAiSupervisor("Sucesso");
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      
      if (stopAiSupervisor) {
        stopAiSupervisor(e.name === "AbortError" ? "Interrompido por timeout do Supervisor" : `Erro: ${e.message || e}`);
      }

      if (e.name === "AbortError") {
        alert("O servidor de IA demorou muito para responder (limite de tempo atingido). Por favor, tente novamente.");
      } else {
        alert(e.message || "Falha de rede ao conectar com IA.");
      }
      setEditingText("");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAutoFill = () => {
    if (selectedTechniques.length === 0) {
      alert("Por favor, selecione pelo menos uma técnica anestésica para gerar a descrição.");
      return;
    }
    const compiled = compileNarrativeDraft(selectedTechniques, ficha);
    setEditingText(compiled);
  };

  // Toggle technique selection
  const handleToggleTechnique = (tech: string) => {
    let updated: string[];
    if (selectedTechniques.includes(tech)) {
      updated = selectedTechniques.filter(t => t !== tech);
    } else {
      updated = [...selectedTechniques, tech];
    }
    setSelectedTechniques(updated);

    // Auto-compile if updated is not empty
    if (updated.length > 0) {
      const compiled = compileNarrativeDraft(updated, ficha);
      setEditingText(compiled);
    } else {
      setEditingText("");
    }
  };

  // Handle template selection
  const handleSelectTemplate = (model: AnesthesiaModel) => {
    setSelectedModelId(model.id);
    // Parse techniques from the model name/category or use it directly
    setEditingText(model.templateText);
  };

  // Launch the narrative text onto the anesthesia chart
  const handleLaunch = () => {
    if (!editingText.trim()) {
      alert("O texto da descrição não pode ser vazio.");
      return;
    }

    // Capture date & time
    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];
    let currentTime = "";

    if (eventTimeMode === "now") {
      const h = String(today.getHours()).padStart(2, "0");
      const m = String(today.getMinutes()).padStart(2, "0");
      currentTime = `${h}:${m}`;
    } else {
      currentTime = customEventTime || "00:00";
    }

    const author = ficha.team?.anesthesiologistLead || "Dr. Cláudio Santos";
    const crm = ficha.team?.crmLead || "12345-SP";

    const newLaunch: AnestheticNarrativeLaunch = {
      id: `narrative-${Date.now()}`,
      date: currentDate,
      time: currentTime,
      author,
      crm,
      text: editingText,
      type: launchType,
      version: 1
    };

    // Add event to official timeline if Evento Cronológico is selected
    const updatedLaunches = [...launches, newLaunch];
    let updatedEvents = [...(ficha.events || [])];

    if (launchType === "Evento Cronológico") {
      updatedEvents.push({
        id: `ev-narrative-${Date.now()}`,
        name: `${eventCategory}: ${editingText.length > 50 ? editingText.substring(0, 50) + "..." : editingText}`,
        timestamp: `${currentDate}T${currentTime}:00.000Z`,
        category: "Outro",
        notes: editingText,
        user: author
      });
    }

    onUpdateDocument({
      narrativeLaunches: updatedLaunches,
      events: updatedEvents
    });

    // Reset editor
    setEditingText("");
    setSelectedTechniques([]);
    alert("Descrição lançada com sucesso!");
  };

  // Duplicate a launch
  const handleDuplicateLaunch = (launch: AnestheticNarrativeLaunch) => {
    const duplicated: AnestheticNarrativeLaunch = {
      ...launch,
      id: `narrative-dup-${Date.now()}`,
      version: 1,
      editedAt: undefined,
      editJustification: undefined
    };
    onUpdateDocument({
      narrativeLaunches: [...launches, duplicated]
    });
  };

  // Undo last launch
  const handleUndoLastLaunch = () => {
    if (launches.length === 0) return;
    const confirmUndo = window.confirm("Deseja realmente remover o último lançamento realizado?");
    if (confirmUndo) {
      const updated = [...launches];
      updated.pop();
      onUpdateDocument({
        narrativeLaunches: updated
      });
    }
  };

  // Start edit flow
  const handleStartEdit = (launch: AnestheticNarrativeLaunch) => {
    if (ficha.status === "Signed") {
      alert("A ficha já está assinada. Qualquer complemento deve ser feito por adendo (Adicionar Adendo).");
      return;
    }
    setEditingLaunchId(launch.id);
    setEditTempText(launch.text);
    setEditJustification("");
  };

  // Confirm edit with justification (Section 4)
  const handleConfirmEdit = () => {
    if (!editTempText.trim()) {
      alert("O texto não pode ser vazio.");
      return;
    }
    if (!editJustification.trim()) {
      alert("Por favor, preencha a justificativa da alteração.");
      return;
    }

    const updated = launches.map(l => {
      if (l.id === editingLaunchId) {
        return {
          ...l,
          text: editTempText,
          version: l.version + 1,
          editedAt: new Date().toISOString(),
          editJustification: editJustification
        };
      }
      return l;
    });

    onUpdateDocument({
      narrativeLaunches: updated
    });

    // Reset edit modal state
    setEditingLaunchId(null);
    setEditTempText("");
    setEditJustification("");
    alert("Lançamento alterado com sucesso!");
  };

  // Delete/Remove Launch
  const handleDeleteLaunch = (id: string) => {
    const confirmDel = window.confirm("Deseja remover este registro de forma permanente?");
    if (confirmDel) {
      onUpdateDocument({
        narrativeLaunches: launches.filter(l => l.id !== id)
      });
    }
  };

  // Add adendum posterior (Section 4 & 5.1 / 18)
  const handleAddAdendum = () => {
    const text = window.prompt("Digite o texto do adendo posterior:");
    if (!text || !text.trim()) return;

    const author = ficha.team?.anesthesiologistLead || "Dr. Cláudio Santos";
    const crm = ficha.team?.crmLead || "12345-SP";

    const newAdendum: AnestheticNarrativeLaunch = {
      id: `narrative-adendum-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().split(" ")[0].substring(0, 5),
      author,
      crm,
      text: `[ADENDO POSTERIOR] ${text}`,
      type: "Evento Cronológico",
      version: 1
    };

    onUpdateDocument({
      narrativeLaunches: [...launches, newAdendum]
    });
    alert("Adendo posterior anexado com sucesso!");
  };

  // MODEL MANAGEMENT FLOWS
  // Save/Create Personal Model
  const handleSaveAsPersonalModel = () => {
    if (!editingText.trim()) {
      alert("O texto está vazio. Preencha algo para salvar como modelo.");
      return;
    }
    const name = window.prompt("Dê um nome para o seu modelo pessoal:");
    if (!name || !name.trim()) return;

    const newModel: AnesthesiaModel = {
      id: `model-user-${Date.now()}`,
      name: name,
      category: "Outro",
      isSystem: false,
      isInstitutional: false,
      templateText: editingText
    };

    const updated = [...models, newModel];
    saveModels(updated);
    alert(`Modelo "${name}" salvo como favorito pessoal!`);
  };

  const handleCreateModel = () => {
    if (!newModelName.trim()) {
      alert("O nome do modelo não pode ser vazio.");
      return;
    }
    if (!newModelText.trim()) {
      alert("O texto do modelo não pode ser vazio.");
      return;
    }

    const newModel: AnesthesiaModel = {
      id: `model-user-${Date.now()}`,
      name: newModelName,
      category: newModelCategory,
      isSystem: false,
      isInstitutional: false,
      templateText: newModelText
    };

    const updated = [...models, newModel];
    saveModels(updated);

    // Reset form
    setNewModelName("");
    setNewModelCategory("Outro");
    setNewModelText("");
    setIsCreatingModel(false);

    alert(`Modelo "${newModelName}" criado com sucesso!`);
  };

  const handleDuplicateModel = (m: AnesthesiaModel) => {
    const newM: AnesthesiaModel = {
      ...m,
      id: `model-user-dup-${Date.now()}`,
      name: `${m.name} (Cópia)`,
      isSystem: false,
      isInstitutional: false
    };
    saveModels([...models, newM]);
  };

  const handleStartEditModel = (m: AnesthesiaModel) => {
    setEditingModelId(m.id);
    setEditModelName(m.name);
    setEditModelText(m.templateText);
    setEditModelCategory(m.category);
  };

  const handleSaveModelEdits = () => {
    if (!editModelName.trim()) {
      alert("O nome do modelo não pode ser vazio.");
      return;
    }
    const updated = models.map(item => 
      item.id === editingModelId 
        ? { ...item, name: editModelName, templateText: editModelText, category: editModelCategory } 
        : item
    );
    saveModels(updated);
    setEditingModelId(null);
  };

  const handleDeleteModel = (m: AnesthesiaModel) => {
    const confirmDel = window.confirm(`Deseja remover o modelo "${m.name}"?`);
    if (confirmDel) {
      saveModels(models.filter(item => item.id !== m.id));
    }
  };

  const handleSetFavoriteModel = (id: string) => {
    const newFav = favoriteModelId === id ? "" : id;
    setFavoriteModelId(newFav);
    localStorage.setItem("anesthesia_favorite_model", newFav);
  };

  const handleRestoreOriginals = () => {
    const confirmRestore = window.confirm("Deseja restaurar as configurações padrão e remover modelos personalizados?");
    if (confirmRestore) {
      setModels(SYSTEM_MODELS);
      localStorage.removeItem("anesthesia_narrative_models");
      localStorage.removeItem("anesthesia_favorite_model");
      setFavoriteModelId("");
    }
  };

  // Export Models to JSON File
  const handleExportModels = () => {
    const filtered = models.filter(m => !m.isSystem);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered, null, 2));
    const dlAnchorElem = document_dl_anchor();
    if (dlAnchorElem) {
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", "meus_modelos_anestesia.json");
      dlAnchorElem.click();
    }
  };

  // Import Models from JSON File
  const handleImportModels = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            // sanitize & prefix
            const sanitized = imported.map((m: any, i: number) => ({
              id: m.id || `imported-${Date.now()}-${i}`,
              name: m.name || "Modelo Importado",
              category: m.category || "Outro",
              templateText: m.templateText || "",
              isSystem: false,
              isInstitutional: false
            }));
            const updated = [...models, ...sanitized];
            saveModels(updated);
            alert("Modelos importados com sucesso!");
          } else {
            alert("Formato de arquivo inválido. Deve ser um array de modelos.");
          }
        } catch (err) {
          alert("Erro ao decodificar arquivo JSON.");
        }
      };
    }
  };

  const document_dl_anchor = () => {
    let elem = document.getElementById("model-dl-anchor");
    if (!elem) {
      elem = document.createElement("a");
      elem.id = "model-dl-anchor";
      elem.style.display = "none";
      document.body.appendChild(elem);
    }
    return elem;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-0 md:p-4" id="anesthesia-narrative-panel">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Main Full-screen container */}
      <div className={`relative w-full h-full md:rounded-lg flex flex-col shadow-sm transition-all duration-300 ${
        isDark ? "bg-zinc-950 text-zinc-100 border border-zinc-800" : "bg-white text-slate-900 border border-slate-200"
      }`}>
        
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide">Descrição da Anestesia e Eventos</h2>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                Registro narrativo e cronológico da técnica anestésica
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg hover:bg-slate-100/10 transition ${
            isDark ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-800"
          }`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className={`px-5 py-2 border-b flex gap-2 ${
          isDark ? "border-zinc-900 bg-zinc-950" : "border-slate-100 bg-slate-50"
        }`}>
          <button
            onClick={() => setActiveTab("launch")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "launch"
                ? "bg-sky-600 text-white"
                : isDark ? "text-zinc-400 hover:bg-zinc-900" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Lançar Descrição / Evento
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "models"
                ? "bg-sky-600 text-white"
                : isDark ? "text-zinc-400 hover:bg-zinc-900" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Meus Modelos e Favoritos
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "preview"
                ? "bg-sky-600 text-white"
                : isDark ? "text-zinc-400 hover:bg-zinc-900" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Visualização de Impressão (PDF)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "launch" && (
            <div className="space-y-4">
              
              {/* Type and Technique selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                    Tipo de Lançamento
                  </label>
                  <div className="flex rounded-lg border border-sky-500/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLaunchType("Descrição Principal")}
                      className={`px-3 py-1.5 text-xs font-bold transition ${
                        launchType === "Descrição Principal"
                          ? "bg-sky-600 text-white"
                          : isDark ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Descrição Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchType("Evento Cronológico")}
                      className={`px-3 py-1.5 text-xs font-bold transition ${
                        launchType === "Evento Cronológico"
                          ? "bg-sky-600 text-white"
                          : isDark ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Evento Cronológico
                    </button>
                  </div>
                </div>

                {launchType === "Descrição Principal" ? (
                  <div className={`p-4 rounded-lg border space-y-3 ${isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-slate-50/50 border-slate-200"}`}>
                    <label className={`text-xs font-bold block ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                      Selecionar Técnicas para Combinar Narrativa:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        "Anestesia geral",
                        "Anestesia geral balanceada",
                        "Anestesia geral inalatória",
                        "Anestesia local",
                        "Anestesia locorregional",
                        "Anestesia peridural",
                        "Anestesia peridural com cateter",
                        "Anestesia subaracnóidea",
                        "Sedação leve / consciente",
                        "Sedação profunda",
                        "Bloqueio combinado raqui-peridural (CSE)",
                        "Bloqueio de plexo braquial",
                        "Bloqueio de parede abdominal (TAP Block)",
                        "Bloqueio de membro inferior"
                      ].map(tech => {
                        const selected = selectedTechniques.includes(tech);
                        return (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => handleToggleTechnique(tech)}
                            className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg border transition text-left ${
                              selected
                                ? "bg-sky-500/10 border-sky-500 text-sky-500"
                                : isDark
                                  ? "bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:bg-zinc-900"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span>{tech}</span>
                            {selected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                        As técnicas selecionadas serão integradas sem repetir monitorizações ou acessos.
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoFill}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Recompilar Dados Ficha
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg border space-y-3.5 ${isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-slate-50/50 border-slate-200"}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={`text-xs font-bold block ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                          Categoria de Evento
                        </label>
                        <select
                          value={eventCategory}
                          onChange={(e) => {
                            setEventCategory(e.target.value);
                            setEditingText(`${e.target.value} realizada conforme protocolo.`);
                          }}
                          className={`w-full text-xs font-semibold rounded-lg border p-2 focus:outline-none focus:border-sky-500 ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          {PRESET_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        <label className={`text-xs font-bold block ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                          Horário do Evento
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEventTimeMode("now")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                              eventTimeMode === "now"
                                ? "bg-sky-600 border-sky-600 text-white"
                                : isDark
                                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            Agora
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEventTimeMode("custom");
                              if (!customEventTime) {
                                const d = new Date();
                                setCustomEventTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                              }
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                              eventTimeMode === "custom"
                                ? "bg-sky-600 border-sky-600 text-white"
                                : isDark
                                  ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            Escolher
                          </button>
                        </div>
                      </div>
                    </div>

                    {eventTimeMode === "custom" && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/20 border border-zinc-800">
                        <span className={`text-xs font-semibold flex items-center gap-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                          <Clock className="w-3.5 h-3.5 text-sky-500" />
                          Definir horário:
                        </span>
                        <input
                          type="time"
                          value={customEventTime}
                          onChange={(e) => setCustomEventTime(e.target.value)}
                          className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none focus:border-rose-500 ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Text Area Input Console */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                    Corpo do Texto Narrativo
                  </label>
                  <span className={`text-xs tabular-nums ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    Campos destacados [___] devem ser completados manualmente.
                  </span>
                </div>
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  placeholder="Escreva ou selecione uma técnica para compilar a narrativa da anestesia automaticamente..."
                  rows={8}
                  className={`w-full p-4 text-xs font-semibold leading-relaxed rounded-lg border focus:outline-none focus:border-sky-500 font-sans ${
                    isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600" : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"
                  }`}
                />
                
                <div className="flex justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateDescriptionAI}
                      disabled={isGeneratingAI}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                        isDark
                          ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400"
                          : "bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {isGeneratingAI ? "Gerando..." : "Gerar com IA (Automático)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAsPersonalModel}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                      isDark
                        ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    Salvar como Modelo Pessoal
                  </button>
                  </div>

                  <button
                    onClick={handleLaunch}
                    className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Lançar na Ficha Anestésica
                  </button>
                </div>
              </div>

              {/* Edit Launching Audit Modal Dialog */}
              {editingLaunchId && (
                <div className={`p-4 rounded-lg border space-y-3.5 transition-all ${
                  isDark ? "bg-amber-950/20 border-amber-800/40 text-amber-100" : "bg-amber-50/50 border-amber-200 text-amber-900"
                }`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Ajuste de Registro de Auditoria</span>
                  </div>
                  <textarea
                    value={editTempText}
                    onChange={(e) => setEditTempText(e.target.value)}
                    rows={4}
                    className={`w-full p-3 text-xs font-semibold rounded-lg border focus:outline-none focus:border-amber-500 ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold block">
                      Justificativa da Edição (Campo Obrigatório):
                    </label>
                    <input
                      type="text"
                      value={editJustification}
                      onChange={(e) => setEditJustification(e.target.value)}
                      placeholder="Ex: Correção de digitação / Adição de detalhe de intercorrência"
                      className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border focus:outline-none focus:border-amber-500 ${
                        isDark ? "bg-zinc-950 border-zinc-850 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLaunchId(null)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmEdit}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      Confirmar Alteração
                    </button>
                  </div>
                </div>
              )}

              {/* TIMELINE OF RECENT LAUNCHED WRITES (NÍVEL 2) */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center border-b pb-2 border-slate-200/40">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                    Linha do Tempo de Lançamentos ({launches.length})
                  </span>
                  <div className="flex gap-2">
                    {launches.length > 0 && (
                      <button
                        type="button"
                        onClick={handleUndoLastLaunch}
                        className={`text-xs font-bold px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                          isDark ? "bg-zinc-900 border-zinc-850 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <RotateCcw className="w-3 h-3 text-rose-500" />
                        Desfazer Último
                      </button>
                    )}
                    {ficha.status === "Signed" && (
                      <button
                        type="button"
                        onClick={handleAddAdendum}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Adendo
                      </button>
                    )}
                  </div>
                </div>

                {launches.length === 0 ? (
                  <div className={`text-center py-6 border border-dashed rounded-lg ${
                    isDark ? "border-zinc-800 text-zinc-500" : "border-slate-200 text-slate-400"
                  }`}>
                    <AlertCircle className="w-6 h-6 mx-auto mb-1.5 text-zinc-400/60" />
                    <p className="text-xs font-semibold">Nenhum texto lançado nesta ficha.</p>
                    <p className="text-xs">Use os modelos acima ou digite livremente para lançar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {launches.map((lnch) => (
                      <div
                        key={lnch.id}
                        className={`p-3.5 rounded-lg border space-y-2.5 transition relative ${
                          isDark ? "bg-zinc-900/40 border-zinc-850" : "bg-slate-50/50 border-slate-250/50"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                lnch.type === "Descrição Principal"
                                  ? "bg-sky-500/15 text-sky-500"
                                  : "bg-indigo-500/15 text-indigo-500"
                              }`}>
                                {lnch.type}
                              </span>
                              <span className={`text-xs tabular-nums font-bold ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                                {lnch.time}
                              </span>
                              {lnch.version > 1 && (
                                <span className="bg-amber-500/15 text-amber-500 text-xs font-bold px-1.5 py-0.5 rounded-sm">
                                  V{lnch.version} (Editado)
                                </span>
                              )}
                            </div>
                            <div className={`text-xs flex items-center gap-1 font-semibold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                              <User className="w-3 h-3" />
                              <span>{lnch.author} (CRM {lnch.crm})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEdit(lnch)}
                              className={`p-1.5 rounded-lg border hover:scale-105 transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                              title="Editar Lançamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicateLaunch(lnch)}
                              className={`p-1.5 rounded-lg border hover:scale-105 transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                              title="Duplicar"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLaunch(lnch.id)}
                              className={`p-1.5 rounded-lg border hover:scale-105 transition hover:border-rose-500 hover:text-rose-500 ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-100"
                              }`}
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className={`text-xs font-semibold leading-relaxed whitespace-pre-wrap ${
                          isDark ? "text-zinc-200" : "text-slate-800"
                        }`}>
                          {lnch.text}
                        </p>

                        {lnch.editJustification && (
                          <div className={`p-2 rounded bg-amber-500/5 border border-amber-500/10 text-xs space-y-0.5 ${
                            isDark ? "text-amber-400/80" : "text-amber-800/80"
                          }`}>
                            <span className="font-bold flex items-center gap-1 uppercase tracking-wider">
                              <Shield className="w-3 h-3 text-amber-500" /> Justificativa do Ajuste:
                            </span>
                            <span>"{lnch.editJustification}" (às {new Date(lnch.editedAt || "").toLocaleTimeString()})</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === "models" && (
            <div className="space-y-4">
              
              {/* Import/Export models toolbar */}
              <div className={`p-3.5 rounded-lg border flex justify-between items-center ${
                isDark ? "bg-zinc-900/40 border-zinc-850" : "bg-slate-50/50 border-slate-200"
              }`}>
                <div>
                  <h4 className="text-xs font-bold">Importação e Exportação</h4>
                  <p className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    Mova seus modelos pessoais sem incluir dados confidenciais de pacientes.
                  </p>
                </div>
                <div className="flex gap-2">
                  <label className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition ${
                    isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                    <Upload className="w-3.5 h-3.5 text-sky-500" />
                    <span>Importar</span>
                    <input type="file" accept=".json" onChange={handleImportModels} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={handleExportModels}
                    className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    Exportar
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreOriginals}
                    className={`px-2.5 py-1.5 border border-dashed rounded-lg text-xs font-bold flex items-center gap-1 text-rose-500 transition ${
                      isDark ? "bg-zinc-950/40 border-zinc-800 hover:bg-zinc-900" : "bg-white border-slate-200 hover:bg-rose-50/30"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Originais
                  </button>
                </div>
              </div>

              {/* Models List Console */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider block ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                    Modelos de Sistema, Institucionais e Pessoais
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingModel(!isCreatingModel)}
                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isCreatingModel ? "Fechar Formulário" : "Criar Novo Modelo"}
                  </button>
                </div>

                {/* Create New Model Form */}
                {isCreatingModel && (
                  <div className={`p-4 rounded-lg border-2 border-sky-500/30 flex flex-col gap-3 transition ${
                    isDark ? "bg-zinc-900/50" : "bg-sky-50/10"
                  }`}>
                    <h4 className="text-xs font-bold text-sky-500 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Criar Novo Modelo de Descrição
                    </h4>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nome do Modelo</label>
                        <input
                          type="text"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="Ex: Minha Anestesia Geral Padrão"
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-700" : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Categoria</label>
                        <select
                          value={newModelCategory}
                          onChange={(e) => setNewModelCategory(e.target.value as any)}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                        >
                          <option value="Geral">Geral</option>
                          <option value="Regional">Regional</option>
                          <option value="Local">Local</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Texto do Modelo</label>
                        <textarea
                          value={newModelText}
                          onChange={(e) => setNewModelText(e.target.value)}
                          placeholder="Digite o texto padrão com placeholders em colchetes como [nível], [fármaco], etc..."
                          rows={4}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-sans font-medium leading-relaxed ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-700" : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"}`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingModel(false)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                          isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateModel}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-550 text-white text-xs font-bold rounded-lg transition"
                      >
                        Criar Modelo
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5">
                  {models.map(m => {
                    const isFav = favoriteModelId === m.id;
                    if (editingModelId === m.id) {
                      return (
                        <div
                          key={m.id}
                          className={`p-4 rounded-lg border-2 border-sky-500/50 flex flex-col gap-3 transition ${
                            isDark ? "bg-zinc-900/50" : "bg-sky-50/10"
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase">Nome do Modelo</label>
                              <input
                                type="text"
                                value={editModelName}
                                onChange={(e) => setEditModelName(e.target.value)}
                                className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
                              <select
                                value={editModelCategory}
                                onChange={(e) => setEditModelCategory(e.target.value as any)}
                                className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                              >
                                <option value="Geral">Geral</option>
                                <option value="Regional">Regional</option>
                                <option value="Local">Local</option>
                                <option value="Outro">Outro</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase">Texto do Modelo</label>
                              <textarea
                                value={editModelText}
                                onChange={(e) => setEditModelText(e.target.value)}
                                rows={5}
                                className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-sans font-medium leading-relaxed ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingModelId(null)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveModelEdits}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-550 text-white text-xs font-bold rounded-lg transition"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-lg border flex flex-col gap-2 transition ${
                          selectedModelId === m.id
                            ? "border-sky-500 bg-sky-500/5"
                            : isDark ? "bg-zinc-900/30 border-zinc-850" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{m.name}</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                                m.isSystem
                                  ? "bg-purple-500/10 text-purple-400"
                                  : m.isInstitutional
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-amber-500/10 text-amber-500"
                              }`}>
                                {m.isSystem ? "Sistema" : m.isInstitutional ? "Institucional" : "Pessoal"}
                              </span>
                            </div>
                            <span className={`text-xs block ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                              Categoria: {m.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleSetFavoriteModel(m.id)}
                              className={`p-1.5 rounded-lg border transition ${
                                isFav
                                  ? "bg-amber-500/10 border-amber-500 text-amber-500"
                                  : isDark ? "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                              }`}
                              title={isFav ? "Remover Favorito" : "Favoritar"}
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={() => handleDuplicateModel(m)}
                              className={`p-1.5 rounded-lg border transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                              title="Duplicar Modelo"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStartEditModel(m)}
                              className={`p-1.5 rounded-lg border transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteModel(m)}
                              className={`p-1.5 rounded-lg border hover:border-rose-500 hover:text-rose-500 transition ${
                                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-100"
                              }`}
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className={`text-xs leading-relaxed line-clamp-3 font-semibold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                          {m.templateText}
                        </p>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectTemplate(m);
                              setActiveTab("launch");
                            }}
                            className="text-xs font-bold text-sky-500 hover:text-sky-400 flex items-center gap-1.5 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Carregar no Editor
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4">
              <span className={`text-xs font-bold uppercase tracking-wider block ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                Pré-visualização do PDF na Ficha de Anestesia
              </span>

              <div className={`p-6 rounded-lg border font-sans leading-relaxed ${
                isDark ? "bg-zinc-950 border-zinc-850 text-zinc-100" : "bg-white border-slate-300 text-slate-900"
              } shadow-sm space-y-6 max-w-xl mx-auto`}>
                
                {/* PDF Header mockup */}
                <div className="border-b pb-4 text-center space-y-1">
                  <span className="tabular-nums text-xs uppercase tracking-widest text-sky-500">Documento Oficial de Registro de Anestesia</span>
                  <h3 className="font-bold text-sm uppercase">Descrição da Anestesia e Eventos</h3>
                  <div className="text-xs text-slate-400 tabular-nums">
                    Paciente: {ficha.patient?.fullName || "Não Informado"} | Reg: {ficha.patient?.recordNumber || "N/A"}
                  </div>
                </div>

                {/* Section Content */}
                <div className="space-y-5">
                  
                  {/* Descriptions */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-500 block border-b pb-1">
                      1. Descrição Principal da Anestesia
                    </span>
                    {launches.filter(l => l.type === "Descrição Principal").length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma descrição principal lançada até o momento.</p>
                    ) : (
                      launches.filter(l => l.type === "Descrição Principal").map((l, i) => (
                        <p key={l.id} className="text-xs font-semibold leading-relaxed text-justify">
                          {l.text}
                        </p>
                      ))
                    )}
                  </div>

                  {/* Events timeline */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-500 block border-b pb-1">
                      2. Registro Cronológico de Atos e Eventos
                    </span>
                    {launches.filter(l => l.type === "Evento Cronológico").length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhum evento cronológico registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {launches.filter(l => l.type === "Evento Cronológico").map((l) => (
                          <div key={l.id} className="text-xs font-semibold flex items-start gap-2">
                            <span className="tabular-nums font-bold text-sky-500 text-xs shrink-0 mt-0.5">{l.time}</span>
                            <span className="text-slate-700 dark:text-zinc-300">— {l.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Auditoria / Histórico de Alterações */}
                  {launches.some(l => l.version > 1) && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block border-b pb-1">
                        3. Histórico de Ajustes e Auditoria
                      </span>
                      <div className="space-y-2 text-xs">
                        {launches.filter(l => l.version > 1).map((l) => (
                          <div key={l.id} className="p-2 rounded bg-amber-500/5 border border-amber-500/10 space-y-0.5 text-slate-500">
                            <div className="font-bold">Registo alterado por {l.author} para a Versão {l.version}:</div>
                            <div>Motivo: "{l.editJustification}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* PDF Signatures Mockup */}
                <div className="border-t pt-4 flex justify-between items-center text-xs text-slate-400 tabular-nums">
                  <span>Assinatura Digital</span>
                  <span>{ficha.status === "Signed" ? "DOCUMENTO ASSINADO" : "RASCUNHO EM ANDAMENTO"}</span>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
