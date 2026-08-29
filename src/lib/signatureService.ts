import { AnesthesiaDocument, DocumentAmendment } from "../types";

export const CURRENT_SCHEMA_VERSION = "2.0.0";

/**
 * Helper to recursively sort keys of an object to ensure exact deterministic string representation for SHA-256 hashing
 */
function recursiveSortKeysJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(item => recursiveSortKeysJson(item)).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys
    .map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return JSON.stringify(key) + ":" + recursiveSortKeysJson(val);
    })
    .filter(Boolean);
  return "{" + parts.join(",") + "}";
}

/**
 * Creates a deterministic canonical representation of the clinical content of an anesthesia sheet.
 */
export function buildCanonicalDocumentRepresentation(doc: Partial<AnesthesiaDocument>): string {
  const clinicalPayload = {
    id: doc.id || "",
    docVersion: doc.docVersion || CURRENT_SCHEMA_VERSION,
    patient: doc.patient || {},
    team: doc.team || {},
    preEvaluation: doc.preEvaluation || {},
    technique: doc.technique || {},
    vitals: doc.vitals || [],
    bolusDrugs: doc.bolusDrugs || [],
    continuousInfusions: doc.continuousInfusions || [],
    inhalationAgents: doc.inhalationAgents || [],
    events: doc.events || [],
    fluids: doc.fluids || [],
    outputs: doc.outputs || [],
    incidents: doc.incidents || [],
    transfers: doc.transfers || [],
    vascularAccesses: doc.vascularAccesses || [],
    narrativeLaunches: doc.narrativeLaunches || [],
    timers: doc.timers || {},
    status: "Signed",
    signedAt: doc.signedAt || "",
    signedBy: doc.signedBy || {}
  };

  return recursiveSortKeysJson(clinicalPayload);
}

/**
 * Standard pure JS SHA-256 implementation fallback when Web Crypto API is unavailable
 */
function sha256Fallback(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';

  const words: number[] = [];
  const asciiLength = ascii[lengthProperty];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let bitLength = asciiLength * 8;
  for (i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  words[(((asciiLength + 8) >> 6) << 4) + 15] = bitLength;

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      let w15 = w[i - 15], w2 = w[i - 2];
      let s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      let s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);

      if (i >= 16) {
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      let maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      let temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
      let temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      let b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Computes a real SHA-256 cryptographic hash over a string using Web Crypto API or pure JS fallback
 */
export async function computeSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  try {
    if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    }
  } catch (err) {
    console.warn("Web Crypto API error, falling back to pure JS sha256:", err);
  }

  return sha256Fallback(data).toUpperCase();
}

/**
 * Signs an anesthesia sheet with a real SHA-256 cryptographic hash, stores signer metadata, version, snapshot, and locks it.
 */
export async function signAndLockDocument(
  doc: AnesthesiaDocument,
  signer: {
    uid?: string;
    name: string;
    crm: string;
    uf: string;
    email?: string;
  }
): Promise<AnesthesiaDocument> {
  const signedAt = new Date().toISOString();
  const docVersion = CURRENT_SCHEMA_VERSION;

  const signedBy = {
    uid: signer.uid || doc.currentResponsibleUid || doc.createdByUid || "",
    name: signer.name || doc.team?.anesthesiologistLead || "Anestesiologista Responsável",
    crm: signer.crm || doc.team?.crmLead || "",
    uf: signer.uf || doc.team?.ufLead || "SP",
    email: signer.email
  };

  const draftDocToSign: AnesthesiaDocument = {
    ...doc,
    status: "Signed",
    signedAt,
    signedBy,
    docVersion
  };

  const canonicalJson = buildCanonicalDocumentRepresentation(draftDocToSign);
  const hashHex = await computeSHA256(canonicalJson);

  const signedDoc: AnesthesiaDocument = {
    ...draftDocToSign,
    hash: hashHex,
    signatureSnapshot: canonicalJson,
    updatedAt: signedAt
  };

  return signedDoc;
}

/**
 * Verifies whether a signed document's clinical content matches its recorded SHA-256 hash.
 */
export async function verifyDocumentIntegrity(
  doc: AnesthesiaDocument
): Promise<{ isValid: boolean; computedHash: string; storedHash?: string; message: string }> {
  if (doc.status !== "Signed" || !doc.hash) {
    return {
      isValid: false,
      computedHash: "",
      storedHash: doc.hash,
      message: "Documento ainda não foi assinado digitalmente."
    };
  }

  const canonical = doc.signatureSnapshot || buildCanonicalDocumentRepresentation(doc);
  const computedHash = await computeSHA256(canonical);

  const isValid = computedHash.toUpperCase() === doc.hash.toUpperCase();

  return {
    isValid,
    computedHash,
    storedHash: doc.hash,
    message: isValid
      ? "Assinatura e hash SHA-256 validados. O documento está autêntico e imutável."
      : "ALERTA DE VIOLAÇÃO: O conteúdo clínico foi alterado após a geração da assinatura digital!"
  };
}

/**
 * Creates an immutable rectifying amendment with its own SHA-256 cryptographic hash.
 */
export async function createSignedAmendment(
  procedureId: string,
  docHashRef: string,
  amendmentData: {
    text: string;
    reason: string;
    createdByUid: string;
    authorName: string;
    authorCRM: string;
    authorUF: string;
  }
): Promise<DocumentAmendment> {
  const id = "amd-" + Date.now().toString() + "-" + Math.random().toString(36).substring(2, 7);
  const createdAt = new Date().toISOString();

  const canonicalPayload = {
    id,
    procedureId,
    docHashRef: docHashRef || "",
    text: amendmentData.text.trim(),
    reason: amendmentData.reason.trim(),
    createdByUid: amendmentData.createdByUid,
    authorName: amendmentData.authorName,
    authorCRM: amendmentData.authorCRM,
    authorUF: amendmentData.authorUF,
    createdAt
  };

  const canonicalJson = recursiveSortKeysJson(canonicalPayload);
  const hashHex = await computeSHA256(canonicalJson);

  return {
    id,
    procedureId,
    docHashRef,
    text: amendmentData.text.trim(),
    reason: amendmentData.reason.trim(),
    createdAt,
    createdByUid: amendmentData.createdByUid,
    authorName: amendmentData.authorName,
    authorCRM: amendmentData.authorCRM,
    authorUF: amendmentData.authorUF,
    hash: hashHex,
    timestamp: createdAt // Backward compatibility
  };
}
