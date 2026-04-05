import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "product-images";
const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const dryRun = body.dry_run === true;

    // Find products with external image_urls that haven't been migrated yet
    // Find products with image_urls that contain external URLs
    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("id, name, image_urls, image_url")
      .not("image_urls", "is", null)
      .limit(limit);

    if (fetchErr) throw fetchErr;

    // Filter to only products with external URLs (not already on our storage)
    const toMigrate = (products || []).filter((p: any) => {
      const urls = p.image_urls as string[];
      return urls && urls.length > 0 && urls.some((u: string) => 
        u && !u.includes("supabase.co/storage") && u.startsWith("http")
      );
    });

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_candidates: toMigrate.length,
        sample: toMigrate.slice(0, 5).map((p: any) => ({
          id: p.id,
          name: p.name,
          image_count: (p.image_urls as string[]).length,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let migrated = 0;
    let failed = 0;
    const errors: { product: string; error: string }[] = [];

    for (const product of toMigrate) {
      const oldUrls = product.image_urls as string[];
      const newUrls: string[] = [];
      let hasChanges = false;

      for (let i = 0; i < oldUrls.length; i++) {
        const url = oldUrls[i];
        if (!url || url.includes("supabase.co/storage") || !url.startsWith("http")) {
          newUrls.push(url);
          continue;
        }

        try {
          // Download the image
          const resp = await fetch(url, {
            headers: {
              "User-Agent": "MediKong-ImageMigrator/1.0",
              "Accept": "image/*",
            },
          });

          if (!resp.ok) {
            newUrls.push(url); // keep original if download fails
            errors.push({ product: product.name, error: `HTTP ${resp.status} for ${url.substring(0, 80)}` });
            continue;
          }

          const contentType = resp.headers.get("content-type") || "image/jpeg";
          const blob = await resp.blob();
          
          // Determine extension
          let ext = "jpg";
          if (contentType.includes("png")) ext = "png";
          else if (contentType.includes("webp")) ext = "webp";
          else if (contentType.includes("gif")) ext = "gif";
          else if (url.includes(".webp")) ext = "webp";
          else if (url.includes(".png")) ext = "png";

          const filePath = `${product.id}/${i}.${ext}`;

          // Upload to storage
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, blob, {
              contentType,
              upsert: true,
            });

          if (uploadErr) {
            newUrls.push(url);
            errors.push({ product: product.name, error: uploadErr.message });
            continue;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

          newUrls.push(publicUrl);
          hasChanges = true;
        } catch (e) {
          newUrls.push(url);
          errors.push({ product: product.name, error: (e as Error).message });
        }
      }

      if (hasChanges) {
        const { error: updateErr } = await supabase
          .from("products")
          .update({
            image_urls: newUrls,
            image_url: newUrls[0] || null,
          })
          .eq("id", product.id);

        if (updateErr) {
          failed++;
          errors.push({ product: product.name, error: `DB update: ${updateErr.message}` });
        } else {
          migrated++;
        }
      }
    }

    return new Response(JSON.stringify({
      total_candidates: toMigrate.length,
      migrated,
      failed,
      errors: errors.slice(0, 50),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});