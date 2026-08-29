import { AnesthesiaDocument } from "../types";

export interface AnesthesiaModel {
  id: string;
  name: string;
  isFavorite?: boolean;
  isSystem?: boolean;
  isInstitutional?: boolean;
  category: "Geral" | "Regional" | "Local" | "Outro";
  templateText: string;
}

export const SYSTEM_MODELS: AnesthesiaModel[] = [
  {
    id: "sys-geral",
    name: "Anestesia geral",
    category: "Geral",
    isSystem: true,
    templateText: "Admissão em sala, verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Acesso venoso: [acesso registrado]. Início da anestesia geral às [horário] com indução conforme ficha. Via aérea avançada: [técnica/dispositivo] nº [número], em [número] tentativa(s), confirmada por [método registrado]. Manutenção com [técnica de manutenção] e ventilação [modo ventilatório]. Posicionamento: [posição]. Fármacos e infusões administrados conforme registro. Intercorrências: [intercorrências e condutas]. Despertar e via aérea ao término: [descrição]. Fim da anestesia às [horário]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-balanceada",
    name: "Anestesia geral balanceada",
    category: "Geral",
    isSystem: true,
    templateText: "Admissão em sala, verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Acesso venoso: [acesso registrado]. Início da anestesia geral balanceada às [horário]. Indução e manutenção com [agente inalatório registrado] e fármacos venosos conforme ficha. Via aérea avançada: [técnica/dispositivo] nº [número], confirmada por [método]. Ventilação: [modo ventilatório]. Posicionamento: [posição]. Intercorrências: [intercorrências e condutas]. Despertar e via aérea ao término: [descrição]. Fim da anestesia às [horário]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-inalatoria",
    name: "Anestesia geral inalatória",
    category: "Geral",
    isSystem: true,
    templateText: "Admissão em sala, verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Acesso venoso: [acesso registrado]. Início da anestesia geral inalatória às [horário]. Via aérea avançada: [técnica/dispositivo] nº [número], confirmada por [método]. Manutenção com [agente inalatório registrado] conforme concentrações na ficha. Ventilação: [modo ventilatório]. Posicionamento: [posição]. Intercorrências: [intercorrências e condutas]. Despertar e via aérea ao término: [descrição]. Fim da anestesia às [horário]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-local",
    name: "Anestesia local",
    category: "Local",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Realizada anestesia local em [local anatômico] com [anestésico registrado] a [concentração], volume de [volume]. Posição: [posição]. [Sedação associada, se houver]. Intercorrências: [intercorrências e condutas]. Fim da anestesia às [horário]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-locorregional",
    name: "Anestesia locorregional",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Realizado bloqueio [tipo de bloqueio] em [região/local], à [lateralidade]. Posição: [posição]. Técnica guiada por [ultrassom/neuroestimulador/referência anatômica] com agulha [tipo/calibre]. Administrado [volume] de anestésico local e adjuvantes conforme ficha. [Instalação de cateter, se aplicável]. [Sedação ou anestesia geral associada, se houver]. Intercorrências: [intercorrências e condutas]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-peridural",
    name: "Anestesia peridural",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Anestesia peridural em [nível], com paciente em [posição]. Antissepsia e técnica estéril. Punção com agulha [tipo/calibre], abordagem [abordagem], identificação por [técnica]. Dose-teste: [resultado/droga]. Administrados anestésicos locais conforme ficha. Nível sensitivo obtido: [nível sensitivo]. [Sedação ou anestesia geral associada, se houver]. Intercorrências: [intercorrências e condutas]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-peridural-cateter",
    name: "Anestesia peridural com cateter",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Punção peridural em [nível], paciente em [posição], sob técnica estéril. Agulha [tipo/calibre], abordagem [abordagem], identificação por [técnica]. Passagem de cateter peridural nº [calibre], introduzido [comprimento] cm, fixado em [profundidade] cm. Aspiração e dose-teste: [resultado]. Fármacos administrados conforme ficha. Nível sensitivo: [nível]. Cateter mantido pérvio. Intercorrências: [intercorrências e condutas]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-subaracnoidea",
    name: "Anestesia subaracnóidea",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Anestesia subaracnóidea em [nível], paciente em [posição], sob técnica estéril. Punção com agulha [tipo/calibre], abordagem [abordagem]. Retorno de líquor [aspecto]. Administrados anestésicos locais conforme ficha. Nível sensitivo obtido: [nível sensitivo]. Posição cirúrgica: [posição após a punção]. [Sedação associada, se houver]. Intercorrências: [intercorrências e condutas]. Encaminhado ao [destino], em [condição registrada]."
  },
  {
    id: "sys-sedacao-leve",
    name: "Sedação leve / consciente",
    category: "Outro",
    isSystem: true,
    templateText: "Admissão em sala cirúrgica, segurança confirmada. Monitorização: [monitorização registrada]. Acesso venoso: [acesso registrado]. Administrado suplemento de Oxigênio via [cateter nasal/máscara facial] a [fluxo] L/min. Realizada sedação leve / consciente com titulação incremental de [fármacos/doses]. Paciente mantido em respiração espontânea, respondendo a comandos verbais simples, cooperativo e hemodinamicamente estável (Escala de Ramsay [pontuação], RASS [pontuação]). Procedimento tolerado confortavelmente e sem intercorrências."
  },
  {
    id: "sys-sedacao-profunda",
    name: "Sedação profunda",
    category: "Outro",
    isSystem: true,
    templateText: "Admissão em sala, segurança e identificação confirmadas. Monitorização contínua: [monitorização registrada]. Suplementação de Oxigênio via [cateter nasal/máscara facial] a [fluxo] L/min. Realizada sedação profunda sob supervisão do anestesiologista, com infusão de [fármacos/doses, ex: propofol/dexmedetomidina]. Paciente mantido em plano profundo (Ramsay 5-6, RASS -4), sem resposta a estímulos leves, mas mantendo respiração espontânea rítmica [necessitando de suporte de via aérea: Guedel / manobra de tração mandibular / sem suporte necessário]. Estabilidade ventilatória e hemodinâmica preservadas. Despertar tranquilo e sem queixas."
  },
  {
    id: "sys-combinada-raqui-peri",
    name: "Bloqueio combinado raqui-peridural (CSE)",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança e identificação confirmadas. Monitorização: [monitorização registrada]. Realizado bloqueio combinado raqui-peridural (CSE) em nível [nível], paciente em posição [posição], sob técnica asséptica e estéril. Punção epidural com agulha Tuohy [calibre], identificando-se o espaço por perda de resistência. Introduzida agulha de raqui [tipo/calibre] concentricamente (needle-through-needle), com retorno de líquido cefalorraquidiano (líquor) límpido e cristalino. Administrados anestésicos locais/adjuvantes na dose subaracnóidea conforme ficha. Retirada agulha de raqui e introduzido cateter peridural nº [calibre] a [profundidade] cm. Dose-teste com [fármaco/dose-teste] com resposta negativa para injeção intravascular ou subaracnóidea inadvertida. Nível sensitivo estabelecido: [nível sensitivo]. Cateter peridural fixado e mantido pérvio."
  },
  {
    id: "sys-bloqueio-plexo-braquial",
    name: "Bloqueio de plexo braquial",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança confirmada. Monitorização contínua: [monitorização registrada]. Paciente posicionado adequadamente. Sob antissepsia rigorosa e técnica estéril, posicionado transdutor de ultrassom linear para identificação do plexo braquial via abordagem [interescalênica/supraclavicular/axilar]. Localizadas estruturas nervosas e vasculares adjacentes. Punção em plano com agulha ecogênica de bisel curto [calibre/comprimento]. Posicionamento perineural confirmado por hidrolocalização e/ou neuroestimulador de nervo periférico (resposta motora a [corrente] mA). Após aspiração negativa intermitente, injetado [anestésicos locais/adjuvantes] num volume de [volume] mL, com dispersão circunferencial em 'donut' em tempo real. Bloqueio sensitivo e motor instalados de forma satisfatória. Sem sinais clínicos de toxicidade sistêmica (LAST)."
  },
  {
    id: "sys-bloqueio-tap",
    name: "Bloqueio de parede abdominal (TAP Block)",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança confirmada. Monitorização contínua: [monitorização registrada]. Sob técnica estéril e antissepsia rigorosa, realizado bloqueio do plano transverso do abdômen (TAP Block) [bilateral/unilateral] guiado por ultrassom. Identificados planos musculares da parede abdominal anterior: oblíquo externo, oblíquo interno e transverso do abdômen. Introduzida agulha ecogênica [calibre/comprimento] em plano até o espaço interfascial entre o músculo oblíquo interno e transverso. Sob aspiração intermitente negativa, realizada injeção de [anestésicos/doses] num volume de [volume] mL [de cada lado], observando-se dispersão linear e deposição ideal do anestésico local. Procedimento transcorreu sem intercorrências."
  },
  {
    id: "sys-bloqueio-membro-inferior",
    name: "Bloqueio de membro inferior",
    category: "Regional",
    isSystem: true,
    templateText: "Verificação de segurança confirmada. Monitorização contínua: [monitorização registrada]. Sob técnica asséptica e antissepsia, realizado bloqueio do nervo [femoral/ciático/safeno] guiado por ultrassom [e/ou neuroestimulador]. Identificado o feixe neurovascular e nervo correspondente. Introduzida agulha ecogênica de bisel curto [calibre] até proximidade íntima neural. Realizada aspiração negativa de sangue e injetados [anestésico local/adjuvantes] num volume total de [volume] mL, confirmando-se a dispersão circunferencial do fármaco ao redor da estrutura neural em tempo real. Bloqueio de instalação eficaz, tolerado perfeitamente pelo paciente."
  }
];

