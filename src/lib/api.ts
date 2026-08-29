import { auth } from "./firebase";

/**
 * Wrapper over standard fetch that automatically attaches the current Firebase user's ID token
 * in the Authorization: Bearer header for protected backend /api/* routes.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuário não autenticado. Faça login para utilizar os recursos de IA do AnestFlow.");
  }

  // Retrieve valid Firebase ID token (refreshes if needed)
  const idToken = await user.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(url, {
    ...options,
    headers
  });
}
