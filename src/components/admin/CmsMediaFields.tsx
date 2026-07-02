import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";

interface CmsMediaFieldsProps {
  coverImageUrl: string;
  galleryImages: string[];
  onChange: (next: { cover_image_url: string; gallery_images: string[] }) => void;
}

export function CmsMediaFields({ coverImageUrl, galleryImages, onChange }: CmsMediaFieldsProps) {
  const setCover = (v: string) => onChange({ cover_image_url: v, gallery_images: galleryImages });
  const setGallery = (arr: string[]) => onChange({ cover_image_url: coverImageUrl, gallery_images: arr });

  return (
    <div className="space-y-3 border-t pt-3 mt-1">
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <ImageIcon size={13} /> Image de couverture (bannière)
        </Label>
        <Input
          value={coverImageUrl || ""}
          onChange={(e) => setCover(e.target.value)}
          placeholder="https://... (idéalement 1600×400)"
          className="mt-1"
        />
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt="Aperçu couverture"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="mt-2 w-full h-24 rounded object-cover border"
            style={{ borderColor: "#E2E8F0" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <ImageIcon size={13} /> Galerie ({galleryImages.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => setGallery([...galleryImages, ""])}
          >
            <Plus size={12} /> Ajouter
          </Button>
        </div>
        <div className="space-y-1.5">
          {galleryImages.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              {url ? (
                <img
                  src={url}
                  alt=""
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="w-10 h-10 rounded object-cover border shrink-0"
                  style={{ borderColor: "#E2E8F0" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                />
              ) : (
                <div className="w-10 h-10 rounded border shrink-0 bg-muted/30" style={{ borderColor: "#E2E8F0" }} />
              )}
              <Input
                value={url}
                onChange={(e) => {
                  const next = [...galleryImages];
                  next[i] = e.target.value;
                  setGallery(next);
                }}
                placeholder="https://..."
                className="flex-1 h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => setGallery(galleryImages.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {galleryImages.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">
              Aucune image. Collez une URL depuis la bibliothèque média ou un CDN externe.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
