/** Headers do front real (Vercel) e do Express local. Uma fonte para os dois. */

export const ANESTFLOW_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://plciototnjsdjzhudptc.supabase.co wss://plciototnjsdjzhudptc.supabase.co https://api.pwnedpasswords.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

export const ANESTFLOW_PERMISSIONS_POLICY =
  "microphone=(self), camera=(), geolocation=(), payment=(), usb=()";

export const ANESTFLOW_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": ANESTFLOW_CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": ANESTFLOW_PERMISSIONS_POLICY,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};

export function applyAnestflowSecurityHeaders(setHeader: (name: string, value: string) => void): void {
  for (const [name, value] of Object.entries(ANESTFLOW_SECURITY_HEADERS)) {
    setHeader(name, value);
  }
}
