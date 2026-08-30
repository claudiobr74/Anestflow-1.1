import React, { useEffect, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { getSupabase, ensureSupabaseConfig } from "../lib/supabase";
import { mapAuthError } from "../lib/authErrors";
import { touchSession } from "../lib/sessionPolicy";
import {
  markOAuthReauthIntent,
  startGoogleOAuth,
  userHasGoogleIdentity,
  userHasPasswordIdentity
} from "../lib/googleAuth";
import GoogleAuthButton from "./GoogleAuthButton";

export type WorkstationLockReason = "idle" | "signature";

interface WorkstationLockScreenProps {
  email?: string | null;
  isDark: boolean;
  reason: WorkstationLockReason;
  onUnlocked: () => void;
  onLogout: () => void;
}

export default function WorkstationLockScreen({
  email,
  isDark,
  reason,
  onUnlocked,
  onLogout
}: WorkstationLockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [methodsReady, setMethodsReady] = useState(false);
  const normalizedEmail = (email || "").trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const configError = await ensureSupabaseConfig();
        if (configError) {
          if (!cancelled) {
            setHasPassword(Boolean(normalizedEmail));
            setMethodsReady(true);
          }
          return;
        }
        const { data } = await getSupabase().auth.getUser();
        if (cancelled) return;
        const passwordIdentity = userHasPasswordIdentity(data.user);
        const googleIdentity = userHasGoogleIdentity(data.user);
        setHasPassword(passwordIdentity || (Boolean(normalizedEmail) && !googleIdentity));
        setHasGoogle(googleIdentity);
      } catch {
        if (!cancelled) {
          setHasPassword(Boolean(normalizedEmail));
        }
      } finally {
        if (!cancelled) setMethodsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedEmail]);

  const title =
    reason === "signature"
      ? hasGoogle && !hasPassword
        ? "Confirme a identidade para assinar"
        : "Confirme a senha para assinar"
      : "Posto bloqueado";
  const description =
    reason === "signature"
      ? hasGoogle && !hasPassword
        ? "A ficha permanece neste posto. Confirme a identidade com o Google para assinar e encerrar — nenhum dado é apagado."
        : "A ficha permanece neste posto. Confirme a senha para assinar e encerrar — nenhum dado é apagado."
      : hasGoogle && !hasPassword
        ? "O posto bloqueou após 20 minutos sem uso. A ficha permanece aqui. Confirme a identidade com o Google para voltar."
        : "O posto bloqueou após 20 minutos sem uso. A ficha permanece aqui. Confirme a senha para voltar.";

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedEmail) return;
    setError("");
    setIsSubmitting(true);
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (signInError) throw signInError;
      touchSession();
      setPassword("");
      onUnlocked();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const unlockWithGoogle = async () => {
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const configError = await ensureSupabaseConfig();
      if (configError) {
        setError(configError);
        setIsSubmitting(false);
        return;
      }
      markOAuthReauthIntent(reason);
      const { error: oauthError } = await startGoogleOAuth({ mode: "reauth" });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(mapAuthError(err));
      setIsSubmitting(false);
    }
  };

  const noUnlockMethod = methodsReady && !hasPassword && !hasGoogle && !normalizedEmail;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workstation-lock-title"
    >
      <div
        className={`w-full max-w-sm rounded-xl p-5 shadow-lg border text-left ${
          isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 id="workstation-lock-title" className="text-lg font-bold text-center">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center">
          {description}
        </p>

        {!methodsReady ? (
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            Verificando a sessão…
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {hasGoogle ? (
              <GoogleAuthButton
                onClick={() => void unlockWithGoogle()}
                disabled={isSubmitting}
                busy={isSubmitting}
                isDark={isDark}
                label="Continuar com Google"
              />
            ) : null}

            {hasGoogle && hasPassword ? (
              <div className="flex items-center gap-3" role="separator" aria-label="ou">
                <div className={`flex-1 h-px ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  ou
                </span>
                <div className={`flex-1 h-px ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
              </div>
            ) : null}

            {hasPassword && normalizedEmail ? (
              <form onSubmit={unlock} className="space-y-3">
                <p className="text-xs font-semibold text-zinc-500 truncate" title={normalizedEmail}>
                  {normalizedEmail}
                </p>
                <label className="block text-xs font-semibold text-zinc-500" htmlFor="workstation-lock-password">
                  Senha
                </label>
                <input
                  id="workstation-lock-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus={!hasGoogle}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                    isDark
                      ? "bg-zinc-900 border-zinc-700 text-white"
                      : "bg-zinc-50 border-zinc-200 text-zinc-900"
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !password}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
                >
                  {isSubmitting ? "Verificando…" : "Desbloquear"}
                </button>
              </form>
            ) : null}

            {error ? <p className="text-xs text-rose-500 font-semibold">{error}</p> : null}

            {noUnlockMethod ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                Esta sessão não tem e-mail para revalidar a senha. Encerre e entre de novo — a ficha na nuvem não é apagada por este bloqueio.
              </p>
            ) : null}
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className={`mt-3 w-full py-2.5 px-4 rounded-xl text-sm font-semibold border inline-flex items-center justify-center gap-2 ${
            isDark
              ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          <LogOut className="h-4 w-4" />
          Encerrar sessão
        </button>
      </div>
    </div>
  );
}
