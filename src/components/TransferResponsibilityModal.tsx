import React, { useState } from 'react';
import { AnesthesiaDocument } from '../types';
import { X, ArrowRightLeft, UserCheck, AlertCircle, ShieldCheck, Mail } from 'lucide-react';
import { lookupProfileByEmail } from '../lib/profileService';

interface TransferFormData {
  outgoingName: string;
  outgoingCRM: string;
  outgoingUF: string;
  incomingName: string;
  incomingCRM: string;
  incomingUF: string;
  incomingEmail?: string;
  clinicalConditions: string;
  incidentsReported: string;
  ongoingInfusions: string;
  pendingItems: string;
  immediate?: boolean;
}

interface TransferResponsibilityModalProps {
  ficha: AnesthesiaDocument;
  isDark: boolean;
  onClose: () => void;
  onConfirmTransfer: (data: TransferFormData) => void | boolean | Promise<void | boolean>;
}

export default function TransferResponsibilityModal({
  ficha,
  isDark,
  onClose,
  onConfirmTransfer
}: TransferResponsibilityModalProps) {
  const currentLead = ficha.team?.anesthesiologistLead || "";
  const currentCRM = ficha.team?.crmLead || "";
  const currentUF = ficha.team?.ufLead || "SP";

  const activeInfusions = ficha.continuousInfusions
    ?.filter(i => i.history && i.history.length > 0 && i.history[i.history.length - 1].status !== 'Finalizado')
    .map(i => `${i.name} (${i.history[i.history.length - 1].rate} ${i.unit})`)
    .join(', ') || "Nenhuma infusão contínua ativa no momento.";

  const [outgoingName, setOutgoingName] = useState(currentLead || "Anestesiologista Responsável");
  const [outgoingCRM, setOutgoingCRM] = useState(currentCRM);
  const [outgoingUF, setOutgoingUF] = useState(currentUF);

  const [incomingName, setIncomingName] = useState("");
  const [incomingCRM, setIncomingCRM] = useState("");
  const [incomingUF, setIncomingUF] = useState("SP");
  const [incomingEmail, setIncomingEmail] = useState("");
  const [lookupHint, setLookupHint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [clinicalConditions, setClinicalConditions] = useState("Paciente em quadro estável, parâmetros hemodinâmicos mantidos.");
  const [incidentsReported, setIncidentsReported] = useState("Sem intercorrências graves no período.");
  const [ongoingInfusions, setOngoingInfusions] = useState(activeInfusions);
  const [pendingItems, setPendingItems] = useState("");

  const isClosed = ficha.status === "Signed";

  const lookupIncoming = async () => {
    const email = incomingEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    try {
      const profile = await lookupProfileByEmail(email);
      if (!profile) {
        setLookupHint("Colega não encontrado. O profissional precisa ter perfil confirmado no AnestFlow.");
        return;
      }
      setLookupHint(`Perfil encontrado: ${profile.full_name || email}`);
      if (!incomingName.trim() && profile.full_name) setIncomingName(profile.full_name);
      if (!incomingCRM.trim() && profile.crm) setIncomingCRM(profile.crm);
      if (profile.uf) setIncomingUF(profile.uf);
    } catch {
      setLookupHint("Não foi possível consultar o perfil deste e-mail.");
    }
  };

  const handleAction = async (e: React.FormEvent, immediate: boolean) => {
    e.preventDefault();
    if (isClosed || submitting) {
      if (isClosed) {
        alert("Ficha encerrada. Não é possível realizar troca de responsabilidade em uma ficha assinada.");
      }
      return;
    }
    if (!incomingEmail.trim()) {
      alert("Informe o e-mail do colega que vai assumir o caso. Ele precisa ter perfil confirmado no AnestFlow.");
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onConfirmTransfer({
        outgoingName,
        outgoingCRM,
        outgoingUF,
        incomingName: incomingName.trim(),
        incomingCRM: incomingCRM.trim(),
        incomingUF,
        incomingEmail: incomingEmail.trim(),
        clinicalConditions,
        incidentsReported,
        ongoingInfusions,
        pendingItems,
        immediate
      });
      if (ok !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className={`relative w-full max-w-2xl p-6 rounded-lg shadow-lg flex flex-col gap-6 my-8 ${isDark ? "bg-zinc-900 border border-zinc-800 text-zinc-100" : "bg-white text-zinc-900"}`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-black"}`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 border-b pb-4 border-slate-200 dark:border-zinc-800">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Troca de Responsabilidade Anestésica
            </h2>
            <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Registro formal de transferência de cuidados anestésicos (Handover / Passo de Plantão). O colega é identificado pelo e-mail do perfil AnestFlow.
            </p>
          </div>
        </div>

        {isClosed && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Ficha Assinada/Encerrada. A troca de responsabilidade não pode ser alterada.</span>
          </div>
        )}

        <form onSubmit={(e) => { void handleAction(e, false); }} className="flex flex-col gap-5">
          <div className={`p-4 rounded-lg border ${isDark ? "bg-zinc-800/40 border-zinc-700/60" : "bg-slate-50 border-slate-200"}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-500" />
              Anestesiologista Sainte (Que Entrega o Caso)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={outgoingName}
                  onChange={e => setOutgoingName(e.target.value)}
                  disabled={isClosed || submitting}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                  required
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">CRM</label>
                  <input
                    type="text"
                    value={outgoingCRM}
                    onChange={e => setOutgoingCRM(e.target.value)}
                    disabled={isClosed || submitting}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">UF</label>
                  <input
                    type="text"
                    value={outgoingUF}
                    onChange={e => setOutgoingUF(e.target.value.toUpperCase())}
                    disabled={isClosed || submitting}
                    maxLength={2}
                    className={`w-full px-2 py-2 text-sm rounded-lg border text-center font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${isDark ? "bg-indigo-950/20 border-indigo-800/40" : "bg-indigo-50/50 border-indigo-100"}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Anestesiologista Entrante (Que Assume a Responsabilidade) *
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  E-mail do Novo Anestesiologista *
                </label>
                <input
                  type="email"
                  placeholder="medico@hospital.com"
                  value={incomingEmail}
                  onChange={e => {
                    setIncomingEmail(e.target.value);
                    setLookupHint("");
                  }}
                  onBlur={() => { void lookupIncoming(); }}
                  disabled={isClosed || submitting}
                  required
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                />
                {lookupHint && (
                  <p className={`text-xs mt-1 ${lookupHint.includes("não") || lookupHint.includes("Não") ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {lookupHint}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Nome Completo do Novo Responsável</label>
                <input
                  type="text"
                  placeholder="Preenchido pelo perfil, se encontrado"
                  value={incomingName}
                  onChange={e => setIncomingName(e.target.value)}
                  disabled={isClosed || submitting}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">CRM</label>
                  <input
                    type="text"
                    placeholder="123456"
                    value={incomingCRM}
                    onChange={e => setIncomingCRM(e.target.value)}
                    disabled={isClosed || submitting}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">UF</label>
                  <input
                    type="text"
                    value={incomingUF}
                    onChange={e => setIncomingUF(e.target.value.toUpperCase())}
                    disabled={isClosed || submitting}
                    maxLength={2}
                    className={`w-full px-2 py-2 text-sm rounded-lg border text-center font-medium ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-slate-300"}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Passagem de Plantão / Checklist Clínico (SBAR)
            </h3>

            <div>
              <label className="block text-xs font-semibold mb-1">Condições Clínicas Atualizadas</label>
              <textarea
                rows={2}
                value={clinicalConditions}
                onChange={e => setClinicalConditions(e.target.value)}
                disabled={isClosed || submitting}
                className={`w-full p-2.5 text-sm rounded-lg border outline-none resize-none ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-slate-300 text-slate-800"}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Infusões e Drogas em Andamento</label>
              <textarea
                rows={2}
                value={ongoingInfusions}
                onChange={e => setOngoingInfusions(e.target.value)}
                disabled={isClosed || submitting}
                className={`w-full p-2.5 text-sm rounded-lg border outline-none resize-none ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-slate-300 text-slate-800"}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Intercorrências / Incidentes</label>
                <textarea
                  rows={2}
                  value={incidentsReported}
                  onChange={e => setIncidentsReported(e.target.value)}
                  disabled={isClosed || submitting}
                  className={`w-full p-2.5 text-sm rounded-lg border outline-none resize-none ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Pendências e Cuidados Especiais</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Checar gasometria pós-extubação, analgesia de resgate..."
                  value={pendingItems}
                  onChange={e => setPendingItems(e.target.value)}
                  disabled={isClosed || submitting}
                  className={`w-full p-2.5 text-sm rounded-lg border outline-none resize-none ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isClosed || submitting}
              className="px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Solicitar Transferência (Para Aceite)
            </button>
            <button
              type="button"
              onClick={(e) => { void handleAction(e, true); }}
              disabled={isClosed || submitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transferir Imediatamente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
