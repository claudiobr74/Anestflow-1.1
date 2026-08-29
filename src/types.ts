/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ASAClass {
  ASA_I = "ASA I",
  ASA_II = "ASA II",
  ASA_III = "ASA III",
  ASA_IV = "ASA IV",
  ASA_V = "ASA V",
  ASA_VI = "ASA VI"
}

export interface PatientInfo {
  id: string;
  cpf?: string;
  fullName: string;
  socialName?: string;
  birthDate: string;
  age: number;
  gender: string;
  admissionNumber: string;
  recordNumber: string;
  hospital: string;
  unit: string;
  sector: string;
  operatingRoom: string;
  bed: string;
  date: string;
  weight: number; // in kg
  height: number; // in cm
  imc: number; // calculated
  asa: ASAClass;
  urgencyType: "Eletivo" | "Urgência" | "Emergência";
  diagnosis: string;
  scheduledProcedure: string;
  actualProcedure: string;
  laterality: "Não se aplica" | "Direita" | "Esquerda" | "Bilateral";
  allergies: string;
  consentStatus: "Pendente" | "Confirmado" | "Isento";
}

export interface MedicalTeam {
  anesthesiologistLead: string;
  crmLead: string;
  ufLead: string;
  anesthesiologistSecond?: string;
  anesthesiologistAssistant?: string;
  surgeon: string;
  surgeonCRM?: string;
  surgeonUF?: string;
  assistantFirst?: string;
  assistantSecond?: string;
  scrubNurse?: string;
  otherStaff?: string;
}

export interface AnesthesiologistTransfer {
  id: string;
  timestamp: string; // ISO string
  outgoingUid?: string;
  outgoingName: string;
  outgoingCRM: string;
  outgoingUF: string;
  incomingUid?: string;
  incomingName: string;
  incomingCRM: string;
  incomingUF: string;
  clinicalConditions: string;
  incidentsReported: string;
  ongoingInfusions: string;
  pendingItems: string;
  acceptedAt?: string;
}

export interface PendingTransfer {
  id: string;
  outgoingUid: string;
  outgoingName: string;
  outgoingCRM: string;
  outgoingUF: string;
  incomingUid?: string;
  incomingEmail?: string;
  incomingName: string;
  incomingCRM: string;
  incomingUF: string;
  clinicalConditions: string;
  incidentsReported: string;
  ongoingInfusions: string;
  pendingItems: string;
  requestedAt: string;
}

export interface ClinicalEvent {
  id: string;
  name: string;
  timestamp: string; // ISO or relative minutes
  time?: string;
  category: "Marcador Temporal" | "Procedimento" | "Acesso" | "Via Aérea" | "Bloqueio" | "Intercorrência" | "Outro" | "Equipe";
  notes?: string;
  user?: string;
}

export interface VitalRecord {
  id: string;
  timestamp: string; // ISO string
  minutesFromStart: number; // relative to start
  pas?: number; // systolic
  pad?: number; // diastolic
  pam?: number; // calculated or manual
  fc?: number; // heart rate
  spo2?: number; // oxygen saturation
  etco2?: number; // capnography
  temp?: number; // temperature
  fr?: number; // respiratory rate
  bis?: number; // depth of anesthesia
  tof?: number; // train of four
  pvc?: number; // central venous pressure
  pai?: number; // invasive blood pressure (mean)
  fio2?: number;
  vt?: number; // tidal volume
  peep?: number;
  p_peak?: number;
  p_plat?: number;
}

export interface BolusDrug {
  id: string;
  name: string;
  dose?: number;
  ampouleTotal?: number; // amount of drug in one ampoule
  ampouleVolume?: number; // volume of the ampoule in mL
  ampoules?: number; // calculated number of ampules used for this specific launch (or overall, but usually we just calculate it in the view)
  unit?: "mg" | "mcg" | "g" | "UI" | "ml" | "ampola" | "mEq";
  route?: "EV" | "IM" | "SC" | "IO" | "Raqui" | "Peridural" | "Bloqueio" | "Inalatório" | "ID";
  timestamp: string;
  minutesFromStart: number;
  administeredBy?: string;
  notes?: string;
}

