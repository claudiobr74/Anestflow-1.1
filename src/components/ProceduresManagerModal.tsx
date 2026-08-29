import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Search, 
  FileCheck2, 
  Trash2, 
  FolderOpen, 
  CloudUpload, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Database,
  ArrowRightLeft,
  Calendar,
  FileText,
  Hospital
} from "lucide-react";
import { AnesthesiaDocument } from "../types";
import { getProcedures, saveProcedure, deleteProcedure } from "../lib/proceduresService";
import PdfPreviewModal from "./PdfPreviewModal";

interface ProceduresManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDocument: AnesthesiaDocument;
  onLoadDocument: (doc: AnesthesiaDocument) => void;
  userId: string;
  isDark: boolean;
}

export default function ProceduresManagerModal({
  isOpen,
  onClose,
  currentDocument,
  onLoadDocument,
  userId,
  isDark
}: ProceduresManagerModalProps) {
  const [procedures, setProcedures] = useState<AnesthesiaDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<AnesthesiaDocument | null>(null);

  // Load procedures on open
  useEffect(() => {
    if (isOpen && userId) {
      fetchProceduresList();
    }
  }, [isOpen, userId]);

  // Clear messages after a delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchProceduresList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProcedures(userId);
      setProcedures(data);
    } catch (err: any) {
      console.error(err);
      setError("Não foi possível carregar a lista de fichas salvadas na nuvem.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrent = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await saveProcedure(currentDocument, userId);
      setSuccessMessage("Ficha atual salva com sucesso na nuvem!");
      onLoadDocument({ ...currentDocument, userId });
      await fetchProceduresList();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar a ficha atual no servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = (docToLoad: AnesthesiaDocument) => {
    onLoadDocument(docToLoad);
    setSuccessMessage(`Ficha de "${docToLoad.patient.fullName || "Sem nome"}" carregada!`);
    onClose();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProcedure(id, userId);
      setConfirmDeleteId(null);
      setSuccessMessage("Ficha excluída com sucesso.");
      await fetchProceduresList();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao tentar excluir a ficha do servidor.");
    }
  };

  // Filter procedures by patient name or record number
  const filteredProcedures = procedures.filter((proc) => {
    const name = (proc.patient?.fullName || "").toLowerCase();
    const record = (proc.patient?.recordNumber || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || record.includes(query);
  });

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "—";
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }) + " às " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Dialog Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={`w-full max-w-4xl h-[85vh] rounded-lg shadow-lg border flex flex-col overflow-hidden relative ${
              isDark 
                ? "bg-[#1C1C1E] border-zinc-800 text-white" 
                : "bg-white border-zinc-200 text-zinc-900"
            }`}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b flex justify-between items-center shrink-0 ${
              isDark ? "border-zinc-800 bg-[#2C2C2E]/40" : "border-zinc-100 bg-zinc-50"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? "bg-indigo-950/40 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Gerenciador de Fichas</h3>
                  <p className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    Salvamento seguro e recuperação de prontuários anestésicos na nuvem
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition ${
                  isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert bar */}
            {error && (
              <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 text-xs font-semibold text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs font-semibold text-emerald-500 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Quick Actions & Search Bar */}
            <div className={`p-4 border-b flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0 ${
              isDark ? "border-zinc-800 bg-[#1C1C1E]" : "border-zinc-100 bg-white"
            }`}>
              {/* Left search */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-zinc-400" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por paciente ou prontuário..."
                  className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs font-medium border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                    isDark 
                      ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" 
                      : "bg-slate-100 dark:bg-zinc-900/80 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                  }`}
                />
              </div>

              {/* Right Save Action */}
              <button
                onClick={handleSaveCurrent}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                <span>Salvar Ficha Atual na Nuvem</span>
              </button>
            </div>

            {/* Active Document Reference Card */}
            <div className={`px-6 py-3 border-b flex flex-wrap justify-between items-center text-xs ${
              isDark ? "bg-[#252528]/40 border-zinc-800" : "bg-indigo-50/30 border-zinc-100"
            }`}>
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                <span className="font-medium">Prontuário em edição:</span>
                <b className="uppercase">{currentDocument.patient.fullName || "Sem Nome"}</b>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                  currentDocument.status === "Signed" 
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}>
                  {currentDocument.status === "Signed" ? "ASSINADO" : "RASCUNHO"}
                </span>
              </div>
              <div className="text-zinc-400 text-xs tabular-nums">
                ID: {currentDocument.id}
              </div>
            </div>

            {/* Content List Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold">Buscando fichas na nuvem...</span>
                </div>
              ) : filteredProcedures.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-6">
                  <div className={`p-4 rounded-full mb-4 ${isDark ? "bg-zinc-800/40 text-zinc-600" : "bg-zinc-100 text-zinc-400"}`}>
                    <FolderOpen className="w-10 h-10" />
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-wider">Nenhuma ficha encontrada</h4>
                  <p className={`text-xs mt-2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {searchQuery 
                      ? "Nenhum prontuário corresponde aos termos da sua pesquisa." 
                      : "Você ainda não possui nenhuma ficha anestésica salva na nuvem para este usuário médico."}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={handleSaveCurrent}
                      disabled={isSaving}
                      className={`mt-4 px-4 py-2 border rounded-lg font-bold text-xs transition flex items-center gap-2 ${
                        isDark 
                          ? "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 text-zinc-300" 
                          : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                      }`}
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                      <span>Salvar ficha atual como primeira</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProcedures.map((proc) => {
                    const isCurrent = proc.id === currentDocument.id;
                    const isDeleting = confirmDeleteId === proc.id;
                    
                    return (
                      <motion.div
                        key={proc.id}
                        layout
                        className={`border rounded-lg p-4 transition-all duration-200 flex flex-col justify-between ${
                          isCurrent
                            ? isDark
                              ? "bg-indigo-950/15 border-indigo-500/40 shadow-xs"
                              : "bg-indigo-50/40 border-indigo-200/80 shadow-xs"
                            : isDark
                              ? "bg-[#252528]/40 border-zinc-800/60 hover:border-zinc-700/80 hover:bg-[#2c2c2f]/40"
                              : "bg-white border-zinc-200/80 hover:border-zinc-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2.5">
                            <div>
                              <h5 className="font-bold text-xs uppercase tracking-tight line-clamp-1">
                                {proc.patient?.fullName || "Paciente sem Nome"}
                              </h5>
                              <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${
                                isDark ? "text-zinc-400" : "text-zinc-500"
                              }`}>
                                <Calendar className="w-3 h-3 text-zinc-400" />
                                <span>Cirurgia: <b>{proc.patient?.date || "Sem data"}</b></span>
                              </p>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums tracking-wider ${
                              proc.status === "Signed"
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}>
                              {proc.status === "Signed" ? "ASSINADO" : "RASCUNHO"}
                            </span>
                          </div>

                          <div className={`grid grid-cols-2 gap-x-3 gap-y-1 py-2 border-y my-2 text-xs font-medium ${
                            isDark ? "border-zinc-800/60 text-zinc-400" : "border-zinc-100 text-zinc-500"
                          }`}>
                            <div>Prontuário: <b className="tabular-nums text-zinc-200 dark:text-zinc-300">{proc.patient?.recordNumber || "—"}</b></div>
                            <div>Idade/Peso: <b>{proc.patient?.age || "—"} anos / {proc.patient?.weight || "—"} kg</b></div>
                            <div className="col-span-2 truncate flex items-center gap-1 mt-0.5">
                              <Hospital className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate">Hospital: <b>{proc.patient?.hospital || "—"}</b></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-1">
                          <div className={`text-xs font-medium flex items-center gap-1 ${
                            isDark ? "text-zinc-500" : "text-zinc-400"
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>Salvo: {formatDate(proc.updatedAt || proc.createdAt)}</span>
                          </div>

                          <div className="flex gap-2">
                            {/* Delete Controls */}
                            {isDeleting ? (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-xs font-bold text-rose-500 uppercase tracking-tight">Excluir?</span>
                                <button
                                  onClick={() => handleDelete(proc.id)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={`px-2 py-1 border rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    isDark ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-700" : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200"
                                  }`}
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setPreviewDocument(proc)}
                                  className={`p-1.5 border rounded-lg transition shrink-0 ${
                                    isDark 
                                      ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-900" 
                                      : "bg-white hover:bg-indigo-50 border-zinc-200 text-zinc-500 hover:text-indigo-600"
                                  }`}
                                  title="Visualizar PDF e Imprimir"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(proc.id)}
                                  className={`p-1.5 border rounded-lg transition shrink-0 ${
                                    isDark 
                                      ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-950" 
                                      : "bg-white hover:bg-rose-50 border-zinc-200 text-zinc-500 hover:text-rose-600"
                                  }`}
                                  title="Excluir Ficha da Nuvem"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleLoad(proc)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                                    isCurrent
                                      ? isDark
                                        ? "bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                        : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                      : isDark
                                        ? "bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-900/50 text-indigo-300"
                                        : "bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700"
                                  }`}
                                  disabled={isCurrent}
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>{isCurrent ? "Aberta" : "Abrir"}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex flex-col sm:flex-row gap-2 justify-between items-center text-xs shrink-0 font-medium ${
              isDark ? "border-zinc-800 bg-[#2C2C2E]/20 text-zinc-500" : "border-zinc-100 bg-zinc-50 text-zinc-400"
            }`}>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-500" />
                <span>Base de dados: <b>{userId}</b></span>
              </span>
              <span>Resolução CFM 2.174/2017 • Segurança AES-256 e LGPD</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {previewDocument && (
      <PdfPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        ficha={previewDocument}
      />
    )}
    </>
  );
}
