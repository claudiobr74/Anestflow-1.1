/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { AnesthesiaDocument, DocumentAmendment } from "../types";
import { ShieldAlert, CheckCircle, Lock, Edit3, Plus, BrainCircuit, Activity, Clock, ShieldCheck, ArrowRightLeft, KeyRound, Copy, Check, FileCheck, Hash, FileDown, Mic } from "lucide-react";
import { invokeAiFunction } from "../lib/aiFunctions";
import { toAIClinicalContext } from "../lib/aiClinicalContext";
import {
  AI_REVIEW_PARSE_FAILED,
  AI_REVIEW_UNAVAILABLE_MESSAGE,
  isAiReviewParseFailedMessage,
  parseAiReviewPayload,
} from "../lib/aiReviewParse";
import { getSupabase } from "../lib/supabase";
import { createSignedAmendment } from "../lib/signatureService";
import {
  addProcedureAmendment,
  getProcedureAmendments,
  isProcedureIntegrityIntact,
  verifyProcedureIntegrity
} from "../lib/proceduresService";
import { evaluateSigningReadiness } from "../lib/signingReadinessEngine";
import { downloadSignedRecordPdf, toSignedAnesthesiaRecordV1 } from "../lib/pdfFinal";

interface ReviewTabProps {
  ficha: AnesthesiaDocument;
  onUpdateDocument: (doc: Partial<AnesthesiaDocument>) => void;
  onCloseProcedure?: () => Promise<void> | void;
  theme?: "light" | "dark" | "dark-clean";
  startAiSupervisor?: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor?: (reason: string) => void;
  onOpenTransferModal?: () => void;
  canEdit?: boolean;
}

interface ValidationAlert {
  type: "Critico" | "Importante" | "Informativo";
  title: string;
  description: string;
  module: string;
}

