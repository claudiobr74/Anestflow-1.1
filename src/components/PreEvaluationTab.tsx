/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { AnesthesiaDocument, PreAnestheticEvaluation, ASAClass } from "../types";
import { User, ClipboardList, ShieldAlert, Heart, Activity, Sliders, CheckCircle, Plus, Trash2, Minus } from "lucide-react";
import { calculateIMC } from "../mockData";
import { getThemeClasses } from "../lib/theme";

interface PreEvaluationTabProps {
  document: AnesthesiaDocument;
  onChange: (evalData: Partial<PreAnestheticEvaluation>) => void;
  theme?: "light" | "dark" | "dark-clean";
}

const SYSTEM_OPTIONS = {
  cardioCirculatory: ["Hipertensão", "Angina", "Coronariopatia", "Infarto do Miocárdio", "Insuficiência Cardíaca", "Valvulopatia", "Arritmia", "Angioplastia"],
  respiratory: ["Dependência O₂", "Apneia do Sono", "IVAS recente", "Expectoração", "Asma", "Tuberculose", "DPOC"],
  gastroHepatic: ["Refluxo Gastroesofágico", "Úlcera Péptica", "Vômito / Diarreia", "Hérnia de Hiato", "Obstrução Intestinal", "Gastrite", "Hepatite", "Icterícia", "Cirrose"],
  neurological: ["Convulsões", "Dormência / Fraqueza", "Lesão Medular", "AVC", "Cefaleia"],
  renal: ["Doença Renal Crônica", "Insuficiência Renal", "Diálise"],
  hematological: ["Transfusão Prévia", "Plaquetopatia", "Coagulopatia", "Anemia"],
  musculoSkeletal: ["Dor Lombar", "Musculodistrofia", "Artrite"],
  endocrine: ["Diabetes", "Patologia da Tireoide"],
  cancer: ["Quimioterapia", "Radioterapia"],
  infectious: ["HIV"]
};

