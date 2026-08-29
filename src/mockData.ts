/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnesthesiaDocument, ASAClass } from "./types";

export const FAVORITE_DRUGS = [
  // 1. Sedativos / Indutores
  { name: "Propofol", defaultDose: 150, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 200, ampouleVolume: 20 },
  { name: "Etomidato", defaultDose: 20, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 20, ampouleVolume: 10 },
  { name: "Cetamina", defaultDose: 100, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 500, ampouleVolume: 10 },
  { name: "Midazolam", defaultDose: 5, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 15, ampouleVolume: 3 },
  { name: "Tiopental", defaultDose: 250, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 1000, ampouleVolume: 40 },
  { name: "Dexmedetomidina", defaultDose: 50, defaultUnit: "mcg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 200, ampouleVolume: 2 },
  { name: "Diazepam", defaultDose: 10, defaultUnit: "mg", defaultRoute: "EV", category: "Sedativos / Indutores", ampouleAmount: 10, ampouleVolume: 2 },

  // 2. Bloqueadores Neuromusculares
  { name: "Rocurônio", defaultDose: 50, defaultUnit: "mg", defaultRoute: "EV", category: "Bloqueadores Neuromusculares", ampouleAmount: 50, ampouleVolume: 5 },
  { name: "Atracúrio", defaultDose: 35, defaultUnit: "mg", defaultRoute: "EV", category: "Bloqueadores Neuromusculares", ampouleAmount: 50, ampouleVolume: 5 },
  { name: "Cisatracúrio", defaultDose: 10, defaultUnit: "mg", defaultRoute: "EV", category: "Bloqueadores Neuromusculares", ampouleAmount: 10, ampouleVolume: 5 },
  { name: "Succinilcolina", defaultDose: 80, defaultUnit: "mg", defaultRoute: "EV", category: "Bloqueadores Neuromusculares", ampouleAmount: 100, ampouleVolume: 10 },
  { name: "Pancurônio", defaultDose: 4, defaultUnit: "mg", defaultRoute: "EV", category: "Bloqueadores Neuromusculares", ampouleAmount: 4, ampouleVolume: 2 },

  // 3. Opioides / Analgésicos
  { name: "Fentanil", defaultDose: 150, defaultUnit: "mcg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 500, ampouleVolume: 10 },
  { name: "Sufentanil", defaultDose: 15, defaultUnit: "mcg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 250, ampouleVolume: 5 },
  { name: "Remifentanil", defaultDose: 2, defaultUnit: "mg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 2, ampouleVolume: 10 },
  { name: "Alfentanil", defaultDose: 500, defaultUnit: "mcg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 2500, ampouleVolume: 5 },
  { name: "Morfina", defaultDose: 5, defaultUnit: "mg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 10, ampouleVolume: 1 },
  { name: "Tramadol", defaultDose: 100, defaultUnit: "mg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 100, ampouleVolume: 2 },
  { name: "Nalbufina", defaultDose: 10, defaultUnit: "mg", defaultRoute: "EV", category: "Opioides / Analgésicos", ampouleAmount: 10, ampouleVolume: 1 },

  // 4. Cardiovascular / Vasoativos
  { name: "Adrenalina", defaultDose: 1, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 1, ampouleVolume: 1 },
  { name: "Noradrenalina", defaultDose: 10, defaultUnit: "mcg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 4000, ampouleVolume: 4 },
  { name: "Dobutamina", defaultDose: 250, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 250, ampouleVolume: 20 },
  { name: "Dopamina", defaultDose: 50, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 50, ampouleVolume: 10 },
  { name: "Milrinona", defaultDose: 20, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 20, ampouleVolume: 20 },
  { name: "Efedrina", defaultDose: 5, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 50, ampouleVolume: 1 },
  { name: "Metaraminol", defaultDose: 0.5, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 10, ampouleVolume: 1 },
  { name: "Atropina", defaultDose: 0.5, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 0.5, ampouleVolume: 1 },
  { name: "Amiodarona", defaultDose: 150, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 150, ampouleVolume: 3 },
  { name: "Esmolol", defaultDose: 50, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 100, ampouleVolume: 10 },
  { name: "Clonidina", defaultDose: 150, defaultUnit: "mcg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 150, ampouleVolume: 1 },
  { name: "Hidralazina", defaultDose: 5, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 20, ampouleVolume: 1 },
  { name: "Adenosina", defaultDose: 6, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 6, ampouleVolume: 2 },
  { name: "Metoprolol", defaultDose: 5, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 5, ampouleVolume: 5 },
  { name: "Nitroglicerina (Tridil)", defaultDose: 50, defaultUnit: "mcg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 50000, ampouleVolume: 10 },
  { name: "Nitroprussiato de Sódio (Nipride)", defaultDose: 50, defaultUnit: "mg", defaultRoute: "EV", category: "Cardiovascular / Vasoativos", ampouleAmount: 50, ampouleVolume: 2 },

  // 5. Antieméticos
  { name: "Ondansetrona", defaultDose: 4, defaultUnit: "mg", defaultRoute: "EV", category: "Antieméticos", ampouleAmount: 4, ampouleVolume: 2 },
  { name: "Dexametasona", defaultDose: 4, defaultUnit: "mg", defaultRoute: "EV", category: "Antieméticos", ampouleAmount: 10, ampouleVolume: 2.5 },
  { name: "Metoclopramida", defaultDose: 10, defaultUnit: "mg", defaultRoute: "EV", category: "Antieméticos", ampouleAmount: 10, ampouleVolume: 2 },
  { name: "Droperidol", defaultDose: 1.25, defaultUnit: "mg", defaultRoute: "EV", category: "Antieméticos", ampouleAmount: 2.5, ampouleVolume: 1 },

  // 6. Adjuvantes e Reversores
  { name: "Cefazolina", defaultDose: 2, defaultUnit: "g", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 1, ampouleVolume: 10 },
  { name: "Lidocaína", defaultDose: 60, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 400, ampouleVolume: 20 },
  { name: "Dipirona", defaultDose: 2, defaultUnit: "g", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 1, ampouleVolume: 2 },
  { name: "Cetoprofeno", defaultDose: 100, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 100, ampouleVolume: 2 },
  { name: "Parecoxibe", defaultDose: 40, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 40, ampouleVolume: 2 },
  { name: "Tenoxicam", defaultDose: 40, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 40, ampouleVolume: 2 },
  { name: "Sugamadex", defaultDose: 200, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 200, ampouleVolume: 2 },
  { name: "Neostigmina", defaultDose: 1.5, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 5, ampouleVolume: 1 },
  { name: "Flumazenil", defaultDose: 0.2, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 0.5, ampouleVolume: 5 },
  { name: "Naloxona", defaultDose: 0.1, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 0.4, ampouleVolume: 1 },
  { name: "Furosemida", defaultDose: 20, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 20, ampouleVolume: 2 },
  { name: "Gluconato de Cálcio", defaultDose: 1, defaultUnit: "g", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 1, ampouleVolume: 10 },
  { name: "Hidrocortisona", defaultDose: 100, defaultUnit: "mg", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 100, ampouleVolume: 2 },
  { name: "Bicarbonato de Sódio", defaultDose: 50, defaultUnit: "mEq", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 50, ampouleVolume: 10 },
  { name: "Ácido Tranexâmico", defaultDose: 1, defaultUnit: "g", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 1, ampouleVolume: 4 },
  { name: "Ocitocina", defaultDose: 10, defaultUnit: "UI", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 10, ampouleVolume: 1 },
  { name: "Insulina Regular", defaultDose: 5, defaultUnit: "UI", defaultRoute: "EV", category: "Adjuvantes e Reversores", ampouleAmount: 100, ampouleVolume: 1 },
  
  // 7. Anestésicos Locais
  { name: "Bupivacaína 0.5% Pesada", defaultDose: 15, defaultUnit: "mg", defaultRoute: "Raqui", category: "Anestésicos Locais", ampouleAmount: 20, ampouleVolume: 4 },
  { name: "Bupivacaína 0.5% S/V", defaultDose: 20, defaultUnit: "mg", defaultRoute: "Peridural", category: "Anestésicos Locais", ampouleAmount: 100, ampouleVolume: 20 },
  { name: "Ropivacaína 0.75%", defaultDose: 20, defaultUnit: "mg", defaultRoute: "Peridural", category: "Anestésicos Locais", ampouleAmount: 150, ampouleVolume: 20 },
  { name: "Lidocaína 2% S/V", defaultDose: 100, defaultUnit: "mg", defaultRoute: "Bloqueio", category: "Anestésicos Locais", ampouleAmount: 400, ampouleVolume: 20 },

  // 8. Anestésicos Inalatórios
  { name: "Sevoflurano", defaultDose: 20, defaultUnit: "ml", defaultRoute: "Inalatório", category: "Anestésicos Inalatórios", ampouleAmount: 250, ampouleVolume: 250 },
  { name: "Desflurano", defaultDose: 20, defaultUnit: "ml", defaultRoute: "Inalatório", category: "Anestésicos Inalatórios", ampouleAmount: 240, ampouleVolume: 240 },
  { name: "Isoflurano", defaultDose: 20, defaultUnit: "ml", defaultRoute: "Inalatório", category: "Anestésicos Inalatórios", ampouleAmount: 250, ampouleVolume: 250 }
] as const;

export const FAVORITE_FLUIDS = [
  { name: "Soro Ringer Simples", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Ringer com Lactato", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Fisiológico 0.9%", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Fisiológico 0.45%", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Glicosado 5%", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Glicosado 10%", type: "Cristaloide", defaultVolume: 500 },
  { name: "Soro Glicofisiológico", type: "Cristaloide", defaultVolume: 500 },
  { name: "Plasma-Lyte", type: "Cristaloide", defaultVolume: 500 },
  { name: "Água Bidestilada", type: "Outro", defaultVolume: 500 },
  { name: "Manitol 20%", type: "Outro", defaultVolume: 250 },
  { name: "Voluven 6% (Hidroxietilamido)", type: "Coloide", defaultVolume: 500 },
  { name: "Albumina Humana 20%", type: "Albumina", defaultVolume: 50 },
  { name: "Albumina Humana 5%", type: "Albumina", defaultVolume: 250 },
  { name: "Gelatina (Haemaccel/Gelafundin)", type: "Coloide", defaultVolume: 500 },
  { name: "Concentrado de Hemácias", type: "Concentrado de Hemácias", defaultVolume: 300 },
  { name: "Plasma Fresco Congelado", type: "Plasma Fresco", defaultVolume: 200 },
  { name: "Crioprecipitado", type: "Crioprecipitado", defaultVolume: 40 },
  { name: "Concentrado de Plaquetas", type: "Plaquetas", defaultVolume: 300 }
] as const;

export const CLINICAL_EVENTS_PRESETS = [
  "Indução Anestésica",
  "Laringoscopia",
  "Intubação Traqueal",
  "Incisão Cirúrgica",
  "Início do Garroteamento",
  "Término do Garroteamento",
  "Bloqueio Regional Realizado",
  "Posicionamento Prono",
  "Despertar",
  "Extubação",
  "Saída de Sala"
] as const;

export const VENTILATION_MODES_PRESETS = [
  "Espontânea",
  "Manual",
  "VCV",
  "PCV",
  "PSV",
  "SIMV"
] as const;

export function calculateAge(birthDateStr: string): number {
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function calculateIMC(weight: number, heightCm: number): number {
  if (!weight || !heightCm) return 0;
  const heightM = heightCm / 100;
  return parseFloat((weight / (heightM * heightM)).toFixed(1));
}

export function getMockDocument(): AnesthesiaDocument {
  const now = new Date();
  const nowMs = now.getTime();
  const startAnesthMs = nowMs - (120 * 60 * 1000); // 120 minutes ago
  const startSurgMs = startAnesthMs + (20 * 60 * 1000); // 20 minutes after start anesth
  const endSurgMs = startAnesthMs + (100 * 60 * 1000); // Surgery ends at 100 mins
  const endAnesthMs = startAnesthMs + (110 * 60 * 1000); // PACU transfer at 110 mins
  
  const startAnesth = new Date(startAnesthMs);
  const startSurg = new Date(startSurgMs);
  const endSurg = new Date(endSurgMs);
  const endAnesth = new Date(endAnesthMs);
  
  const dateStr = startAnesth.toISOString().split('T')[0];
  const startAnesthTime = startAnesth.toISOString();
  const startSurgTime = startSurg.toISOString();
  const endSurgTime = endSurg.toISOString();
  const endAnesthTime = endAnesth.toISOString();
  
  const getRelativeTimeIso = (mins: number) => {
    return new Date(startAnesthMs + mins * 60 * 1000).toISOString();
  };

  const getRelativeTimeStr = (mins: number) => {
    const d = new Date(startAnesthMs + mins * 60 * 1000);
    const hrs = String(d.getHours()).padStart(2, "0");
    const mns = String(d.getMinutes()).padStart(2, "0");
    return `${hrs}:${mns}`;
  };

  // Generating vitals from 0 to 115 in 5 minute steps
  const vitals: any[] = [];
  const sampleVitals = [
    { pas: 130, pad: 85, fc: 80, spo2: 98, etco2: 0, temp: 36.6, fr: 16, bis: 98 }, // 0
    { pas: 128, pad: 82, fc: 78, spo2: 100, etco2: 0, temp: 36.6, fr: 12, bis: 95 }, // 5 (PreO2)
    { pas: 110, pad: 70, fc: 72, spo2: 100, etco2: 36, temp: 36.5, fr: 12, bis: 48 }, // 10 (Indução / Intubação)
    { pas: 115, pad: 75, fc: 76, spo2: 99, etco2: 35, temp: 36.5, fr: 12, bis: 45 }, // 15
    { pas: 125, pad: 80, fc: 82, spo2: 99, etco2: 37, temp: 36.4, fr: 12, bis: 46 }, // 20 (Incisão)
    { pas: 135, pad: 85, fc: 85, spo2: 99, etco2: 40, temp: 36.3, fr: 14, bis: 44 }, // 25 (Pneumoperitônio)
    { pas: 130, pad: 82, fc: 80, spo2: 99, etco2: 39, temp: 36.2, fr: 14, bis: 42 }, // 30
    { pas: 125, pad: 78, fc: 78, spo2: 99, etco2: 38, temp: 36.2, fr: 14, bis: 45 }, // 35
    { pas: 120, pad: 75, fc: 75, spo2: 99, etco2: 38, temp: 36.1, fr: 14, bis: 43 }, // 40
    { pas: 122, pad: 76, fc: 76, spo2: 99, etco2: 37, temp: 36.1, fr: 14, bis: 42 }, // 45
    { pas: 118, pad: 74, fc: 72, spo2: 99, etco2: 36, temp: 36.0, fr: 14, bis: 45 }, // 50
    { pas: 120, pad: 75, fc: 74, spo2: 99, etco2: 37, temp: 36.0, fr: 14, bis: 44 }, // 55
    { pas: 115, pad: 72, fc: 70, spo2: 99, etco2: 36, temp: 35.9, fr: 14, bis: 42 }, // 60
    { pas: 116, pad: 73, fc: 72, spo2: 99, etco2: 36, temp: 35.8, fr: 14, bis: 46 }, // 65
    { pas: 112, pad: 70, fc: 68, spo2: 99, etco2: 35, temp: 35.8, fr: 14, bis: 44 }, // 70
    { pas: 110, pad: 68, fc: 65, spo2: 99, etco2: 35, temp: 35.7, fr: 14, bis: 45 }, // 75
    { pas: 112, pad: 70, fc: 68, spo2: 99, etco2: 35, temp: 35.7, fr: 14, bis: 44 }, // 80
    { pas: 115, pad: 72, fc: 70, spo2: 99, etco2: 36, temp: 35.8, fr: 14, bis: 45 }, // 85
    { pas: 118, pad: 75, fc: 72, spo2: 99, etco2: 36, temp: 35.8, fr: 14, bis: 46 }, // 90
    { pas: 115, pad: 73, fc: 70, spo2: 99, etco2: 37, temp: 35.9, fr: 14, bis: 48 }, // 95
    { pas: 120, pad: 76, fc: 75, spo2: 99, etco2: 38, temp: 35.9, fr: 16, bis: 55 }, // 100 (Esvaziando pneumo, reversão)
    { pas: 125, pad: 80, fc: 82, spo2: 99, etco2: 40, temp: 36.0, fr: 18, bis: 85 }, // 105 (Despertar)
    { pas: 128, pad: 82, fc: 85, spo2: 98, etco2: 0, temp: 36.1, fr: 16, bis: 96 },  // 110 (Extubado)
    { pas: 125, pad: 80, fc: 80, spo2: 97, etco2: 0, temp: 36.1, fr: 15, bis: 98 },  // 115 (Sala SRPA)
  ];

  sampleVitals.forEach((v, index) => {
    const mins = index * 5;
    const timeIso = getRelativeTimeIso(mins);
    vitals.push({
      id: `v-${index}`,
      timestamp: timeIso,
      minutesFromStart: mins,
      ...v,
      pam: Math.round(v.pad + (v.pas - v.pad) / 3),
      fio2: mins >= 110 ? 21 : 45,
      peep: mins >= 110 ? 0 : 5,
      vt: mins >= 110 ? 0 : 500,
      p_peak: mins >= 110 ? 0 : (mins >= 25 && mins <= 100 ? 25 : 18),
      p_plat: mins >= 110 ? 0 : (mins >= 25 && mins <= 100 ? 21 : 14)
    });
  });

  return {
    id: "doc-mock-cvl-2026",
    status: "InProgress",
    createdAt: new Date(startAnesthMs - 30 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString(),
    timers: {
      startAnesthesia: startAnesthTime,
      startSurgery: startSurgTime,
      endSurgery: endSurgTime,
      endAnesthesia: endAnesthTime
    },
    patient: {
      id: "pat-maria-silva",
      fullName: "Maria Aparecida da Silva",
      socialName: "Maria",
      birthDate: "1968-05-15",
      age: 58,
      gender: "Feminino",
      admissionNumber: "20268840",
      recordNumber: "772199-A",
      hospital: "Hospital São Lucas",
      unit: "Bloco Cirúrgico 2",
      sector: "Cirurgia do Aparelho Digestivo",
      operatingRoom: "Sala 05",
      bed: "Leito 08 - RPA",
      date: dateStr,
      weight: 78,
      height: 162,
      imc: 29.7,
      asa: ASAClass.ASA_II,
      urgencyType: "Eletivo",
      diagnosis: "Colelitíase com crises de cólica biliar (CID K80.2)",
      scheduledProcedure: "Colecistectomia Videolaparoscópica",
      actualProcedure: "Colecistectomia Videolaparoscópica + Colangiografia Intraoperatória",
      laterality: "Não se aplica",
      allergies: "Iodo (Reação leve)",
      consentStatus: "Confirmado"
    },
    team: {
      anesthesiologistLead: "Dra. Juliana Mendes",
      crmLead: "234567",
      ufLead: "SP",
      anesthesiologistSecond: "Dr. Marcos Vinicius",
      surgeon: "Dr. Rodrigo Alcantara",
      surgeonCRM: "987654",
      surgeonUF: "SP",
      assistantFirst: "Dra. Camila Barros",
      scrubNurse: "Amanda Correia"
    },
    preEvaluation: {
      weight: 78,
      height: 162,
      imc: 29.7,
      pa_s: 135,
      pa_d: 85,
      fc: 82,
      fr: 16,
      temp: 36.5,
      painScale: 0,
      jejumSolidsHours: 10,
      jejumLiquidsHours: 10,
      jejumTypeSolids: "Jantar Leve",
      jejumTypeLiquids: "Água",
      proposedSurgery: "Colecistectomia Videolaparoscópica",
      proposedDiagnosis: "Colelitíase",
      cardioCirculatory: { negative: false, text: "HAS controlada há 5 anos", options: ["Hipertensão"] },
      respiratory: { negative: true, text: "Nega asma ou DPOC. Nega apneia do sono.", options: [] },
      gastroHepatic: { negative: false, text: "DRGE leve, dispepsia a gorduras", options: ["Gastrite", "Refluxo"] },
      neurological: { negative: true, text: "Lúcida, sem histórico de AVC", options: [] },
      renal: { negative: true, text: "Sem comorbidades renais", options: [] },
      hematological: { negative: true, text: "Nega sangramentos anormais", options: [] },
      musculoSkeletal: { negative: false, text: "Lombalgia esporádica", options: ["Dor crônica"] },
      endocrine: { negative: false, text: "Resistência insulínica. Hipotireoidismo subclínico.", options: ["Diabetes Tipo 2", "Hipotireoidismo"] },
      cancer: { negative: true, text: "Nega neoplasias", options: [] },
      infectious: { negative: true, text: "Nega doenças infectocontagiosas", options: [] },
      pregnancy: { negative: true },
      socialHabits: { negative: false, tobaccoChecked: false, alcoholChecked: true, drugsChecked: false, text: "Etilismo social raro" },
      allergies: {
        negative: false,
        list: [
          { id: "a1", agent: "Iodo", reaction: "Eritema no local da aplicação", severity: "Leve" }
        ]
      },
      previousAnesthesia: {
        negative: false,
        list: [
          { id: "pa1", surgery: "Cesariana", anesthesia: "Raquianestesia", outcomes: "Cefaleia pós-raqui há 25 anos." },
          { id: "pa2", surgery: "Amigdalectomia", anesthesia: "Anestesia Geral", outcomes: "Náuseas e vômitos no pós-operatório (NVPO)." }
        ]
      },
      nauseaVomitingHistory: true,
      apfelScore: 4,
      familyAnesthesiaComplications: { negative: true },
      malignantHyperthermiaSuspected: false,
      currentMedications: "Losartana 50mg (tomou hoje 6h). Levotiroxina 50mcg (tomou hoje 6h). Omeprazol 20mg.",
      preAnestheticMedication: "Midazolam 3mg EV em sala",
      physicalExam: {
        cardiac: "Ritmo sinusal, BNF, sem sopros audíveis.",
        respiratory: "MV+, sem RA. Expansibilidade preservada.",
        neurological: "ECG 15. Ansiosa.",
        regional: "Abdome flácido, indolor à palpação, Murphy negativo no momento.",
        other: "Acesso venoso difícil relatado (veias finas)."
      },
      laboratory: {
        hb: "13.5 g/dL",
        ht: "40%",
        na: "142 mEq/L",
        k: "4.0 mEq/L",
        plaquetas: "280.000 /mm³",
        glicose: "105 mg/dL",
        creatinina: "0.8 mg/dL",
        coagulation: "TAP 95%, RNI 1.05, TTPA 32s",
        other: "AST 32, ALT 40, GGT 55, FA 110"
      },
      airwayEvaluation: {
        historyOfDifficultAirway: false,
        teethStatus: "Ausentes",
        prosthesis: true,
        mallampati: "II",
        mouthOpeningCm: 4,
        tireomentonianaCm: "> 5 cm (3 dedos)",
        neckMobility: "Normal",
        neckAspect: "Largo (>40cm)",
        interincisivos: "> 3 cm",
        mandibularProtrusionNormal: true,
        predictDifficultAirway: true,
        planPrimary: "Laringoscopia direta com MacIntosh 3 ou 4",
        planAlternative: "Videolaringoscopia ou Máscara Laríngea ProSeal",
        specialEquipmentNeeded: "Videolaringoscópio em sala."
      },
      asa: ASAClass.ASA_II,
      isEmergency: false,
      proposedAnestheticTechnique: "Anestesia Geral Balanceada com IOT",
      alternativeAnestheticTechnique: "TIVA (Anestesia Venosa Total)",
      bloodComponentsExpected: "Tipagem O+ confirmada. Sem reserva de hemocomponentes.",
      icuRequired: false,
      releasedForSurgery: true,
      date: dateStr,
      time: getRelativeTimeStr(-15),
      anesthesiologistName: "Dra. Juliana Mendes",
      crm: "234567"
    },
    technique: {
      generalIV: true,
      generalInhalational: true,
      balanced: true,
      sedation: false,
      local: false,
      spinal: false,
      epidural: false,
      combinedSpinalEpidural: false,
      regionalPeripheralBlock: true,
      regionalIV: false,
      other: "Bloqueio TAP Block Bilateral ecoguiado pós-indução",
    },
    airway: {
      ventilationType: "Intubação Orotraqueal",
      deviceSize: "Tubo Aramado nº 7.5",
      hasCuff: true,
      cuffPressure: 25,
      fixationDepth: "21 cm",
      attempts: 1,
      laryngoscopyType: "Videolaringoscopia",
      airwayGuides: "Bougie",
      cormackLehane: "Grau II",
      predictionEasy: "Fácil",
      capnographyConfirmed: true,
      extubatedInRoom: true,
      airwayHandoverMaintenance: false,
    },
    vascularAccesses: [
      {
        id: "va-1",
        type: "Venoso Periférico",
        site: "Dorso da Mão",
        side: "Direito",
        gauge: "20G",
        attempts: 2,
        ultrasoundGuided: false,
        timestamp: getRelativeTimeIso(-10),
        professional: "Amanda (Enf)"
      }
    ],
    monitorConfig: {
      cardioscopy: true,
      pani: true,
      pai: false,
      oximetry: true,
      capnography: true,
      temperature: true,
      bis: true,
      entropy: false,
      tof: true,
      pvc: false,
      cardiacOutput: false,
      gasMonitor: true,
      diuresis: false,
    },
    equipmentConfig: {
      infusionPump: true,
      urinaryCatheter: false,
      gastricTube: true,
      thermalBlanket: true,
      thermalMattress: false,
      cellSaver: false,
      defibrillator: true,
      pacemaker: false,
    },
    vitals: vitals,
    bolusDrugs: [
      {
        id: "bd-1",
        name: "Midazolam",
        dose: 3,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(-5),
        minutesFromStart: -5,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Ansiólise (Paciente muito ansiosa)"
      },
      {
        id: "bd-2",
        name: "Fentanil",
        dose: 150,
        unit: "mcg",
        route: "EV",
        timestamp: getRelativeTimeIso(5),
        minutesFromStart: 5,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Co-indução"
      },
      {
        id: "bd-3",
        name: "Lidocaína",
        dose: 60,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(6),
        minutesFromStart: 6,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Dor à injeção de propofol"
      },
      {
        id: "bd-4",
        name: "Propofol",
        dose: 120,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(7),
        minutesFromStart: 7,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Indução"
      },
      {
        id: "bd-5",
        name: "Rocurônio",
        dose: 50,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(8),
        minutesFromStart: 8,
        administeredBy: "Dra. Juliana Mendes",
        notes: "BNM"
      },
      {
        id: "bd-5-b",
        name: "Ropivacaína 0.5%",
        dose: 40,
        unit: "ml",
        route: "Bloqueio",
        timestamp: getRelativeTimeIso(16),
        minutesFromStart: 16,
        administeredBy: "Dra. Juliana Mendes",
        notes: "TAP Block Ecoguiado Bilateral (20ml cada lado)"
      },
      {
        id: "bd-6",
        name: "Dexametasona",
        dose: 8,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(20),
        minutesFromStart: 20,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Profilaxia NVPO e anti-inflamatório"
      },
      {
        id: "bd-7",
        name: "Dipirona",
        dose: 2,
        unit: "g",
        route: "EV",
        timestamp: getRelativeTimeIso(70),
        minutesFromStart: 70,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Analgesia"
      },
      {
        id: "bd-8",
        name: "Cetoprofeno",
        dose: 100,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(70),
        minutesFromStart: 70,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Analgesia"
      },
      {
        id: "bd-9",
        name: "Ondansetrona",
        dose: 8,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(85),
        minutesFromStart: 85,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Profilaxia NVPO (Apfel 4)"
      },
      {
        id: "bd-10",
        name: "Sugamadex",
        dose: 200,
        unit: "mg",
        route: "EV",
        timestamp: getRelativeTimeIso(100),
        minutesFromStart: 100,
        administeredBy: "Dra. Juliana Mendes",
        notes: "Reversão BNM (TOF ratio 0.6)"
      }
    ],
    continuousInfusions: [
      {
        id: "ci-1",
        name: "Remifentanil",
        concentration: "50 mcg/ml",
        diluent: "SF 0.9% 100ml",
        totalVolumePrepared: 100,
        unit: "mcg/kg/min",
        history: [
          {
            timestamp: getRelativeTimeIso(15),
            minutesFromStart: 15,
            rate: 0.1,
            status: "Iniciado"
          },
          {
            timestamp: getRelativeTimeIso(25),
            minutesFromStart: 25,
            rate: 0.2,
            status: "Alterado" // Pneumoperitônio
          },
          {
            timestamp: getRelativeTimeIso(60),
            minutesFromStart: 60,
            rate: 0.1,
            status: "Alterado" // Retirada da vesícula
          },
          {
            timestamp: getRelativeTimeIso(95),
            minutesFromStart: 95,
            rate: 0,
            status: "Finalizado"
          }
        ]
      }
    ],
    inhalationAgents: [
      {
        id: "ia-1",
        agent: "Sevoflurano",
        inspiredConc: 2.2,
        expiredConc: 1.8,
        mac: 1.0,
        flowO2: 1.0,
        flowAir: 1.0,
        startTime: getRelativeTimeIso(11),
        endTime: getRelativeTimeIso(100)
      }
    ],
    fluids: [
      {
        id: "fl-1",
        type: "Cristaloide",
        name: "Soro Ringer com Lactato",
        volumePrepared: 1000,
        volumeAdministered: 800,
        startTime: getRelativeTimeIso(0)
      }
    ],
    outputs: [
      {
        id: "out-1",
        type: "Perda Sanguínea Estimada",
        volume: 50,
        timestamp: getRelativeTimeIso(90)
      }
    ],
    events: [
      {
        id: "ev-0",
        name: "Paciente em Sala",
        timestamp: getRelativeTimeIso(-10),
        category: "Procedimento",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-1",
        name: "Indução Anestésica",
        timestamp: getRelativeTimeIso(7),
        category: "Procedimento",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-2",
        name: "Intubação Traqueal",
        timestamp: getRelativeTimeIso(10),
        category: "Via Aérea",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-3",
        name: "Sonda Orogástrica Passada",
        timestamp: getRelativeTimeIso(14),
        category: "Procedimento",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-4",
        name: "Bloqueio Regional (TAP)",
        timestamp: getRelativeTimeIso(16),
        category: "Procedimento",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-5",
        name: "Incisão Cirúrgica",
        timestamp: getRelativeTimeIso(20),
        category: "Procedimento",
        user: "Dr. Rodrigo Alcantara"
      },
      {
        id: "ev-6",
        name: "Pneumoperitônio (Início)",
        timestamp: getRelativeTimeIso(25),
        category: "Procedimento",
        user: "Dr. Rodrigo Alcantara"
      },
      {
        id: "ev-7",
        name: "Início Colangiografia",
        timestamp: getRelativeTimeIso(55),
        category: "Procedimento",
        user: "Dr. Rodrigo Alcantara"
      },
      {
        id: "ev-8",
        name: "Retirada da Vesícula",
        timestamp: getRelativeTimeIso(70),
        category: "Procedimento",
        user: "Dr. Rodrigo Alcantara"
      },
      {
        id: "ev-9",
        name: "Fim do Pneumoperitônio",
        timestamp: getRelativeTimeIso(95),
        category: "Procedimento",
        user: "Dr. Rodrigo Alcantara"
      },
      {
        id: "ev-10",
        name: "Extubação",
        timestamp: getRelativeTimeIso(108),
        category: "Via Aérea",
        user: "Dra. Juliana Mendes"
      },
      {
        id: "ev-11",
        name: "Saída de Sala",
        timestamp: getRelativeTimeIso(112),
        category: "Procedimento",
        user: "Dra. Juliana Mendes"
      }
    ],
    incidents: [],
    transfers: [],
    checklist: {
      patientIdConfirmed: true,
      procedureConfirmed: true,
      lateralityConfirmed: true,
      consentConfirmed: true,
      allergiesReviewed: true,
      jejumReviewed: true,
      preEvaluationReviewed: true,
      machineChecked: true,
      monitorsReady: true,
      airwayPrepped: true,
      drugsPrepped: true,
      bloodAvailable: false,
      antibioticChecked: true,
      icuBedReserved: false,
    },
    recovery: {
      admissionTime: getRelativeTimeStr(115),
      admittingStaff: "Enf. Ana Paula",
      pas: 125,
      pad: 80,
      fc: 80,
      spo2: 97,
      painScale: 2,
      scoreActivity: 2,
      scoreRespiration: 2,
      scoreCirculation: 2,
      scoreConsciousness: 2,
      scoreSaturation: 2,
      records: [
        {
          id: "rec-1",
          timestamp: getRelativeTimeIso(115),
          minutesFromAdmission: 0,
          pas: 125,
          pad: 80,
          fc: 80,
          spo2: 97,
          fr: 15,
          temp: 36.1,
          painScale: 2,
          nauseaVomiting: "Ausente",
          consciousnessState: "Acordado/Alerta",
          motorActivity: "Move 4 membros voluntariamente",
          motorBlockBromage: "Bromage 0 (Sem bloqueio)",
          dressingStatus: "Seco"
        },
        {
          id: "rec-2",
          timestamp: getRelativeTimeIso(130),
          minutesFromAdmission: 15,
          pas: 120,
          pad: 76,
          fc: 74,
          spo2: 98,
          fr: 14,
          temp: 36.4,
          painScale: 1,
          nauseaVomiting: "Ausente",
          consciousnessState: "Acordado/Alerta",
          motorActivity: "Move 4 membros voluntariamente",
          motorBlockBromage: "Bromage 0 (Sem bloqueio)",
          dressingStatus: "Seco"
        }
      ]
    },
    handover: {
      dischargeCondition: "Acordado",
      destination: "Leito",
      notes: "Paciente com boa evolução na SRPA. Sinais vitais estáveis. Sem dor intensa, referiu apenas dor leve incisional, sem náuseas (Aldrete 10). Liberada para quarto conforme rotina institucional."
    },
    amendments: [],
    voiceTranscripts: [],
    narrativeLaunches: [
      {
        id: "nl-1",
        date: dateStr,
        time: getRelativeTimeStr(-10),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Paciente recebida na sala operatória. Muito ansiosa. Confirmados dados de identificação, jejum e consentimento cirúrgico. Realizada punção venosa com jelco 20G em dorso da mão direita após segunda tentativa (relata veias difíceis). Feito midazolam 3mg EV.",
        type: "Descrição Principal",
        version: 1
      },
      {
        id: "nl-2",
        date: dateStr,
        time: getRelativeTimeStr(7),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Indução em sequência rápida modificada. Pré-oxigenação sob máscara 100%. Propofol, fentanil e rocurônio. Sem reações.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-3",
        date: dateStr,
        time: getRelativeTimeStr(10),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Realizada intubação orotraqueal com auxílio de videolaringoscópio devido obesidade e histórico de via aérea potencialmente difícil (Cormack IIa). Tubo aramado 7.5 passado com facilidade. Capnografia normal.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-4",
        date: dateStr,
        time: getRelativeTimeStr(16),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Realizado TAP Block bilateral guiado por ultrassom com ropivacaína 0.5% (20ml de cada lado) para analgesia multimodal pós-operatória.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-5",
        date: dateStr,
        time: getRelativeTimeStr(25),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Instalado pneumoperitônio (pressão intra-abdominal 12 mmHg). Elevação transitória da pressão arterial (PAM ~ 100) e picos pressóricos inspiratórios, compensados com aumento do remifentanil e adequação da frequência respiratória para manter EtCO2 adequado.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-6",
        date: dateStr,
        time: getRelativeTimeStr(55),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Realizada colangiografia transoperatória pela equipe cirúrgica. Sem intercorrências, vias biliares pérvias sem cálculos retidos evidentes.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-7",
        date: dateStr,
        time: getRelativeTimeStr(70),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Extração da vesícula biliar. Procedimento encaminha-se para o fim.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-8",
        date: dateStr,
        time: getRelativeTimeStr(100),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Término da cirurgia. Desinsuflação do abdome. Reversão do bloqueio neuromuscular com sugamadex 200mg (TOF ratio estava 0.6). Paciente recuperando ventilação espontânea, retornando à consciência.",
        type: "Evento Cronológico",
        version: 1
      },
      {
        id: "nl-9",
        date: dateStr,
        time: getRelativeTimeStr(108),
        author: "Dra. Juliana Mendes",
        crm: "234567",
        text: "Extubação orotraqueal em sala, paciente totalmente acordada, respondendo a comandos verbais, respiração rítmica e adequada. Proteção de via aérea intacta. Sem queixas de dor intensa de imediato.",
        type: "Evento Cronológico",
        version: 1
      }
    ]
  };
}


export function getBlankDocument(): AnesthesiaDocument {
  return {
    id: `doc-${Date.now()}`,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: 1,
    patient: {
      id: `pat-${Date.now()}`,
      fullName: "",
      recordNumber: "",
      admissionNumber: "",
      birthDate: "",
      age: 0,
      gender: "",
      weight: 0,
      height: 0,
      imc: 0,
      hospital: "",
      unit: "",
      sector: "",
      operatingRoom: "",
      bed: "",
      date: new Date().toISOString().split("T")[0],
      scheduledProcedure: "",
      actualProcedure: "",
      allergies: "",
      laterality: "Não se aplica",
      urgencyType: "Eletivo",
      diagnosis: "",
      asa: "" as unknown as ASAClass,
      consentStatus: "Pendente"
    },
    team: {
      anesthesiologistLead: "",
      crmLead: "",
      ufLead: "SP",
      surgeon: "",
      surgeonCRM: "",
      surgeonUF: "GO"
    },
    timers: {},
    preEvaluation: {
      weight: 0,
      height: 0,
      imc: 0,
      painScale: 0,
      jejumSolidsHours: 0,
      jejumLiquidsHours: 0,
      currentMedications: "",
      preAnestheticMedication: "",
      proposedSurgery: "",
      proposedDiagnosis: "",
      cardioCirculatory: { negative: true, text: "", options: [] },
      respiratory: { negative: true, text: "", options: [] },
      gastroHepatic: { negative: true, text: "", options: [] },
      neurological: { negative: true, text: "", options: [] },
      renal: { negative: true, text: "", options: [] },
      hematological: { negative: true, text: "", options: [] },
      musculoSkeletal: { negative: true, text: "", options: [] },
      endocrine: { negative: true, text: "", options: [] },
      cancer: { negative: true, text: "", options: [] },
      infectious: { negative: true, text: "", options: [] },
      pregnancy: { negative: true },
      socialHabits: { negative: true },
      allergies: { negative: true, list: [] },
      previousAnesthesia: { negative: true, list: [] },
      nauseaVomitingHistory: false,
      apfelScore: 0,
      familyAnesthesiaComplications: { negative: true },
      malignantHyperthermiaSuspected: false,
      physicalExam: {
        cardiac: "Normal",
        respiratory: "Normal",
        neurological: "Normal",
        regional: "Normal",
        other: ""
      },
      airwayEvaluation: {
        historyOfDifficultAirway: false,
        teethStatus: "Conservados",
        prosthesis: false,
        mallampati: "I",
        tireomentonianaCm: "> 5 cm (3 dedos)",
        neckMobility: "Normal",
        neckAspect: "Normal",
        interincisivos: "> 3 cm",
        mandibularProtrusionNormal: true,
        predictDifficultAirway: false,
        planPrimary: "",
        planAlternative: ""
      },
      laboratory: {},
      proposedAnestheticTechnique: "",
      alternativeAnestheticTechnique: "",
      asa: "" as unknown as ASAClass,
      isEmergency: false,
      releasedForSurgery: false,
      date: new Date().toISOString().split("T")[0],
      time: "",
      anesthesiologistName: "",
      crm: ""
    },
    technique: {
      balanced: false,
      generalIV: false,
      generalInhalational: false,
      sedation: false,
      local: false,
      spinal: false,
      epidural: false,
      combinedSpinalEpidural: false,
      regionalPeripheralBlock: false,
      regionalIV: false,
      other: ""
    },
    airway: {
      ventilationType: "Espontânea",
      deviceSize: "",
      cormackLehane: undefined,
      capnographyConfirmed: false
    },
    vitals: [],
    bolusDrugs: [],
    continuousInfusions: [],
    fluids: [],
    outputs: [],
    events: [],
    vascularAccesses: [],
    monitorConfig: {
      cardioscopy: true,
      pani: true,
      pai: false,
      oximetry: true,
      capnography: true,
      temperature: false,
      bis: false,
      entropy: false,
      tof: false,
      pvc: false,
      cardiacOutput: false,
      gasMonitor: false,
      diuresis: false
    },
    equipmentConfig: {
      infusionPump: false,
      urinaryCatheter: false,
      gastricTube: false,
      thermalBlanket: false,
      thermalMattress: false,
      cellSaver: false,
      defibrillator: false,
      pacemaker: false
    },
    inhalationAgents: [],
    incidents: [],
    transfers: [],
    checklist: {
      patientIdConfirmed: true,
      procedureConfirmed: true,
      lateralityConfirmed: true,
      consentConfirmed: true,
      allergiesReviewed: true,
      jejumReviewed: true,
      preEvaluationReviewed: true,
      machineChecked: true,
      monitorsReady: true,
      airwayPrepped: true,
      drugsPrepped: true,
      bloodAvailable: true,
      antibioticChecked: true,
      icuBedReserved: true
    },
    recovery: {
      records: []
    },
    handover: {
      dischargeCondition: "Acordado",
      destination: "SRPA",
      notes: ""
    },
    amendments: [],
    narrativeLaunches: [],
    voiceTranscripts: []
  };
}
