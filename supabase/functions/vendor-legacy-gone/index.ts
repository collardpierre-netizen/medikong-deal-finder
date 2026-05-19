// Real HTTP 410 Gone endpoint for the deprecated /vendeur/:slug route.
//
// Lovable's SPA hosting can only emit 200 + meta noindex on the front route.
// This Supabase Edge Function delivers a *real* 410 status code with the
// proper SEO headers, intended to be reached either:
//   - directly by crawlers/clients via its public URL, or
//   - via a CDN/proxy rewrite of the legacy `/vendeur/:slug` URLs
//     (rewrite setup is out of scope of this function and must be wired
//     at the hosting layer).
//
// Query param: ?slug=<legacy-slug>  (echoed in body, never trusted as HTML
// without escaping).
//
// verify_jwt = false (declared in supabase/config.toml).

const HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  // SEO: explicit deindex signal at HTTP level (independent of HTML meta).
  "X-Robots-Tag": "noindex, nofollow",
  // Cache: 410 is permanent — let CDNs/crawlers cache it.
  "Cache-Control": "public, max-age=86400, s-maxage=86400",
  // CORS: minimal — this endpoint is a public landing, no JSON API.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBody(slug: string | null): string {
  const safeSlug = slug ? escapeHtml(slug.slice(0, 120)) : "";
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="googlebot" content="noindex, nofollow" />
    <title>Page supprimée — MediKong</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; color: #1E252F;">
    <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Cette page n'existe plus</h1>
    <p style="line-height: 1.6;">
      L'ancienne adresse${safeSlug ? ` <code>/vendeur/${safeSlug}</code>` : ""}
      a été définitivement supprimée (HTTP 410 Gone).
    </p>
    <p style="line-height: 1.6;">
      Les fiches vendeur publiques sont désormais accessibles via leur
      identifiant MediKong à 6 caractères, sur <code>/vendeur/&lt;code&gt;</code>.
    </p>
    <p style="margin-top: 2rem;">
      <a href="https://medikong.pro/catalogue" style="color: #1C58D9;">Parcourir le catalogue</a>
      &nbsp;·&nbsp;
      <a href="https://medikong.pro/" style="color: #1C58D9;">Accueil</a>
    </p>
  </body>
</html>`;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HTML_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...HTML_HEADERS, Allow: "GET, HEAD, OPTIONS" },
    });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  const body = req.method === "HEAD" ? null : renderBody(slug);

  return new Response(body, {
    status: 410,
    statusText: "Gone",
    headers: HTML_HEADERS,
  });
});
