import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CustomerLocationRow } from "@/hooks/useVendorAnalyticsRecurrence";
import { fmtEur } from "@/lib/format-currency";
import { supabase } from "@/integrations/supabase/client";

type Geo = { lat: number; lng: number };

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
      // Loop until all locations are geocoded (edge function caps per call to respect Nominatim rate limit).
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

  return (
    <div className="rounded-[10px] overflow-hidden border border-[#E2E8F0] relative" style={{ height: 480 }}>
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
      {loading && (
        <div className="absolute bottom-2 left-2 bg-white/90 border border-[#E2E8F0] rounded px-2 py-1 text-[11px] text-[#8B95A5]">
          Géocodage serveur en cours{pending ? ` (${pending} restant${pending > 1 ? "s" : ""})` : ""}…
        </div>
      )}
    </div>
  );
}
