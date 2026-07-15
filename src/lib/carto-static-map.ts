/**
 * Compose a CARTO Light basemap raster (BENELUX-friendly) into a PNG data URL,
 * for embedding into client-side PDFs. Points are drawn on top so they align
 * perfectly with the underlying tiles.
 *
 * CARTO Positron tiles are free to use with attribution (CC BY 3.0 / ODbL for
 * OSM data). Tiles are CORS-enabled so we can read the canvas back.
 */

export type MapPoint = {
  lat: number;
  lng: number;
  color: [number, number, number]; // rgb 0..255
  radius: number; // pixels
};

const TILE = 256;

function lonLatToTile(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n;
  return { x, y };
}

function loadImage(url: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

export async function renderCartoStaticMap({
  bbox,
  widthPx,
  heightPx,
  points = [],
  style = "light_all",
}: {
  bbox: [number, number, number, number]; // [minLng,minLat,maxLng,maxLat]
  widthPx: number;
  heightPx: number;
  points?: MapPoint[];
  style?: "light_all" | "voyager_nolabels";
}): Promise<{ dataUrl: string; widthPx: number; heightPx: number } | null> {
  if (typeof document === "undefined") return null;

  const [minLng, minLat, maxLng, maxLat] = bbox;

  // Pick the highest zoom where the bbox still fits into the target canvas.
  let zoom = 5;
  for (let z = 12; z >= 3; z--) {
    const a = lonLatToTile(minLng, maxLat, z);
    const b = lonLatToTile(maxLng, minLat, z);
    const wpx = (b.x - a.x) * TILE;
    const hpx = (b.y - a.y) * TILE;
    if (wpx <= widthPx && hpx <= heightPx) {
      zoom = z;
      break;
    }
  }

  const a = lonLatToTile(minLng, maxLat, zoom);
  const b = lonLatToTile(maxLng, minLat, zoom);
  const pxW = Math.max(64, Math.round((b.x - a.x) * TILE));
  const pxH = Math.max(64, Math.round((b.y - a.y) * TILE));

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Soft sea background in case tiles fail to load.
  ctx.fillStyle = "#EEF4FD";
  ctx.fillRect(0, 0, pxW, pxH);

  const xMin = Math.floor(a.x);
  const xMax = Math.floor(b.x);
  const yMin = Math.floor(a.y);
  const yMax = Math.floor(b.y);
  const subdomains = ["a", "b", "c", "d"];

  const tileJobs: Array<{ tx: number; ty: number; url: string }> = [];
  for (let tx = xMin; tx <= xMax; tx++) {
    for (let ty = yMin; ty <= yMax; ty++) {
      const s = subdomains[Math.abs(tx + ty) % 4];
      tileJobs.push({
        tx,
        ty,
        url: `https://${s}.basemaps.cartocdn.com/${style}/${zoom}/${tx}/${ty}.png`,
      });
    }
  }

  const images = await Promise.all(tileJobs.map((j) => loadImage(j.url)));
  images.forEach((img, i) => {
    if (!img) return;
    const { tx, ty } = tileJobs[i];
    const dx = (tx - a.x) * TILE;
    const dy = (ty - a.y) * TILE;
    try {
      ctx.drawImage(img, dx, dy);
    } catch {
      /* ignore individual tile draw errors */
    }
  });

  // Draw points on top.
  for (const p of points) {
    const t = lonLatToTile(p.lng, p.lat, zoom);
    const px = (t.x - a.x) * TILE;
    const py = (t.y - a.y) * TILE;
    if (px < -20 || py < -20 || px > pxW + 20 || py > pxH + 20) continue;
    const [r, g, bl] = p.color;
    // white halo
    ctx.beginPath();
    ctx.arc(px, py, p.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    // fill
    ctx.beginPath();
    ctx.arc(px, py, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${bl},0.65)`;
    ctx.fill();
    // stroke
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgb(${r},${g},${bl})`;
    ctx.stroke();
  }

  try {
    const dataUrl = canvas.toDataURL("image/png");
    return { dataUrl, widthPx: pxW, heightPx: pxH };
  } catch {
    // canvas tainted (should not happen with CORS tiles, but be safe)
    return null;
  }
}
