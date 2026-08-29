/**
 * Espelha supabase/config.toml (minimum_password_length + required characters).
 * Usado no cadastro do cliente; o Auth rejeita senhas fracas no servidor também.
 * Senha vazada (HaveIBeenPwned) é checada em `leakedPassword.ts` antes do signUp.
 */
export const MIN_PASSWORD_LENGTH = 12;

export function validateClinicalPassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra maiúscula.";
  }
  if (!/[a-z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra minúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "A senha deve conter pelo menos um dígito.";
  }
  return null;
}
