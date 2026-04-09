import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_SECRET = Deno.env.get("SENDCLOUD_WEBHOOK_SECRET") || "";

// HMAC-SHA256 signature verification
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawBody = await req.text();

  // Verify HMAC signature
  const signature = req.headers.get("Sendcloud-Signature") || req.headers.get("sendcloud-signature") || "";
  if (WEBHOOK_SECRET) {
    const valid = await verifySignature(rawBody, signature);
    if (!valid) {
      console.error("Invalid Sendcloud webhook signature");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Use service role for DB writes
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const action = (payload.action as string) || "unknown";
    const parcel = (payload.parcel as Record<string, unknown>) || {};
    const parcelId = String(parcel.id || "");
    const trackingNumber = String(parcel.tracking_number || "");
    const statusMessage = String((parcel.status as Record<string, unknown>)?.message || "");
    const statusId = (parcel.status as Record<string, unknown>)?.id;
    const timestamp = (payload.timestamp as string) || new Date().toISOString();

    // Generate unique event ID for idempotency
    const eventId = `${parcelId}_${action}_${timestamp}`;

    // Find matching shipment
    const { data: shipment } = await supabase
      .from("restock_shipments")
      .select("id")
      .eq("sendcloud_parcel_id", parcelId)
      .maybeSingle();

    // Insert event (idempotent via UNIQUE constraint on sendcloud_event_id)
    const { error: insertErr } = await supabase.from("restock_shipment_events").insert({
      shipment_id: shipment?.id || null,
      sendcloud_parcel_id: parcelId,
      event_type: action,
      event_message: statusMessage,
      event_timestamp: timestamp,
      sendcloud_event_id: eventId,
      raw_payload: payload,
    });

    // If duplicate, silently succeed
    if (insertErr?.code === "23505") {
      return new Response("OK", { status: 200 });
    }
    if (insertErr) {
      console.error("Error inserting event:", insertErr);
      return new Response("OK", { status: 200 }); // Still return 200 to avoid retries
    }

    // Map Sendcloud status to our status
    if (shipment?.id) {
      let newStatus: string | null = null;
      if (action === "parcel_status_changed") {
        const sid = Number(statusId);
        if (sid >= 1 && sid <= 999) newStatus = "announced";
        if (sid >= 1000 && sid < 1999) newStatus = "in_transit";
        if (sid === 11) newStatus = "delivered";
        if (sid === 1999 || sid === 2000) newStatus = "exception";
        if (sid === 2001) newStatus = "returned";
      }

      if (newStatus) {
        await supabase.from("restock_shipments").update({
          status: newStatus,
          status_updated_at: timestamp,
          sendcloud_tracking_number: trackingNumber || undefined,
          exception_reason: newStatus === "exception" ? statusMessage : undefined,
        }).eq("id", shipment.id);

        // Update transaction status
        const { data: ship } = await supabase
          .from("restock_shipments")
          .select("transaction_id")
          .eq("id", shipment.id)
          .single();

        if (ship?.transaction_id) {
          let txStatus: string | null = null;
          if (newStatus === "in_transit") txStatus = "shipped";
          if (newStatus === "delivered") txStatus = "delivered";
          if (txStatus) {
            await supabase.from("restock_transactions").update({
              status: txStatus,
              ...(txStatus === "shipped" ? { shipped_at: timestamp } : {}),
              ...(txStatus === "delivered" ? { delivered_at: timestamp } : {}),
            }).eq("id", ship.transaction_id);
          }
        }

        // Auto-create incident for exceptions (lost/damaged)
        if (newStatus === "exception") {
          await supabase.from("restock_shipment_incidents").insert({
            shipment_id: shipment.id,
            incident_type: "exception",
            description: `Sendcloud exception: ${statusMessage}`,
            status: "open",
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response("OK", { status: 200 }); // Always 200 to prevent retries
  }
});