export interface ContinuousInfusion {
  id: string;
  name: string;
  concentration?: string; // e.g., "1 mg/ml" — vazio se a voz/UI não informou
  diluent?: string; // e.g., "SG 5% 250ml"
  totalVolumePrepared?: number; // ml
  unit?: "mcg/kg/min" | "mcg/kg/h" | "mg/kg/min" | "mg/kg/h" | "mg/h" | "ml/h" | "mcg/min";
  history: {
    timestamp: string;
    minutesFromStart: number;
    rate: number; // can be speed or dose rate
    status: "Iniciado" | "Alterado" | "Pausado" | "Finalizado";
  }[];
  notes?: string;
  ampoules?: number;
}

export interface InhalationAgent {
  id: string;
  agent: "Isoflurano" | "Sevoflurano" | "Desflurano" | "Óxido Nitroso" | "Oxigênio (O₂)" | "Ar Comprimido";
  inspiredConc?: number; // %
  expiredConc?: number; // %
  mac?: number;
  flowO2?: number; // L/min
  flowAir?: number; // L/min
  flowN2O?: number; // L/min
  startTime: string;
  endTime?: string;
}

export interface FluidRecord {
  id: string;
  type: "Cristaloide" | "Coloide" | "Albumina" | "Concentrado de Hemácias" | "Plasma Fresco" | "Plaquetas" | "Crioprecipitado" | "Outro";
  name: string; // e.g., "Soro Ringer Lactato"
  volumePrepared: number; // ml
  volumeAdministered: number; // ml
  startTime: string;
  endTime?: string;
  batchNumber?: string;
  reactionNotes?: string;
}

export interface OutputRecord {
  id: string;
  type: "Diurese" | "Perda Sanguínea Estimada" | "Aspirado Gástrico" | "Dreno" | "Outros";
  volume: number; // ml
  timestamp: string;
  notes?: string;
}

export interface AnesthesiaTechnique {
  generalIV: boolean;
  generalInhalational: boolean;
  balanced: boolean;
  sedation: boolean;
  local: boolean;
  spinal: boolean; // Raquianestesia
  epidural: boolean; // Peridural
  combinedSpinalEpidural: boolean;
  regionalPeripheralBlock: boolean;
  regionalIV: boolean;
  other: string;
  
  // Details for regional/blocks
  regionalDetails?: {
    type?: string;
    region?: string;
    site?: string;
    side?: "Direito" | "Esquerdo" | "Bilateral";
    level?: string;
    position?: string;
    ultrasoundGuided?: boolean;
    neurostimulator?: boolean;
    needleType?: string;
    needleGauge?: string;
    needleLength?: string;
    catheterInserted?: boolean;
    catheterDepth?: string;
    testDose?: string;
    drugsUsed?: string;
    attempts?: number;
    incidents?: string;
    result?: "Sucesso" | "Falha Parcial" | "Falha Total";
  };
}

export interface AirwayDetails {
  ventilationType: "Espontânea" | "Máscara Facial" | "Cânula Nasal" | "Cânula Orofaríngea" | "Dispositivo Supraglótico" | "Intubação Orotraqueal" | "Intubação Nasotraqueal" | "Tubo Duplo Lúmen" | "Traqueostomia" | "Outro";
  ventilationMode?: "Espontânea" | "VCM" | "VCV" | "PCV" | "Manual" | "PSV" | "SIMV" | "Outro";
  deviceSize?: string;
  hasCuff?: boolean;
  cuffPressure?: number;
  fixationDepth?: string;
  attempts?: number;
  laryngoscopyType?: "Laringoscopia Direta" | "Videolaringoscopia" | "Fibroscopia" | "Outro";
  airwayGuides?: "Bougie" | "Estilete" | "Nenhum";
  cormackLehane?: "Grau I" | "Grau II" | "Grau III" | "Grau IV";
  predictionEasy?: "Fácil" | "Difícil" | "Não avaliado";
  capnographyConfirmed?: boolean;
  extubatedInRoom?: boolean;
  airwayHandoverMaintenance?: boolean;
  incidents?: string;
}

export interface VentilationParams {
  mode: "Espontânea" | "Manual" | "VCV" | "PCV" | "PSV" | "SIMV" | "Outro";
  vt?: number;
  fr?: number;
  peep?: number;
  fio2?: number;
  p_insp?: number;
  p_peak?: number;
  p_plat?: number;
  ie_ratio?: string;
  flow?: number;
}

export interface MonitorConfig {
  cardioscopy: boolean;
  pani: boolean;
  pai: boolean;
  oximetry: boolean;
  capnography: boolean;
  temperature: boolean;
  bis: boolean;
  entropy: boolean;
  tof: boolean;
  pvc: boolean;
  cardiacOutput: boolean;
  gasMonitor: boolean;
  diuresis: boolean;
  other?: string;
}

