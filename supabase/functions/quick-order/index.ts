// MEDIKONG — Quick Order · supabase/functions/quick-order/index.ts
// Routeur. Déploiement : --no-verify-jwt (la page est publique, l'auth c'est le token).

import { cors, json } from "./_shared.ts";
import { handleGet } from "./handle-get.ts";
import { handlePost } from "./handle-post.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";

  try {
    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("t")?.trim() ?? "";
      if (!token || token.length > 64) return json({ error: "invalid_link" }, 404);
      return await handleGet(token, ip);
    }
    if (req.method === "POST") {
      return await handlePost(req, ip);
    }
    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    // Aucune erreur avalée : message + pile dans les journaux de la fonction.
    console.error(
      "[quick-order] exception non gérée:",
      (e as Error)?.message ?? String(e),
      (e as Error)?.stack ?? null,
    );
    return json({ error: "server_error" }, 500);
  }
});
