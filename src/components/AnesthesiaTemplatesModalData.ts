export const PRESET_TEMPLATES: any[] = [
  {
    id: "tpl-1",
    userId: "system",
    name: "Geral Balanceada (Padrão)",
    description: "Indução venosa, manutenção inalatória com Sevoflurano.",
    isPublic: true,
    bolusDrugs: [
      { name: "Fentanil", dose: "2", unit: "mcg/kg", route: "EV" },
      { name: "Propofol", dose: "2", unit: "mg/kg", route: "EV" },
      { name: "Rocurônio", dose: "0.6", unit: "mg/kg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Ondansetrona", dose: "4", unit: "mg", route: "EV" },
      { name: "Dexametasona", dose: "4", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    inhalationAgents: [
      { name: "Sevoflurano", inspiredConc: 2.0, flowO2: 1.0, flowAir: 1.0, timeOffset: 0 }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 500 }
    ],
    airway: {
      ventilationType: "Tubo Endotraqueal",
      deviceInfo: "Tubo 7.5 com Balão"
    },
    accesses: [
      { type: "Periférico", site: "Membro Superior Esquerdo", gauge: "20G" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-2",
    userId: "system",
    name: "Cesariana",
    description: "Raquianestesia com Bupivacaína Hiperbárica e Morfina.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "10", unit: "mg", route: "Subaracnóideo" },
      { name: "Morfina", dose: "100", unit: "mcg", route: "Subaracnóideo" },
      { name: "Ocitocina", dose: "5", unit: "UI", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Ondansetrona", dose: "4", unit: "mg", route: "EV" },
      { name: "Cetoprofeno", dose: "100", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 1000 }
    ],
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupivacaína Hiperbárica + Morfina" }
    ],
    accesses: [
      { type: "Periférico", site: "Membro Superior Esquerdo", gauge: "18G" }
    ],
    events: [
      { name: "Nascimento", category: "Procedimento" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-3",
    userId: "system",
    name: "Apendicectomia",
    description: "Anestesia Geral Balanceada com Indução de Sequência Rápida.",
    isPublic: true,
    bolusDrugs: [
      { name: "Fentanil", dose: "2", unit: "mcg/kg", route: "EV" },
      { name: "Propofol", dose: "2", unit: "mg/kg", route: "EV" },
      { name: "Succinilcolina", dose: "1", unit: "mg/kg", route: "EV" },
      { name: "Ceftriaxona", dose: "1", unit: "g", route: "EV" },
      { name: "Metronidazol", dose: "500", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    inhalationAgents: [
      { name: "Sevoflurano", inspiredConc: 2.0, flowO2: 1.0, flowAir: 1.0, timeOffset: 0 }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 500 }
    ],
    airway: {
      ventilationType: "Tubo Endotraqueal",
      deviceInfo: "Tubo 8.0 com Balão"
    },
    accesses: [
      { type: "Periférico", site: "MSE", gauge: "18G" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-4",
    userId: "system",
    name: "Hernioplastia Inguinal",
    description: "Raquianestesia com Bupivacaína e sedação leve.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "15", unit: "mg", route: "Subaracnóideo" },
      { name: "Midazolam", dose: "2", unit: "mg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" },
      { name: "Cetoprofeno", dose: "100", unit: "mg", route: "EV" },
      { name: "Ondansetrona", dose: "4", unit: "mg", route: "EV" }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 500 }
    ],
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupi Hiperbárica" }
    ],
    accesses: [
      { type: "Periférico", site: "MSD", gauge: "20G" }
    ],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-5",
    userId: "system",
    name: "Histerectomia Abdominal",
    description: "Técnica Combinada (Raqui + Geral) ou Geral Balanceada.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "15", unit: "mg", route: "Subaracnóideo" },
      { name: "Morfina", dose: "100", unit: "mcg", route: "Subaracnóideo" },
      { name: "Propofol", dose: "2", unit: "mg/kg", route: "EV" },
      { name: "Rocurônio", dose: "0.6", unit: "mg/kg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" },
      { name: "Dexametasona", dose: "10", unit: "mg", route: "EV" }
    ],
    inhalationAgents: [
      { name: "Sevoflurano", inspiredConc: 2.0, flowO2: 1.0, flowAir: 1.0, timeOffset: 0 }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 1000 }
    ],
    airway: {
      ventilationType: "Tubo Endotraqueal",
      deviceInfo: "Tubo 7.5"
    },
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupi Hiper + Morfina" }
    ],
    accesses: [
      { type: "Periférico", site: "MSE", gauge: "18G" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-6",
    userId: "system",
    name: "Artroplastia (Quadril/Joelho)",
    description: "Raquianestesia + Sedação + Controle de Sangramento.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "15", unit: "mg", route: "Subaracnóideo" },
      { name: "Morfina", dose: "100", unit: "mcg", route: "Subaracnóideo" },
      { name: "Midazolam", dose: "2", unit: "mg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Ácido Tranexâmico", dose: "1", unit: "g", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" },
      { name: "Cetoprofeno", dose: "100", unit: "mg", route: "EV" }
    ],
    continuousInfusions: [
      { name: "Propofol", concentration: "10 mg/ml", rate: "25", rateUnit: "mcg/kg/min", diluent: "Puro", totalVolumePrepared: 50, timeOffset: 0 }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 1000 }
    ],
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupi Hiper + Morfina" }
    ],
    accesses: [
      { type: "Periférico", site: "MSE", gauge: "18G" }
    ],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-7",
    userId: "system",
    name: "Cirurgia Bariátrica",
    description: "Anestesia Geral Venosa Total (TIVA) com monitorização BIS.",
    isPublic: true,
    continuousInfusions: [
      { name: "Propofol", concentration: "10 mg/ml", rate: "3.0", rateUnit: "mcg/ml", diluent: "Puro", totalVolumePrepared: 50, timeOffset: 0 },
      { name: "Remifentanil", concentration: "50 mcg/ml", rate: "4.0", rateUnit: "ng/ml", diluent: "SF 0.9% 40ml", totalVolumePrepared: 50, timeOffset: 0 }
    ],
    bolusDrugs: [
      { name: "Rocurônio", dose: "1", unit: "mg/kg", route: "EV" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Dexametasona", dose: "10", unit: "mg", route: "EV" },
      { name: "Ondansetrona", dose: "8", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 1000 }
    ],
    airway: {
      ventilationType: "Tubo Endotraqueal",
      deviceInfo: "Tubo 8.0"
    },
    accesses: [
      { type: "Periférico", site: "MSE", gauge: "18G" }
    ],
    events: [
      { name: "Indução Anestésica", category: "Procedimento" }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-8",
    userId: "system",
    name: "RTU de Próstata",
    description: "Raquianestesia T10 para monitorização da Síndrome de RTU.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "12.5", unit: "mg", route: "Subaracnóideo" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Midazolam", dose: "1", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 500 }
    ],
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupi Hiperbárica 12.5mg" }
    ],
    accesses: [
      { type: "Periférico", site: "MSD", gauge: "20G" }
    ],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-9",
    userId: "system",
    name: "Lipoabdominoplastia",
    description: "Raquianestesia alta ou Geral. Sedação com Dexmedetomidina.",
    isPublic: true,
    bolusDrugs: [
      { name: "Bupivacaína Hiperbárica 0,5%", dose: "15", unit: "mg", route: "Subaracnóideo" },
      { name: "Morfina", dose: "100", unit: "mcg", route: "Subaracnóideo" },
      { name: "Cefazolina", dose: "2", unit: "g", route: "EV" },
      { name: "Dexametasona", dose: "10", unit: "mg", route: "EV" },
      { name: "Dipirona", dose: "2", unit: "g", route: "EV" }
    ],
    continuousInfusions: [
      { name: "Propofol", concentration: "10 mg/ml", rate: "25", rateUnit: "mcg/kg/min", diluent: "Puro", totalVolumePrepared: 50, timeOffset: 0 },
      { name: "Dexmedetomidina", concentration: "4 mcg/ml", rate: "0.5", rateUnit: "mcg/kg/h", diluent: "SF 0.9% 50ml", totalVolumePrepared: 50, timeOffset: 0 }
    ],
    fluids: [
      { name: "Soro Ringer com Lactato", type: "Cristaloide", volume: 1000 }
    ],
    blocks: [
      { type: "Raquianestesia", site: "L3-L4", drugs: "Bupi Hiper + Morfina" }
    ],
    accesses: [
      { type: "Periférico", site: "MSE", gauge: "18G" }
    ],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-10",
    userId: "system",
    name: "Cirurgia de Catarata",
    description: "Sedação leve + Anestesia Tópica ou Bloqueio Peribulbar.",
    isPublic: true,
    bolusDrugs: [
      { name: "Midazolam", dose: "1", unit: "mg", route: "EV" },
      { name: "Fentanil", dose: "25", unit: "mcg", route: "EV" },
      { name: "Ropivacaína 1%", dose: "5", unit: "ml", route: "Peribulbar" }
    ],
    fluids: [
      { name: "Soro Fisiológico 0.9%", type: "Cristaloide", volume: 500 }
    ],
    blocks: [
      { type: "Bloqueio de Nervo Periférico", site: "Peribulbar", drugs: "Ropivacaína 1%" }
    ],
    accesses: [
      { type: "Periférico", site: "MSD", gauge: "22G" }
    ],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];