export interface EquipmentConfig {
  infusionPump: boolean;
  urinaryCatheter: boolean;
  gastricTube: boolean;
  thermalBlanket: boolean;
  thermalMattress: boolean;
  cellSaver: boolean;
  defibrillator: boolean;
  pacemaker: boolean;
  other?: string;
}

export interface VascularAccess {
  id: string;
  type: string;
  site: string; // e.g. "Fossa Cubital"
  side: "Direito" | "Esquerdo" | "Bilateral" | "N/A";
  gauge: string; // e.g. "18G"
  attempts: number;
  ultrasoundGuided: boolean;
  timestamp: string;
  professional: string;
  incidents?: string;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  category: "Via Aérea" | "Respiratória" | "Hemodinâmica" | "Arritmia" | "Alérgica" | "Hemorrágica" | "Transfusional" | "Neurológica" | "Equipamento" | "Acesso Vascular" | "Técnica Regional" | "Posicionamento" | "Medicamentosa" | "Outra";
  description: string;
  vitalsAffected?: string;
  conductTaken: string;
  drugsUsed?: string;
  clinicalOutcome: string;
  staffInvolved: string;
  status: "Resolvida" | "Em Acompanhamento";
}

export interface PreAnestheticEvaluation {
  weight: number;
  height: number;
  imc: number;
  pa_s?: number;
  pa_d?: number;
  fc?: number;
  fr?: number;
  temp?: number;
  painScale: number; // 0 to 10
  jejumSolidsHours: number;
  jejumLiquidsHours: number;
  jejumTypeSolids?: string;
  jejumTypeLiquids?: string;
  proposedSurgery: string;
  proposedDiagnosis: string;
  
  // Antecedents
  cardioCirculatory: { negative: boolean; text: string; options: string[] };
  respiratory: { negative: boolean; text: string; options: string[] };
  gastroHepatic: { negative: boolean; text: string; options: string[] };
  neurological: { negative: boolean; text: string; options: string[] };
  renal: { negative: boolean; text: string; options: string[] };
  hematological: { negative: boolean; text: string; options: string[] };
  musculoSkeletal: { negative: boolean; text: string; options: string[] };
  endocrine: { negative: boolean; text: string; options: string[] };
  cancer: { negative: boolean; text: string; options: string[] };
  infectious: { negative: boolean; text: string; options: string[] };
  
  pregnancy: { negative: boolean; gestationalWeeks?: number };
  infantBirth?: { negative: boolean; hospitalized?: boolean; dischargedWithMother?: boolean; term: "Termo" | "Pré-termo"; gestationalWeeks?: number; postConceptualWeeks?: number };
  socialHabits: { negative: boolean; tobaccoChecked?: boolean; tobaccoCount?: string; alcoholChecked?: boolean; drugsChecked?: boolean; text?: string };
  
  allergies: { negative: boolean; list: { id: string; agent: string; reaction: string; severity: "Leve" | "Moderada" | "Grave"; date?: string }[] };
  previousAnesthesia: { negative: boolean; list: { id: string; surgery: string; anesthesia: string; outcomes: string }[] };
  nauseaVomitingHistory: boolean;
  apfelScore?: number; // 0-4 points
  familyAnesthesiaComplications: { negative: boolean; text?: string };
  malignantHyperthermiaSuspected: boolean;
  
  currentMedications: string; // text or list
  preAnestheticMedication?: string;
  
  physicalExam: {
    cardiac: string;
    respiratory: string;
    neurological: string;
    regional: string;
    other: string;
  };
  
  laboratory: {
    hb?: string;
    ht?: string;
    na?: string;
    k?: string;
    plaquetas?: string;
    glicose?: string;
    creatinina?: string;
    coagulation?: string;
    other?: string;
  };
  
  airwayEvaluation: {
    historyOfDifficultAirway: boolean;
    teethStatus: "Conservados" | "Precários" | "Ausentes";
    prosthesis: boolean;
    mallampati: "I" | "II" | "III" | "IV";
    mouthOpeningCm?: number; // Distance
    tireomentonianaCm?: "> 5 cm (3 dedos)" | "< 5 cm";
    neckMobility: "Normal" | "Limitada";
    neckAspect: "Normal" | "Largo (>40cm)" | "Curto";
    interincisivos: "> 3 cm" | "< 3 cm";
    mandibularProtrusionNormal: boolean;
    predictDifficultAirway: boolean;
    planPrimary: string;
    planAlternative: string;
    specialEquipmentNeeded?: string;
  };
  
