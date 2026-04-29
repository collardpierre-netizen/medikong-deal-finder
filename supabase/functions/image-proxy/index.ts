const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hosts we never proxy — return a redirect so the browser fetches them directly.
// (CSP img-src must allow these hosts.)
const BYPASS_HOSTS = new Set<string>([
  "www.fresubin.be",
  "fresubin.be",
  "www.delical.fr",
  "delical.fr",
]);

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function buildUpstreamHeaders(imageUrl: string): HeadersInit {
  let referer = "";
  try {
    const u = new URL(imageUrl);
    referer = `${u.protocol}//${u.host}/`;
  } catch {
    // ignore
  }
  const h: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
  };
  if (referer) h["Referer"] = referer;
  return h;
}

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

  // Bypass: redirect to the source for trusted hosts (CSP must allow them).
  try {
    const host = new URL(imageUrl).hostname.toLowerCase();
    if (BYPASS_HOSTS.has(host)) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: imageUrl,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {
    // invalid URL — fall through to fetch which will error cleanly
  }

  try {
    const upstreamHeaders = buildUpstreamHeaders(imageUrl);
    let resp: Response | null = null;

    // Strategy 1: standard fetch
    try {
      resp = await fetch(imageUrl, {
        headers: upstreamHeaders,
        redirect: "follow",
      });
    } catch {
      resp = null;
    }

    // Strategy 2: try HTTP if HTTPS failed
    if (!resp || !resp.ok) {
      const httpUrl = imageUrl.replace(/^https:\/\//i, "http://");
      if (httpUrl !== imageUrl) {
        try {
          resp = await fetch(httpUrl, {
            headers: buildUpstreamHeaders(httpUrl),
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

    // Strip any Set-Cookie / cookie headers from upstream — never forward them.
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
