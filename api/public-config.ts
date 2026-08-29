import {
  CANONICAL_SUPABASE_PUBLISHABLE_KEY,
  CANONICAL_SUPABASE_URL
} from "../src/lib/supabaseProject";
import { ANESTFLOW_SECURITY_HEADERS } from "../src/lib/securityHeaders";

export function GET() {
  const url = (process.env.VITE_SUPABASE_URL || CANONICAL_SUPABASE_URL).trim();
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    CANONICAL_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  return Response.json(
    {
      supabaseUrl: url || null,
      supabasePublishableKey: key && !key.includes("xxxxxxxx") ? key : null
    },
    { headers: ANESTFLOW_SECURITY_HEADERS }
  );
}
