// Confirmation publique (par jeton) d'un bon de livraison : checklist, quantités
// acceptées, signature manuscrite, remarques, horodatage serveur.
// Aucune authentification : la légitimité vient du jeton du bon de livraison.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_SIGNATURE_BYTES = 1_500_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }

  const token = String(body?.token ?? "").trim();
  const name = String(body?.confirmedByName ?? "").trim();
  const remarks = typeof body?.remarks === "string" ? body.remarks.slice(0, 2000) : null;
  const checklist = body?.checklist && typeof body.checklist === "object" ? body.checklist : {};
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const signatureDataUrl = typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : "";

  if (token.length < 16) return json({ error: "not_found" }, 404);
  if (name.length < 2) return json({ error: "name_required" }, 400);

  // Le jeton doit désigner un BL existant, émis et non encore signé.
  const { data: note } = await admin
    .from("delivery_notes")
    .select("id, status, confirmed_at")
    .eq("confirmation_token", token)
    .maybeSingle();
  if (!note) return json({ error: "not_found" }, 404);
  if (note.status !== "issued") return json({ error: "cancelled" }, 409);
  if (note.confirmed_at) return json({ error: "already_confirmed" }, 409);

  // Signature : PNG dataURL -> bucket privé.
  let signaturePath: string | null = null;
  if (signatureDataUrl.startsWith("data:image/png;base64,")) {
    const base64 = signatureDataUrl.slice("data:image/png;base64,".length);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_SIGNATURE_BYTES) return json({ error: "signature_too_large" }, 413);
    const path = `${note.id}/${Date.now()}-signature.png`;
    const { error: upErr } = await admin.storage
      .from("delivery-signatures")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return json({ error: "signature_upload_failed", detail: upErr.message }, 500);
    signaturePath = path;
  } else if (signatureDataUrl) {
    return json({ error: "invalid_signature_format" }, 400);
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    null;

  const { data, error } = await admin.rpc("delivery_note_confirm_by_token", {
    _token: token,
    _confirmed_by_name: name,
    _checklist: checklist,
    _lines: lines,
    _remarks: remarks,
    _signature_storage_path: signaturePath,
    _ip: ip,
  });
  if (error) return json({ error: "confirmation_failed", detail: error.message }, 500);
  if ((data as any)?.error) return json({ error: (data as any).error }, 409);

  return json({ success: true, ...(data as any) });
});