export default function PreEvaluationTab({ document, onChange, theme = "light" }: PreEvaluationTabProps) {
  const data = document.preEvaluation;
  const tc = getThemeClasses(theme);

  // Auto-calcula Via Aérea Difícil
  useEffect(() => {
    if (!data.airwayEvaluation) return;

    let score = 0;
    if (data.airwayEvaluation.historyOfDifficultAirway) score += 3;
    if (data.airwayEvaluation.mallampati === "III" || data.airwayEvaluation.mallampati === "IV") score += 1;
    if (data.airwayEvaluation.tireomentonianaCm === "< 5 cm") score += 1;
    if (data.airwayEvaluation.neckMobility === "Limitada") score += 1;
    if (data.airwayEvaluation.neckAspect === "Largo (>40cm)" || data.airwayEvaluation.neckAspect === "Curto") score += 1;
    if (data.airwayEvaluation.interincisivos === "< 3 cm") score += 1;
    if (!data.airwayEvaluation.mandibularProtrusionNormal) score += 1;
    if (document.patient?.imc && document.patient?.imc >= 35) score += 1;

    const isDifficult = score >= 2;

    if (isDifficult !== data.airwayEvaluation.predictDifficultAirway) {
      onChange({
        airwayEvaluation: {
          ...data.airwayEvaluation,
          predictDifficultAirway: isDifficult
        }
      });
    }
  }, [
    data?.airwayEvaluation?.historyOfDifficultAirway,
    data?.airwayEvaluation?.mallampati,
    data?.airwayEvaluation?.tireomentonianaCm,
    data?.airwayEvaluation?.neckMobility,
    data?.airwayEvaluation?.neckAspect,
    data?.airwayEvaluation?.interincisivos,
    data?.airwayEvaluation?.mandibularProtrusionNormal,
    document?.patient?.imc,
    data?.airwayEvaluation?.predictDifficultAirway
  ]);

  const handleSystemChange = (systemKey: keyof typeof SYSTEM_OPTIONS, value: string) => {
    const current = { ...data[systemKey] } as { negative: boolean; text: string; options: string[] };
    const idx = current.options.indexOf(value);
    
    if (idx >= 0) {
      current.options.splice(idx, 1);
    } else {
      current.options.push(value);
      current.negative = false; // automatically toggle negative off if option selected
    }
    
    onChange({ [systemKey]: current });
  };

  const toggleSystemNegative = (systemKey: keyof typeof SYSTEM_OPTIONS) => {
    const current = { ...data[systemKey] } as { negative: boolean; text: string; options: string[] };
    current.negative = !current.negative;
    if (current.negative) {
      current.options = []; // clear options if negative
    }
    onChange({ [systemKey]: current });
  };

  const handleSystemTextChange = (systemKey: keyof typeof SYSTEM_OPTIONS, text: string) => {
    const current = { ...data[systemKey] } as { negative: boolean; text: string; options: string[] };
    current.text = text;
    if (text.trim().length > 0) {
      current.negative = false;
    }
    onChange({ [systemKey]: current });
  };

  // Fasting triggers
  const setJejum = (type: "solids" | "liquids", hrs: number) => {
    if (type === "solids") {
      onChange({ jejumSolidsHours: hrs });
    } else {
      onChange({ jejumLiquidsHours: hrs });
    }
  };

  // Allergies handlers
  const addAllergy = () => {
    const list = [...(data.allergies.list || [])];
    list.push({
      id: `all-${Date.now()}`,
      agent: "",
      reaction: "",
      severity: "Moderada"
    });
    onChange({ allergies: { negative: false, list } });
  };

  const removeAllergy = (id: string) => {
    const list = (data.allergies.list || []).filter(a => a.id !== id);
    onChange({ allergies: { negative: list.length === 0, list } });
  };

  const updateAllergy = (id: string, fields: Partial<PreAnestheticEvaluation["allergies"]["list"][0]>) => {
    const list = (data.allergies.list || []).map(a => {
      if (a.id === id) {
        return { ...a, ...fields };
      }
      return a;
    });
    onChange({ allergies: { negative: false, list } });
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: GENERAL BIOMETRICS & VITALS */}
      <div className={tc.card}>
        <div className={tc.cardHeader}>
          <Activity className={tc.cardIcon} />
          <h3 className={tc.cardHeading}>Dados Vitais e Antropométricos de Admissão</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className={tc.label}>Peso (kg)</label>
            <input
              type="number"
              value={data.weight || ""}
              onChange={(e) => {
                const w = parseFloat(e.target.value) || 0;
                onChange({ weight: w, imc: calculateIMC(w, data.height) });
              }}
              className={`${tc.input} tabular-nums`}
            />
          </div>

          <div>
            <label className={tc.label}>Altura (cm)</label>
            <input
              type="number"
              value={data.height || ""}
              onChange={(e) => {
                const h = parseFloat(e.target.value) || 0;
                onChange({ height: h, imc: calculateIMC(data.weight, h) });
              }}
              className={`${tc.input} tabular-nums`}
            />
          </div>

          <div>
            <label className={tc.label}>IMC (kg/m²)</label>
            <div className={`w-full rounded-lg px-3 py-2.5 text-sm tabular-nums font-bold border ${
              tc.isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-slate-100 dark:bg-zinc-900/80 border-slate-200 text-slate-700"
            }`}>
              {data.imc || "0"}
            </div>
          </div>

          <div>
            <label className={tc.label}>Pressão Arterial</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="PAS"
                value={data.pa_s || ""}
                onChange={(e) => onChange({ pa_s: parseInt(e.target.value) || undefined })}
                className="w-1/2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2 py-2.5 text-sm text-center tabular-nums focus:outline-hidden focus:border-teal-500"
              />
              <span className="text-slate-400 dark:text-zinc-500">/</span>
              <input
                type="number"
                placeholder="PAD"
                value={data.pa_d || ""}
                onChange={(e) => onChange({ pa_d: parseInt(e.target.value) || undefined })}
                className="w-1/2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2 py-2.5 text-sm text-center tabular-nums focus:outline-hidden focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">FC (bpm)</label>
            <input
              type="number"
              value={data.fc || ""}
              onChange={(e) => onChange({ fc: parseInt(e.target.value) || undefined })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-hidden focus:border-teal-500 tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Dor (Adulto 0-10 / Criança Faces)</label>
            <select
              value={data.painScale}
              onChange={(e) => onChange({ painScale: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-hidden focus:border-teal-500"
            >
              {[0,1,2,3,4,5,6,7,8,9,10].map(v => (
                <option key={v} value={v}>{v} {v === 0 ? "(Sem Dor)" : v === 10 ? "(Dor Pior)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        {/* JEJUM (Fasting) Panel */}
        <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="flex flex-col h-full">
            <label className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 gap-1 min-h-[2.5rem]">
              <span>Jejum de Sólidos ({data.jejumSolidsHours}h)</span>
              <span className="text-amber-600 font-normal">Recomendado: 8 horas</span>
            </label>
            <div className="flex items-center gap-2 mb-2 mt-auto bg-white border border-amber-200 rounded-lg overflow-hidden h-9">
              <button
                onClick={() => setJejum("solids", Math.max(1, (data.jejumSolidsHours || 8) - 1))}
                className="w-10 h-full flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 transition active:bg-amber-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center font-bold text-amber-900 text-sm select-none">
                {data.jejumSolidsHours || 8} horas
              </div>
              <button
                onClick={() => setJejum("solids", Math.min(24, (data.jejumSolidsHours || 8) + 1))}
                className="w-10 h-full flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 transition active:bg-amber-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Descreva o sólido consumido (ex: Almoço leve)"
              value={data.jejumTypeSolids || ""}
              onChange={(e) => onChange({ jejumTypeSolids: e.target.value })}
              className="w-full bg-white border border-amber-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-amber-600"
            />
          </div>

          <div className="flex flex-col h-full">
            <label className="flex flex-col lg:flex-row lg:justify-between lg:items-center text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 gap-1 min-h-[2.5rem]">
              <span>Jejum de Líquidos ({data.jejumLiquidsHours}h)</span>
              <span className="text-amber-600 font-normal">Recomendado: 2 horas</span>
            </label>
            <div className="flex items-center gap-2 mb-2 mt-auto bg-white border border-amber-200 rounded-lg overflow-hidden h-9">
              <button
                onClick={() => setJejum("liquids", Math.max(1, (data.jejumLiquidsHours || 2) - 1))}
                className="w-10 h-full flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 transition active:bg-amber-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center font-bold text-amber-900 text-sm select-none">
                {data.jejumLiquidsHours || 2} horas
              </div>
              <button
                onClick={() => setJejum("liquids", Math.min(24, (data.jejumLiquidsHours || 2) + 1))}
                className="w-10 h-full flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 transition active:bg-amber-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Descreva o líquido consumido (ex: Água, chá)"
              value={data.jejumTypeLiquids || ""}
              onChange={(e) => onChange({ jejumTypeLiquids: e.target.value })}
              className="w-full bg-white border border-amber-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-amber-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: SYSTEMIC HISTORY (AVALIAÇÃO CLÍNICA) */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
        <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Histórico Clínico e Antecedentes Clínicos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Object.keys(SYSTEM_OPTIONS) as Array<keyof typeof SYSTEM_OPTIONS>).map((sysKey) => {
            const system = data[sysKey] as { negative: boolean; text: string; options: string[] };
            const label = sysKey === "cardioCirculatory" ? "Cardiovascular" :
                          sysKey === "respiratory" ? "Respiratório" :
                          sysKey === "gastroHepatic" ? "Gastrointestinal / Hepático" :
                          sysKey === "neurological" ? "Neurológico" :
                          sysKey === "renal" ? "Renal" :
                          sysKey === "hematological" ? "Hematológico" :
                          sysKey === "musculoSkeletal" ? "Músculo-esquelético" :
                          sysKey === "endocrine" ? "Endócrino" : "Câncer / Oncologia";

            return (
              <div key={sysKey} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-700">{label}</span>
                  <button
                    onClick={() => toggleSystemNegative(sysKey)}
                    className={`px-2.5 py-1 rounded text-xs font-bold tracking-wider uppercase transition ${system.negative ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                  >
                    {system.negative ? "Negativo ✓" : "Alterado"}
                  </button>
                </div>

                {/* Progressive disclosure of specific pathology options */}
                {!system.negative && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {SYSTEM_OPTIONS[sysKey].map(opt => {
                        const active = system.options.includes(opt);
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSystemChange(sysKey, opt)}
                            className={`px-2 py-1 rounded text-xs font-medium transition ${active ? "bg-indigo-600 text-white font-semibold" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-zinc-900/80"}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      placeholder="Outros achados ou detalhes clínicos..."
                      value={system.text || ""}
                      onChange={(e) => handleSystemTextChange(sysKey, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2.5: SPECIAL CONDITIONS, HABITS & HISTORY */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
        <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
          <User className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Condições Especiais, Hábitos e Histórico</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GRAVIDEZ & CRIANÇAS */}
          <div className="space-y-4">
            {/* Gravidez */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Gravidez</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase">Negativo</span>
                  <input
                    type="checkbox"
                    checked={data.pregnancy.negative}
                    onChange={(e) => onChange({ pregnancy: { ...data.pregnancy, negative: e.target.checked } })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {!data.pregnancy.negative && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Idade gestacional:</span>
                  <input
                    type="number"
                    value={data.pregnancy.gestationalWeeks || ""}
                    onChange={(e) => onChange({ pregnancy: { ...data.pregnancy, gestationalWeeks: parseInt(e.target.value) || undefined } })}
                    className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-center"
                    placeholder="Semanas"
                  />
                  <span className="text-xs text-slate-600">semanas</span>
                </div>
              )}
            </div>

            {/* Crianças < 1 ano */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Crianças abaixo de 1 ano</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase">Negativo</span>
                  <input
                    type="checkbox"
                    checked={data.infantBirth?.negative ?? true}
                    onChange={(e) => onChange({ infantBirth: { ...(data.infantBirth || { term: "Termo" }), negative: e.target.checked } })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {!(data.infantBirth?.negative ?? true) && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={data.infantBirth?.hospitalized || false}
                        onChange={(e) => onChange({ infantBirth: { ...data.infantBirth!, hospitalized: e.target.checked } })}
                        className="rounded border-slate-300 text-indigo-600"
                      /> Internação
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={data.infantBirth?.dischargedWithMother || false}
                        onChange={(e) => onChange({ infantBirth: { ...data.infantBirth!, dischargedWithMother: e.target.checked } })}
                        className="rounded border-slate-300 text-indigo-600"
                      /> Alta com a mãe
                    </label>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="radio"
                        name="infantTerm"
                        checked={data.infantBirth?.term === "Termo"}
                        onChange={() => onChange({ infantBirth: { ...data.infantBirth!, term: "Termo" } })}
                        className="text-indigo-600"
                      /> Termo
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="radio"
                        name="infantTerm"
                        checked={data.infantBirth?.term === "Pré-termo"}
                        onChange={() => onChange({ infantBirth: { ...data.infantBirth!, term: "Pré-termo" } })}
                        className="text-indigo-600"
                      /> Pré-termo
                    </label>
                  </div>
                  {data.infantBirth?.term === "Pré-termo" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-zinc-400">Idade Gestacional</label>
                        <input
                          type="number"
                          value={data.infantBirth?.gestationalWeeks || ""}
                          onChange={(e) => onChange({ infantBirth: { ...data.infantBirth!, gestationalWeeks: parseInt(e.target.value) || undefined } })}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          placeholder="Semanas"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-zinc-400">Idade Pós-conceptual</label>
                        <input
                          type="number"
                          value={data.infantBirth?.postConceptualWeeks || ""}
                          onChange={(e) => onChange({ infantBirth: { ...data.infantBirth!, postConceptualWeeks: parseInt(e.target.value) || undefined } })}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          placeholder="Semanas"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* HÁBITOS & HISTÓRICO */}
          <div className="space-y-4">
            {/* Hábitos Sociais */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Hábitos Sociais</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase">Negativo</span>
                  <input
                    type="checkbox"
                    checked={data.socialHabits.negative}
                    onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, negative: e.target.checked } })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {!data.socialHabits.negative && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 w-24">
                      <input
                        type="checkbox"
                        checked={data.socialHabits.tobaccoChecked || false}
                        onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, tobaccoChecked: e.target.checked } })}
                        className="rounded border-slate-300 text-indigo-600"
                      /> Tabaco
                    </label>
                    <input
                      type="text"
                      value={data.socialHabits.tobaccoCount || ""}
                      onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, tobaccoCount: e.target.value } })}
                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                      placeholder="Cigarros/dia"
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={data.socialHabits.alcoholChecked || false}
                        onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, alcoholChecked: e.target.checked } })}
                        className="rounded border-slate-300 text-indigo-600"
                      /> Álcool
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={data.socialHabits.drugsChecked || false}
                        onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, drugsChecked: e.target.checked } })}
                        className="rounded border-slate-300 text-indigo-600"
                      /> Drogas
                    </label>
                  </div>
                  <input
                    type="text"
                    value={data.socialHabits.text || ""}
                    onChange={(e) => onChange({ socialHabits: { ...data.socialHabits, text: e.target.value } })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs mt-1"
                    placeholder="Outros hábitos..."
                  />
                </div>
              )}
            </div>

            {/* Histórico Náuseas / História Familiar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                <label className="text-xs font-bold text-slate-700 block leading-tight">Náuseas / Vômitos no Pós-op</label>
                <select
                  value={data.nauseaVomitingHistory ? "Sim" : "Não"}
                  onChange={(e) => onChange({ nauseaVomitingHistory: e.target.value === "Sim" })}
                  className="w-full bg-white border border-slate-200 rounded py-1 px-2 text-xs"
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                <label className="text-xs font-bold text-slate-700 block leading-tight">Score de Apfel (0-4)</label>
                <select
                  value={data.apfelScore ?? 0}
                  onChange={(e) => onChange({ apfelScore: parseInt(e.target.value, 10) })}
                  className="w-full bg-white border border-slate-200 rounded py-1 px-2 text-xs"
                >
                  <option value={0}>0 (Baixo risco)</option>
                  <option value={1}>1 (20% risco)</option>
                  <option value={2}>2 (40% risco)</option>
                  <option value={3}>3 (60% risco)</option>
                  <option value={4}>4 (80% risco)</option>
                </select>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                <label className="text-xs font-bold text-slate-700 block leading-tight">Histórico Familiar - Prob. Anestesia</label>
                <select
                  value={!data.familyAnesthesiaComplications.negative ? "Sim" : "Não"}
                  onChange={(e) => onChange({ familyAnesthesiaComplications: { negative: e.target.value === "Não" } })}
                  className="w-full bg-white border border-slate-200 rounded py-1 px-2 text-xs"
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: ALLERGIES & PREVIOUS REACTION LOG */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Alergias e Complicações Prévias</h3>
          </div>
          <button
            onClick={addAllergy}
            className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 transition px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Adicionar Alergia
          </button>
        </div>

        {data.allergies.list && data.allergies.list.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.allergies.list.map((all) => (
              <div key={all.id} className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 flex items-start gap-3 relative">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-rose-800 mb-0.5">Agente / Medicamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Dipirona, Penicilina, Látex"
                      value={all.agent}
                      onChange={(e) => updateAllergy(all.id, { agent: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-md px-2 py-1 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-0.5">Reação Esperada</label>
                    <input
                      type="text"
                      placeholder="Ex: Urticária, Anafilaxia"
                      value={all.reaction}
                      onChange={(e) => updateAllergy(all.id, { reaction: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-md px-2 py-1 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-rose-800 mb-0.5">Gravidade</label>
                    <select
                      value={all.severity}
                      onChange={(e) => updateAllergy(all.id, { severity: e.target.value as any })}
                      className="w-full bg-white border border-rose-200 rounded-md px-2 py-1 text-xs focus:outline-hidden"
                    >
                      <option value="Leve">Leve</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Grave">Grave / Crítica</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => removeAllergy(all.id)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Sem Alergias Conhecidas (Nega Alergias)</p>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mt-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Cirurgia / Anestesia Prévia</h3>
          </div>
          <button
            onClick={() => {
              const list = [...(data.previousAnesthesia?.list || [])];
              list.push({ id: Date.now().toString(), surgery: "", anesthesia: "", outcomes: "" });
              onChange({ previousAnesthesia: { ...data.previousAnesthesia, negative: false, list } });
            }}
            className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Adicionar Cirurgia
          </button>
        </div>

        {data.previousAnesthesia?.list && data.previousAnesthesia.list.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {data.previousAnesthesia.list.map((prev) => (
              <div key={prev.id} className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-3 relative">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-0.5">Cirurgia</label>
                    <input
                      type="text"
                      placeholder="Ex: Apendicectomia"
                      value={prev.surgery}
                      onChange={(e) => {
                        const list = data.previousAnesthesia.list.map(a => a.id === prev.id ? { ...a, surgery: e.target.value } : a);
                        onChange({ previousAnesthesia: { ...data.previousAnesthesia, list } });
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-0.5">Anestesia</label>
                    <input
                      type="text"
                      placeholder="Ex: Raquianestesia"
                      value={prev.anesthesia}
                      onChange={(e) => {
                        const list = data.previousAnesthesia.list.map(a => a.id === prev.id ? { ...a, anesthesia: e.target.value } : a);
                        onChange({ previousAnesthesia: { ...data.previousAnesthesia, list } });
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-0.5">Dados Relevantes</label>
                    <input
                      type="text"
                      placeholder="Ex: Sem intercorrências"
                      value={prev.outcomes}
                      onChange={(e) => {
                        const list = data.previousAnesthesia.list.map(a => a.id === prev.id ? { ...a, outcomes: e.target.value } : a);
                        onChange({ previousAnesthesia: { ...data.previousAnesthesia, list } });
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const list = data.previousAnesthesia.list.filter(a => a.id !== prev.id);
                    onChange({ previousAnesthesia: { ...data.previousAnesthesia, list } });
                  }}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Nenhuma cirurgia prévia relatada</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Medicamentos em uso habitual <span className="text-xs font-normal text-slate-400 dark:text-zinc-500 ml-1">(verificar se tomou no dia da cirurgia)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Lista de medicamentos e doses tomadas habitualmente..."
              value={data.currentMedications}
              onChange={(e) => onChange({ currentMedications: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 p-2 text-xs focus:outline-hidden focus:border-teal-500 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Medicação Pré-Anestésica (MPA) administrada</label>
            <textarea
              rows={2}
              placeholder="Ex: Midazolam 15mg VO realizado no quarto"
              value={data.preAnestheticMedication}
              onChange={(e) => onChange({ preAnestheticMedication: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 p-2 text-xs focus:outline-hidden focus:border-teal-500 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* EXAME FÍSICO & LABORATÓRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* EXAME FÍSICO */}
        <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
          <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Exame Físico</h3>
          </div>
          <div className="space-y-3">
            {["cardiac", "respiratory", "neurological", "regional", "other"].map((sys) => (
              <div key={sys} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 sm:w-1/4">
                  {sys === "cardiac" ? "Cardíaco" :
                   sys === "respiratory" ? "Resp." :
                   sys === "neurological" ? "Neuro" :
                   sys === "regional" ? "Regional" : "Outro"}
                </label>
                <input
                  type="text"
                  placeholder="Normal / Sem alterações..."
                  value={data.physicalExam?.[sys as keyof typeof data.physicalExam] || ""}
                  onChange={(e) => onChange({ physicalExam: { ...data.physicalExam, [sys]: e.target.value } })}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* LABORATÓRIO */}
        <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
          <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Laboratório (Exames Pré-operatórios)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: "hb", label: "Hb (Hemoglobina)" },
              { id: "ht", label: "Ht (Hematócrito)" },
              { id: "na", label: "Na (Sódio)" },
              { id: "k", label: "K (Potássio)" },
              { id: "plaquetas", label: "Plaquetas" },
              { id: "glicose", label: "Glicose" }
            ].map((lab) => (
              <div key={lab.id}>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">{lab.label}</label>
                <input
                  type="text"
                  placeholder="Valor"
                  value={data.laboratory?.[lab.id as keyof typeof data.laboratory] || ""}
                  onChange={(e) => onChange({ laboratory: { ...data.laboratory, [lab.id]: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500 tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: AVALIAÇÃO DE VIA AÉREA */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2 bg-slate-200/50 p-2 rounded-t-lg">
          <Heart className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm uppercase tracking-wide">Avaliação de Via Aérea</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">História Prévia Difícil?</label>
            <select
              value={data.airwayEvaluation.historyOfDifficultAirway ? "Sim" : "Não"}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, historyOfDifficultAirway: e.target.value === "Sim" } })}
              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none ${data.airwayEvaluation.historyOfDifficultAirway ? "bg-rose-50 text-rose-700 border-rose-300 focus:border-rose-500" : "bg-emerald-50 text-emerald-700 border-emerald-300 focus:border-emerald-500"}`}
            >
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Dentes</label>
            <select
              value={data.airwayEvaluation.teethStatus}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, teethStatus: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="Conservados">Conservados</option>
              <option value="Precários">Precários</option>
              <option value="Ausentes">Ausentes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Distância Tireomentoniana</label>
            <select
              value={data.airwayEvaluation.tireomentonianaCm}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, tireomentonianaCm: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="> 5 cm (3 dedos)">&gt; 5 cm (3 dedos)</option>
              <option value="< 5 cm">&lt; 5 cm</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Pescoço</label>
            <select
              value={data.airwayEvaluation.neckAspect}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, neckAspect: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="Normal">Normal</option>
              <option value="Largo (>40cm)">Largo (&gt;40cm)</option>
              <option value="Curto">Curto</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Distância Inter-incisivos</label>
            <select
              value={data.airwayEvaluation.interincisivos}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, interincisivos: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="> 3 cm">&gt; 3 cm</option>
              <option value="< 3 cm">&lt; 3 cm</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Protusão Mandíbula Normal</label>
            <select
              value={data.airwayEvaluation.mandibularProtrusionNormal ? "Sim" : "Não"}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, mandibularProtrusionNormal: e.target.value === "Sim" } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Flexão/Extensão Cervical</label>
            <select
              value={data.airwayEvaluation.neckMobility}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, neckMobility: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="Normal">Normal</option>
              <option value="Limitada">Limitada</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Mallampati</label>
            <select
              value={data.airwayEvaluation.mallampati}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, mallampati: e.target.value as any } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="I">Classe I</option>
              <option value="II">Classe II</option>
              <option value="III">Classe III (Alerta)</option>
              <option value="IV">Classe IV (Crítica)</option>
            </select>
          </div>
          
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">Outras / Condições Especiais</label>
            <input 
              type="text" 
              placeholder="Ex: Barba longa, colar cervical..."
              value={data.airwayEvaluation.specialEquipmentNeeded || ""}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, specialEquipmentNeeded: e.target.value } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
              Previsão de IOT Difícil? <span className="text-xs font-normal text-slate-400 ml-1">(Auto-calculado)</span>
            </label>
            <select
              value={data.airwayEvaluation.predictDifficultAirway ? "Sim" : "Não"}
              disabled
              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${data.airwayEvaluation.predictDifficultAirway ? "bg-rose-50 text-rose-700 border-rose-300 focus:border-rose-500" : "bg-emerald-50 text-emerald-700 border-emerald-300 focus:border-emerald-500"}`}
            >
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Plano Aéreo Principal (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: IOT por laringoscopia convencional com lâmina Mac 4"
              value={data.airwayEvaluation.planPrimary}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, planPrimary: e.target.value } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Plano Alternativo / Resgate (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Uso de Videolaringoscópio McGrath / Máscara Laríngea"
              value={data.airwayEvaluation.planAlternative}
              onChange={(e) => onChange({ airwayEvaluation: { ...data.airwayEvaluation, planAlternative: e.target.value } })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: PLANNING & RECOMMENDATIONS (PLANEJAMENTO) */}
      <div className="bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 p-6 rounded-lg border shadow-sm transition-colors space-y-4">
        <div className="flex items-center gap-2 border-b pb-4 mb-5 border-slate-100 dark:border-zinc-800/80">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 dark:text-zinc-100 text-sm">Classificação ASA e Planejamento Cirúrgico</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Estado Físico ASA</label>
            <select
              value={data.asa || ""}
              onChange={(e) => onChange({ asa: e.target.value as ASAClass })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-sm font-bold text-indigo-700 focus:outline-hidden focus:border-indigo-600"
            >
              <option value="">Selecione ASA...</option>
              {Object.values(ASAClass).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Caráter do Procedimento</label>
            <select
              value={data.isEmergency ? "Emergencia" : "Eletivo"}
              onChange={(e) => onChange({ isEmergency: e.target.value === "Emergencia" })}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm font-bold ${data.isEmergency ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"}`}
            >
              <option value="Eletivo">Eletivo</option>
              <option value="Emergencia">Urgência / Emergência</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reserva de UTI?</label>
            <select
              value={data.icuRequired ? "Sim" : "Não"}
              onChange={(e) => onChange({ icuRequired: e.target.value === "Sim" })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-sm"
            >
              <option value="Não">Não necessário</option>
              <option value="Sim">Sim, vaga reservada</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Técnica Anestésica Proposta</label>
            <input
              type="text"
              placeholder="Ex: Anestesia Geral Balanceada com IOT"
              value={data.proposedAnestheticTechnique}
              onChange={(e) => onChange({ proposedAnestheticTechnique: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Técnica Anestésica Alternativa</label>
            <input
              type="text"
              placeholder="Ex: Anestesia Geral Total Venosa (TIVA)"
              value={data.alternativeAnestheticTechnique}
              onChange={(e) => onChange({ alternativeAnestheticTechnique: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Hemocomponentes / Quantidade</label>
            <textarea
              rows={2}
              placeholder="Concentrado de Hemácias, Plaquetas, Plasma, etc..."
              value={data.bloodComponentsExpected || ""}
              onChange={(e) => onChange({ bloodComponentsExpected: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Avaliação de outra especialidade</label>
            <textarea
              rows={2}
              placeholder="Parecer cardiológico, pneumológico, etc..."
              value={data.otherSpecialtyEvaluation || ""}
              onChange={(e) => onChange({ otherSpecialtyEvaluation: e.target.value })}
              className="w-full bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 rounded-lg transition focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 px-3 py-2.5 text-xs focus:outline-hidden focus:border-teal-500 tabular-nums"
            />
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-slate-200">
          <label className="block text-sm font-black text-slate-800 mb-2">Comentários sobre os achados</label>
          <textarea
            rows={3}
            placeholder="Observações adicionais pertinentes à avaliação pré-anestésica..."
            value={data.generalComments || ""}
            onChange={(e) => onChange({ generalComments: e.target.value })}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        <div className="pt-4 mt-2 border-t border-slate-200">
          <label className="block text-sm font-black text-slate-800 mb-2">Liberação Médica para Cirurgia</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={data.releasedForSurgery ? "Liberado" : "NaoLiberado"}
              onChange={(e) => onChange({ releasedForSurgery: e.target.value === "Liberado" })}
              className={`w-full sm:w-1/3 border-2 rounded-lg px-4 py-3 text-sm font-bold transition-all focus:outline-none ${data.releasedForSurgery ? "bg-emerald-50 text-emerald-700 border-emerald-400 focus:ring-4 focus:ring-emerald-500/20" : "bg-rose-50 text-rose-700 border-rose-400 focus:ring-4 focus:ring-rose-500/20"}`}
            >
              <option value="Liberado">Liberado para Anestesia ✓</option>
              <option value="NaoLiberado">Não Liberado (Pendente correção) ✕</option>
            </select>
            <input
              type="text"
              placeholder="Comentários sobre a liberação (opcional)..."
              value={data.releaseNotes || ""}
              onChange={(e) => onChange({ releaseNotes: e.target.value })}
              className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
