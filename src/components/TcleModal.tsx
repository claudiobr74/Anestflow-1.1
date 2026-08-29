/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";
import { Download, Printer, X, ZoomIn, ZoomOut, Check, Info, FileText } from "lucide-react";
import { AnesthesiaDocument } from "../types";
import { formatCPF } from "./PatientTab";

interface TcleModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: AnesthesiaDocument;
  user?: { name: string; crm: string; uf: string; hospital: string; uid?: string } | null;
}

export default function TcleModal({ isOpen, onClose, document: doc, user }: TcleModalProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoom, setZoom] = useState(65); // Zoom percentage for the A4 pages preview

  // Prefilled states based on document
  const [patientName, setPatientName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorCrm, setDoctorCrm] = useState("");
  const [procedure, setProcedure] = useState("");
  const [recordNumber, setRecordNumber] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  
  // Custom TCLE Options
  const [proposedTechs, setProposedTechs] = useState<Record<string, boolean>>({
    acompanhamento: false,
    sedacao: false,
    geral: true,
    outros: false,
  });
  const [alternativeTechs, setAlternativeTechs] = useState<Record<string, boolean>>({
    acompanhamento: false,
    sedacao: true,
    geral: false,
    outros: false,
  });

  const [transfusionAccept, setTransfusionAccept] = useState<"aceita" | "nao_aceita" | "">("aceita");
  const [signerType, setSignerType] = useState<"paciente" | "responsavel">("paciente");
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signerRelation, setSignerRelation] = useState("");
  const [location, setLocation] = useState("Goiânia");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  
  // Doctor/Emergency settings
  const [isEmergency, setIsEmergency] = useState(false);

  // Sync with document when opened
  useEffect(() => {
    if (isOpen && doc) {
      setPatientName(doc.patient?.fullName || "");
      setBirthDate(doc.patient?.birthDate ? doc.patient.birthDate.split("-").reverse().join("/") : "");
      
      const docDoctor = doc.team?.anesthesiologistLead;
      const docCrmVal = doc.team?.crmLead;
      const docUfVal = doc.team?.ufLead;
      
      if (docDoctor) {
        setDoctorName(docDoctor);
        setDoctorCrm(docCrmVal ? `${docCrmVal}${docUfVal ? `-${docUfVal}` : ""}` : "");
      } else if (user) {
        setDoctorName(user.name || "");
        setDoctorCrm(user.crm ? `${user.crm}${user.uf ? `-${user.uf}` : ""}` : "");
      } else {
        setDoctorName("");
        setDoctorCrm("");
      }

      setProcedure(doc.patient?.scheduledProcedure || doc.patient?.actualProcedure || "");
      setSignerName(doc.patient?.fullName || "");
      setRecordNumber(doc.patient?.recordNumber || "");
      setHospitalName(doc.patient?.hospital || user?.hospital || "");
      
      const today = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDateStr(`${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`);
      setTimeStr(`${pad(today.getHours())}:${pad(today.getMinutes())}`);
    }
  }, [isOpen, doc, user]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!previewContainerRef.current || isGenerating) return;

    try {
      setIsGenerating(true);
      const elements = previewContainerRef.current.querySelectorAll(".tcle-print-page");
      if (elements.length === 0) {
        throw new Error("Páginas não encontradas para exportação.");
      }

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
      });

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        
        // A4 standard Portrait dimensions: ~794px width by 1123px height @ 96 DPI.
        // For a beautiful sharp standard vector output, we use explicit dimensions:
        const imgData = await htmlToImage.toPng(element, {
          pixelRatio: 2.2,
          quality: 1.0,
          backgroundColor: "#ffffff",
          width: 800,
          height: 1130,
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
            width: "800px",
            height: "1130px",
          },
        });

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      }

      pdf.save(`TCLE_Anestesiologia_${patientName.replace(/\s+/g, "_") || "Paciente"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF do TCLE:", err);
      alert("Ocorreu um erro ao gerar o PDF do TCLE. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = Array.from(previewContainerRef.current?.querySelectorAll(".tcle-print-page") || [])
      .map(el => (el as HTMLElement).outerHTML)
      .join("<div style='page-break-after: always;'></div>");

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir TCLE - Anestesiologia</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body {
              margin: 0;
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .tcle-print-page {
              width: 210mm;
              height: 297mm;
              box-sizing: border-box;
              position: relative;
              background-color: white;
            }
            @page {
              size: A4 portrait;
              margin: 0;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div style="display: flex; flex-direction: column; align-items: center;">
            ${htmlContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="bg-slate-50 w-full max-w-7xl h-[90vh] rounded-lg shadow-lg flex flex-col overflow-hidden border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">Termo de Consentimento Livre e Esclarecido (TCLE)</h2>
              <p className="text-xs text-slate-500 font-medium">Preencha e faça o download do documento em PDF para assinatura do paciente</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT SPLIT SCREEN */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: FORM FIELD CONTROLS */}
          <div className="w-full lg:w-[450px] border-r border-slate-200 bg-white overflow-y-auto p-6 space-y-6">
            
            <div className="bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-100/70 text-xs text-indigo-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Customização Dinâmica</span>
                Preencha os dados abaixo. Eles serão renderizados imediatamente no modelo oficial do TCLE ao lado.
              </div>
            </div>

            {/* SECTION 1: DADOS BÁSICOS */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-1.5">1. Dados do Paciente & Médico</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Completo do Paciente</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Data de Nascimento</label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Data do Termo</label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Procedimento Proposto</label>
                  <input
                    type="text"
                    value={procedure}
                    onChange={(e) => setProcedure(e.target.value)}
                    placeholder="Ex: Colecistectomia por Videolaparoscopia"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Anestesiologista</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">CRM do Médico</label>
                    <input
                      type="text"
                      value={doctorCrm}
                      onChange={(e) => setDoctorCrm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Prontuário</label>
                    <input
                      type="text"
                      value={recordNumber}
                      onChange={(e) => setRecordNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Hospital</label>
                    <input
                      type="text"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: TÉCNICAS PROPOSTAS & ALTERNATIVAS */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">2. Escolha das Técnicas</h3>
                <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">Tabela oficial</span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider text-center border-b border-slate-100 pb-1">
                  <div className="col-span-4 text-left">Técnica</div>
                  <div className="col-span-4">Prop.</div>
                  <div className="col-span-4">Alt.</div>
                </div>

                {[
                  { id: "acompanhamento", name: "Acomp. de Anestesia" },
                  { id: "sedacao", name: "Sedação" },
                  { id: "geral", name: "Anestesia geral" },
                  { id: "outros", name: "Outros proced." }
                ].map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-1 items-center py-1">
                    <div className="col-span-4 text-xs font-semibold text-slate-700">{item.name}</div>
                    <div className="col-span-4 flex justify-center">
                      <input
                        type="checkbox"
                        checked={proposedTechs[item.id]}
                        onChange={(e) => setProposedTechs({ ...proposedTechs, [item.id]: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div className="col-span-4 flex justify-center">
                      <input
                        type="checkbox"
                        checked={alternativeTechs[item.id]}
                        onChange={(e) => setAlternativeTechs({ ...alternativeTechs, [item.id]: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: TRANSFUSÃO E ASSINANTE */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-1.5">3. Transfusão & Assinante</h3>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Sobre Transfusão de Sangue (Item 8)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransfusionAccept("aceita")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition text-center ${transfusionAccept === "aceita" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      ACEITA transfusão
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransfusionAccept("nao_aceita")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition text-center ${transfusionAccept === "nao_aceita" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      NÃO ACEITA transfusão
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Quem assinará o Termo?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSignerType("paciente");
                        setSignerName(patientName);
                        setSignerRelation("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition text-center ${signerType === "paciente" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      O próprio paciente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignerType("responsavel");
                        setSignerName("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition text-center ${signerType === "responsavel" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      Um responsável legal
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Nome Completo do Assinante</label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Nome de quem assina"
                      className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-indigo-600 transition mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">CPF do Assinante</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={signerCpf}
                        onChange={(e) => setSignerCpf(formatCPF(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Grau de Parentesco</label>
                      <input
                        type="text"
                        placeholder="Cônjuge, Filho, etc"
                        disabled={signerType === "paciente"}
                        value={signerType === "paciente" ? "O próprio" : signerRelation}
                        onChange={(e) => setSignerRelation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Município</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase">Horário</label>
                      <input
                        type="text"
                        placeholder="HH:MM"
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="emergency-check"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="emergency-check" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    Caso de Emergência (Consentimento impossível)
                  </label>
                </div>
              </div>
            </div>

            {/* BUTTON CONTROLS */}
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGenerating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isGenerating ? "Gerando PDF..." : "Baixar Termo em PDF (A4)"}
              </button>
              
              <button
                type="button"
                onClick={handlePrint}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg border border-slate-200 transition flex items-center justify-center gap-2 text-xs"
              >
                <Printer className="w-4 h-4" />
                Imprimir Diretamente
              </button>
            </div>

          </div>

          {/* RIGHT: REAL-TIME DOUBLE PAGE PDF PREVIEW */}
          <div className="flex-1 bg-slate-500 overflow-auto p-8 flex flex-col items-center gap-8 relative select-none">
            
            {/* FLOAT ZOOM CONTROLS */}
            <div className="fixed bottom-10 right-10 bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-lg px-3 py-2 shadow-md flex items-center gap-3 z-30">
              <button 
                onClick={() => setZoom(Math.max(30, zoom - 10))} 
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 w-10 text-center">{zoom}%</span>
              <button 
                onClick={() => setZoom(Math.min(100, zoom + 10))} 
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div 
              ref={previewContainerRef}
              className="flex flex-col items-center gap-8"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", marginBottom: `${(zoom - 100) * 11.3}px` }}
            >
              
              {/* PAGE 1 */}
              <div className="tcle-print-page w-[210mm] h-[297mm] bg-white text-zinc-800 p-[15mm] relative shadow-lg flex flex-col border border-zinc-200 text-left select-text">
                
                {/* HEADLINE BLOCK */}
                <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-3">
                  <div className="max-w-[65%]">
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 leading-none">TCLE</h1>
                    <p className="text-[9.5px] font-extrabold italic text-zinc-500 mt-1 uppercase">Termo de Consentimento Livre e Esclarecido para Anestesiologia</p>
                  </div>
                  
                  {/* Etiqueta / Header Box */}
                  <div className="border border-zinc-400 w-[78mm] text-xs leading-tight rounded-sm overflow-hidden bg-white shrink-0">
                    <div className="bg-zinc-100 font-bold px-2 py-0.5 border-b border-zinc-300 text-xs tracking-wider text-center uppercase text-zinc-600">
                      Preencher quando não houver etiqueta
                    </div>
                    <div className="p-1.5 space-y-1">
                      <div>
                        <span className="font-semibold text-zinc-500">Nome: </span>
                        <span className="font-bold underline text-xs">{patientName || "______________________________________"}</span>
                      </div>
                      <div className="flex justify-between">
                        <div>
                          <span className="font-semibold text-zinc-500">Nasc: </span>
                          <span className="font-bold underline text-xs">{birthDate || "____/____/________"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-500">Data: </span>
                          <span className="font-bold underline text-xs">{dateStr || "____/____/________"}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <div>
                          <span className="font-semibold text-zinc-500">Prontuário: </span>
                          <span className="font-bold underline text-xs">{recordNumber || "_________"}</span>
                        </div>
                        <div className="max-w-[50%] truncate">
                          <span className="font-semibold text-zinc-500">Hosp: </span>
                          <span className="font-bold underline text-xs" title={hospitalName}>{hospitalName || "______________"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ESSENTIAL PARAGRAPHS */}
                <div className="mt-4 text-[9.5px] leading-relaxed text-zinc-800 space-y-2">
                  <p>
                    Este Termo de Consentimento tem como objetivo permitir a livre escolha do paciente em submeter-se ou não ao procedimento de anestesiologia.
                  </p>
                  <p>
                    A anestesia pode ser definida como a modificação das funções do organismo por meio de medicamentos, com o intuito de reduzir ou eliminar a dor durante procedimento médico (cirurgias ou exames para diagnósticos).
                  </p>
                  <p>
                    O procedimento anestésico é realizado por um médico anestesiologista devidamente habilitado na prática de anestesia e sedação. Este médico permanece junto ao paciente que fica monitorizado durante todo o procedimento. De maneira obrigatória todo paciente é monitorizado quanto aos seguintes sinais vitais: frequência cardíaca, pulso, oxigenação sanguínea, pressão arterial e respiração (no caso de anestesia geral). Existem ao menos três técnicas anestésicas comumente realizadas, cada uma delas envolve métodos diferentes de serem realizados e serão explicados abaixo:
                  </p>
                </div>

                {/* TECHNIQUES TABLE */}
                <div className="mt-4 border border-zinc-400 rounded-sm overflow-hidden">
                  <div className="grid grid-cols-12 bg-zinc-100 text-zinc-800 font-extrabold text-xs text-center uppercase py-1 border-b border-zinc-300">
                    <div className="col-span-1.5 border-r border-zinc-300 text-xs leading-tight px-0.5">Técnica Prop.</div>
                    <div className="col-span-1.5 border-r border-zinc-300 text-xs leading-tight px-0.5">Técnica Alt.</div>
                    <div className="col-span-3 border-r border-zinc-300 text-left pl-2">Técnica</div>
                    <div className="col-span-6 text-left pl-2">Descrição</div>
                  </div>

                  {/* ROW 1: Acompanhamento */}
                  <div className="grid grid-cols-12 text-xs border-b border-zinc-300 items-stretch bg-white">
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-indigo-700">
                        {proposedTechs.acompanhamento && "✓"}
                      </div>
                    </div>
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-emerald-700">
                        {alternativeTechs.acompanhamento && "✓"}
                      </div>
                    </div>
                    <div className="col-span-3 border-r border-zinc-300 font-bold p-1.5 leading-tight flex items-center">
                      Acompanhamento do Serviço de Anestesia
                    </div>
                    <div className="col-span-6 p-1.5 text-zinc-600 leading-tight">
                      Um anestesiologista fica responsável por acompanhar e/ou supervisionar o deslocamento e/ou procedimento.
                    </div>
                  </div>

                  {/* ROW 2: Sedacao */}
                  <div className="grid grid-cols-12 text-xs border-b border-zinc-300 items-stretch bg-white">
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-indigo-700">
                        {proposedTechs.sedacao && "✓"}
                      </div>
                    </div>
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-emerald-700">
                        {alternativeTechs.sedacao && "✓"}
                      </div>
                    </div>
                    <div className="col-span-3 border-r border-zinc-300 font-bold p-1.5 leading-tight flex items-center">
                      Sedação
                    </div>
                    <div className="col-span-6 p-1.5 text-zinc-600 leading-tight">
                      A sedação pode variar de leve (paciente consciente, porém não ansioso) até profunda (paciente em sono profundo, só despertado por estímulos dolorosos). Ela é realizada através da administração de um ou mais tipos de anestésicos.
                    </div>
                  </div>

                  {/* ROW 3: Geral */}
                  <div className="grid grid-cols-12 text-xs border-b border-zinc-300 items-stretch bg-white">
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-indigo-700">
                        {proposedTechs.geral && "✓"}
                      </div>
                    </div>
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-emerald-700">
                        {alternativeTechs.geral && "✓"}
                      </div>
                    </div>
                    <div className="col-span-3 border-r border-zinc-300 font-bold p-1.5 leading-tight flex items-center">
                      Anestesia geral
                    </div>
                    <div className="col-span-6 p-1.5 text-zinc-600 leading-tight">
                      Estado de perda de consciência em que o paciente não é desperto mesmo que sofra algum estímulo doloroso. Pode ser administrada por via: venosa; venosa e inalatória (adultos e crianças) ou apenas inalatória (crianças).
                    </div>
                  </div>

                  {/* ROW 4: Outros */}
                  <div className="grid grid-cols-12 text-xs items-stretch bg-white">
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-indigo-700">
                        {proposedTechs.outros && "✓"}
                      </div>
                    </div>
                    <div className="col-span-1.5 border-r border-zinc-300 flex items-center justify-center bg-zinc-50/50">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-xs flex items-center justify-center font-bold text-emerald-700">
                        {alternativeTechs.outros && "✓"}
                      </div>
                    </div>
                    <div className="col-span-3 border-r border-zinc-300 font-bold p-1.5 leading-tight flex items-center">
                      Outros procedimentos
                    </div>
                    <div className="col-span-6 p-1.5 text-zinc-600 leading-tight">
                      Eventualmente serão necessários outros procedimentos invasivos para a realização da anestesia e sua monitorização, entre eles estão a inserção de cateter venoso central, punção arterial, sondagem gástrica, entre outros.
                    </div>
                  </div>
                </div>

                {/* TEXT BEFORE RISKS */}
                <p className="mt-3.5 text-[9.5px] leading-tight text-zinc-800">
                  Por ser um procedimento complexo a anestesia envolve diversos riscos e pode levar a uma série de complicações e efeitos colaterais com diferentes níveis de gravidade, entre eles:
                </p>

                {/* RISKS TABLE (DOUBLE COLUMN) */}
                <div className="mt-2 border border-zinc-300 rounded-xs overflow-hidden bg-zinc-50">
                  <div className="bg-zinc-200 text-zinc-800 font-extrabold text-xs text-center uppercase py-0.5 tracking-wider border-b border-zinc-300">
                    Anestesia Geral / Sedação - Principais Complicações Relacionadas
                  </div>
                  <div className="grid grid-cols-2 text-xs p-2 gap-x-6 gap-y-1 bg-white">
                    <div className="space-y-1">
                      <div>• Náusea e vômito</div>
                      <div>• Dor de garganta</div>
                      <div>• Lesão dentária</div>
                      <div>• Reações alérgicas</div>
                      <div>• Consciência intraoperatória</div>
                      <div>• Acidente vascular cerebral (Derrame)</div>
                    </div>
                    <div className="space-y-1">
                      <div>• Arritmias cardíacas</div>
                      <div>• Aspiração de conteúdo gástrico</div>
                      <div>• Infarto agudo do miocárdio</div>
                      <div>• Perda visual parcial ou total</div>
                      <div>• Hipóxia (Baixa oxigenação)</div>
                      <div>• Parada cardiorrespiratória e óbito</div>
                    </div>
                  </div>
                </div>

                {/* DECLARATIONS 01, 02, 03 */}
                <div className="mt-4 text-xs leading-relaxed text-zinc-800 space-y-2">
                  <p className="font-semibold text-zinc-900">
                    Diante dos esclarecimentos iniciais, declaro, para fins legais, conforme segue:
                  </p>
                  <p>
                    <span className="font-bold">01. Autorizo o Dr.</span> <span className="font-extrabold underline text-zinc-950">{doctorName || "_________________________________"}</span> ou outro anestesiologista credenciado pelo Hospital/Clínica, a realizar na minha pessoa, anestesia/sedação para o seguinte procedimento: <span className="font-extrabold underline text-indigo-950">{procedure || "_________________________________________________________________________"}</span>
                  </p>
                  <p>
                    <span className="font-bold">02. Estou ciente de que</span>, para minha segurança e benefício, existe a possibilidade de mudança de conduta anestésica durante o procedimento e que, em caso de risco iminente de vida, autorizo todo e qualquer procedimento que preserve o meu direito a vida, resguardado o meu direito quanto à anuência ou rejeição tangente ao procedimento de transfusão de sangue, conforme será informado ao parágrafo n. 8 do presente termo.
                  </p>
                  <p>
                    <span className="font-bold">03. Declaro também expressa ciência</span> de que o anestesiologista exerce atividade de meio, através da qual obriga-se a prestar seus serviços da melhor forma e condições que lhe forem possíveis, agindo com a melhor técnica, zelo profissional e diligência em busca do meu bem-estar geral e preservação de minha vida.
                  </p>
                </div>

                {/* A4 PAGES FOOTER */}
                <div className="absolute bottom-6 left-[15mm] right-[15mm] border-t border-zinc-200 pt-1 flex justify-between items-center text-xs font-bold text-zinc-400">
                  <span>AnestFlow - Prontuário Eletrônico de Anestesia</span>
                  <span>1ª Via Hospital | 2ª Via Paciente</span>
                </div>

              </div>

              {/* PAGE 2 */}
              <div className="tcle-print-page w-[210mm] h-[297mm] bg-white text-zinc-800 p-[15mm] relative shadow-lg flex flex-col border border-zinc-200 text-left select-text">
                
                {/* DECLARATIONS 04, 05, 06, 07 */}
                <div className="text-xs leading-relaxed text-zinc-800 space-y-2.5">
                  <p>
                    <span className="font-bold">04. Declaro ainda</span> que me foi explicado sobre as condutas e riscos que envolvem o ato anestésico em questão, por meio de palavras claras e compreensíveis pelo anestesiologista, tendo tido oportunidade para escolher entre submeter-me ou não ao ato anestésico.
                  </p>
                  <p>
                    <span className="font-bold">05. Declaro</span> que prestei ao anestesiologista todas as informações necessárias acerca de minhas condições físicas e psicológicas, sem ocultar qualquer fato ou elemento que seja imprescindível para o procedimento de anestesiologia.
                  </p>
                  <p>
                    <span className="font-bold">06. Declaro ainda</span> que minha admissão no hospital/clínica em questão deu-se por minha livre e espontânea vontade, tendo conhecimento que o anestesiologista apenas se responsabiliza pelos procedimentos de sua especialidade, não cabendo a sua responsabilização pela qualidade dos serviços que serão prestados pela instituição ou por outros profissionais que participem do ato cirúrgico.
                  </p>
                  <p>
                    <span className="font-bold">07. Entendi</span> que procedimentos menores podem ser realizados com anestesia local ou até mesmo sem anestesia. Na maioria dos casos, não realizar anestesia ou sedação poderá impossibilitar a realização do procedimento.
                  </p>
                </div>

                {/* TRANSFUSION / SECTION 8 */}
                <div className="mt-4 border border-zinc-300 rounded-xs p-3 bg-zinc-50/50">
                  <h3 className="text-[9.5px] font-bold text-zinc-900 leading-tight">
                    8. Dever ético de esclarecimento e decisão sobre Transfusão Sanguínea
                  </h3>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    O presente item tem o dever ético de comprovar as informações prestadas ao paciente e/ou responsável, pelo médico assistente, dos principais aspectos relacionados à transfusão sanguínea. Diante dos esclarecimentos iniciais, declaro, para fins legais, conforme segue:
                  </p>
                  
                  <div className="mt-2.5 space-y-2 text-xs font-semibold text-zinc-800">
                    <div className="flex items-start gap-2.5">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-full flex items-center justify-center font-bold text-xs bg-white shrink-0 mt-0.5 text-emerald-600">
                        {transfusionAccept === "aceita" && "●"}
                      </div>
                      <p className="leading-tight">
                        ( <span className={transfusionAccept === "aceita" ? "font-bold text-emerald-700 underline" : ""}>X</span> ) <span className="font-bold">ACEITO</span> receber transfusões de sangue e/ou seus componentes, se necessário para preservação da minha integridade física ou vida.
                      </p>
                    </div>
                    
                    <div className="flex items-start gap-2.5">
                      <div className="w-3.5 h-3.5 border border-zinc-400 rounded-full flex items-center justify-center font-bold text-xs bg-white shrink-0 mt-0.5 text-rose-600">
                        {transfusionAccept === "nao_aceita" && "●"}
                      </div>
                      <p className="leading-tight">
                        ( <span className={transfusionAccept === "nao_ace_ita" ? "font-bold text-rose-700 underline" : ""}>X</span> ) <span className="font-bold">NÃO ACEITO</span> receber transfusões de sangue e/ou seus componentes, assumindo e declarando estar plenamente ciente de todos os riscos graves decorrentes desta decisão.
                      </p>
                    </div>
                  </div>

                  {/* MINI SIGNATURE PATIENT/GUARDIAN */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-zinc-200 mt-3 pt-3 text-xs text-zinc-800">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border border-zinc-400 rounded-full flex items-center justify-center text-xs bg-white">
                          {signerType === "paciente" && "✓"}
                        </div>
                        <span>Paciente</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border border-zinc-400 rounded-full flex items-center justify-center text-xs bg-white">
                          {signerType === "responsavel" && "✓"}
                        </div>
                        <span>Responsável</span>
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-500">CPF:</span> <span className="underline font-bold tabular-nums">{signerCpf || "______________________"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="font-semibold text-zinc-500">Nome Legível:</span> <span className="underline font-bold uppercase">{signerName || "______________________________________________________________________"}</span>
                    </div>

                    <div>
                      <span className="font-semibold text-zinc-500">Assinatura:</span> <span className="underline text-zinc-400">_____________________________</span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-500">Grau Parentesco:</span> <span className="underline font-bold">{signerType === "paciente" ? "O próprio" : (signerRelation || "_____________________")}</span>
                    </div>

                    <div className="col-span-2 flex justify-between">
                      <div>
                        <span className="font-semibold text-zinc-500">Município:</span> <span className="font-bold underline">{location || "Goiânia"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-500">Data:</span> <span className="font-bold underline">{dateStr || "____/____/________"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-500">Hora:</span> <span className="font-bold underline tabular-nums">{timeStr || "____:____"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DOUBLE BOXES DEVE SER PREENCHIDO PELO PACIENTE / MEDICO */}
                <div className="mt-4 grid grid-cols-2 gap-4 flex-1">
                  
                  {/* BOX PACIENTE */}
                  <div className="border border-zinc-400 rounded-xs bg-white flex flex-col overflow-hidden">
                    <div className="bg-zinc-100 text-zinc-900 font-extrabold text-xs py-1 text-center border-b border-zinc-400 uppercase tracking-tight">
                      Deve ser preenchido pelo paciente
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-1 text-[8.2px] leading-relaxed text-zinc-700">
                      <p className="text-justify font-medium">
                        Confirmo que recebi explicações, li, compreendi e concordo com os itens acima referidos e que, apesar de ter entendido as explicações que me foram prestadas, de terem sido esclarecidas todas as dúvidas e estando plenamente satisfeito(a) com as informações recebidas, <span className="font-bold">RESERVO-ME o direito de revogar este consentimento</span> até que o procedimento, objeto deste documento, seja iniciado.
                      </p>
                      
                      <div className="space-y-1.5 border-t border-dashed border-zinc-300 pt-2.5 mt-2 text-xs">
                        <div className="flex gap-3">
                          <span className="flex items-center gap-0.5">
                            <span className="w-2.5 h-2.5 border border-zinc-400 rounded-full flex items-center justify-center font-bold text-[6px]">{signerType === "paciente" ? "✓" : ""}</span> Paciente
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="w-2.5 h-2.5 border border-zinc-400 rounded-full flex items-center justify-center font-bold text-[6px]">{signerType === "responsavel" ? "✓" : ""}</span> Responsável
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold">Grau de Parentesco:</span> <span className="font-bold underline">{signerType === "paciente" ? "O próprio" : (signerRelation || "_________________")}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold">Nome:</span> <span className="font-bold underline block truncate uppercase">{signerName || "________________________________________"}</span>
                        </div>
                        <div className="flex justify-between">
                          <div><span className="text-zinc-500 font-semibold">CPF:</span> <span className="font-bold underline tabular-nums">{signerCpf || "_________________"}</span></div>
                          <div><span className="text-zinc-500 font-semibold">Data:</span> <span className="font-bold underline">{dateStr || "___/___/_____"}</span></div>
                        </div>
                        <div className="pt-1">
                          <span className="text-zinc-500 font-semibold">Assinatura:</span> <span className="text-zinc-400">_____________________________</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOX MÉDICO */}
                  <div className="border border-zinc-400 rounded-xs bg-white flex flex-col overflow-hidden">
                    <div className="bg-zinc-100 text-zinc-900 font-extrabold text-xs py-1 text-center border-b border-zinc-400 uppercase tracking-tight">
                      Deve ser preenchido pelo médico
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-1 text-[8.2px] leading-relaxed text-zinc-700">
                      <p className="text-justify font-medium">
                        Expliquei todo o procedimento, exame, tratamento e/ou cirurgia a que o paciente acima referido está sujeito, ao próprio paciente e/ou seu responsável, sobre os benefícios, riscos e alternativas, tendo respondido às perguntas formuladas pelos mesmos. De acordo com o meu entendimento, o paciente e/ou seu responsável, está em condições de compreender o que lhes foi informado.
                      </p>

                      <div className="space-y-1.5 border-t border-dashed border-zinc-300 pt-2.5 mt-2 text-xs">
                        <div className="flex items-center gap-1 text-rose-600 font-bold">
                          <span className="w-3 h-3 border border-zinc-400 rounded-xs flex items-center justify-center">{isEmergency ? "✓" : ""}</span>
                          <span>Não foi possível obter o consentimento (Emergência)</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-semibold">Nome Médico:</span> <span className="font-bold underline block truncate uppercase">{doctorName || "________________________________________"}</span>
                        </div>
                        <div className="flex justify-between">
                          <div><span className="text-zinc-500 font-semibold">CRM:</span> <span className="font-bold underline tabular-nums">{doctorCrm || "_________________"}</span></div>
                          <div><span className="text-zinc-500 font-semibold">Data:</span> <span className="font-bold underline">{dateStr || "___/___/_____"}</span></div>
                        </div>
                        <div className="pt-1">
                          <span className="text-zinc-500 font-semibold">Assinatura / Carimbo:</span> <span className="text-zinc-400">_______________________</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* BOTTOM BRANDING & EVALUATION BANNER */}
                <div className="mt-3.5 border border-zinc-300 rounded-sm p-1.5 bg-zinc-50 flex justify-between items-center text-xs tracking-tight">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-indigo-600 text-white font-black flex items-center justify-center text-xs rounded-xs select-none">
                      AF
                    </div>
                    <div>
                      <span className="font-black text-indigo-900 block leading-none">AnestFlow Digital</span>
                      <span className="text-xs text-zinc-400">Inovação e Segurança em Anestesiologia</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600 font-medium">
                    <span>Fale com a gente! Ao final avalie o atendimento do anestesista.</span>
                    <div className="text-amber-500 font-bold shrink-0 text-xs">★★★★★</div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="absolute bottom-6 left-[15mm] right-[15mm] border-t border-zinc-200 pt-1 flex justify-between items-center text-xs font-bold text-zinc-400">
                  <span>AnestFlow - Prontuário Eletrônico de Anestesia</span>
                  <span>1ª Via Hospital | 2ª Via Paciente</span>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
