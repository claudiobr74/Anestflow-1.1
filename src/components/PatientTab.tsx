/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AnesthesiaDocument, PatientInfo } from "../types";
import { User, FileText, Clipboard, Heart, CheckSquare, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { calculateAge } from "../mockData";
import TcleModal from "./TcleModal";
import { getThemeClasses } from "../lib/theme";
import { isClinicalEditor } from "../lib/assertCanEdit";
import ClinicalEditorLock from "./ClinicalEditorLock";

export const formatCPF = (value: string) => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 9) {
    return numericValue.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, "$1.$2.$3-$4");
  } else if (numericValue.length > 6) {
    return numericValue.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (numericValue.length > 3) {
    return numericValue.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return numericValue;
};

interface PatientTabProps {
  ficha: AnesthesiaDocument;
  onChangePatient: (patientData: Partial<PatientInfo>) => void;
  onChangeTeam: (teamData: Partial<AnesthesiaDocument["team"]>) => void;
  onLoadWorklist?: (cpf: string) => Promise<void>;
  onSaveWorklist?: () => Promise<void>;
  theme?: "light" | "dark" | "dark-clean";
  user?: { name: string; crm: string; uf: string; hospital: string; uid?: string } | null;
  onOpenTransferModal?: () => void;
}

export default function PatientTab({ ficha, onChangePatient, onChangeTeam, onLoadWorklist, onSaveWorklist, theme = "light", user, onOpenTransferModal }: PatientTabProps) {
  const p = ficha.patient;
  const team = ficha.team;
  const tc = getThemeClasses(theme);
  const [isTcleOpen, setIsTcleOpen] = useState(false);
  const [cpf, setCpf] = useState(ficha.patient?.cpf || "");

  const isClosed = !isClinicalEditor(ficha, user?.uid);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [worklistMsg, setWorklistMsg] = useState("");

  const todayStr = React.useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const handleSearchWorklist = async () => {
    if (!onLoadWorklist || isClosed) return;
    setIsSearching(true);
    setWorklistMsg("");
    try {
      await onLoadWorklist(cpf);
      setWorklistMsg("Paciente carregado da Worklist!");
    } catch (e: any) {
      setWorklistMsg(e.message || "Erro ao buscar");
    } finally {
      setIsSearching(false);
      setTimeout(() => setWorklistMsg(""), 3000);
    }
  };

  const handleSaveWorklist = async () => {
    if (!onSaveWorklist || isClosed) return;
    onChangePatient({ cpf });
    setIsSaving(true);
    setWorklistMsg("");
    try {
      await onSaveWorklist();
      setWorklistMsg("Paciente salvo na Worklist!");
    } catch (e: any) {
      setWorklistMsg(e.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
      setTimeout(() => setWorklistMsg(""), 3000);
    }
  };

  const handleBirthDateChange = (val: string) => {
    const age = calculateAge(val);
    onChangePatient({ birthDate: val, age });
  };

  const isDark = theme === "dark" || theme === "dark-clean";
  const cardClass = `p-6 rounded-lg border shadow-xs space-y-5 transition-colors ${
    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
  }`;
  const labelClass = `block text-xs font-semibold mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`;
  const inputClass = `w-full rounded-lg px-3 py-2.5 text-sm transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
    isDark 
      ? "bg-zinc-950 border border-zinc-800 text-zinc-200 focus:bg-zinc-900" 
      : "bg-zinc-50/50 border border-zinc-200 text-zinc-900 focus:bg-white"
  }`;
  const selectClass = inputClass; // Reuse input classes for selects
  const headingClass = `font-bold text-sm ${isDark ? "text-zinc-100" : "text-zinc-800"}`;
  const iconClass = `w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`;

  return (
    <ClinicalEditorLock canEdit={!isClosed}>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* COLUMN 1: PATIENT DEMOGRAPHICS (Col 7) */}
      <div className={`lg:col-span-7 ${cardClass}`}>
        <div className={`flex items-center gap-2 border-b pb-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
          <User className={iconClass} />
          <h3 className={headingClass}>Dados de Identificação do Paciente</h3>
        </div>

        {/* WORKLIST CONTROLS */}
        <div className={`p-4 rounded-lg border ${isDark ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50 border-indigo-100"}`}>
          <label className={labelClass}>CPF do Paciente (Worklist)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={cpf}
              onChange={(e) => {
                const formatted = formatCPF(e.target.value);
                setCpf(formatted);
                onChangePatient({ cpf: formatted });
              }}
              placeholder="000.000.000-00"
              className={`${inputClass} tabular-nums flex-1`}
            />
            {onLoadWorklist && (
              <button 
                onClick={handleSearchWorklist} 
                disabled={isClosed || isSearching || !cpf}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                {isSearching ? "Buscando..." : "Buscar na Worklist"}
              </button>
            )}
            {onSaveWorklist && (
              <button 
                onClick={handleSaveWorklist} 
                disabled={isClosed || isSaving || !cpf}
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-50 border ${isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-200" : "border-indigo-200 hover:bg-indigo-100 text-indigo-700 bg-white"}`}
              >
                {isSaving ? "Salvando..." : "Criar Novo Paciente"}
              </button>
            )}
          </div>
          {worklistMsg && (
            <p className={`text-xs font-semibold mt-2 ${worklistMsg.includes('Erro') ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {worklistMsg}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome Completo</label>
            <input
              type="text"
              value={p.fullName || ""}
              onChange={(e) => onChangePatient({ fullName: e.target.value })}
              placeholder="Ex: João da Silva Santos"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Data de Nascimento</label>
            <input
              type="date"
              value={p.birthDate || ""}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Idade (Anos)</label>
            <div className={`w-full rounded-lg px-3 py-2.5 text-sm font-bold border ${
              isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}>
              {p.age !== undefined ? `${p.age} anos` : "Selecione a data de nascimento"}
            </div>
          </div>

          <div>
            <label className={labelClass}>Gênero</label>
            <select
              value={p.gender || ""}
              onChange={(e) => onChangePatient({ gender: e.target.value as any })}
              className={selectClass}
            >
              <option value="">Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Número do Prontuário</label>
            <input
              type="text"
              value={p.recordNumber || ""}
              onChange={(e) => onChangePatient({ recordNumber: e.target.value })}
              placeholder="Ex: GH-90210"
              className={`${inputClass} tabular-nums`}
            />
          </div>

          <div>
            <label className={labelClass}>Número de Atendimento</label>
            <input
              type="text"
              value={p.admissionNumber || ""}
              onChange={(e) => onChangePatient({ admissionNumber: e.target.value })}
              placeholder="Ex: 44093"
              className={`${inputClass} tabular-nums`}
            />
          </div>

          <div>
            <label className={labelClass}>Leito / Quarto</label>
            <input
              type="text"
              value={p.bed || ""}
              onChange={(e) => onChangePatient({ bed: e.target.value })}
              placeholder="Ex: UTI-04 / A"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* COLUMN 2: SURGICAL DETAILS & CONSENT (Col 5) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        
        {/* SURGICAL TEAM & PROCEDURE */}
        <div className={cardClass}>
          <div className={`flex items-center gap-2 border-b pb-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
            <Clipboard className={iconClass} />
            <h3 className={headingClass}>Agendamento e Equipe</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Data da Cirurgia</label>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onChangePatient({ date: todayStr })}
                    className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors ${
                      p.date === todayStr
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => {
                      if (p.date === todayStr) {
                         onChangePatient({ date: "" });
                      }
                    }}
                    className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-colors ${
                      p.date !== todayStr
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800'
                    }`}
                  >
                    Escolher Data
                  </button>
                </div>
                {p.date !== todayStr && (
                  <input
                    type="date"
                    value={p.date || ""}
                    onChange={(e) => onChangePatient({ date: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Procedimento Planejado</label>
              <input
                type="text"
                value={p.scheduledProcedure || ""}
                onChange={(e) => onChangePatient({ scheduledProcedure: e.target.value })}
                placeholder="Ex: Colecistectomia por Videolaparoscopia"
                className={inputClass}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-teal-400" : "text-teal-700"}`}>Procedimento Efetivamente Realizado</label>
              <input
                type="text"
                value={p.actualProcedure || ""}
                onChange={(e) => onChangePatient({ actualProcedure: e.target.value })}
                placeholder="Ex: Colecistectomia videolaparoscópica c/ colangiografia"
                className={`${inputClass} font-semibold`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className={labelClass}>Anestesiologista de Sala</label>
                <input
                  type="text"
                  value={user ? user.name : (team.anesthesiologistLead || "")}
                  onChange={(e) => {
                    if (!user) onChangeTeam({ anesthesiologistLead: e.target.value });
                  }}
                  readOnly={!!user}
                  placeholder="Nome do Anestesista"
                  className={`${inputClass} ${user ? "opacity-75 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed" : ""}`}
                />
              </div>
              <div>
                <label className={labelClass}>CRM Anestesiologista</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={user ? user.crm : (team.crmLead || "")}
                    onChange={(e) => {
                      if (!user) onChangeTeam({ crmLead: e.target.value });
                    }}
                    readOnly={!!user}
                    placeholder="CRM"
                    className={`${inputClass} tabular-nums ${user ? "opacity-75 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed" : ""}`}
                  />
                  <input
                    type="text"
                    value={user ? user.uf : (team.ufLead || "")}
                    onChange={(e) => {
                      if (!user) onChangeTeam({ ufLead: e.target.value });
                    }}
                    readOnly={!!user}
                    placeholder="UF"
                    className={`w-16 rounded-lg px-2 py-2.5 text-sm tabular-nums text-center transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
                      isDark 
                        ? "bg-zinc-950 border border-zinc-800 text-zinc-200 focus:bg-zinc-900" 
                        : "bg-zinc-50/50 border border-zinc-200 text-zinc-900 focus:bg-white"
                    } ${user ? "opacity-75 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Cirurgião Principal</label>
                <input
                  type="text"
                  value={team.surgeon || ""}
                  onChange={(e) => onChangeTeam({ surgeon: e.target.value })}
                  placeholder="Nome do Cirurgião"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>CRM Cirurgião</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={team.surgeonCRM || ""}
                    onChange={(e) => onChangeTeam({ surgeonCRM: e.target.value })}
                    placeholder="CRM"
                    className={`${inputClass} tabular-nums`}
                  />
                  <input
                    type="text"
                    value={team.surgeonUF || "GO"}
                    onChange={(e) => onChangeTeam({ surgeonUF: e.target.value })}
                    placeholder="UF"
                    className={`w-16 rounded-lg px-2 py-2.5 text-sm tabular-nums text-center transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
                      isDark 
                        ? "bg-zinc-950 border border-zinc-800 text-zinc-200 focus:bg-zinc-900" 
                        : "bg-zinc-50/50 border border-zinc-200 text-zinc-900 focus:bg-white"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Hospital / Unidade</label>
              <input
                type="text"
                value={p.hospital || ""}
                onChange={(e) => onChangePatient({ hospital: e.target.value })}
                className={inputClass}
              />
            </div>

            {/* HANDOVER / RESPONSIBILITY TRANSFER BUTTON AND LOGS */}
            <div className={`mt-4 p-4 rounded-lg border ${isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50/60 border-indigo-100"}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                    Troca de Responsabilidade (Handover)
                  </span>
                </div>
                {onOpenTransferModal && (
                  <button
                    type="button"
                    onClick={onOpenTransferModal}
                    disabled={isClosed}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Registrar Troca
                  </button>
                )}
              </div>

              {ficha.transfers && ficha.transfers.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {ficha.transfers.map((t, idx) => (
                    <div key={t.id || idx} className={`p-2.5 rounded-lg text-xs border ${isDark ? "bg-zinc-900/70 border-zinc-800 text-zinc-300" : "bg-white border-indigo-100 text-slate-800"}`}>
                      <div className="flex items-center justify-between font-bold text-indigo-600 dark:text-indigo-400">
                        <span>
                          {t.outgoingName} (CRM {t.outgoingCRM}/{t.outgoingUF}) ➔ {t.incomingName} (CRM {t.incomingCRM}/{t.incomingUF})
                        </span>
                        <span className="text-xs text-zinc-400 tabular-nums">
                          {new Date(t.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {t.clinicalConditions && <p className="mt-1 text-slate-600 dark:text-zinc-400"><strong>Condição:</strong> {t.clinicalConditions}</p>}
                      {t.pendingItems && <p className="mt-0.5 text-amber-600 dark:text-amber-400"><strong>Pendências:</strong> {t.pendingItems}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
                  Nenhuma troca de responsabilidade registrada nesta cirurgia até o momento.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* INFORMED CONSENT LOG */}
        <div className={cardClass}>
          <div className={`flex items-center gap-2 border-b pb-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
            <CheckSquare className={`w-5 h-5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />
            <h3 className={headingClass}>Termo de Consentimento Informado</h3>
          </div>

          <div className={`p-4 rounded-lg border flex items-start gap-3 select-none ${
            isDark 
              ? p.consentStatus === "Confirmado" ? "bg-teal-950/30 border-teal-900/50" : "bg-zinc-800/50 border-zinc-700/50"
              : "bg-teal-50/50 border-teal-100"
          }`}>
            <input
              type="checkbox"
              id="consent-check"
              checked={p.consentStatus === "Confirmado"}
              onChange={(e) => {
                onChangePatient({ consentStatus: e.target.checked ? "Confirmado" : "Pendente" });
              }}
              className="w-4 h-4 text-teal-600 rounded border-teal-300 focus:ring-teal-500 mt-1 cursor-pointer"
            />
            <label htmlFor="consent-check" className={`text-sm cursor-pointer ${isDark ? "text-zinc-300" : "text-teal-900"}`}>
              <span className="font-bold block mb-1">Termo assinado pelo paciente?</span>
              <span className="text-xs opacity-80 leading-relaxed block">Declaro que o Termo de Consentimento Informado para Anestesia foi discutido, preenchido, esclarecido e assinado de forma autônoma.</span>
            </label>
          </div>

          {p.consentStatus !== "Confirmado" && (
            <div className={`mt-2 p-4 rounded-lg border flex flex-col gap-3 ${
              isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50/50 border-indigo-100"
            }`}>
              <div className={`flex gap-3 text-sm font-medium leading-relaxed ${
                isDark ? "text-indigo-200" : "text-indigo-900"
              }`}>
                <FileText className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                <div>
                  <span className="font-bold block mb-1">Imprimir TCLE Personalizado</span>
                  <span className="text-xs opacity-80">Como o termo ainda não foi assinado, você pode gerar o PDF do termo oficial com os dados do paciente para assinatura.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTcleOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 px-4 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <FileText className="w-4 h-4" />
                Preencher e Baixar TCLE (PDF)
              </button>
            </div>
          )}
        </div>

        {/* TCLE MODAL */}
        <TcleModal
          isOpen={isTcleOpen}
          onClose={() => setIsTcleOpen(false)}
          ficha={ficha}
          user={user}
        />

      </div>

    </div>
    </ClinicalEditorLock>
  );
}
