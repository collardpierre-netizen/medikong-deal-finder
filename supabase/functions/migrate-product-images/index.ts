import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "product-images";

async function downloadWithCurl(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    // Use curl -k to bypass SSL certificate issues
    const proc = new Deno.Command("curl", {
      args: ["-skL", "--max-time", "15", "-o", "-", "-D", "-", url],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await proc.output();
    if (!output.success) return null;

    const raw = output.stdout;
    // Find the end of HTTP headers (double CRLF)
    let headerEnd = -1;
    for (let i = 0; i < raw.length - 3; i++) {
      if (raw[i] === 0x0d && raw[i+1] === 0x0a && raw[i+2] === 0x0d && raw[i+3] === 0x0a) {
        headerEnd = i + 4;
        // Check if there's another header block (redirects)
        const remaining = raw.slice(headerEnd);
        let nextHeaderEnd = -1;
        for (let j = 0; j < remaining.length - 3; j++) {
          if (remaining[j] === 0x0d && remaining[j+1] === 0x0a && remaining[j+2] === 0x0d && remaining[j+3] === 0x0a) {
            // Check if this looks like an HTTP header
            const chunk = new TextDecoder().decode(remaining.slice(0, Math.min(30, j)));
            if (chunk.startsWith("HTTP/")) {
              nextHeaderEnd = headerEnd + j + 4;
            }
            break;
          }
        }
        if (nextHeaderEnd > 0) headerEnd = nextHeaderEnd;
        break;
      }
    }

    if (headerEnd < 0) return null;

    const headerText = new TextDecoder().decode(raw.slice(0, headerEnd));
    const ctMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = ctMatch?.[1]?.trim() || "image/jpeg";
    const data = raw.slice(headerEnd);

    if (data.length < 100) return null; // Too small, probably an error

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
    const limit = Math.min(body.limit || 50, 200);
    const dryRun = body.dry_run === true;
    const brandName: string | null = body.brand_name || null;

    let query = supabase
      .from("products")
      .select("id, name, image_urls, image_url")
      .not("image_urls", "is", null)
      .limit(limit);

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
    });

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

    for (const product of toMigrate) {
      const oldUrls = product.image_urls as string[];
      const newUrls: string[] = [];
      let hasChanges = false;

      for (let i = 0; i < oldUrls.length; i++) {
        const url = oldUrls[i];
        if (!url || url.includes(storageHost) || !url.startsWith("http")) {
          newUrls.push(url);
          continue;
        }

        // Try standard fetch first, then curl -k for SSL issues
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
          errors.push({ product: product.name, error: `Download failed for ${url.substring(0, 80)}` });
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
          errors.push({ product: product.name, error: uploadErr.message });
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
          errors.push({ product: product.name, error: `DB update: ${updateErr.message}` });
        } else {
          migrated++;
        }
      }
    }

    return new Response(JSON.stringify({
      total_candidates: toMigrate.length, migrated, failed,
      errors: errors.slice(0, 50),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
