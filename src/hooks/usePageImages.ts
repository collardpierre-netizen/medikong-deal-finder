import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageImage {
  page_key: string;
  section_key: string;
  image_url: string;
  alt_text: string;
}

export function usePageImages(pageKey: string) {
  const { data: images = [] } = useQuery<PageImage[]>({
    queryKey: ["cms-page-images", pageKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cms_page_images")
        .select("page_key, section_key, image_url, alt_text")
        .eq("page_key", pageKey);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const getImage = (sectionKey: string) =>
    images.find((i) => i.section_key === sectionKey);

  return { images, getImage };
}