  asa: ASAClass;
  isEmergency: boolean;
  proposedAnestheticTechnique: string;
  alternativeAnestheticTechnique: string;
  bloodComponentsExpected?: string;
  icuRequired?: boolean;
  otherSpecialtyEvaluation?: string;
  releasedForSurgery: boolean;
  releaseNotes?: string;
  generalComments?: string;
  date: string;
  time: string;
  anesthesiologistName: string;
  crm: string;
}

export interface PostAnesthesiaRecovery {
  admissionTime?: string;
  admittingStaff?: string;
  pas?: number;
  pad?: number;
  fc?: number;
  spo2?: number;
  painScale?: number;
  scoreActivity?: number;
  scoreRespiration?: number;
  scoreCirculation?: number;
  scoreConsciousness?: number;
  scoreSaturation?: number;
  dischargeTime?: string;
  dischargingAnesthesiologist?: string;
  dischargingCRM?: string;
  dischargingUF?: string;
  dischargeDestination?: string;
  dischargeInstructions?: string;
  
  // QMentum Parametrization Settings
  temp?: number; // Baseline admission temperature
  paramPasDeviationPct?: number; // Blood pressure deviation percent (e.g., 20)
  paramFcDeviationPct?: number; // Heart rate deviation percent (e.g., 20)
  paramMinSpo2?: number; // Minimum oxygen saturation (e.g., 94)
  paramMinTemp?: number; // Minimum body temperature (e.g., 35.5)
  paramMaxTemp?: number; // Maximum body temperature (e.g., 37.8)
  
  // Serial recordings
  records: {
    id: string;
    timestamp: string;
    minutesFromAdmission: number;
    pas?: number;
    pad?: number;
    fc?: number;
    spo2?: number;
    fr?: number;
    temp?: number;
    painScale?: number; // 0-10
    nauseaVomiting: "Ausente" | "Náusea Leve" | "Náusea Moderada/Vômito";
    consciousnessState: "Acordado/Alerta" | "Sonolento/Desperta ao chamado" | "Sedado/Não responde";
    motorActivity: "Move 4 membros voluntariamente" | "Move 2 membros voluntariamente" | "Não move membros";
    motorBlockBromage: "Bromage 0 (Sem bloqueio)" | "Bromage 1 (Incapacidade de elevar a perna estendida)" | "Bromage 2 (Incapacidade de fletir os joelhos)" | "Bromage 3 (Incapacidade de fletir o tornozelo)";
    dressingStatus: "Seco" | "Úmido" | "Sujando/Sangramento";
    diuresis?: number;
    oxygenTherapy?: string;
    medicationsAdministered?: string;
    solutionsAdministered?: string;
    incidents?: string;
    
    // Aldrete Kroulik components
    aldreteConsciousness?: number; // 0, 1, 2
    aldreteRespiration?: number; // 0, 1, 2
    aldreteCirculation?: number; // 0, 1, 2
    aldreteActivity?: number; // 0, 1, 2
    aldreteOximetry?: number; // 0, 1, 2
    aldreteTotal?: number; // Sum
  }[];
}

export interface HandoverSummary {
  dischargeCondition: "Acordado" | "Sonolento" | "Sedado" | "Intubado" | "Ventilação Mecânica" | "Suporte Vasoativo" | "Óbito";
  destination: "SRPA" | "UTI" | "Unidade Semi-Intensiva" | "Leito" | "Ambulatório" | "Transferência Externa" | "Outro";
  notes: string;
}

export interface DocumentAmendment {
  id: string;
  procedureId: string;      // Referência à ficha original
  text: string;             // Texto do adendo retificatório
  reason: string;           // Motivo da retificação
  createdAt: string;        // Data/hora ISO
  createdByUid: string;     // UID do autor do adendo
  authorName: string;       // Nome do profissional
  authorCRM: string;        // CRM do profissional
  authorUF: string;         // UF do CRM
  hash: string;             // Hash SHA-256 do adendo
  docHashRef?: string;      // Hash da ficha assinada de referência
  timestamp?: string;       // Data/hora legada para compatibilidade
}

