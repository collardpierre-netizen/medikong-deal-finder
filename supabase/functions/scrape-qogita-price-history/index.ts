// Scrape public Qogita product pages to ingest daily priceHistory.
// No authentication required (public RSC payload).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Politesse : pacing + walltime bound
const REQUEST_DELAY_MS = 800 // ~1.25 req/s
const MAX_WALLTIME_MS = 55_000
const FETCH_TIMEOUT_MS = 15_000
const DEFAULT_BATCH = 40

type ScrapeResult = {
  status: 'ok' | 'not_found' | 'error' | 'no_history'
  points: number
  lastPrice?: number
  lastDate?: string
  error?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

// Extract the priceHistory JSON array from the RSC-encoded HTML.
// The payload appears escaped inside a JSON string, e.g.
//   priceHistory\":[{\"date\":1778515610,\"price\":\"10\"}, ...]
function extractPriceHistory(html: string): Array<{ date: number; price: string }> {
  const key = 'priceHistory'
  const idx = html.indexOf(key)
  if (idx < 0) return []
  // Find the first "[" after the key
  const start = html.indexOf('[', idx)
  if (start < 0) return []
  // Bracket-match with awareness of escaped quotes
  let depth = 0
  let end = -1
  let inStr = false
  let esc = false
  for (let i = start; i < html.length && i < start + 200_000; i++) {
    const ch = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) return []
  let raw = html.substring(start, end)
  // Unescape JSON string escapes present in RSC stream
  raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch {
    // Fallback: regex
    const out: Array<{ date: number; price: string }> = []
    const re = /\{"date":(\d+),"price":"([\d.]+)"\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      out.push({ date: Number(m[1]), price: m[2] })
    }
    return out
  }
  return []
}

async function scrapeProduct(
  supabase: ReturnType<typeof createClient>,
  product: { id: string; gtin: string | null; qogita_fid: string | null; qogita_slug: string | null },
  opts: { resourceOffers: boolean },
): Promise<ScrapeResult> {
  if (!product.gtin || !product.qogita_fid || !product.qogita_slug) {
    return { status: 'error', points: 0, error: 'missing_gtin_or_qogita_ids' }
  }
  const url = `https://www.qogita.com/products/${product.qogita_fid}/${product.qogita_slug}/`
  let resp: Response
  try {
    resp = await fetchWithTimeout(url)
  } catch (e) {
    return { status: 'error', points: 0, error: `fetch_error:${(e as Error).message}` }
  }
  if (resp.status === 404) return { status: 'not_found', points: 0 }
  if (!resp.ok) return { status: 'error', points: 0, error: `http_${resp.status}` }
  const html = await resp.text()
  const history = extractPriceHistory(html)
  if (history.length === 0) return { status: 'no_history', points: 0 }

  // Dedup by date (keep last), map to rows
  const byDate = new Map<string, number>()
  for (const p of history) {
    if (!p || typeof p.date !== 'number') continue
    const priceEur = Number(p.price)
    if (!Number.isFinite(priceEur) || priceEur <= 0) continue
    const d = new Date(p.date * 1000).toISOString().slice(0, 10)
    byDate.set(d, priceEur)
  }
  const rows = Array.from(byDate.entries()).map(([price_date, price_eur]) => ({
    gtin: product.gtin!,
    price_date,
    price_eur,
    source: 'qogita_public',
    scraped_at: new Date().toISOString(),
  }))
  if (rows.length === 0) return { status: 'no_history', points: 0 }

  const { error: upErr } = await supabase
    .from('qogita_price_history')
    .upsert(rows, { onConflict: 'gtin,price_date' })
  if (upErr) return { status: 'error', points: 0, error: `upsert_${upErr.message}` }

  // Latest point
  rows.sort((a, b) => (a.price_date < b.price_date ? 1 : -1))
  const last = rows[0]

  // Optional re-sourcing of Qogita-backed offers with tracing
  if (opts.resourceOffers) {
    const priceExcl = last.price_eur // qogita public price shown TTC vs HTVA? kept as-is; tagged for downstream
    // Only touch offers that are Qogita-backed and currently stale
    await supabase
      .from('offers')
      .update({
        price_stale: false,
        price_stale_since: null,
        price_source: 'qogita_public',
        price_source_updated_at: new Date().toISOString(),
      })
      .eq('product_id', product.id)
      .eq('is_qogita_backed', true)
      .eq('price_stale', true)
  }

  return { status: 'ok', points: rows.length, lastPrice: last.price_eur, lastDate: last.price_date }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const startedAt = Date.now()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let body: {
    productIds?: string[]
    gtins?: string[]
    limit?: number
    resourceOffers?: boolean
    dryRun?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    /* GET / cron */
  }

  const limit = Math.min(Math.max(body.limit ?? DEFAULT_BATCH, 1), 200)
  const resourceOffers = body.resourceOffers ?? true

  // Resolve targets
  let query = supabase
    .from('products')
    .select('id, gtin, qogita_fid, qogita_slug')
    .not('gtin', 'is', null)
    .not('qogita_fid', 'is', null)
    .not('qogita_slug', 'is', null)

  if (body.productIds?.length) {
    query = query.in('id', body.productIds).limit(limit)
  } else if (body.gtins?.length) {
    query = query.in('gtin', body.gtins).limit(limit)
  } else {
    // Cron mode: pick from tendances_index_basket, oldest first
    const { data: basket } = await supabase
      .from('tendances_index_basket')
      .select('product_id')
      .eq('is_active', true)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .order('priority', { ascending: true })
      .limit(limit)
    const ids = (basket ?? []).map((b: any) => b.product_id)
    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'basket_empty', targeted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    query = query.in('id', ids)
  }

  const { data: products, error: prodErr } = await query
  if (prodErr) {
    return new Response(JSON.stringify({ error: prodErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Open log row
  const { data: logRow } = await supabase
    .from('qogita_price_scrape_logs')
    .insert({ products_targeted: products?.length ?? 0 })
    .select('id')
    .single()

  let ok = 0
  let notFound = 0
  let errors = 0
  let points = 0
  let resourced = 0
  const errorSamples: any[] = []

  for (const p of products ?? []) {
    if (Date.now() - startedAt > MAX_WALLTIME_MS) {
      errorSamples.push({ reason: 'walltime_exceeded' })
      break
    }
    let res: ScrapeResult
    if (body.dryRun) {
      res = { status: 'ok', points: 0 }
    } else {
      res = await scrapeProduct(supabase, p as any, { resourceOffers })
    }
    if (res.status === 'ok') {
      ok++
      points += res.points
      if (resourceOffers) resourced++
    } else if (res.status === 'not_found') {
      notFound++
    } else if (res.status !== 'no_history') {
      errors++
      if (errorSamples.length < 10) errorSamples.push({ id: p.id, gtin: p.gtin, error: res.error })
    }
    await supabase
      .from('tendances_index_basket')
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: res.status,
        last_scrape_error: res.error ?? null,
      })
      .eq('product_id', p.id)

    await sleep(REQUEST_DELAY_MS)
  }

  if (logRow?.id) {
    await supabase
      .from('qogita_price_scrape_logs')
      .update({
        ended_at: new Date().toISOString(),
        products_ok: ok,
        products_404: notFound,
        products_error: errors,
        points_upserted: points,
        offers_resourced: resourced,
        errors: errorSamples,
      })
      .eq('id', logRow.id)
  }

  return new Response(
    JSON.stringify({
      ok: true,
      targeted: products?.length ?? 0,
      products_ok: ok,
      products_404: notFound,
      products_error: errors,
      points_upserted: points,
      offers_resourced: resourced,
      elapsedMs: Date.now() - startedAt,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
