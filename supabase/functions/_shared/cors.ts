function allowOrigin(): string {
  return Deno.env.get("ANESTFLOW_CORS_ORIGIN")?.trim() || "*";
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin(),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export function optionsResponse(): Response {
  return new Response("ok", { headers: corsHeaders() });
}
