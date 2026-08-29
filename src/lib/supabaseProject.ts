/** Public Anestflow client config. Publishable/anon key is designed for the browser (RLS).
 *  Vercel builds do not receive gitignored .env.local; env vars still override these defaults.
 */
export const CANONICAL_SUPABASE_URL = 'https://plciototnjsdjzhudptc.supabase.co';
export const CANONICAL_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6IfbLU8udkXkC6C9aXWo8A_QbPoOfOz'; // pragma: allowlist secret