export function compileNarrativeDraft(techniques: string[], document: AnesthesiaDocument): string {
  // Extract registered details dynamically from the document without inventing anything!
  
  // 1. Monitorização registrada
  const monitors: string[] = [];
  if (document.monitorConfig?.cardioscopy) monitors.push("cardioscopia");
  if (document.monitorConfig?.pani) monitors.push("pressão arterial não invasiva (PANI)");
  if (document.monitorConfig?.pai) monitors.push("pressão arterial invasiva (PAI)");
  if (document.monitorConfig?.oximetry) monitors.push("oximetria de pulso");
  if (document.monitorConfig?.capnography) monitors.push("capnografia");
  if (document.monitorConfig?.temperature) monitors.push("temperatura");
  if (document.monitorConfig?.bis) monitors.push("índice bispectral (BIS)");
  if (document.monitorConfig?.entropy) monitors.push("entropia");
  if (document.monitorConfig?.tof) monitors.push("sequência de quatro estímulos (TOF)");
  if (document.monitorConfig?.pvc) monitors.push("pressão venosa central (PVC)");
  if (document.monitorConfig?.cardiacOutput) monitors.push("débito cardíaco");
  if (document.monitorConfig?.gasMonitor) monitors.push("analisador de gases expirados");
  if (document.monitorConfig?.diuresis) monitors.push("débito urinário");
  if (document.monitorConfig?.other) monitors.push(document.monitorConfig.other);
  const monitorString = monitors.length > 0 ? monitors.join(", ") : undefined;

  // 2. Acessos
  const accesses = document.vascularAccesses?.map(acc => {
    return `${acc.type} ${acc.gauge ? `calibre ${acc.gauge}` : ""} em ${acc.site || ""} ${acc.side && acc.side !== "N/A" ? `(${acc.side})` : ""}`.trim().replace(/\s+/g, " ");
  });
  const accessString = accesses && accesses.length > 0 ? accesses.join(" e ") : undefined;

  // 3. Timers
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    } catch {
      return "";
    }
  };
  const startAnesthTime = formatTime(document.timers?.startAnesthesia);
  const endAnesthTime = formatTime(document.timers?.endAnesthesia);

  // 4. Airway
  const airwayTech = document.airway?.ventilationType;
  const airwayDevice = document.airway?.deviceSize ? `tamanho ${document.airway.deviceSize}` : "";
  const airwayAttempts = document.airway?.attempts;
  const airwayConfirm = document.airway?.capnographyConfirmed ? "capnografia" : undefined;

  // 5. Ventilation & Maintenance
  const ventilationMode = document.vitals && document.vitals.length > 0
    ? document.vitals.find(v => v.fr !== undefined || v.peep !== undefined) ? "controlada mecânica" : "espontânea"
    : undefined;
  
  const inalatorios = document.inhalationAgents?.map(i => i.agent).filter(Boolean);
  const isBalanced = document.technique?.balanced;
  const maintenanceText = inalatorios && inalatorios.length > 0 
    ? inalatorios.join(", ") 
    : isBalanced 
      ? "agente inalatório a definir" 
      : undefined;

  // 6. Patient positioning & procedure
  const patientPos = document.technique?.regionalDetails?.position || undefined;
  const destination = document.handover?.destination || undefined;
  const condition = document.handover?.dischargeCondition || undefined;

  // 7. Incidents/Intercorrências
  const incidentTexts = document.incidents?.map(i => `${i.description} (conduta: ${i.conductTaken})`).join("; ");

  // 8. Regional details
  const regType = document.technique?.regionalDetails?.type || undefined;
  const regSite = document.technique?.regionalDetails?.site || undefined;
  const regSide = document.technique?.regionalDetails?.side || undefined;
  const regLevel = document.technique?.regionalDetails?.level || undefined;
  const regGuide = [
    document.technique?.regionalDetails?.ultrasoundGuided ? "ultrassonografia" : "",
    document.technique?.regionalDetails?.neurostimulator ? "neuroestimulação" : ""
  ].filter(Boolean).join(" associado a ");
  const needle = [
    document.technique?.regionalDetails?.needleType || "",
    document.technique?.regionalDetails?.needleGauge ? `calibre ${document.technique.regionalDetails.needleGauge}` : "",
    document.technique?.regionalDetails?.needleLength ? `${document.technique.regionalDetails.needleLength}mm` : ""
  ].filter(Boolean).join(", ");
  const hasCatheter = document.technique?.regionalDetails?.catheterInserted;
  const catheterNum = document.technique?.regionalDetails?.catheterDepth ? `calibre/profundidade ${document.technique.regionalDetails.catheterDepth}` : undefined;
  const testDose = document.technique?.regionalDetails?.testDose || undefined;
  const blockResult = document.technique?.regionalDetails?.result || undefined;

  // Helper to resolve bracket placeholders gracefully
  const resolvePlaceholder = (val: string | number | undefined, placeholder: string): string => {
    if (val !== undefined && val !== null && val !== "") {
      return String(val);
    }
    // Highlighting for manual filling when missing
    return `[__${placeholder}__]`;
  };

  // We support multiple selected techniques.
  // Let's sort techniques so regional comes first, general second, as per guideline:
  // "1. Apresentar inicialmente a técnica regional."
  // "2. Apresentar depois indução, via aérea e manutenção da anestesia geral."
  const isRegional = (t: string) => 
    t.includes("local") || 
    t.includes("locorregional") || 
    t.includes("peridural") || 
    t.includes("subaracnóidea") ||
    t.toLowerCase().includes("bloqueio") ||
    t.toLowerCase().includes("combinado");

  const sortedTechs = [...techniques].sort((a, b) => {
    const regA = isRegional(a);
    const regB = isRegional(b);
    if (regA && !regB) return -1;
    if (!regA && regB) return 1;
    return 0;
  });

  // Base paragraphs
  const paragraphs: string[] = [];

  // P1: Admission & Monitors (Always generated)
  const p1Monitors = monitorString ? monitorString : "[__monitorização registrada__]";
  const p1Access = accessString ? accessString : "[__acesso registrado__]";
  paragraphs.push(`Admissão em sala cirúrgica, com verificação de segurança e identificação confirmadas. Monitorização: ${p1Monitors}. Acesso venoso: ${p1Access}.`);

  // Loop through sorted techniques
  sortedTechs.forEach(tech => {
    if (tech === "Anestesia local") {
      const pLocalLoc = resolvePlaceholder(regSite, "local anatômico");
      const pLocalAnest = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "anestésico registrado");
      const pLocalPos = resolvePlaceholder(patientPos, "posição");
      const pSedation = document.technique?.sedation ? "Sob sedação complementar." : "[__sedação associada__]";
      paragraphs.push(`Anestesia local em ${pLocalLoc} com ${pLocalAnest}. Posição: ${pLocalPos}. ${pSedation} Resultado: [__resultado da anestesia local__].`);
    }
    else if (tech === "Anestesia locorregional") {
      const pType = resolvePlaceholder(regType || "Bloqueio periférico", "tipo de bloqueio");
      const pSite = resolvePlaceholder(regSite, "região/local");
      const pSide = resolvePlaceholder(regSide, "lateralidade");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pGuide = regGuide || "referência anatômica";
      const pNeedle = needle || "[__agulha: tipo, calibre e comprimento__]";
      const pVol = resolvePlaceholder(document.technique?.regionalDetails?.attempts, "volume/doses");
      const pResult = resolvePlaceholder(blockResult, "resultado do bloqueio");
      paragraphs.push(`Bloqueio ${pType} em ${pSite} (${pSide}). Posição: ${pPos}. Guiado por ${pGuide}, agulha ${pNeedle}. Fármacos conforme ficha. Resultado: ${pResult}.`);
    }
    else if (tech === "Anestesia peridural") {
      const pLevel = resolvePlaceholder(regLevel, "nível");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pNeedle = needle || "Tuohy 16G";
      const pIdent = "perda de resistência (Gutiérrez)";
      const pTest = testDose ? `Dose-teste com ${testDose}.` : "[__dose-teste__]";
      const pSens = resolvePlaceholder(blockResult, "nível sensitivo");
      paragraphs.push(`Anestesia peridural em ${pLevel}, posição: ${pPos}, técnica estéril. Agulha ${pNeedle}, identificação por ${pIdent}. ${pTest} Fármacos conforme ficha. Nível sensitivo: ${pSens}.`);
    }
    else if (tech === "Anestesia peridural com cateter") {
      const pLevel = resolvePlaceholder(regLevel, "nível");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pNeedle = needle || "Tuohy 16G";
      const pCatheter = resolvePlaceholder(catheterNum, "número ou calibre do cateter");
      const pTest = testDose ? `Dose-teste com ${testDose}.` : "[__dose-teste__]";
      const pSens = resolvePlaceholder(blockResult, "nível sensitivo");
      paragraphs.push(`Punção peridural em ${pLevel}, posição: ${pPos}, técnica estéril. Agulha ${pNeedle}, identificação por perda de resistência. Cateter peridural nº ${pCatheter}. Aspiração negativa e ${pTest} Fármacos conforme ficha. Nível sensitivo: ${pSens}. Cateter fixado e mantido.`);
    }
    else if (tech === "Anestesia subaracnóidea") {
      const pLevel = resolvePlaceholder(regLevel, "nível");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pNeedle = needle || "Pencil Point 27G";
      const pLiquor = "líquido cefalorraquidiano límpido e cristalino";
      const pSens = resolvePlaceholder(blockResult, "nível sensitivo");
      paragraphs.push(`Anestesia subaracnóidea em ${pLevel}, posição: ${pPos}, técnica estéril. Agulha ${pNeedle}. Retorno de ${pLiquor}. Fármacos conforme ficha. Nível sensitivo: ${pSens}.`);
    }
    else if (tech === "Sedação leve / consciente") {
      const pSuplement = "cateter nasal / máscara facial";
      const pSedDrugs = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "fármacos sedativos e doses");
      paragraphs.push(`Sedação leve / consciente sob monitorização contínua. Administrado suplemento de Oxigênio via ${pSuplement}. Realizada infusão/titulação de ${pSedDrugs}. Paciente mantido em respiração espontânea rítmica, respondendo prontamente a comandos verbais simples, hemodinamicamente estável e cooperativo (Ramsay 2-3, RASS -1 a -2).`);
    }
    else if (tech === "Sedação profunda") {
      const pSuplement = "cateter nasal / máscara facial";
      const pSedDrugs = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "fármacos sedativos e doses");
      const pAirwaySupport = "sem necessidade de suporte mecânico de via aérea avançada";
      paragraphs.push(`Sedação profunda sob supervisão direta do anestesiologista. Administrado suplemento de Oxigênio via ${pSuplement}. Infusão contínua/titulada de ${pSedDrugs}. Paciente mantido sob depressão profunda da consciência (Ramsay 5-6, RASS -4), com respiração espontânea preservada, ${pAirwaySupport}. Estabilidade ventilatória e hemodinâmica mantida durante todo o procedimento.`);
    }
    else if (tech === "Bloqueio combinado raqui-peridural (CSE)") {
      const pLevel = resolvePlaceholder(regLevel, "nível da punção");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pNeedleTuohy = "Tuohy 16G / 18G";
      const pNeedleSpinal = needle || "Pencil Point 27G";
      const pLiquor = "líquido cefalorraquidiano límpido e cristalino";
      const pCatheter = resolvePlaceholder(catheterNum, "calibre do cateter");
      const pTest = testDose ? `Dose-teste com ${testDose}.` : "[__dose-teste__]";
      const pSens = resolvePlaceholder(blockResult, "nível sensitivo");
      paragraphs.push(`Bloqueio combinado raqui-peridural (CSE) em ${pLevel}, paciente em posição ${pPos}, sob técnica asséptica estéril. Punção epidural com agulha ${pNeedleTuohy}, identificação do espaço por perda de resistência. Introduzida agulha de raqui ${pNeedleSpinal} de forma concêntrica (needle-through-needle), com retorno espontâneo de ${pLiquor}. Administrada dose subaracnóidea conforme ficha. Passagem de cateter epidural nº ${pCatheter}, recuando-se a agulha de Tuohy. Aspiração negativa e ${pTest} Nível sensitivo cirúrgico obtido: ${pSens}. Cateter fixado e mantido.`);
    }
    else if (tech === "Bloqueio de plexo braquial") {
      const pType = resolvePlaceholder(regType || "Plexo Braquial", "via de abordagem (ex: supraclavicular)");
      const pSide = resolvePlaceholder(regSide, "lateralidade (Esquerdo/Direito)");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pGuide = regGuide || "ultrassonografia de alta frequência";
      const pNeedle = needle || "agulha ecogênica de bisel curto 50mm";
      const pDrugs = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "anestésicos locais e doses");
      const pVol = resolvePlaceholder(document.technique?.regionalDetails?.attempts, "volume total (mL)");
      const pResult = resolvePlaceholder(blockResult, "resultado do bloqueio sensitivo/motor");
      paragraphs.push(`Bloqueio do plexo braquial por abordagem ${pType} (${pSide}). Paciente posicionado em ${pPos}. Sob técnica estéril, identificadas as estruturas nervosas e vasculares por ${pGuide}. Punção em plano com agulha ${pNeedle}. Sob aspiração negativa intermitente e hidrolocalização, injetado ${pDrugs} no volume de ${pVol} mL, com adequada dispersão perineural circunferencial. Bloqueio motor e sensitivo confirmados: ${pResult}. Sem sinais imediatos de toxicidade sistêmica (LAST).`);
    }
    else if (tech === "Bloqueio de parede abdominal (TAP Block)") {
      const pSide = resolvePlaceholder(regSide, "lateralidade (Bilateral/Unilateral)");
      const pGuide = "ultrassonografia de alta frequência";
      const pNeedle = needle || "agulha ecogênica de bisel curto 50mm/80mm";
      const pDrugs = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "anestésicos locais e doses");
      const pVol = resolvePlaceholder(document.technique?.regionalDetails?.attempts, "volume total (mL)");
      paragraphs.push(`Bloqueio do plano transverso do abdômen (TAP Block) de forma ${pSide}, guiado por ${pGuide}. Sob técnica asséptica, identificados os planos musculares (oblíquo externo, interno e transverso do abdômen). Introduzida agulha ${pNeedle} em plano até o espaço interfascial alvo. Realizada aspiração negativa intermitente e injeção de ${pDrugs} num total de ${pVol} mL, observando-se dispersão linear e deposição adequada do anestésico local.`);
    }
    else if (tech === "Bloqueio de membro inferior") {
      const pType = resolvePlaceholder(regType || "Nervo Alvo", "tipo de bloqueio (ex: femoral, ciático, safeno)");
      const pSide = resolvePlaceholder(regSide, "lateralidade (Esquerdo/Direito)");
      const pPos = resolvePlaceholder(patientPos, "posição");
      const pGuide = regGuide || "ultrassonografia [e/ou neuroestimulador]";
      const pNeedle = needle || "agulha ecogênica de bisel curto";
      const pDrugs = resolvePlaceholder(document.technique?.regionalDetails?.drugsUsed, "anestésicos locais e doses");
      const pVol = resolvePlaceholder(document.technique?.regionalDetails?.attempts, "volume total (mL)");
      const pResult = resolvePlaceholder(blockResult, "resultado do bloqueio");
      paragraphs.push(`Bloqueio de nervo periférico de membro inferior: ${pType} (${pSide}). Paciente posicionado em ${pPos}. Sob técnica asséptica rigorosa, identificada a anatomia alvo guiada por ${pGuide}. Punção com agulha ${pNeedle} até proximidade neural. Após aspiração negativa, injetados ${pDrugs} em volume de ${pVol} mL. Dispersão circunferencial adequada observada em tempo real. Resultado sensitivo e motor: ${pResult}.`);
    }
    else if (tech === "Anestesia geral" || tech === "Anestesia geral balanceada" || tech === "Anestesia geral inalatória") {
      const pTime = startAnesthTime ? `às ${startAnesthTime}` : "[__horário__]";
      const pAirway = airwayTech ? `${airwayTech}` : "[__técnica/dispositivo__]";
      const pDevice = airwayDevice ? ` ${airwayDevice}` : "";
      const pAttempts = airwayAttempts ? `após ${airwayAttempts} tentativa(s)` : "em primeira tentativa";
      const pConfirm = airwayConfirm ? `confirmada por ${airwayConfirm}` : "confirmada por ausculta e capnografia";
      const pMode = ventilationMode ? `${ventilationMode}` : "[__modo ventilatório__]";
      const pMaint = maintenanceText ? `${maintenanceText}` : "agentes registrados na ficha";

      paragraphs.push(`Início da ${tech.toLowerCase()} ${pTime}. Indução conforme ficha. Via aérea: ${pAirway}${pDevice}, ${pAttempts}, ${pConfirm}. Manutenção com ${pMaint}. Ventilação: ${pMode}.`);
    }
  });

  // P-Final: Conclusion, Incidents, Destination (Always generated)
  const pFinalTime = endAnesthTime ? `às ${endAnesthTime}` : "[__horário final__]";
  const pDest = destination ? `${destination}` : "[__destino__]";
  const pCond = condition ? `${condition}` : "[__condição registrada__]";
  const pIncidents = incidentTexts ? `${incidentTexts}` : "[__intercorrências e condutas__]";

  // Guide warning: Never auto-fill expressions like "Sem intercorrências" or "Paciente estável"
  paragraphs.push(`Fármacos e infusões administrados conforme registro. Intercorrências: ${pIncidents}. Ao término, despertado e extubado conforme técnica. Fim da anestesia ${pFinalTime}. Encaminhado ao ${pDest}, em condição ${pCond}.`);

  return paragraphs.join("\n\n");
}
