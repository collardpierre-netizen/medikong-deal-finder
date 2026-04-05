const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let imageUrl = url.searchParams.get("url");

  // Also support POST with JSON body
  if (!imageUrl && req.method === "POST") {
    try {
      const body = await req.json();
      imageUrl = body.url;
    } catch { /* ignore */ }
  }

  if (!imageUrl) {
    return new Response("Missing url param", { status: 400, headers: corsHeaders });
  }

  try {
    const client = Deno.createHttpClient({ caCerts: [] });

    const resp = await fetch(imageUrl, {
      client,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*",
      },
    } as any);

    if (!resp.ok) {
      client.close();
      return new Response(`Upstream ${resp.status}`, { status: 502, headers: corsHeaders });
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const body = await resp.arrayBuffer();
    client.close();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
