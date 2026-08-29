/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import AnestFlowLogo from "./AnestFlowLogo";
import { 
  Lock, 
  User, 
  FileText, 
  Sparkles, 
  Building, 
  HelpCircle, 
  Fingerprint, 
  Moon, 
  Sun,
  ChevronRight,
  ShieldAlert,
  Mail,
  LogOut
} from "lucide-react";
import { auth, db } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface LoginScreenProps {
  onLogin: (doctor: { name: string; crm: string; uf: string; hospital: string; uid?: string }) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const POPULAR_HOSPITALS = [
  "Hospital Universitário Central",
  "Hospital de Clínicas Metropolitano",
  "Maternidade Santa Rita de Cássia",
  "Hospital Israelita de Prontidão",
  "Hospital Sírio Clínico de São Paulo",
  "Complexo Hospitalar Geral"
];

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", 
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", 
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function LoginScreen({ onLogin, isDark, onToggleTheme }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Profile completion state
  const [needsProfile, setNeedsProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [crm, setCrm] = useState("");
  const [uf, setUf] = useState("GO");
  const [hospital, setHospital] = useState(POPULAR_HOSPITALS[0]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth state changed. User:", user.uid);
        setCurrentUser(user);
        await checkUserProfile(user);
      } else {
        console.log("Auth state changed. No user.");
        setCurrentUser(null);
        setNeedsProfile(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const checkUserProfile = async (user: any) => {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      // If the user has logged out or changed in the meantime, do not update state
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        onLogin({
          name: data.name,
          crm: data.crm,
          uf: data.uf,
          hospital: data.hospital,
          uid: user.uid
        });
      } else {
        setNeedsProfile(true);
        if (user.displayName) setName(user.displayName);
      }
    } catch (e: any) {
      console.error("Erro ao verificar perfil:", e);
      
      // If the user has logged out or changed in the meantime, do not update state
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
        return;
      }

      // Se estiver offline ou falhar, permite preencher o perfil para usar o app offline
      setNeedsProfile(true);
      if (user.displayName) setName(user.displayName);
      
      if (e.message?.includes('offline') || e.message?.includes('Backend didn\'t respond')) {
        setError("Modo offline: O banco de dados está inacessível. Você pode usar o app localmente e os dados serão sincronizados quando a conexão voltar.");
      } else if (e.code === 'permission-denied' || e.message?.includes('permission') || e.message?.includes('Permission') || e.message?.includes('insufficient')) {
        // Silently handle permission denied because it often happens during logout or when auth token is being updated/revoked
        console.log("Permission denied or insufficient permissions during profile check - likely signing out.");
      } else {
        // setError apenas como aviso, mas deixa preencher o perfil
        setError("Aviso ao carregar perfil: " + (e.message || "Erro desconhecido"));
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        setError("O pop-up de login foi bloqueado. Por favor, permita pop-ups ou abra o app em uma nova aba (botão no canto superior direito).");
      } else {
        setError(err.message || "Erro ao fazer login com Google. Tente abrir em uma nova aba.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Por favor, preencha email e senha.");
      return;
    }
    
    if (isRegistering && password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (userCred.user) {
          try {
            await sendEmailVerification(userCred.user);
          } catch (ve) {
            console.warn("E-mail de verificação não enviado:", ve);
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);
      let errorMsg = "Erro na autenticação.";
      
      switch (err.code) {
        case "auth/email-already-in-use":
          errorMsg = "Este email já está em uso.";
          break;
        case "auth/invalid-email":
          errorMsg = "Email inválido.";
          break;
        case "auth/weak-password":
          errorMsg = "Senha muito fraca (mínimo de 6 caracteres).";
          break;
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          errorMsg = "Email ou senha incorretos.";
          break;
        case "auth/too-many-requests":
          errorMsg = "Muitas tentativas. Tente novamente mais tarde.";
          break;
        default:
          errorMsg = err.message || errorMsg;
      }
      
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !crm.trim() || isNaN(Number(crm))) {
      setError("Por favor, preencha o nome e um CRM válido.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (currentUser) {
        // Fire and forget setDoc so offline users aren't blocked waiting for server acknowledgment
        setDoc(doc(db, "users", currentUser.uid), {
          name: name.trim(),
          crm: crm.trim(),
          uf,
          hospital,
          email: (currentUser.email || "").toLowerCase(),
          uid: currentUser.uid,
          emailVerified: currentUser.emailVerified || false,
          updatedAt: new Date().toISOString()
        }).catch(err => console.error("Falha ao sincronizar perfil (será sincronizado depois):", err));
        
        onLogin({
          name: name.trim(),
          crm: crm.trim(),
          uf,
          hospital,
          uid: currentUser.uid
        });
      }
    } catch (err: any) {
      setError(err.message || "Erro ao salvar perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${
      isDark 
        ? "bg-[#09090b] text-zinc-100" 
        : "bg-slate-50 text-zinc-900"
    }`}>
      
      {/* TOP HEADER CONTROLS */}
      <header className="px-6 py-4 flex justify-end items-center w-full max-w-7xl mx-auto shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className={`p-2.5 border rounded-lg transition flex items-center justify-center ${
              isDark 
                ? "bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-indigo-600 shadow-sm"
            }`}
            title={isDark ? "Modo Claro" : "Modo Escuro"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* CORE FORM WRAPPER */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md relative">
          
          <div className={`rounded-lg border shadow-sm p-8 relative overflow-hidden transition-all duration-300 ${
            isDark 
              ? "bg-[#161618] border-zinc-800/80" 
              : "bg-white border-zinc-200 shadow-slate-200/50"
          }`}>
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-6">
                <AnestFlowLogo height={48} />
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
                {needsProfile ? "Completar Perfil" : "Acesso Restrito"}
              </h2>
              <p className={`text-sm mt-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {needsProfile ? "Informe seus dados de atuação para continuar." : "Portal de segurança médica."}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 text-xs font-semibold flex items-start gap-2 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!needsProfile ? (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-zinc-400" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" 
                          : "bg-slate-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-zinc-400" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha secreta"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" 
                          : "bg-slate-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-sm  active:scale-98 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isRegistering ? "Criar Conta" : "Entrar com Senha Padrão"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold transition"
                  >
                    {isRegistering ? "Já tem uma conta? Entrar" : "Não tem conta? Cadastrar"}
                  </button>
                </div>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
                  <span className="flex-shrink-0 mx-4 text-xs font-bold text-zinc-400 uppercase">Ou</span>
                  <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-sm border transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                    isDark ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white" : "bg-white hover:bg-slate-50 border-zinc-300 text-zinc-800"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar com Google
                </button>
              </form>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-zinc-400" />
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Dr. Cláudio Brandão"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" 
                          : "bg-slate-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                      CRM
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <FileText className="h-4 w-4 text-zinc-400" />
                      </span>
                      <input
                        type="text"
                        value={crm}
                        onChange={(e) => setCrm(e.target.value)}
                        placeholder="Apenas números"
                        maxLength={10}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border font-bold tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                          isDark 
                            ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" 
                            : "bg-slate-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                      UF
                    </label>
                    <select
                      value={uf}
                      onChange={(e) => setUf(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-lg text-sm border font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none transition ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-white" 
                          : "bg-slate-50 border-zinc-200 text-zinc-800"
                      }`}
                    >
                      {ESTADOS_BRASIL.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
                    Unidade Hospitalar
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Building className="h-4 w-4 text-zinc-400" />
                    </span>
                    <select
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none transition appearance-none ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-white" 
                          : "bg-slate-50 border-zinc-200 text-zinc-800"
                      }`}
                    >
                      {POPULAR_HOSPITALS.map((hosp) => (
                        <option key={hosp} value={hosp}>{hosp}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSubmitting}
                    className={`px-4 py-3 border rounded-lg flex items-center justify-center transition disabled:opacity-50 ${
                      isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-white border-zinc-300 text-zinc-600 hover:bg-slate-50"
                    }`}
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-sm  active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Salvar e Entrar</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="px-6 py-4 text-center text-xs font-bold text-zinc-500 tabular-nums shrink-0">
        <p>REGISTRO ANESTÉSICO DIGITAL v2.1 • PRIVACIDADE E SEGURANÇA SEGUNDO A LGPD</p>
      </footer>

    </div>
  );
}

