import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "product-images";

async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  // Try HTTPS first, then HTTP fallback
  const urls = [url];
  if (url.startsWith("https://")) {
    urls.push(url.replace("https://", "http://"));
  }

  for (const tryUrl of urls) {
    try {
      const resp = await fetch(tryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/*,*/*",
        },
        redirect: "follow",
      });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf.byteLength >= 100) {
          return {
            data: new Uint8Array(buf),
            contentType: resp.headers.get("content-type") || "image/jpeg",
          };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const storageHost = new URL(supabaseUrl).hostname;

  try {
    const body = await req.json().catch(() => ({}));
    const brandFilter: string = body.brand_name || "fresubin";
    const limit = Math.min(body.limit || 200, 500);

    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("id, name, image_urls, image_url")
      .ilike("brand_name", `%${brandFilter}%`)
      .not("image_urls", "is", null)
      .limit(limit);

    if (fetchErr) throw fetchErr;

    const toMigrate = (products || []).filter((p: any) => {
      const urls = p.image_urls as string[];
      return urls?.length > 0 && urls.some((u: string) =>
        u?.startsWith("http") && !u.includes(storageHost)
      );
    });

    if (toMigrate.length === 0) {
      return new Response(JSON.stringify({ status: "complete", message: "No external images found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let migrated = 0;
    let failed = 0;
    const errors: { product: string; error: string }[] = [];

    for (const product of toMigrate as any[]) {
      const oldUrls = product.image_urls as string[];
      const newUrls: string[] = [];
      let hasChanges = false;

      for (let i = 0; i < oldUrls.length; i++) {
        const url = oldUrls[i];
        if (!url || url.includes(storageHost) || !url.startsWith("http")) {
          newUrls.push(url);
          continue;
        }

        const result = await downloadImage(url);
        if (!result) {
          newUrls.push(url);
          if (errors.length < 20) errors.push({ product: product.name, error: `Download failed: ${url.substring(0, 80)}` });
          failed++;
          continue;
        }

        let ext = "jpg";
        if (result.contentType.includes("png")) ext = "png";
        else if (result.contentType.includes("webp")) ext = "webp";

        const filePath = `${product.id}/${i}.${ext}`;
        const blob = new Blob([result.data], { type: result.contentType });

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, blob, { contentType: result.contentType, upsert: true });

        if (uploadErr) {
          newUrls.push(url);
          if (errors.length < 20) errors.push({ product: product.name, error: uploadErr.message });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
        hasChanges = true;
      }

      if (hasChanges) {
        await supabase
          .from("products")
          .update({ image_urls: newUrls, image_url: newUrls[0] || null })
          .eq("id", product.id);
        migrated++;
      }
    }

    return new Response(JSON.stringify({
      total_candidates: toMigrate.length,
      migrated,
      failed,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
