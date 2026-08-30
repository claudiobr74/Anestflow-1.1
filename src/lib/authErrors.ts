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

export const AUTH_ERROR_OAUTH_CANCELLED =
  "Login com Google cancelado. Nenhuma sessão foi criada.";

export const AUTH_ERROR_OAUTH_PROVIDER =
  "O login com Google não está disponível neste ambiente. Use e-mail e senha, ou avise o administrador.";

export const AUTH_ERROR_OAUTH_REDIRECT =
  "O retorno do Google não coincide com o endereço desta aplicação. Verifique as URLs de redirecionamento no Auth.";

export const AUTH_ERROR_OAUTH_NO_SESSION =
  "O Google autorizou, mas a sessão do AnestFlow não foi criada. Tente de novo.";

export const AUTH_ERROR_OAUTH_GENERIC =
  "Não foi possível entrar com Google. Tente de novo ou use e-mail e senha.";

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
  if (
    code.includes("access_denied") ||
    message.includes("access_denied") ||
    message.includes("popup closed") ||
    message.includes("popup_closed") ||
    message.includes("user cancelled") ||
    message.includes("user canceled") ||
    message.includes("oauth_canceled")
  ) {
    return AUTH_ERROR_OAUTH_CANCELLED;
  }
  if (
    code.includes("provider_disabled") ||
    code.includes("provider_not_enabled") ||
    code.includes("unsupported_provider") ||
    message.includes("provider is not enabled") ||
    message.includes("unsupported provider")
  ) {
    return AUTH_ERROR_OAUTH_PROVIDER;
  }
  if (
    code.includes("redirect") ||
    message.includes("redirect_uri") ||
    message.includes("redirect uri mismatch") ||
    message.includes("invalid redirect")
  ) {
    return AUTH_ERROR_OAUTH_REDIRECT;
  }
  if (
    code.includes("oauth") ||
    message.includes("oauth") ||
    message.includes("unable to exchange") ||
    message.includes("pkce")
  ) {
    return AUTH_ERROR_OAUTH_GENERIC;
  }
  return err?.message || "Erro na autenticação.";
}
