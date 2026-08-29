import React, { useState } from "react";
import { AnesthesiaDocument, PostAnesthesiaRecovery } from "../types";
import { Shield, Plus, Clock, Save, Trash2, CheckCircle, Activity, Smile, RefreshCw, AlertTriangle, Settings, Heart, Thermometer } from "lucide-react";

interface RecoveryTabProps {
  document: AnesthesiaDocument;
  onUpdateRecovery: (recData: Partial<PostAnesthesiaRecovery>) => void;
  theme?: "light" | "dark" | "dark-clean";
}

export default function RecoveryTab({ document, onUpdateRecovery, theme = "light" }: RecoveryTabProps) {
  const recovery = document.recovery;
  const records = recovery.records || [];

  // Find latest intraoperative vitals as fallback
  const getLatestIntraoperativeVitals = () => {
    if (!document.vitals || document.vitals.length === 0) return null;
    const sorted = [...document.vitals].sort((a, b) => b.minutesFromStart - a.minutesFromStart);
    return sorted.find(v => v.pas !== undefined || v.fc !== undefined || v.spo2 !== undefined || v.temp !== undefined) || null;
  };

  const latestIntra = getLatestIntraoperativeVitals();

  // Baseline reference values (resolved with fallbacks)
  const baselinePas = recovery.pas ?? latestIntra?.pas ?? 120;
  const baselinePad = recovery.pad ?? latestIntra?.pad ?? 80;
  const baselineFc = recovery.fc ?? latestIntra?.fc ?? 80;
  const baselineSpo2 = recovery.spo2 ?? latestIntra?.spo2 ?? 98;
  const baselineTemp = recovery.temp ?? latestIntra?.temp ?? 36.5;

  // Deviation parameters (resolved with fallbacks)
  const pasDeviationPct = recovery.paramPasDeviationPct ?? 20; // default 20%
  const fcDeviationPct = recovery.paramFcDeviationPct ?? 20; // default 20%
  const minSpo2 = recovery.paramMinSpo2 ?? 94; // default 94%
  const minTemp = recovery.paramMinTemp ?? 35.5; // default 35.5 C
  const maxTemp = recovery.paramMaxTemp ?? 37.8; // default 37.8 C

  // Calculated safe ranges
  const minPas = Math.round(baselinePas * (1 - pasDeviationPct / 100));
  const maxPas = Math.round(baselinePas * (1 + pasDeviationPct / 100));
  const minPad = Math.round(baselinePad * (1 - pasDeviationPct / 100));
  const maxPad = Math.round(baselinePad * (1 + pasDeviationPct / 100));
  
  const minFc = Math.round(baselineFc * (1 - fcDeviationPct / 100));
  const maxFc = Math.round(baselineFc * (1 + fcDeviationPct / 100));

  const checkVitalsAlert = (pasStr: string, padStr: string, fcStr: string, spo2Str: string, tempStr: string) => {
    const alerts: string[] = [];
    
    if (pasStr) {
      const p = parseInt(pasStr);
      if (p < minPas) alerts.push(`PAS baixa (${p} < limite de ${minPas} mmHg)`);
      if (p > maxPas) alerts.push(`PAS alta (${p} > limite de ${maxPas} mmHg)`);
    }
    if (padStr) {
      const p = parseInt(padStr);
      if (p < minPad) alerts.push(`PAD baixa (${p} < limite de ${minPad} mmHg)`);
      if (p > maxPad) alerts.push(`PAD alta (${p} > limite de ${maxPad} mmHg)`);
    }
    if (fcStr) {
      const f = parseInt(fcStr);
      if (f < minFc) alerts.push(`FC baixa (${f} < limite de ${minFc} bpm)`);
      if (f > maxFc) alerts.push(`FC alta (${f} > limite de ${maxFc} bpm)`);
    }
    if (spo2Str) {
      const s = parseInt(spo2Str);
      if (s < minSpo2) alerts.push(`Saturação crítica (${s}% < limite de ${minSpo2}%)`);
    }
    if (tempStr) {
      const t = parseFloat(tempStr);
      if (t < minTemp) alerts.push(`Hipotermia (${t.toFixed(1)}°C < limite de ${minTemp.toFixed(1)}°C)`);
      if (t > maxTemp) alerts.push(`Hipertermia (${t.toFixed(1)}°C > limite de ${maxTemp.toFixed(1)}°C)`);
    }
    
    return alerts;
  };

  const currentAlerts = checkVitalsAlert(
    recovery.records?.[recovery.records.length - 1]?.pas ? String(recovery.records[recovery.records.length - 1].pas) : "",
    recovery.records?.[recovery.records.length - 1]?.pad ? String(recovery.records[recovery.records.length - 1].pad) : "",
    recovery.records?.[recovery.records.length - 1]?.fc ? String(recovery.records[recovery.records.length - 1].fc) : "",
    recovery.records?.[recovery.records.length - 1]?.spo2 ? String(recovery.records[recovery.records.length - 1].spo2) : "",
    recovery.records?.[recovery.records.length - 1]?.temp ? String(recovery.records[recovery.records.length - 1].temp) : ""
  );

  const getRecordAlerts = (r: any) => {
    const alerts: string[] = [];
    if (r.pas !== undefined) {
      if (r.pas < minPas) alerts.push(`PAS baixa (${r.pas} < ${minPas})`);
      if (r.pas > maxPas) alerts.push(`PAS alta (${r.pas} > ${maxPas})`);
    }
    if (r.pad !== undefined) {
      if (r.pad < minPad) alerts.push(`PAD baixa (${r.pad} < ${minPad})`);
      if (r.pad > maxPad) alerts.push(`PAD alta (${r.pad} > ${maxPad})`);
    }
    if (r.fc !== undefined) {
      if (r.fc < minFc) alerts.push(`FC baixa (${r.fc} < ${minFc})`);
      if (r.fc > maxFc) alerts.push(`FC alta (${r.fc} > ${maxFc})`);
    }
    if (r.spo2 !== undefined) {
      if (r.spo2 < minSpo2) alerts.push(`SpO₂ baixo (${r.spo2}% < ${minSpo2}%)`);
    }
    if (r.temp !== undefined) {
      if (r.temp < minTemp) alerts.push(`Hipotermia (${r.temp}°C < ${minTemp}°C)`);
      if (r.temp > maxTemp) alerts.push(`Hipertermia (${r.temp}°C > ${maxTemp}°C)`);
    }
    return alerts;
  };

  // Active form state for adding a new recovery serial observation
  const [newRecord, setNewRecord] = useState({
    pas: "",
    pad: "",
    fc: "",
    spo2: "99",
    fr: "16",
    temp: "36.5",
    painScale: "0",
    nauseaVomiting: "Ausente" as any,
    consciousnessState: "Acordado/Alerta" as any,
    motorActivity: "Move 4 membros voluntariamente" as any,
    motorBlockBromage: "Bromage 0 (Sem bloqueio)" as any,
    dressingStatus: "Seco" as any,
    
    // Aldrete Kroulik fields
    aldreteConsciousness: 2,
    aldreteRespiration: 2,
    aldreteCirculation: 2,
    aldreteActivity: 2,
    aldreteOximetry: 2
  });

  const handleAddObservation = () => {
    const mins = records.length * 15; // default spacing of 15 min
    const timestamp = new Date().toISOString();

    // Calculate Aldrete Total
    const aldreteTotal = 
      newRecord.aldreteConsciousness +
      newRecord.aldreteRespiration +
      newRecord.aldreteCirculation +
      newRecord.aldreteActivity +
      newRecord.aldreteOximetry;

    const record = {
      id: `rec-${Date.now()}`,
      timestamp,
      minutesFromAdmission: mins,
      pas: newRecord.pas ? parseInt(newRecord.pas) : undefined,
      pad: newRecord.pad ? parseInt(newRecord.pad) : undefined,
      fc: newRecord.fc ? parseInt(newRecord.fc) : undefined,
      spo2: newRecord.spo2 ? parseInt(newRecord.spo2) : undefined,
      fr: newRecord.fr ? parseInt(newRecord.fr) : undefined,
      temp: newRecord.temp ? parseFloat(newRecord.temp) : undefined,
      painScale: parseInt(newRecord.painScale),
      nauseaVomiting: newRecord.nauseaVomiting,
      consciousnessState: newRecord.consciousnessState,
      motorActivity: newRecord.motorActivity,
      motorBlockBromage: newRecord.motorBlockBromage,
      dressingStatus: newRecord.dressingStatus,
      aldreteConsciousness: newRecord.aldreteConsciousness,
      aldreteRespiration: newRecord.aldreteRespiration,
      aldreteCirculation: newRecord.aldreteCirculation,
      aldreteActivity: newRecord.aldreteActivity,
      aldreteOximetry: newRecord.aldreteOximetry,
      aldreteTotal
    };

    onUpdateRecovery({
      records: [...records, record]
    });

    // Reset some fields
    setNewRecord(prev => ({
      ...prev,
      pas: "",
      pad: "",
      fc: "",
      painScale: "0"
    }));
  };

  const handleRemoveRecord = (id: string) => {
    onUpdateRecovery({
      records: records.filter(r => r.id !== id)
    });
  };

  const handleDischarge = () => {
    onUpdateRecovery({
      dischargeTime: new Date().toISOString(),
      dischargingAnesthesiologist: document.team.anesthesiologistLead,
      dischargingCRM: document.team.crmLead,
      dischargingUF: document.team.ufLead,
      dischargeDestination: "Enfermaria (Quarto)",
      dischargeInstructions: "Repouso no leito, analgésicos SOS conforme prescrição pós-operatória, dieta branda após restabelecimento motor completo."
    });
  };

  return (
    <div className="space-y-6">
      
      {/* SRPA INTAKE DETAILS */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <span className="text-xs text-slate-400 dark:text-zinc-500 block font-medium">Anestesiologista de Recebimento</span>
          <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{document.team.anesthesiologistLead}</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 dark:text-zinc-500 block font-medium">Horário de Admissão na SRPA</span>
          <span className="text-sm tabular-nums font-bold text-slate-800 dark:text-zinc-100">
            {recovery.admissionTime ? new Date(recovery.admissionTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "Pendente Admissão"}
          </span>
        </div>
        {!recovery.admissionTime ? (
          <button
            onClick={() => onUpdateRecovery({ admissionTime: new Date().toISOString() })}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-bold py-2 px-4 rounded-lg text-xs transition"
          >
            Registrar Entrada na SRPA
          </button>
        ) : (
          <div className="text-emerald-600 font-bold text-xs flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Paciente Admitido na SRPA
          </div>
        )}
      </div>

      {/* BARREIRA DE SEGURANÇA QMENTUM — PARAMETRIZAÇÃO INDIVIDUALIZADA */}
      <div className="bg-indigo-50/50 dark:bg-zinc-900/40 border-indigo-150/60 dark:border-zinc-800/60 p-6 rounded-lg border transition-colors space-y-4">
        <div className="flex items-center gap-2.5 border-b border-indigo-100/60 dark:border-zinc-800/65 pb-3">
          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div>
            <h3 className="font-bold text-indigo-950 dark:text-zinc-100 text-xs sm:text-sm">
              Barreira de Segurança Clínica — Metas QMentum
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Parametrização individualizada de sinais vitais baseada em porcentagem do estado de admissão do paciente para detecção precoce de deterioração clínica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BASAL PARAMETERS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              1. Parâmetros Basais de Entrada (Referência)
            </h4>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">PAS (mmHg)</label>
                <input
                  type="number"
                  value={recovery.pas !== undefined ? recovery.pas : ""}
                  placeholder={String(latestIntra?.pas ?? 120)}
                  onChange={(e) => onUpdateRecovery({ pas: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">PAD (mmHg)</label>
                <input
                  type="number"
                  value={recovery.pad !== undefined ? recovery.pad : ""}
                  placeholder={String(latestIntra?.pad ?? 80)}
                  onChange={(e) => onUpdateRecovery({ pad: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">FC (bpm)</label>
                <input
                  type="number"
                  value={recovery.fc !== undefined ? recovery.fc : ""}
                  placeholder={String(latestIntra?.fc ?? 80)}
                  onChange={(e) => onUpdateRecovery({ fc: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">SpO₂ (%)</label>
                <input
                  type="number"
                  value={recovery.spo2 !== undefined ? recovery.spo2 : ""}
                  placeholder={String(latestIntra?.spo2 ?? 98)}
                  onChange={(e) => onUpdateRecovery({ spo2: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={recovery.temp !== undefined ? recovery.temp : ""}
                  placeholder={String(latestIntra?.temp ?? 36.5)}
                  onChange={(e) => onUpdateRecovery({ temp: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
            {latestIntra && !recovery.pas && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold italic">
                * Valores preenchidos automaticamente do final do intraoperatório.
              </p>
            )}
          </div>

          {/* PARAMETRIZATION TARGETS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              2. Metas Clínicas & Tolerâncias de Segurança
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Desvio PA</label>
                <select
                  value={pasDeviationPct}
                  onChange={(e) => onUpdateRecovery({ paramPasDeviationPct: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value={10}>±10%</option>
                  <option value={15}>±15%</option>
                  <option value={20}>±20%</option>
                  <option value={25}>±25%</option>
                  <option value={30}>±30%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Desvio FC</label>
                <select
                  value={fcDeviationPct}
                  onChange={(e) => onUpdateRecovery({ paramFcDeviationPct: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value={10}>±10%</option>
                  <option value={15}>±15%</option>
                  <option value={20}>±20%</option>
                  <option value={25}>±25%</option>
                  <option value={30}>±30%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Mín SpO₂</label>
                <select
                  value={minSpo2}
                  onChange={(e) => onUpdateRecovery({ paramMinSpo2: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value={90}>≥ 90%</option>
                  <option value={92}>≥ 92%</option>
                  <option value={93}>≥ 93%</option>
                  <option value={94}>≥ 94%</option>
                  <option value={95}>≥ 95%</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">T. Mín</label>
                  <input
                    type="number"
                    step="0.1"
                    value={minTemp}
                    onChange={(e) => onUpdateRecovery({ paramMinTemp: parseFloat(e.target.value) })}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">T. Máx</label>
                  <input
                    type="number"
                    step="0.1"
                    value={maxTemp}
                    onChange={(e) => onUpdateRecovery({ paramMaxTemp: parseFloat(e.target.value) })}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg px-1 py-1 text-center tabular-nums text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIVE SAFE RANGE LIMITS DISPLAY */}
        <div className="bg-white/80 dark:bg-zinc-950/60 rounded-lg p-3 border border-indigo-100/40 dark:border-zinc-800/70 flex flex-wrap gap-4 justify-between items-center text-xs tabular-nums">
          <span className="font-sans font-black text-indigo-950 dark:text-zinc-200 text-xs uppercase tracking-wider">Limites de Alerta Calculados:</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <span className="text-slate-600 dark:text-zinc-400">PAS: <b className="text-indigo-700 dark:text-indigo-400">{minPas} - {maxPas}</b> mmHg</span>
            <span className="text-slate-600 dark:text-zinc-400">PAD: <b className="text-indigo-700 dark:text-indigo-400">{minPad} - {maxPad}</b> mmHg</span>
            <span className="text-slate-600 dark:text-zinc-400">FC: <b className="text-indigo-700 dark:text-indigo-400">{minFc} - {maxFc}</b> bpm</span>
            <span className="text-slate-600 dark:text-zinc-400">SpO₂: <b className="text-indigo-700 dark:text-indigo-400">≥ {minSpo2}%</b></span>
            <span className="text-slate-600 dark:text-zinc-400">Temp: <b className="text-indigo-700 dark:text-indigo-400">{minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C</b></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* OBSERVATION ADD PANEL (Left Col 5) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
          <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Registrar Avaliação Seriada</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">PAS (mmHg)</label>
              <input
                type="number"
                value={newRecord.pas}
                onChange={(e) => setNewRecord({ ...newRecord, pas: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">PAD (mmHg)</label>
              <input
                type="number"
                value={newRecord.pad}
                onChange={(e) => setNewRecord({ ...newRecord, pad: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">FC (bpm)</label>
              <input
                type="number"
                value={newRecord.fc}
                onChange={(e) => setNewRecord({ ...newRecord, fc: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">SpO₂ (%)</label>
              <input
                type="number"
                value={newRecord.spo2}
                onChange={(e) => setNewRecord({ ...newRecord, spo2: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">FR (irpm)</label>
              <input
                type="number"
                value={newRecord.fr}
                onChange={(e) => setNewRecord({ ...newRecord, fr: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={newRecord.temp}
                onChange={(e) => setNewRecord({ ...newRecord, temp: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs text-center tabular-nums focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">Dor (0-10)</label>
              <select
                value={newRecord.painScale}
                onChange={(e) => setNewRecord({ ...newRecord, painScale: e.target.value })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-hidden"
              >
                {[0,1,2,3,4,5,6,7,8,9,10].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">Náuseas/Vômitos</label>
              <select
                value={newRecord.nauseaVomiting}
                onChange={(e) => setNewRecord({ ...newRecord, nauseaVomiting: e.target.value as any })}
                className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-hidden"
              >
                <option value="Ausente">Ausente</option>
                <option value="Náusea Leve">Náusea Leve</option>
                <option value="Náusea Moderada/Vômito">Náusea Mod/Vômito</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-0.5">Bloqueio Motor (Escala Bromage)</label>
            <select
              value={newRecord.motorBlockBromage}
              onChange={(e) => setNewRecord({ ...newRecord, motorBlockBromage: e.target.value as any })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-hidden"
            >
              <option value="Bromage 0 (Sem bloqueio)">Bromage 0 - Livre (Move perna estendida)</option>
              <option value="Bromage 1 (Incapacidade de elevar a perna estendida)">Bromage 1 - Parcial (Flete joelho)</option>
              <option value="Bromage 2 (Incapacidade de fletir os joelhos)">Bromage 2 - Quase total (Flete tornozelo)</option>
              <option value="Bromage 3 (Incapacidade de fletir o tornozelo)">Bromage 3 - Total (Sem movimentos)</option>
            </select>
          </div>

          {/* DYNAMIC ALDRETE-KROULIK CALCULATOR (NÍVEL 2) */}
          <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 dark:bg-zinc-950/20 dark:border-zinc-800 space-y-3">
            <h4 className="font-bold text-xs text-indigo-800 dark:text-indigo-400 tracking-wide uppercase flex justify-between">
              <span>Índice de Aldrete-Kroulik</span>
              <span className="tabular-nums text-xs font-black">
                PONTOS: {newRecord.aldreteConsciousness + newRecord.aldreteRespiration + newRecord.aldreteCirculation + newRecord.aldreteActivity + newRecord.aldreteOximetry} / 10
              </span>
            </h4>

            <div className="space-y-2 text-xs select-none">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400 font-semibold">1. Consciência</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRecord({ ...newRecord, aldreteConsciousness: v })}
                      className={`w-7 py-1 text-xs rounded font-bold transition ${newRecord.aldreteConsciousness === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-zinc-800"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400 font-semibold">2. Respiração</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRecord({ ...newRecord, aldreteRespiration: v })}
                      className={`w-7 py-1 text-xs rounded font-bold transition ${newRecord.aldreteRespiration === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-zinc-800"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400 font-semibold">3. Circulação (PA)</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRecord({ ...newRecord, aldreteCirculation: v })}
                      className={`w-7 py-1 text-xs rounded font-bold transition ${newRecord.aldreteCirculation === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-zinc-800"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400 font-semibold">4. Atividade Motora</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRecord({ ...newRecord, aldreteActivity: v })}
                      className={`w-7 py-1 text-xs rounded font-bold transition ${newRecord.aldreteActivity === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-zinc-800"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400 font-semibold">5. Saturação O₂</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRecord({ ...newRecord, aldreteOximetry: v })}
                      className={`w-7 py-1 text-xs rounded font-bold transition ${newRecord.aldreteOximetry === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-zinc-800"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* LIVE GATILHOS CLÍNICOS WARNING */}
          {checkVitalsAlert(newRecord.pas, newRecord.pad, newRecord.fc, newRecord.spo2, newRecord.temp).length > 0 && (
            <div className="p-3 bg-amber-50/90 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/35 rounded-lg text-xs text-amber-850 dark:text-amber-300 font-medium space-y-1">
              <span className="font-bold flex items-center gap-1 text-amber-900 dark:text-amber-200 uppercase tracking-wide text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Gatilhos Clínicos Ativos (QMentum)
              </span>
              <div className="space-y-0.5 pl-1">
                {checkVitalsAlert(newRecord.pas, newRecord.pad, newRecord.fc, newRecord.spo2, newRecord.temp).map((alt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                    <span>{alt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleAddObservation}
            disabled={!recovery.admissionTime}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Registrar Avaliação
          </button>
        </div>

        {/* SERIAL RECORDINGS VIEW (Right Col 7) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* SERIAL TABLE CARD */}
          <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors flex-1">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm border-b border-slate-100 dark:border-zinc-800/70 pb-3 mb-4">
              Histórico de Registros Seriados SRPA
            </h3>

            {records.length > 0 ? (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {records.map((r, index) => {
                  const rAlerts = getRecordAlerts(r);
                  return (
                    <div key={r.id} className={`p-4 rounded-lg border relative text-xs grid grid-cols-2 sm:grid-cols-5 gap-3 items-center transition ${rAlerts.length > 0 ? "bg-amber-50/40 border-amber-100/70 dark:bg-amber-950/5 dark:border-amber-900/20" : "bg-slate-50/80 border-slate-100 dark:bg-zinc-950/50 dark:border-zinc-800/80"}`}>
                      <div className="col-span-1">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 block">+{r.minutesFromAdmission} min</span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
                          {new Date(r.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 dark:text-zinc-500 block font-medium uppercase text-xs tracking-wider">Cardio/Hem</span>
                        <span className={`font-bold tabular-nums text-xs block ${(r.pas !== undefined && (r.pas < minPas || r.pas > maxPas)) || (r.pad !== undefined && (r.pad < minPad || r.pad > maxPad)) ? "text-amber-600 font-extrabold" : "text-slate-800 dark:text-zinc-200"}`}>
                          {r.pas !== undefined && r.pad !== undefined ? `${r.pas}/${r.pad}` : "—"}
                        </span>
                        <span className={`text-xs tabular-nums block ${r.fc !== undefined && (r.fc < minFc || r.fc > maxFc) ? "text-amber-600 font-extrabold" : "text-slate-500 dark:text-zinc-400"}`}>FC: {r.fc || "—"} bpm</span>
                      </div>

                      <div>
                        <span className="text-slate-400 dark:text-zinc-500 block font-medium uppercase text-xs tracking-wider">Oxig. / Termo</span>
                        <span className={`font-bold tabular-nums text-xs block ${r.spo2 !== undefined && r.spo2 < minSpo2 ? "text-rose-600 font-extrabold" : "text-slate-800 dark:text-zinc-200"}`}>
                          SpO₂: {r.spo2 !== undefined ? `${r.spo2}%` : "—"}
                        </span>
                        <span className={`text-xs tabular-nums block ${r.temp !== undefined && (r.temp < minTemp || r.temp > maxTemp) ? "text-amber-600 font-extrabold" : "text-slate-500 dark:text-zinc-400"}`}>
                          T: {r.temp !== undefined ? `${r.temp.toFixed(1)}°C` : "—"}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 dark:text-zinc-500 block font-medium uppercase text-xs tracking-wider">Aldrete / Resp</span>
                        <span className={`tabular-nums font-bold px-2 py-0.5 rounded text-xs inline-block ${r.aldreteTotal! >= 8 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                          {r.aldreteTotal} / 10
                        </span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums block">FR: {r.fr || "—"} irpm</span>
                      </div>

                      <div className="flex justify-end gap-2 col-span-2 sm:col-span-1">
                        <button
                          onClick={() => handleRemoveRecord(r.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expandable details line */}
                      <div className="col-span-2 sm:col-span-5 border-t border-slate-200/50 dark:border-zinc-800/50 pt-2 text-xs text-slate-500 dark:text-zinc-400 grid grid-cols-3 gap-2">
                        <div><Smile className="w-3.5 h-3.5 inline mr-1 text-slate-400 dark:text-zinc-500" />Dor: <b>{r.painScale}</b></div>
                        <div>Emese: <b>{r.nauseaVomiting}</b></div>
                        <div className="truncate">Bromage: <b>{r.motorBlockBromage}</b></div>
                      </div>

                      {/* QMentum alarm triggers list */}
                      {rAlerts.length > 0 && (
                        <div className="col-span-2 sm:col-span-5 mt-1 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/60 dark:border-amber-900/30 p-2 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-semibold space-y-0.5">
                          <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Gatilho de Alerta QMentum:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                            {rAlerts.map((alt, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                <span>{alt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 dark:text-zinc-500 py-12 font-medium">Nenhum registro seriado de recuperação lançado.</p>
            )}
          </div>

          {/* FINAL DISCHARGE CONTROLS */}
          <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-xs tracking-wider uppercase border-b border-slate-100 dark:border-zinc-800/70 pb-2.5">
              Alta e Destino do Paciente
            </h3>

            {recovery.dischargeTime ? (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-800">Alta da SRPA Registrada!</p>
                  <p className="text-slate-600 mt-0.5">Paciente liberado para: <b>{recovery.dischargeDestination}</b> em <b>{new Date(recovery.dischargeTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</b>.</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 tabular-nums">Assinado por: {recovery.dischargingAnesthesiologist} (CRM {recovery.dischargingCRM}/{recovery.dischargingUF})</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Destino de Alta</label>
                    <select
                      value={recovery.dischargeDestination || ""}
                      onChange={(e) => onUpdateRecovery({ dischargeDestination: e.target.value })}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs"
                    >
                      <option value="">Selecione...</option>
                      <option value="Enfermaria (Quarto)">Enfermaria (Quarto)</option>
                      <option value="UTI Geral">Admissão UTI Geral</option>
                      <option value="UTI Cardíaca">Admissão UTI Cardíaca</option>
                      <option value="Ambulatorial (Alta domiciliar)">Ambulatório / Alta Casa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Responsável pela Alta</label>
                    <div className="w-full bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                      {document.team.anesthesiologistLead}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDischarge}
                  disabled={records.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <CheckCircle className="w-4 h-4" />
                  Assinar Alta da SRPA
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
