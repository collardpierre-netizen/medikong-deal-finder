import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const QOGITA_API = "https://api.qogita.com";

async function getQogitaToken(): Promise<string> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await sb.from("qogita_config").select("qogita_email, qogita_password").eq("id", 1).single();
  if (!data?.qogita_email || !data?.qogita_password) throw new Error("Qogita credentials not configured");

  const res = await fetch(`${QOGITA_API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: data.qogita_email, password: data.qogita_password }),
  });
  const auth = await res.json();
  if (!auth.accessToken) throw new Error("Auth failed: " + JSON.stringify(auth));
  return auth.accessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gtin, fid, slug } = await req.json().catch(() => ({
      gtin: "0008080153555",
      fid: null,
      slug: null,
    }));

    const token = await getQogitaToken();
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    // Step 1: Get variant details
    const variantRes = await fetch(`${QOGITA_API}/variants/${gtin}/?country=BE`, { headers });
    const variantData = await variantRes.json();

    const actualFid = fid || variantData.fid;
    const actualSlug = slug || variantData.slug;

    // Step 2: Get offers
    let offersData: any = null;
    let offersError: string | null = null;
    let offersStatus: number | null = null;
    let offersUrl = "";

    if (actualFid && actualSlug) {
      offersUrl = `${QOGITA_API}/variants/${actualFid}/${actualSlug}/offers/`;
      const offersRes = await fetch(offersUrl, { headers });
      offersStatus = offersRes.status;
      try {
        offersData = await offersRes.json();
      } catch (e) {
        offersError = `Failed to parse JSON: ${e.message}`;
        offersData = await offersRes.text();
      }
    } else {
      offersError = "No fid/slug available to call offers endpoint";
    }

    // Step 3: Analysis
    const offersArray = Array.isArray(offersData)
      ? offersData
      : (offersData?.offers || offersData?.results || []);

    const sellerCounts: Record<string, number> = {};
    for (const o of offersArray) {
      sellerCounts[o.seller] = (sellerCounts[o.seller] || 0) + 1;
    }

    const prices = offersArray.map((o: any) => parseFloat(o.price) || 0).filter((p: number) => p > 0);

    const analysis = {
      offersCount: offersArray.length,
      uniqueSellers: [...new Set(offersArray.map((o: any) => o.seller))].length,
      sellers: offersArray.map((o: any) => ({
        seller: o.seller,
        price: o.price,
        mov: o.mov,
        inventory: o.inventory,
        qid: o.qid,
      })),
      hasMultiplePricesPerSeller: Object.values(sellerCounts).some((c) => c > 1),
      priceRange: {
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null,
      },
    };

    return new Response(JSON.stringify({
      _test_info: { product: gtin, offersUrl, timestamp: new Date().toISOString() },
      variant: {
        gtin: variantData.gtin,
        name: variantData.name,
        fid: variantData.fid,
        slug: variantData.slug,
        qid: variantData.qid,
        price: variantData.price,
        priceCurrency: variantData.priceCurrency,
        inventory: variantData.inventory,
        sellerCount: variantData.sellerCount,
        dimensions: variantData.dimensions,
        images: variantData.images,
        delay: variantData.delay,
        _fullResponse: variantData,
      },
      offers: { status: offersStatus, error: offersError, _rawResponse: offersData },
      analysis,
    }, null, 2), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500, headers: corsHeaders,
    });
  }
});
