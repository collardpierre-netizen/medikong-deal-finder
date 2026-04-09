import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { product_id, image_index, image_base64, content_type, ext, update_product } = body;

    if (!product_id || image_base64 === undefined) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const filePath = `${product_id}/${image_index || 0}.${ext || "jpg"}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(filePath, bytes, { contentType: content_type || "image/jpeg", upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    if (update_product === true) {
      const normalizedIndex = Number.isInteger(image_index) ? image_index : 0;
      const { data: product, error: productErr } = await supabase
        .from("products")
        .select("image_urls")
        .eq("id", product_id)
        .maybeSingle();

      if (productErr) throw productErr;

      const imageUrls = Array.isArray(product?.image_urls) ? [...product.image_urls] : [];
      imageUrls[normalizedIndex] = publicUrl;

      const cleanedUrls = imageUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0);

      const { error: updateErr } = await supabase
        .from("products")
        .update({
          image_url: cleanedUrls[0] ?? publicUrl,
          image_urls: cleanedUrls.length > 0 ? cleanedUrls : [publicUrl],
        })
        .eq("id", product_id);

      if (updateErr) throw updateErr;
    }

    return new Response(JSON.stringify({ url: publicUrl, updated: update_product === true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
