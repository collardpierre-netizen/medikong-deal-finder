// Scan uniquement : n'envoie le code que si l'officine a l'accès Scan.
// Réponse toujours identique, pour ne jamais révéler si une adresse existe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MESSAGE = "Si votre officine fait partie du pilote MediKong Scan, vous allez recevoir un code. Pas de code ? Écrivez-nous à pcoll@medikong.pro.";
const hits = new Map<string, number[]>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const reply = () => new Response(JSON.stringify({ ok: true, message: MESSAGE }), { headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const { email, redirect } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e)) return reply();
    // Anti-rafale : 5 demandes / 10 min par adresse
    const now = Date.now(); const h = (hits.get(e) ?? []).filter((t) => now - t < 600_000);
    if (h.length >= 5) return reply(); h.push(now); hits.set(e, h);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ok } = await admin.rpc("scan_email_has_access", { _email: e });
    if (ok === true) {
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
      const safeRedirect = typeof redirect === "string" && /^https:\/\/([a-z0-9-]+\.)*(medikong\.pro|lovable\.app)(\/|$)/.test(redirect) ? redirect : "https://medikong.pro/scan";
      const { error } = await anon.auth.signInWithOtp({ email: e, options: { shouldCreateUser: false, emailRedirectTo: safeRedirect } });
      if (error) console.error("scan-request-code otp", error.message);
    }
  } catch (err) { console.error("scan-request-code", err); }
  return reply();
});
