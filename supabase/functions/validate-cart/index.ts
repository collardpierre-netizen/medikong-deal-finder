import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCart, type CartInputItem } from "../_shared/validate-cart.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

export interface HandlerDeps {
  /** Factory injectable pour les tests d'intégration. */
  makeClient?: () => SupabaseClientLike;
}

export async function handler(req: Request, deps: HandlerDeps = {}): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = deps.makeClient
      ? deps.makeClient()
      : createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const items = (body.items as CartInputItem[]) || [];
    if (!Array.isArray(items)) {
      return new Response(JSON.stringify({ error: "items must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve buyer_account_id (customers.id) + profile/country for cascade
    const { data: customer } = await supabase
      .from("customers")
      .select("id, customer_type, country_code")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const result = await validateCart(
      supabase,
      items,
      customer?.id ?? null,
      customer ? { customer_type: customer.customer_type, country_code: customer.country_code } : null,
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("validate-cart error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve((req) => handler(req));
