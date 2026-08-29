/**
 * Traduz erros do Supabase Auth para a tela de login.
 * O SMTP embutido do projeto hospedado limita envios a 2 e-mails/hora
 * (https://supabase.com/docs/guides/auth/rate-limits).
 */

import { PASSWORD_ERROR_CHARACTERS, PASSWORD_ERROR_LENGTH } from "./passwordPolicy";

export const AUTH_ERROR_EMAIL_SEND_RATE =
  "Limite de e-mails de confirmação atingido (SMTP padrão: 2 por hora). Espere cerca de 1 hora. Não clique em Cadastrar nem em Reenviar. Se a conta já existir e o e-mail já estiver confirmado no Dashboard, use Entrar.";

export const AUTH_ERROR_TOO_MANY_REQUESTS =
  "Muitas tentativas de login. Espere alguns minutos.";

export const AUTH_ERROR_LEAKED_PASSWORD =
  "Esta senha aparece em vazamentos públicos (HaveIBeenPwned). Escolha outra senha longa e exclusiva, de preferência gerada por um gerenciador.";

export type AuthErrorLike = {
  message?: string;
  code?: string;
  name?: string;
  reasons?: string[];
  weak_password?: { reasons?: string[] };
};

function collectReasons(err: AuthErrorLike): string[] {
  const nested = err.weak_password?.reasons;
  const raw = [
    ...(Array.isArray(err.reasons) ? err.reasons : []),
    ...(Array.isArray(nested) ? nested : []),
  ];
  return raw.map((item) => String(item).toLowerCase());
}

export function mapAuthError(err: AuthErrorLike | null | undefined): string {
  const code = (err?.code || "").toLowerCase();
  const message = (err?.message || "").toLowerCase();
  const reasons = err ? collectReasons(err) : [];

  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam.";
  }
  if (code.includes("invalid_credentials") || message.includes("invalid login")) {
    return "Email ou senha incorretos.";
  }
  if (code.includes("user_already_exists") || message.includes("already registered")) {
    return "Este email já está em uso. Use Entrar, ou recupere a senha depois que o limite de e-mails passar.";
  }
  if (
    code.includes("email_address_invalid") ||
    (message.includes("email address") && message.includes("invalid"))
  ) {
    return "Este endereço de e-mail não é aceito pelo Auth. Use um e-mail real (Gmail, institucional, etc.).";
  }
  if (
    reasons.includes("pwned") ||
    message.includes("pwned") ||
    message.includes("leaked password") ||
    message.includes("haveibeenpwned")
  ) {
    return AUTH_ERROR_LEAKED_PASSWORD;
  }
  if (reasons.includes("length")) {
    return PASSWORD_ERROR_LENGTH;
  }
  if (reasons.includes("characters")) {
    return PASSWORD_ERROR_CHARACTERS;
  }
  if (
    code.includes("weak_password") ||
    message.includes("password should") ||
    message.includes("password is too")
  ) {
    return err?.message || "Senha não atende à política de segurança.";
  }
  if (
    code.includes("over_email_send") ||
    message.includes("over_email_send_rate_limit") ||
    message.includes("email rate limit")
  ) {
    return AUTH_ERROR_EMAIL_SEND_RATE;
  }
  if (code.includes("over_request") || message.includes("too many requests")) {
    return AUTH_ERROR_TOO_MANY_REQUESTS;
  }
  return err?.message || "Erro na autenticação.";
}