export default function ReviewTab({ 
  ficha, 
  onUpdateDocument, 
  onCloseProcedure,
  theme = "light",
  startAiSupervisor,
  stopAiSupervisor,
  onOpenTransferModal,
  canEdit = true
}: ReviewTabProps) {
  const isDark = theme === "dark" || theme === "dark-clean";
  const isSigned = ficha.status === "Signed";
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAlerts, setAiAlerts] = useState<ValidationAlert[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Amendment state
  const [amendmentText, setAmendmentText] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [subcollectionAmendments, setSubcollectionAmendments] = useState<DocumentAmendment[]>([]);
  const [loadingAmendments, setLoadingAmendments] = useState(false);
  const [savingAmendment, setSavingAmendment] = useState(false);

  // Fetch amendments from subcollection procedures/{procedureId}/amendments
  useEffect(() => {
    let isMounted = true;
    if (ficha.id) {
      setLoadingAmendments(true);
      getProcedureAmendments(ficha.id)
        .then((items) => {
          if (isMounted) {
            setSubcollectionAmendments(items);
          }
        })
        .catch((err) => {
          console.warn("Aviso ao carregar adendos da subcoleção:", err);
        })
        .finally(() => {
          if (isMounted) setLoadingAmendments(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [ficha.id]);

  // Combined amendments sorted chronologically
  const allAmendments = useMemo(() => {
    const map = new Map<string, DocumentAmendment>();
    (ficha.amendments || []).forEach(a => { if (a && a.id) map.set(a.id, a); });
    subcollectionAmendments.forEach(a => { if (a && a.id) map.set(a.id, a); });
    const list = Array.from(map.values());
    list.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
    return list;
  }, [ficha.amendments, subcollectionAmendments]);

  const readiness = evaluateSigningReadiness(ficha);
  const localAlerts: ValidationAlert[] = readiness.alerts;

  // Call server-side Gemini Clinical Review Assistant
  const handleAICheck = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiAlerts([]);

    const controller = new AbortController();

    // Register with the AI Supervisor
    if (startAiSupervisor) {
      startAiSupervisor("Auditoria de Prontuário", () => {
        controller.abort();
      });
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 55000); // 55s component-level safety timeout (letting central supervisor handle 60s)

    try {
      const result = await invokeAiFunction<{ alerts?: Array<{ type: string; title: string; description: string; module: string }>; error?: string }>(
        "review",
        toAIClinicalContext(ficha),
        controller.signal
      );
      
      clearTimeout(timeoutId);
      const parsed = parseAiReviewPayload(result);
      if (!parsed.ok) {
        setAiError(AI_REVIEW_UNAVAILABLE_MESSAGE);
        if (stopAiSupervisor) {
          stopAiSupervisor(`Erro: ${AI_REVIEW_PARSE_FAILED}`);
        }
        return;
      }
      setAiAlerts(parsed.alerts);
      
      if (stopAiSupervisor) {
        stopAiSupervisor("Sucesso");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (stopAiSupervisor) {
        stopAiSupervisor(err.name === "AbortError" ? "Interrompido por timeout do Supervisor" : `Erro: ${err.message || err}`);
      }

      let errMsg = err.message || "Erro desconhecido.";
      if (err.name === "AbortError") {
        errMsg = "O servidor de IA demorou muito para responder (limite de tempo atingido). Por favor, tente novamente em alguns instantes.";
      } else if (isAiReviewParseFailedMessage(errMsg)) {
        errMsg = AI_REVIEW_UNAVAILABLE_MESSAGE;
      } else if (errMsg.includes("quota") || errMsg.includes("429")) {
        errMsg = "Erro 429: Cota excedida na API. Verifique seus créditos ou chave de acesso.";
      } else if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("overloaded")) {
        errMsg = "Erro 503: O servidor de IA está com alta demanda temporária. Por favor, tente novamente em alguns instantes.";
      } else if (errMsg.includes("{")) {
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed.error && parsed.error.message) {
            errMsg = parsed.error.message;
          }
        } catch(e) {}
      }
      setAiError(errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  // Real SHA-256 Verification State
  const [verifyingHash, setVerifyingHash] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ isValid: boolean; message: string; computedHash: string } | null>(null);

  const handleVerifyIntegrity = async () => {
    setVerifyingHash(true);
    try {
      const report = await verifyProcedureIntegrity(ficha.id);
      const intact = isProcedureIntegrityIntact(report);
      let message: string;
      if (intact) {
        message = "Selo criptográfico de integridade conferido (checagens A e B).";
      } else if (report.legacy && report.snapshotOk) {
        message =
          "O hash do snapshot bate (checagem A), mas o registro é legado e não usa o contrato V2. Não é possível afirmar integridade persistida.";
      } else if (!report.snapshotOk) {
        message = "O hash armazenado não confere com o snapshot selado (checagem A).";
      } else {
        message = "O snapshot selado não coincide com os dados atuais do servidor (checagem B).";
      }
      setVerificationResult({
        isValid: intact,
        message,
        computedHash: report.snapshotHash
      });
    } catch (err) {
      const mapped = err instanceof Error ? err.message : "Erro ao verificar o selo de integridade.";
      setVerificationResult({ isValid: false, message: mapped, computedHash: "" });
    } finally {
      setVerifyingHash(false);
    }
  };

  const handleCopyHash = () => {
    if (ficha.hash) {
      navigator.clipboard.writeText(ficha.hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadFinalPdf = () => {
    downloadSignedRecordPdf(toSignedAnesthesiaRecordV1(ficha));
  };

  // Sign and Lock documents
  const handleSignDocument = () => {
    if (!canEdit) return;
    if (!readiness.canClose) {
      setShowCriticalAlert(true);
      return;
    }
    setShowCloseConfirm(true);
  };

  const executeCloseProcedure = async () => {
    setShowCloseConfirm(false);

    if (onCloseProcedure) {
      await onCloseProcedure();
    } else {
      alert("O encerramento precisa ser selado no servidor. Recarregue a ficha e tente novamente.");
    }
  };

  // Add adendum / amendment to subcollection WITHOUT mutating signed procedure ficha
  const handleAddAmendment = async () => {
    if (!amendmentText.trim() || !amendmentReason.trim()) {
      alert("Por favor, preencha o motivo e a descrição do adendo retificatório.");
      return;
    }

    setSavingAmendment(true);
    try {
      const { data: sessionData } = await getSupabase().auth.getUser();
      const currentUid = sessionData.user?.id || ficha.signedBy?.uid || ficha.currentResponsibleUid || ficha.createdByUid || "";
      if (!currentUid) {
        throw new Error("Usuário não autenticado.");
      }
      const authorName = ficha.signedBy?.name || ficha.team.anesthesiologistLead || sessionData.user?.email || "Anestesiologista Responsável";
      const authorCRM = ficha.signedBy?.crm || ficha.team.crmLead || "";
      const authorUF = ficha.signedBy?.uf || ficha.team.ufLead || "SP";

      // Generate signed amendment with its own SHA-256 hash
      const newAmendment = await createSignedAmendment(
        ficha.id,
        ficha.hash || "",
        {
          text: amendmentText,
          reason: amendmentReason,
          createdByUid: currentUid,
          authorName,
          authorCRM,
          authorUF
        }
      );

      // Write directly to subcollection procedures/{ficha.id}/amendments/{newAmendment.id}
      const saved = await addProcedureAmendment(ficha.id, newAmendment);

      setSubcollectionAmendments(prev => [...prev, saved]);
      setAmendmentText("");
      setAmendmentReason("");
      setShowAmendmentForm(false);
      alert(`Adendo retificatório selado com sucesso.\n\nIntegridade SHA-256 do adendo:\n${saved.hash}\n\nO registro clínico original permanece imutável.`);
    } catch (err: any) {
      console.error("Erro ao adicionar adendo:", err);
      alert(err?.message || "Erro ao salvar o adendo retificatório.");
    } finally {
      setSavingAmendment(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* CARD 1: MAIN REVISION STATUS CARD */}
      {/* CARD 1: REVISÃO E SELO DE INTEGRIDADE */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-2">
              {isSigned ? (
                <>
                  <Lock className="w-5 h-5 text-emerald-600" />
                  <span>Documento oficial com selo criptográfico de integridade</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-5 h-5 text-amber-500" />
                  <span>Revisão, Auditoria e Encerramento</span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {isSigned 
                ? `Homologado em ${new Date(ficha.signedAt!).toLocaleString("pt-BR")} • Ficha Clínica Imutável`
                : "Verifique todas as pendências e dados clínicos obrigatórios antes de selar o registro."
              }
            </p>
          </div>

          <div>
            {!isSigned ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignDocument}
                  disabled={!canEdit}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 font-bold text-sm text-white rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  Encerrar Procedimento
                </button>
              </div>
            ) : (
              <div className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-2 border border-emerald-300 dark:border-emerald-800/60 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div>FICHA ENCERRADA E ASSINADA</div>
                  <div className="text-xs opacity-80 font-normal">Edição bloqueada • Imutável no servidor</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DETAILS OF REAL SHA-256 SIGNATURE */}
        {isSigned && (
          <div className="mt-2 p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-700 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Selo criptográfico de integridade</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadFinalPdf}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF final (selo)</span>
                </button>
                <button
                  type="button"
                  onClick={handleVerifyIntegrity}
                  disabled={verifyingHash}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                {verifyingHash ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Verificar Integridade SHA-256</span>
              </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-400 uppercase block">Anestesiologista</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 block truncate">
                  Dr(a). {ficha.signedBy?.name || ficha.team.anesthesiologistLead}
                </span>
                <span className="text-xs tabular-nums text-slate-500">
                  CRM {ficha.signedBy?.crm || ficha.team.crmLead}/{ficha.signedBy?.uf || ficha.team.ufLead}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-400 uppercase block">Data/Hora da Assinatura</span>
                <span className="tabular-nums text-slate-800 dark:text-zinc-200 block font-bold">
                  {ficha.signedAt ? new Date(ficha.signedAt).toLocaleString("pt-BR") : "—"}
                </span>
                <span className="text-xs text-slate-500">Versão da Ficha: {ficha.docVersion || "2.0.0"}</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Integridade SHA-256 (canônico)</span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
                <div className="tabular-nums text-xs font-bold text-emerald-700 dark:text-emerald-400 break-all select-all mt-1 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                  {ficha.hash || "NENHUM HASH GERADO"}
                </div>
              </div>
            </div>

            {verificationResult && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                verificationResult.isValid
                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              }`}>
                {verificationResult.isValid ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <strong className="block">{verificationResult.isValid ? "Integridade Confirmada com Sucesso" : "Falha de Integridade"}</strong>
                  <span className="text-xs opacity-90">{verificationResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {Array.isArray(ficha.voiceTranscripts) && ficha.voiceTranscripts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-5 rounded-lg border shadow-sm">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Transcrições originais
          </h4>
          <ul className="space-y-2">
            {ficha.voiceTranscripts.map((row) => (
              <li
                key={row.id}
                className="text-sm rounded-lg border border-slate-200 dark:border-zinc-800 px-3 py-2 whitespace-pre-wrap"
              >
                {row.transcriptOriginal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CARD 2: PROPRIEDADE E RESPONSABILIDADE MÉDICA */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-5 rounded-lg border shadow-sm transition-colors">
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Modelo de Propriedade e Continuidade da Ficha (Auditável)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200/80 dark:border-zinc-700/60">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide block">Criador do Prontuário (Imutável)</span>
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-1">
              Dr(a). {ficha.team?.anesthesiologistLead || "Anestesiologista"}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums mt-0.5 truncate">
              UID: {ficha.createdByUid || ficha.userId || "Definido no registro"}
            </p>
          </div>

          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200/80 dark:border-indigo-800/60">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide block">Responsável Atual pelo Atendimento</span>
            <p className="text-sm font-bold text-indigo-950 dark:text-indigo-200 mt-1">
              Dr(a). {ficha.team?.anesthesiologistLead || "Não especificado"}
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 tabular-nums mt-0.5 truncate">
              CRM: {ficha.team?.crmLead}/{ficha.team?.ufLead} • UID: {ficha.currentResponsibleUid || ficha.createdByUid || "Atual"}
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block">Status de Edição Clínica</span>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                {ficha.status === "Signed" ? "Bloqueado (Ficha Assinada)" : "Exclusiva do Anestesiologista Responsável"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CARD TROCA DE RESPONSABILIDADE & HANDOVER LOGS */}
      {ficha.transfers && ficha.transfers.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border-indigo-100 dark:border-zinc-800 p-5 rounded-lg border shadow-sm">
          <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Histórico Registrado de Troca de Responsabilidade (Handover)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ficha.transfers.map((t, idx) => (
              <div key={t.id || idx} className="p-3 bg-indigo-50/40 dark:bg-zinc-800/50 border border-indigo-100 dark:border-zinc-700/60 rounded-lg text-xs space-y-1">
                <div className="font-bold text-indigo-900 dark:text-indigo-300 flex justify-between">
                  <span>Dr(a). {t.outgoingName} ➔ Dr(a). {t.incomingName}</span>
                  <span className="text-xs tabular-nums text-zinc-400">{new Date(t.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-zinc-600 dark:text-zinc-400"><strong>CRM Entrante:</strong> {t.incomingCRM}/{t.incomingUF}</div>
                {t.clinicalConditions && <div className="text-zinc-700 dark:text-zinc-300"><strong>Condições:</strong> {t.clinicalConditions}</div>}
                {t.pendingItems && <div className="text-amber-700 dark:text-amber-400 font-medium"><strong>Pendências:</strong> {t.pendingItems}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* LOCAL VALIDATIONS BOARD (Col 6) */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-xs text-slate-700 border-b border-slate-100 pb-3 mb-4 flex justify-between">
              <span>Auditoria Local de Pendências</span>
              <span className="text-xs bg-slate-100 dark:bg-zinc-900/80 text-slate-600 px-2 rounded-full py-0.5 font-bold tabular-nums">
                {localAlerts.length} itens encontrados
              </span>
            </h4>

            {localAlerts.length > 0 ? (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {localAlerts.map((alert, idx) => {
                  const style = alert.type === "Critico" 
                    ? "bg-rose-50 text-rose-800 border-rose-100" 
                    : alert.type === "Importante"
                    ? "bg-amber-50 text-amber-800 border-amber-100"
                    : "bg-blue-50 text-blue-800 border-blue-100";
                  
                  return (
                    <div key={idx} className={`p-3.5 rounded-lg border text-xs flex gap-2.5 items-start ${style}`}>
                      <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold flex items-center gap-1.5">
                          <span>{alert.title}</span>
                          <span className="text-xs bg-white/70 px-1.5 py-0.2 rounded font-black tabular-nums">
                            {alert.type}
                          </span>
                        </p>
                        <p className="text-slate-600 mt-1">{alert.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-emerald-50/20 border border-dashed border-emerald-200 rounded-lg">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-bold">Nenhuma pendência crítica ou importante local encontrada.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">O prontuário está pronto para ser assinado.</p>
              </div>
            )}
          </div>
        </div>

        {/* GEMINI AI ASSISTED AUDITING (Col 6) */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-xs text-slate-700 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600 animate-pulse" />
                Assistente de Consistência Clínica (Gemini AI)
              </h4>
              <button
                onClick={handleAICheck}
                disabled={aiLoading}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
              >
                {aiLoading ? "Analisando..." : "Auditar com IA"}
              </button>
            </div>

            {aiLoading && (
              <div className="text-center py-12 space-y-3">
                <BrainCircuit className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold">O Gemini 3.5 está auditando o prontuário para inconsistências clínicas...</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">Verificando coerência de doses, tempos operatórios e antecedentes anestésicos.</p>
              </div>
            )}

            {aiError && (
              <p className="text-center text-xs text-rose-500 font-bold py-6">{aiError}</p>
            )}

            {!aiLoading && !aiError && aiAlerts.length > 0 && (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {aiAlerts.map((alert, idx) => {
                  const style = alert.type === "Critico" 
                    ? "bg-rose-50 border-rose-100 text-rose-900" 
                    : alert.type === "Importante"
                    ? "bg-amber-50 border-amber-100 text-amber-900"
                    : "bg-indigo-50 border-indigo-100 text-indigo-900";
                  
                  return (
                    <div key={idx} className={`p-3 rounded-lg border text-xs flex gap-2.5 items-start ${style}`}>
                      <BrainCircuit className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold flex items-center gap-1.5">
                          <span>{alert.title}</span>
                          <span className="text-xs bg-white px-1 py-0.1 rounded tabular-nums font-black">{alert.module}</span>
                        </p>
                        <p className="opacity-90 mt-1 text-xs">{alert.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!aiLoading && !aiError && aiAlerts.length === 0 && (
              <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                <BrainCircuit className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">Assistente de IA inativo.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Clique em "Auditar com IA" para rodar a consistência do prontuário eletrônico.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SECTION: RETIFICAÇÕES / ADENDOS PANEL (POST-SIGNATURE AUDIT TRAIL) */}
      {isSigned && (
        <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-600" />
              Retificações e Adendos ao Prontuário
            </h4>
            {!showAmendmentForm && (
              <button
                onClick={() => setShowAmendmentForm(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Adendo Retificatório
              </button>
            )}
          </div>

          {showAmendmentForm && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo da Retificação</label>
                <input
                  type="text"
                  placeholder="Ex: Correção do volume infundido de Ringer"
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Texto Retificatório Oficial</label>
                <textarea
                  rows={3}
                  placeholder="Descreva detalhadamente o evento ou correção..."
                  value={amendmentText}
                  onChange={(e) => setAmendmentText(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAmendmentForm(false)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddAmendment}
                  disabled={savingAmendment}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold transition hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingAmendment ? "Gravando Adendo..." : "Assinar e Gravar Adendo (Imutável)"}
                </button>
              </div>
            </div>
          )}

          {allAmendments && allAmendments.length > 0 ? (
            <div className="space-y-3 pt-2">
              {allAmendments.map((amd, idx) => (
                <div key={amd.id || idx} className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-lg text-xs space-y-2">
                  <div className="flex flex-wrap justify-between items-center text-amber-900 dark:text-amber-300 border-b border-amber-200/60 dark:border-amber-800/40 pb-2 gap-2">
                    <span className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      Adendo #{idx + 1} Retificatório: {amd.reason}
                    </span>
                    <span className="tabular-nums text-xs text-amber-800 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-md font-semibold">
                      {new Date(amd.createdAt || amd.timestamp || Date.now()).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-zinc-200 font-medium whitespace-pre-line leading-relaxed bg-white/60 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">{amd.text}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-zinc-400 pt-1 tabular-nums">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">Profissional Responsável:</span> {amd.authorName} (CRM {amd.authorCRM}{amd.authorUF ? `/${amd.authorUF}` : ''})
                      {amd.createdByUid && <span className="block text-xs text-slate-400">UID: {amd.createdByUid}</span>}
                    </div>
                    {amd.hash && (
                      <div className="bg-slate-100/80 dark:bg-zinc-800/80 p-1.5 rounded border border-slate-200 dark:border-zinc-700 truncate">
                        <span className="font-bold text-slate-700 dark:text-zinc-300 block text-xs">INTEGRIDADE SHA-256 DO ADENDO:</span>
                        <span className="tabular-nums text-xs text-indigo-600 dark:text-indigo-400 select-all font-bold">{amd.hash}</span>
                      </div>
                    )}
                  </div>

                  {(amd.procedureId || amd.docHashRef) && (
                    <div className="text-xs text-slate-400 tabular-nums border-t border-amber-100 dark:border-amber-900/30 pt-1 flex flex-wrap justify-between gap-1">
                      <span>Ref Ficha Original ID: {amd.procedureId || ficha.id}</span>
                      {amd.docHashRef && <span>Ref Hash Ficha: {amd.docHashRef.substring(0, 16)}...</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4 font-medium">
              {loadingAmendments ? "Carregando adendos da subcoleção imutável..." : "Nenhum adendo retificatório adicionado para este prontuário."}
            </p>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE ENCERRAMENTO */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-md rounded-lg p-6 shadow-sm border text-center transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold">Selar ficha anestésica?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Ao encerrar, o servidor monta o contrato clínico <strong>SignedAnesthesiaRecordV1</strong> e grava o <strong>selo criptográfico de integridade (SHA-256)</strong>. O navegador não envia o canonical. A ficha tornar-se-á <strong>estritamente imutável</strong>. Deseja prosseguir?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold border transition ${
                  isDark 
                    ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" 
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={executeCloseProcedure}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition shadow-sm"
              >
                Confirmar e Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPEDIMENTO - ALERTA CRÍTICO */}
      {showCriticalAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-md rounded-lg p-6 shadow-sm border text-center transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Pendências Críticas Impeditivas</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Não é possível encerrar o procedimento neste momento. Existem pendências Críticas impeditivas (como identificação básica ou horários essenciais) que precisam ser corrigidas antes da finalização legal da ficha.
            </p>
            <div className="mt-4 max-h-40 overflow-y-auto bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 text-left space-y-2 border border-rose-100 dark:border-rose-950/40">
              {localAlerts.filter(a => a.type === "Critico").map((a, idx) => (
                <div key={idx} className="flex gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold">
                  <span>•</span>
                  <span><strong>{a.title}:</strong> {a.description}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button
                onClick={() => setShowCriticalAlert(false)}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition"
              >
                Entendido, vou corrigir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
