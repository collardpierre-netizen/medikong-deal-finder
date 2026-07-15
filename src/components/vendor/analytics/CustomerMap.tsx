import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomerLocationRow } from "@/hooks/useVendorAnalyticsRecurrence";
import { fmtEur } from "@/lib/format-currency";
import { supabase } from "@/integrations/supabase/client";

type Geo = { lat: number; lng: number };

type Tier = "high" | "mid" | "low";

// Color palette (semantic-friendly). Kept literal here because leaflet paths take raw colors.
const TIER_COLORS: Record<Tier, string> = {
  high: "#16A34A",   // green — bonne couverture
  mid: "#F59E0B",    // orange — couverture moyenne
  low: "#DC2626",    // red — couverture faible
};

function tierFor(value: number, p66: number, p33: number): Tier {
  if (value >= p66) return "high";
  if (value >= p33) return "mid";
  return "low";
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function CustomerMap({ rows }: { rows: CustomerLocationRow[] }) {
  const [cache, setCache] = useState<Record<string, Geo>>({});
  const [pending, setPending] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const items = useMemo(
    () =>
      rows
        .filter((r) => r.postal_code !== "-" || r.city !== "-")
        .map((r) => ({
          key: `${r.country_code}|${r.postal_code}|${r.city}`,
          row: r,
        })),
    [rows]
  );

  useEffect(() => {
    let cancelled = false;
    const locations = rows
      .filter((r) => r.postal_code !== "-" || r.city !== "-")
      .map((r) => ({
        country_code: r.country_code,
        postal_code: r.postal_code,
        city: r.city,
      }));
    if (!locations.length) {
      setLoading(false);
      return;
    }

    const runOnce = async () => {
      const { data, error } = await supabase.functions.invoke("geocode-locations", {
        body: { locations },
      });
      if (cancelled) return { pending: 0 };
      if (error) {
        setLoading(false);
        return { pending: 0 };
      }
      const results: Array<{ key: string; lat: number; lng: number }> = data?.results ?? [];
      setCache((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.key] = { lat: r.lat, lng: r.lng };
        return next;
      });
      const remaining: number = data?.pending ?? 0;
      setPending(remaining);
      return { pending: remaining };
    };

    (async () => {
      setLoading(true);
      let guard = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { pending } = await runOnce();
        if (cancelled) return;
        if (!pending || guard++ > 50) break;
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const points = items
    .map((k) => ({ ...k, geo: cache[k.key] }))
    .filter((k) => k.geo);

  const maxCa = Math.max(1, ...points.map((p) => p.row.ca_htva_cents));

  // Tertile thresholds on CA to color-code coverage zones.
  const sortedCa = useMemo(
    () => points.map((p) => p.row.ca_htva_cents).sort((a, b) => a - b),
    [points]
  );
  const p33 = quantile(sortedCa, 1 / 3);
  const p66 = quantile(sortedCa, 2 / 3);

  const tileStyle = (typeof window !== "undefined" && (localStorage.getItem("vendor-map-tile") as "sober" | "gray" | "standard" | null)) || "sober";
  const tiles = {
    sober: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    gray: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    standard: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  }[tileStyle];

  return (
    <div className="rounded-[10px] overflow-hidden border border-[#E2E8F0] relative" style={{ height: 480 }}>
      <div className="absolute top-2 right-2 z-[1000] flex gap-1 bg-white/95 border border-[#E2E8F0] rounded-md shadow-sm p-1 text-[11px]">
        {(["sober", "gray", "standard"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              localStorage.setItem("vendor-map-tile", k);
              // force re-render
              window.dispatchEvent(new Event("storage"));
              location.reload();
            }}
            className={`px-2 py-1 rounded ${tileStyle === k ? "bg-[#1E252F] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}
          >
            {k === "sober" ? "Sobre" : k === "gray" ? "Neutre" : "Standard"}
          </button>
        ))}
      </div>
      <MapContainer center={[50.5, 4.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution={tiles.attribution} url={tiles.url} />
        {points.map((p) => {
          const tier = tierFor(p.row.ca_htva_cents, p66, p33);
          const color = TIER_COLORS[tier];
          return (
            <CircleMarker
              key={p.key}
              center={[p.geo!.lat, p.geo!.lng]}
              radius={6 + 18 * (p.row.ca_htva_cents / maxCa)}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1.5 }}
            >
              <Popup>
                <div className="text-[12px]">
                  <div className="font-semibold">
                    {p.row.city !== "-" ? p.row.city : p.row.postal_code} · {p.row.country_code}
                  </div>
                  <div>CA HTVA : {fmtEur(p.row.ca_htva_cents / 100)} €</div>
                  <div>{p.row.orders_count} commandes · {p.row.customers_count} client(s)</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>
                      Couverture{" "}
                      {tier === "high" ? "forte" : tier === "mid" ? "moyenne" : "faible"}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-2 right-2 bg-white/95 border border-[#E2E8F0] rounded px-2.5 py-1.5 text-[11px] text-[#1D2530] shadow-sm space-y-1">
        <div className="font-semibold text-[10px] uppercase tracking-wide text-[#616B7C]">
          Couverture (CA)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS.high }} />
          <span>Forte (≥ {fmtEur(p66 / 100)} €)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS.mid }} />
          <span>Moyenne</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS.low }} />
          <span>Faible (&lt; {fmtEur(p33 / 100)} €)</span>
        </div>
      </div>

      {loading && (
        <div className="absolute bottom-2 left-2 bg-white/90 border border-[#E2E8F0] rounded px-2 py-1 text-[11px] text-[#8B95A5]">
          Géocodage serveur en cours{pending ? ` (${pending} restant${pending > 1 ? "s" : ""})` : ""}…
        </div>
      )}
    </div>
  );
}
