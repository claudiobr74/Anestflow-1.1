import { db, auth } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { PatientInfo, PreAnestheticEvaluation } from "../types";
import { onAuthStateChanged } from "firebase/auth";
import { handleFirestoreError, OperationType } from "./firestoreUtils";

export interface WorklistEntry {
  cpf: string;
  patient: PatientInfo;
  preEvaluation: PreAnestheticEvaluation;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

function waitForAuth() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
    setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 2000);
  });
}

export async function saveToWorklist(cpf: string, patient: PatientInfo, preEvaluation: PreAnestheticEvaluation) {
  const user = await waitForAuth();
  if (!user) throw new Error("Você precisa estar autenticado para salvar na Worklist.");
  
  const cleanCpf = cpf.replace(/\D/g, "");
  if (!cleanCpf || cleanCpf.length !== 11) {
    throw new Error("CPF inválido. Forneça um CPF válido com 11 dígitos numéricos.");
  }
  
  const path = `worklist/${cleanCpf}`;
  const docRef = doc(db, "worklist", cleanCpf);
  try {
    await setDoc(docRef, {
      cpf: cleanCpf,
      patient,
      preEvaluation,
      createdBy: (user as any).uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getFromWorklist(cpf: string): Promise<WorklistEntry | null> {
  const user = await waitForAuth();
  if (!user) throw new Error("Você precisa estar autenticado para buscar na Worklist.");

  const cleanCpf = cpf.replace(/\D/g, "");
  if (!cleanCpf || cleanCpf.length !== 11) {
    throw new Error("CPF inválido. Forneça um CPF válido com 11 dígitos numéricos.");
  }

  const path = `worklist/${cleanCpf}`;
  const docRef = doc(db, "worklist", cleanCpf);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as WorklistEntry;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

