/**
 * Espelha supabase/config.toml (minimum_password_length + required characters).
 * Usado no cadastro do cliente; o Auth rejeita senhas fracas no servidor também.
 * Senha vazada (HaveIBeenPwned) é checada em `leakedPassword.ts` antes do signUp.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_ERROR_LENGTH = `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
export const PASSWORD_ERROR_UPPER = "A senha deve conter pelo menos uma letra maiúscula.";
export const PASSWORD_ERROR_LOWER = "A senha deve conter pelo menos uma letra minúscula.";
export const PASSWORD_ERROR_DIGIT = "A senha deve conter pelo menos um dígito.";
export const PASSWORD_ERROR_CHARACTERS = "A senha deve conter letra maiúscula, minúscula e dígito.";

export function validateClinicalPassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_ERROR_LENGTH;
  }
  if (!/[A-Z]/.test(password)) {
    return PASSWORD_ERROR_UPPER;
  }
  if (!/[a-z]/.test(password)) {
    return PASSWORD_ERROR_LOWER;
  }
  if (!/[0-9]/.test(password)) {
    return PASSWORD_ERROR_DIGIT;
  }
  return null;
}
