import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface HeroImage {
  id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
}

export function HeroImageGallery() {
  const { data: images = [] } = useQuery({
    queryKey: ["hero-images"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_hero_images")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as HeroImage[];
    },
  });

  if (images.length === 0) return null;

  // Masonry-style gallery layout
  return (
    <div className="grid grid-cols-2 gap-3 max-w-[480px] mx-auto">
      {images.slice(0, 5).map((img, i) => {
        // Alternating tall/short for masonry feel
        const isTall = i === 0 || i === 3;
        return (
          <motion.div
            key={img.id}
            className={`relative rounded-2xl overflow-hidden shadow-lg ${
              isTall ? "row-span-2" : ""
            } ${i === 4 ? "col-span-2" : ""}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src={img.image_url}
              alt={img.alt_text}
              className={`w-full object-cover ${
                isTall ? "h-[260px]" : i === 4 ? "h-[140px]" : "h-[120px]"
              }`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
