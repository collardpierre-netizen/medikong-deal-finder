import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "product-images";

async function downloadWithCurl(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const proc = new Deno.Command("curl", {
      args: ["-skL", "--max-time", "10", "-o", "-", "-D", "-", url],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await proc.output();
    if (!output.success) return null;

    const raw = output.stdout;
    let headerEnd = -1;
    for (let i = 0; i < raw.length - 3; i++) {
      if (raw[i] === 0x0d && raw[i+1] === 0x0a && raw[i+2] === 0x0d && raw[i+3] === 0x0a) {
        headerEnd = i + 4;
        const remaining = raw.slice(headerEnd);
        for (let j = 0; j < remaining.length - 3; j++) {
          if (remaining[j] === 0x0d && remaining[j+1] === 0x0a && remaining[j+2] === 0x0d && remaining[j+3] === 0x0a) {
            const chunk = new TextDecoder().decode(remaining.slice(0, Math.min(30, j)));
            if (chunk.startsWith("HTTP/")) {
              headerEnd = headerEnd + j + 4;
            }
            break;
          }
        }
        break;
      }
    }

    if (headerEnd < 0) return null;

    const headerText = new TextDecoder().decode(raw.slice(0, headerEnd));
    const ctMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = ctMatch?.[1]?.trim() || "image/jpeg";
    const data = raw.slice(headerEnd);

    if (data.length < 100) return null;

    return { data, contentType };
  } catch {
    return null;
  }
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
    const limit = Math.min(body.limit || 500, 500);
    const dryRun = body.dry_run === true;
    const brandName: string | null = body.brand_name || null;
    const autoBatch = body.auto_batch === true; // Called by cron

    // Fetch products with external images — use offset tracking table for cron
    let query = supabase
      .from("products")
      .select("id, name, image_urls, image_url")
      .not("image_urls", "is", null)
      .not("image_urls", "eq", "{}")
      .order("id")
      .limit(limit * 4);

    if (brandName) {
      query = query.ilike("brand_name", `%${brandName}%`);
    }

    const { data: products, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const toMigrate = (products || []).filter((p: any) => {
      const urls = p.image_urls as string[];
      return urls && urls.length > 0 && urls.some((u: string) =>
        u && u.startsWith("http") && !u.includes(storageHost)
      );
    }).slice(0, limit);

    // If cron mode and nothing left to migrate, log and return
    if (autoBatch && toMigrate.length === 0) {
      console.log("Auto-batch: no more images to migrate. Migration complete!");
      return new Response(JSON.stringify({
        auto_batch: true, status: "complete", total_candidates: 0, migrated: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_candidates: toMigrate.length,
        sample: toMigrate.slice(0, 5).map((p: any) => ({
          id: p.id, name: p.name,
          urls: (p.image_urls as string[]).slice(0, 2),
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let migrated = 0;
    let failed = 0;
    const errors: { product: string; error: string }[] = [];

    // Process concurrently in chunks of 10 for speed
    const CONCURRENCY = 10;
    for (let chunk = 0; chunk < toMigrate.length; chunk += CONCURRENCY) {
      const batch = toMigrate.slice(chunk, chunk + CONCURRENCY);
      await Promise.all(batch.map(async (product: any) => {
        try {
          const oldUrls = product.image_urls as string[];
          const newUrls: string[] = [];
          let hasChanges = false;

          for (let i = 0; i < oldUrls.length; i++) {
            const url = oldUrls[i];
            if (!url || url.includes(storageHost) || !url.startsWith("http")) {
              newUrls.push(url);
              continue;
            }

            let blob: Blob | null = null;
            let contentType = "image/jpeg";

            try {
              const resp = await fetch(url, {
                headers: { "User-Agent": "MediKong-ImageMigrator/1.0", "Accept": "image/*" },
              });
              if (resp.ok) {
                contentType = resp.headers.get("content-type") || "image/jpeg";
                blob = await resp.blob();
              }
            } catch {
              // SSL or network error — try curl
            }

            if (!blob) {
              const result = await downloadWithCurl(url);
              if (result) {
                blob = new Blob([result.data], { type: result.contentType });
                contentType = result.contentType;
              }
            }

            if (!blob || blob.size < 100) {
              newUrls.push(url);
              if (errors.length < 20) errors.push({ product: product.name, error: `Download failed: ${url.substring(0, 60)}` });
              continue;
            }

            let ext = "jpg";
            if (contentType.includes("png")) ext = "png";
            else if (contentType.includes("webp")) ext = "webp";
            else if (contentType.includes("gif")) ext = "gif";
            else if (url.includes(".webp")) ext = "webp";
            else if (url.includes(".png")) ext = "png";

            const filePath = `${product.id}/${i}.${ext}`;

            const { error: uploadErr } = await supabase.storage
              .from(BUCKET)
              .upload(filePath, blob, { contentType, upsert: true });

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
            const { error: updateErr } = await supabase
              .from("products")
              .update({ image_urls: newUrls, image_url: newUrls[0] || null })
              .eq("id", product.id);

            if (updateErr) {
              failed++;
              if (errors.length < 20) errors.push({ product: product.name, error: `DB: ${updateErr.message}` });
            } else {
              migrated++;
            }
          }
        } catch (e) {
          failed++;
          if (errors.length < 20) errors.push({ product: product.name, error: (e as Error).message });
        }
      }));
    }

    console.log(`Batch done: ${migrated} migrated, ${failed} failed, ${toMigrate.length - migrated - failed} skipped`);

    return new Response(JSON.stringify({
      auto_batch: autoBatch,
      total_candidates: toMigrate.length, migrated, failed,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
