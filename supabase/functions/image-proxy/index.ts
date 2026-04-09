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
    // Try multiple fetch strategies for SSL compatibility
    let resp: Response | null = null;

    // Strategy 1: standard fetch (works for valid SSL)
    try {
      resp = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/*,*/*",
        },
        redirect: "follow",
      });
    } catch {
      resp = null;
    }

    // Strategy 2: try HTTP if HTTPS failed (some sites serve images on both)
    if (!resp || !resp.ok) {
      const httpUrl = imageUrl.replace(/^https:\/\//i, "http://");
      if (httpUrl !== imageUrl) {
        try {
          resp = await fetch(httpUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "image/*,*/*",
            },
            redirect: "follow",
          });
        } catch {
          // keep previous resp
        }
      }
    }

    if (!resp || !resp.ok) {
      return new Response(`Upstream ${resp?.status ?? 0}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const body = await resp.arrayBuffer();

    if (body.byteLength < 100) {
      return new Response("Image too small", { status: 502, headers: corsHeaders });
    }

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
