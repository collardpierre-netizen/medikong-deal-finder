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
    let resp: Response | null = null;
    try {
      const client = Deno.createHttpClient({ caCerts: [] });
      resp = await fetch(imageUrl, {
        client,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/*,*/*",
          "Referer": new URL(imageUrl).origin,
        },
      } as any);
      client.close();
    } catch {
      resp = null;
    }

    if (!resp || !resp.ok) {
      const proc = new Deno.Command("curl", {
        args: ["-skL", "--max-time", "20", "-H", "User-Agent: Mozilla/5.0", "-H", "Accept: image/*,*/*", "-o", "-", imageUrl],
        stdout: "piped",
        stderr: "piped",
      });
      const output = await proc.output();
      if (!output.success || !output.stdout || output.stdout.length < 100) {
        return new Response(`Upstream ${resp?.status ?? 0}`, { status: 502, headers: corsHeaders });
      }
      return new Response(output.stdout, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
        },
      });
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const body = await resp.arrayBuffer();

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