export interface AnesthesiaDocument {
  id: string;
  createdByUid?: string;          // Imutável: UID do criador da ficha
  currentResponsibleUid?: string; // UID do anestesiologista atualmente responsável
  participantUids?: string[];     // UIDs dos anestesiologistas autorizados a visualizar/participar
  pendingTransfer?: PendingTransfer; // Solicitação de troca de responsabilidade pendente
  userId?: string;                // Mantido para compatibilidade retroativa
  sharedWithEmails?: string[];
  status: "Draft" | "InProgress" | "Signed";
  isOfflineDraft?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedAtServer?: any;
  /** Token de concorrência da linha em procedures (não é schema_version). */
  revision?: number;
  signedAt?: string;
  signedBy?: {
    uid?: string;
    name: string;
    crm: string;
    uf: string;
    email?: string;
  };
  hash?: string;
  docVersion?: string;
  signatureSnapshot?: string;
  
  // High-level states
  timers: {
    startAnesthesia?: string;
    startSurgery?: string;
    endSurgery?: string;
    endAnesthesia?: string;
  };
  
  // Modules
  patient: PatientInfo;
  team: MedicalTeam;
  preEvaluation: PreAnestheticEvaluation;
  technique: AnesthesiaTechnique;
  airway: AirwayDetails;
  vascularAccesses: VascularAccess[];
  monitorConfig: MonitorConfig;
  equipmentConfig: EquipmentConfig;
  vitals: VitalRecord[];
  bolusDrugs: BolusDrug[];
  continuousInfusions: ContinuousInfusion[];
  inhalationAgents: InhalationAgent[];
  fluids: FluidRecord[];
  outputs: OutputRecord[];
  events: ClinicalEvent[];
  incidents: IncidentRecord[];
  transfers: AnesthesiologistTransfer[];
  checklist: {
    patientIdConfirmed: boolean;
    procedureConfirmed: boolean;
    lateralityConfirmed: boolean;
    consentConfirmed: boolean;
    allergiesReviewed: boolean;
    jejumReviewed: boolean;
    preEvaluationReviewed: boolean;
    machineChecked: boolean;
    monitorsReady: boolean;
    airwayPrepped: boolean;
    drugsPrepped: boolean;
    bloodAvailable: boolean;
    antibioticChecked: boolean;
    icuBedReserved: boolean;
  };
  recovery: PostAnesthesiaRecovery;
  handover: HandoverSummary;
  amendments: DocumentAmendment[];
  narrativeLaunches?: AnestheticNarrativeLaunch[];
}

/** Partial da ficha ou updater funcional (evita snapshot stale de arrays). */
export type AnesthesiaDocumentPatch =
  Partial<AnesthesiaDocument>
  | ((prev: AnesthesiaDocument) => Partial<AnesthesiaDocument>);


export interface AnestheticNarrativeLaunch {
  id: string;
  date: string;       // e.g. "2026-06-26"
  time: string;       // e.g. "10:15"
  author: string;
  crm: string;
  text: string;
  type: "Descrição Principal" | "Evento Cronológico";
  version: number;
  editedAt?: string;  // ISO String
  editJustification?: string;
}
export interface AnesthesiaTemplate {
  id: string;
  userId: string; // The user who created the template
  name: string;
  description: string;
  isPublic?: boolean;
  
  // Data to insert
  bolusDrugs?: { name: string; dose: string; unit: string; route: string; protocolId?: string; timeOffset?: number }[];
  continuousInfusions?: { name: string; concentration: string; rate: string; rateUnit: string; diluent?: string; totalVolumePrepared?: number; timeOffset?: number; duration?: number }[];
  inhalationAgents?: { name: string; timeOffset?: number; inspiredConc?: number; flowO2?: number; flowAir?: number }[];
  events?: { name: string; category: "Marcador Temporal" | "Procedimento" | "Acesso" | "Via Aérea" | "Bloqueio" | "Intercorrência" | "Outro"; timeOffset?: number }[];
  
  // New modules
  fluids?: { name: string; type: string; volume: number; timeOffset?: number }[];
  airway?: {
    ventilationType: "Espontânea" | "Máscara Facial" | "Máscara Laríngea" | "Tubo Endotraqueal" | "Traqueostomia";
    deviceInfo?: string;
  };
  accesses?: {
    type: "Periférico" | "Central" | "Arterial";
    site: string;
    gauge?: string;
    timeOffset?: number;
  }[];
  blocks?: {
    type: "Raquianestesia" | "Peridural" | "Bloqueio de Nervo Periférico" | "Outro";
    site: string;
    drugs?: string;
    timeOffset?: number;
  }[];
  
  createdAt: string;
  updatedAt: string;
}
