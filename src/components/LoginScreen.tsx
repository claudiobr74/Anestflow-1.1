/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import AnestFlowLogo from "./AnestFlowLogo";
import {
  Lock,
  User,
  FileText,
  Building,
  Moon,
  Sun,
  ChevronRight,
  ShieldAlert,
  Mail,
  LogOut
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { validateClinicalPassword } from "../lib/passwordPolicy";
import {
  fetchOwnProfile,
  isProfileComplete,
  profileToDoctor,
  saveOwnProfile
} from "../lib/profileService";

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

function mapAuthError(err: { message?: string; code?: string }): string {
  const code = (err.code || "").toLowerCase();
  const message = (err.message || "").toLowerCase();

  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam.";
  }
  if (code.includes("invalid_credentials") || message.includes("invalid login")) {
    return "Email ou senha incorretos.";
  }
  if (code.includes("user_already_exists") || message.includes("already registered")) {
    return "Este email já está em uso.";
  }
  if (code.includes("weak_password") || message.includes("password")) {
    return err.message || "Senha não atende à política de segurança.";
  }
  if (message.includes("rate") || code.includes("over_request")) {
    return "Muitas tentativas. Tente novamente mais tarde.";
  }
  return err.message || "Erro na autenticação.";
}

export default function LoginScreen({ onLogin, isDark, onToggleTheme }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [name, setName] = useState("");
  const [crm, setCrm] = useState("");
  const [uf, setUf] = useState("GO");
  const [hospital, setHospital] = useState(POPULAR_HOSPITALS[0]);
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase não configurado. Preencha VITE_SUPABASE_PUBLISHABLE_KEY em .env.local.");
      return;
    }

    const supabase = getSupabase();
    let cancelled = false;

    const applySessionUser = async (user: SupabaseUser | null) => {
      if (cancelled) return;
      if (!user) {
        setCurrentUser(null);
        setNeedsProfile(false);
        setNeedsEmailConfirm(false);
        return;
      }

      setCurrentUser(user);
      if (!user.email_confirmed_at) {
        setNeedsEmailConfirm(true);
        setNeedsProfile(false);
        return;
      }

      setNeedsEmailConfirm(false);
      try {
        const profile = await fetchOwnProfile(user.id);
        if (cancelled) return;
        if (isProfileComplete(profile)) {
          onLoginRef.current(profileToDoctor(profile!));
        } else {
          setNeedsProfile(true);
          if (profile?.full_name) setName(profile.full_name);
          if (profile?.crm) setCrm(profile.crm);
          if (profile?.uf) setUf(profile.uf);
          if (profile?.hospital) setHospital(profile.hospital);
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("Erro ao verificar perfil:", e);
        setNeedsProfile(true);
        setError("Aviso ao carregar perfil: " + (e.message || "Erro desconhecido"));
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void applySessionUser(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySessionUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError("Por favor, preencha email e senha.");
      return;
    }

    if (isRegistering) {
      const policyError = validateClinicalPassword(password);
      if (policyError) {
        setError(policyError);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabase();
      if (isRegistering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNeedsEmailConfirm(true);
          setInfo("Conta criada. Confirme o e-mail enviado antes de entrar.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError("");
    setInfo("");
    const target = email.trim().toLowerCase() || currentUser?.email || "";
    if (!target) {
      setError("Informe o e-mail para reenviar a confirmação.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: resendError } = await getSupabase().auth.resend({
        type: "signup",
        email: target
      });
      if (resendError) throw resendError;
      setInfo("E-mail de confirmação reenviado. Verifique a caixa de entrada e o spam.");
    } catch (err: any) {
      setError(mapAuthError(err));
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
      if (!currentUser) {
        setError("Sessão expirada. Entre novamente.");
        return;
      }
      await saveOwnProfile(currentUser.id, currentUser.email || email, {
        name,
        crm,
        uf,
        hospital
      });
      onLogin({
        name: name.trim(),
        crm: crm.trim(),
        uf,
        hospital,
        uid: currentUser.id
      });
    } catch (err: any) {
      setError(err.message || "Erro ao salvar perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    setNeedsEmailConfirm(false);
    setInfo("");
  };

  const heading = needsProfile
    ? "Completar Perfil"
    : needsEmailConfirm
      ? "Confirme o e-mail"
      : "Acesso Restrito";
  const subtitle = needsProfile
    ? "Informe seus dados de atuação para continuar."
    : needsEmailConfirm
      ? "O acesso clínico exige e-mail confirmado."
      : "Portal de segurança médica.";

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${
      isDark
        ? "bg-[#09090b] text-zinc-100"
        : "bg-slate-50 text-zinc-900"
    }`}>
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
                {heading}
              </h2>
              <p className={`text-sm mt-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {subtitle}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 text-xs font-semibold flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                {info}
              </div>
            )}

            {needsEmailConfirm && !needsProfile ? (
              <div className="space-y-4">
                <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Enviamos um link de confirmação para <strong>{email || currentUser?.email}</strong>.
                  Depois de confirmar, volte e entre com a mesma senha.
                </p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-sm transition disabled:opacity-50"
                >
                  Reenviar e-mail de confirmação
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-xs text-indigo-500 hover:text-indigo-400 font-semibold"
                >
                  Voltar ao login
                </button>
              </div>
            ) : !needsProfile ? (
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
                      autoComplete="username"
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
                      placeholder={isRegistering ? "Mín. 12 caracteres, maiúsculas, minúsculas e dígito" : "Sua senha secreta"}
                      autoComplete={isRegistering ? "new-password" : "current-password"}
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
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-sm active:scale-98 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
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

                <p className={`text-center text-[11px] leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  Google OAuth está preparado no Auth, mas permanece desligado até existirem Client ID e Secret no Dashboard.
                </p>
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
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-sm active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
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

      <footer className="px-6 py-4 text-center text-xs font-bold text-zinc-500 tabular-nums shrink-0">
        <p>REGISTRO ANESTÉSICO DIGITAL v2.1 • PRIVACIDADE E SEGURANÇA SEGUNDO A LGPD</p>
      </footer>
    </div>
  );
}
