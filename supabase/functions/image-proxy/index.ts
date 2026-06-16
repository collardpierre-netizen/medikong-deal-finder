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

// SSRF guard: reject non-http(s) schemes and hosts that resolve to
// private / loopback / link-local / cloud-metadata ranges.
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;

  // IPv4 literal?
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 127) return true;                         // loopback
    if (a === 0) return true;                           // 0.0.0.0/8
    if (a === 169 && b === 254) return true;            // link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
    if (a >= 224) return true;                          // multicast / reserved
    return false;
  }
  // IPv6 literal (URL.hostname strips brackets)
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:")) {
      // IPv4-mapped — recurse on the v4 part
      return isBlockedHostname(h.slice(7));
    }
  }
  return false;
}

function validateImageUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "Invalid URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) allowed" };
  }
  if (isBlockedHostname(u.hostname)) {
    return { ok: false, reason: "Host not allowed" };
  }
  return { ok: true, url: u };
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

  const validated = validateImageUrl(imageUrl);
  if (!validated.ok) {
    return new Response(validated.reason, { status: 400, headers: corsHeaders });
  }
  imageUrl = validated.url.toString();

  // Bypass: redirect to the source for trusted hosts (CSP must allow them).
  if (BYPASS_HOSTS.has(validated.url.hostname.toLowerCase())) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: imageUrl,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Follow redirects manually so each hop is SSRF-validated.
  async function safeFetch(initialUrl: string, maxHops = 5): Promise<Response | null> {
    let current = initialUrl;
    for (let i = 0; i < maxHops; i++) {
      const v = validateImageUrl(current);
      if (!v.ok) return null;
      const r = await fetch(current, {
        headers: buildUpstreamHeaders(current),
        redirect: "manual",
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return r;
        current = new URL(loc, current).toString();
        continue;
      }
      return r;
    }
    return null;
  }

  try {
    let resp: Response | null = null;
    try { resp = await safeFetch(imageUrl); } catch { resp = null; }

    // Strategy 2: try HTTP if HTTPS failed (still SSRF-validated each hop)
    if (!resp || !resp.ok) {
      const httpUrl = imageUrl.replace(/^https:\/\//i, "http://");
      if (httpUrl !== imageUrl) {
        try { resp = await safeFetch(httpUrl); } catch { /* keep previous */ }
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
