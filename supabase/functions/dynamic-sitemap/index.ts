import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const SITE = "https://medikong-deal-finder.lovable.app";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/catalogue", priority: "0.9", changefreq: "daily" },
    { loc: "/marques", priority: "0.8", changefreq: "weekly" },
    { loc: "/categories", priority: "0.8", changefreq: "weekly" },
    { loc: "/fabricants", priority: "0.7", changefreq: "weekly" },
    { loc: "/promotions", priority: "0.7", changefreq: "daily" },
    { loc: "/recherche", priority: "0.6", changefreq: "daily" },
    { loc: "/onboarding", priority: "0.6", changefreq: "monthly" },
    { loc: "/professionnels", priority: "0.6", changefreq: "monthly" },
    { loc: "/entreprise/a-propos", priority: "0.5", changefreq: "monthly" },
    { loc: "/entreprise/comment-ca-marche", priority: "0.5", changefreq: "monthly" },
    { loc: "/aide", priority: "0.5", changefreq: "monthly" },
    { loc: "/contact", priority: "0.5", changefreq: "monthly" },
    { loc: "/devenir-vendeur", priority: "0.6", changefreq: "monthly" },
    { loc: "/mentions-legales", priority: "0.3", changefreq: "yearly" },
    { loc: "/politique-de-confidentialite", priority: "0.3", changefreq: "yearly" },
    { loc: "/conditions-generales", priority: "0.3", changefreq: "yearly" },
    { loc: "/politique-cookies", priority: "0.3", changefreq: "yearly" },
  ];

  // Fetch products (limited to 50k for sitemap performance)
  const { data: products } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(50000);

  // Fetch brands
  const { data: brands } = await supabase
    .from("brands")
    .select("slug, synced_at")
    .eq("is_active", true)
    .limit(5000);

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("slug, synced_at")
    .eq("is_active", true)
    .limit(2000);

  // Fetch manufacturers
  const { data: manufacturers } = await supabase
    .from("manufacturers")
    .select("slug, synced_at")
    .eq("is_active", true)
    .limit(2000);

  const toDate = (d: string | null) => d ? d.substring(0, 10) : new Date().toISOString().substring(0, 10);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Static pages with hreflang
  const langs = ["fr", "nl", "de", "en"];
  for (const p of staticPages) {
    xml += `  <url>\n    <loc>${SITE}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n`;
    for (const lang of langs) {
      xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${p.loc}?lang=${lang}" />\n`;
    }
    xml += `  </url>\n`;
  }

  // Products
  for (const p of products || []) {
    xml += `  <url>\n    <loc>${SITE}/produit/${p.slug}</loc>\n    <lastmod>${toDate(p.updated_at)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }

  // Brands
  for (const b of brands || []) {
    xml += `  <url>\n    <loc>${SITE}/marque/${b.slug}</loc>\n    <lastmod>${toDate(b.synced_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  }

  // Categories
  for (const c of categories || []) {
    xml += `  <url>\n    <loc>${SITE}/categorie/${c.slug}</loc>\n    <lastmod>${toDate(c.synced_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  }

  // Manufacturers
  for (const m of manufacturers || []) {
    xml += `  <url>\n    <loc>${SITE}/fabricant/${m.slug}</loc>\n    <lastmod>${toDate(m.synced_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});
