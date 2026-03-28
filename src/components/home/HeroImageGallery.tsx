import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const staticImages = [
  { id: "1", image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900&q=80", alt_text: "Fournitures médicales" },
  { id: "2", image_url: "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=900&q=80", alt_text: "Équipement médical" },
  { id: "3", image_url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&q=80", alt_text: "Pharmacie professionnelle" },
];

export function HeroImageGallery() {
  const [current, setCurrent] = useState(0);
  const count = staticImages.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const iv = setInterval(next, 5000);
    return () => clearInterval(iv);
  }, [count, next]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg group" style={{ height: 340 }}>
      {staticImages.map((img, i) => (
        <img key={img.id} src={img.image_url} alt={img.alt_text}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }} loading={i === 0 ? "eager" : "lazy"} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-10 text-white">
        <p className="text-xs font-medium uppercase tracking-wider opacity-80 mb-1">MediKong.pro</p>
        <h3 className="text-lg md:text-2xl font-bold leading-tight max-w-sm">Le marketplace médical de référence en Belgique</h3>
      </div>
      {count > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40"><ChevronLeft size={18} /></button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/40"><ChevronRight size={18} /></button>
        </>
      )}
      {count > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
          {staticImages.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-5" : "bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
