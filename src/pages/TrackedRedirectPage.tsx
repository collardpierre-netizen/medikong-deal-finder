// Public tracked-redirect landing: /go/:slug?k=<code>
// Logs the scan, drops mk_ref cookie, then redirects to the campaign's landing_path with UTM params.
import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { forceSetMkRef, getVisitorId } from "@/lib/tracking";

export default function TrackedRedirectPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const codeParam = params.get("k");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fallback = "/inscription";
      if (!slug) { window.location.replace(fallback); return; }

      try {
        const { data, error } = await supabase.functions.invoke("track-scan", {
          body: {
            slug,
            code: codeParam ?? undefined,
            visitor_id: getVisitorId(),
            referrer: document.referrer || undefined,
            ua: navigator.userAgent,
          },
        });
        if (cancelled) return;

        if (error || !data?.ok || !data?.campaign) {
          window.location.replace(fallback);
          return;
        }

        const c = data.campaign as {
          id: string; landing_path: string;
          utm_source: string | null; utm_medium: string | null;
          utm_campaign: string | null; utm_content: string | null;
          code: string | null; code_id: string | null;
        };

        // First-touch cookie (helper prevents overwrite if valid one exists)
        forceSetMkRef({
          visitor_id: getVisitorId(),
          campaign_slug: slug,
          code: c.code,
          ts: Date.now(),
        });

        const u = new URL(c.landing_path, window.location.origin);
        if (c.utm_source) u.searchParams.set("utm_source", c.utm_source);
        if (c.utm_medium) u.searchParams.set("utm_medium", c.utm_medium);
        if (c.utm_campaign) u.searchParams.set("utm_campaign", c.utm_campaign);
        if (c.utm_content) u.searchParams.set("utm_content", c.utm_content);
        u.searchParams.set("ref", slug);
        if (c.code) u.searchParams.set("code", c.code);
        window.location.replace(u.pathname + u.search);
      } catch (e) {
        console.error("tracked redirect failed", e);
        if (!cancelled) window.location.replace(fallback);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, codeParam]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <div className="text-sm">Redirection…</div>
    </div>
  );
}
