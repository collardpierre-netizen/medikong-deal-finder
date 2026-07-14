import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomerLocationRow } from "@/hooks/useVendorAnalyticsRecurrence";
import { fmtEur } from "@/lib/format-currency";

type Geo = { lat: number; lng: number };
const CACHE_KEY = "mk-geo-cache-v1";

function loadCache(): Record<string, Geo> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveCache(c: Record<string, Geo>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

async function geocode(q: string): Promise<Geo | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json" },
    });
    const d = await r.json();
    if (Array.isArray(d) && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch {}
  return null;
}

export function CustomerMap({ rows }: { rows: CustomerLocationRow[] }) {
  const [cache, setCache] = useState<Record<string, Geo>>(() => loadCache());
  const [ready, setReady] = useState(false);

  const keys = useMemo(
    () =>
      rows
        .filter((r) => r.postal_code !== "-" || r.city !== "-")
        .slice(0, 80)
        .map((r) => ({
          key: `${r.country_code}|${r.postal_code}|${r.city}`,
          q: [r.postal_code !== "-" ? r.postal_code : null, r.city !== "-" ? r.city : null, r.country_code !== "UNK" ? r.country_code : null]
            .filter(Boolean)
            .join(", "),
          row: r,
        })),
    [rows]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = keys.filter((k) => !cache[k.key] && k.q);
      if (!missing.length) {
        setReady(true);
        return;
      }
      const next = { ...cache };
      for (const m of missing.slice(0, 25)) {
        const g = await geocode(m.q);
        if (g) next[m.key] = g;
        await new Promise((r) => setTimeout(r, 1100));
        if (cancelled) return;
      }
      setCache(next);
      saveCache(next);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const points = keys
    .map((k) => ({ ...k, geo: cache[k.key] }))
    .filter((k) => k.geo);

  const maxCa = Math.max(1, ...points.map((p) => p.row.ca_htva_cents));

  return (
    <div className="rounded-[10px] overflow-hidden border border-[#E2E8F0]" style={{ height: 480 }}>
      <MapContainer center={[50.5, 4.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <CircleMarker
            key={p.key}
            center={[p.geo!.lat, p.geo!.lng]}
            radius={6 + 18 * (p.row.ca_htva_cents / maxCa)}
            pathOptions={{ color: "#1C58D9", fillColor: "#1C58D9", fillOpacity: 0.5 }}
          >
            <Popup>
              <div className="text-[12px]">
                <div className="font-semibold">
                  {p.row.city !== "-" ? p.row.city : p.row.postal_code} · {p.row.country_code}
                </div>
                <div>CA HTVA : {fmtEur(p.row.ca_htva_cents / 100)} €</div>
                <div>{p.row.orders_count} commandes · {p.row.customers_count} client(s)</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {!ready && (
        <div className="text-[11px] text-[#8B95A5] p-2">Géocodage en cours (OpenStreetMap, 1 req/s)…</div>
      )}
    </div>
  );
}
