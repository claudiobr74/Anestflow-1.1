import { getPublicSupabaseConfig } from "../src/lib/publicSupabaseConfig";
import { ANESTFLOW_SECURITY_HEADERS } from "../src/lib/securityHeaders";

export function GET() {
  return Response.json(getPublicSupabaseConfig(), {
    headers: ANESTFLOW_SECURITY_HEADERS
  });
}
