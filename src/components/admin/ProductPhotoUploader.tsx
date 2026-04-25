import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, Image as ImageIcon, ImagePlus, AlertTriangle, ShieldCheck } from "lucide-react";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per file
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGES_PER_PRODUCT = 10;

type Mode = "append" | "replace";

interface Props {
  productId: string;
  productSlug?: string | null;
  currentImages?: string[];
  /** Trigger label/element. If omitted, renders a default outlined button. */
  trigger?: React.ReactNode;
  /** React Query keys to invalidate after success */
  invalidateKeys?: (string | string[])[];
}

const sanitize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

export default function ProductPhotoUploader({
  productId,
  productSlug,
  currentImages = [],
  trigger,
  invalidateKeys = [],
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("append");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setProgress(0);
    setMode("append");
  };

  const handlePick = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [];
    const errors: string[] = [];
    Array.from(incoming).forEach((f) => {
      if (!ACCEPTED.includes(f.type)) {
        errors.push(`${f.name} : format non supporté`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name} : trop volumineux (>8 Mo)`);
        return;
      }
      next.push(f);
    });
    if (errors.length > 0) toast.error(errors.slice(0, 3).join("\n"));
    setFiles((prev) => [...prev, ...next].slice(0, MAX_IMAGES_PER_PRODUCT));
  };

  const totalAfter =
    mode === "replace" ? files.length : (currentImages.length + files.length);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("Aucun fichier sélectionné");
      if (totalAfter > MAX_IMAGES_PER_PRODUCT) {
        throw new Error(`Maximum ${MAX_IMAGES_PER_PRODUCT} photos par produit`);
      }

      const slug = sanitize(productSlug || productId);
      const uploaded: string[] = [];
      let done = 0;

      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `${slug}/${ts}-${rand}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (upErr) throw new Error(`Upload "${file.name}" : ${upErr.message}`);

        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push(pub.publicUrl);

        done += 1;
        setProgress(Math.round((done / files.length) * 100));
      }

      const finalImages =
        mode === "replace" ? uploaded : [...currentImages, ...uploaded];

      const { error: dbErr } = await supabase
        .from("products")
        .update({
          image_urls: finalImages,
          image_url: finalImages[0] ?? null,
        })
        .eq("id", productId);
      if (dbErr) throw new Error(`Mise à jour produit : ${dbErr.message}`);

      return { count: uploaded.length, total: finalImages.length };
    },
    onSuccess: (res) => {
      toast.success(`${res.count} photo(s) ajoutée(s) — ${res.total} au total`);
      invalidateKeys.forEach((k) => {
        qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
      });
      qc.invalidateQueries({ queryKey: ["product-detail", productId] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de l'upload"),
  });

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger ?? (
          <Button variant="outline" size="sm">
            <ImagePlus size={14} className="mr-1.5" />
            Ajouter des photos
          </Button>
        )}
      </span>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && uploadMutation.isPending) return;
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={18} /> Ajouter des photos produit
            </DialogTitle>
            <DialogDescription>
              Sélectionnez plusieurs images d'un coup. Formats acceptés : JPG, PNG, WebP, AVIF — 8 Mo max par fichier.
              Limite de {MAX_IMAGES_PER_PRODUCT} photos par produit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drop / pick zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                handlePick(e.dataTransfer.files);
              }}
              className="cursor-pointer border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors bg-muted/30"
            >
              <ImageIcon size={28} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Glissez-déposez vos images ici</p>
              <p className="text-xs text-muted-foreground">ou cliquez pour parcourir</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                multiple
                className="hidden"
                onChange={(e) => {
                  handlePick(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Selected previews */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{files.length} fichier(s) sélectionné(s)</span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="hover:text-destructive"
                  >
                    Tout retirer
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {files.map((f, i) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div key={i} className="relative aspect-square rounded border bg-muted overflow-hidden group">
                        <img
                          src={url}
                          alt={f.name}
                          className="w-full h-full object-contain"
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <button
                          type="button"
                          aria-label="Retirer"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-background/90 border opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode */}
            <div className="space-y-2">
              <Label className="text-xs">Comportement</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-2 gap-2">
                <Label
                  htmlFor="mode-append"
                  className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "append" ? "border-primary bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value="append" id="mode-append" className="mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold">Ajouter aux existantes</div>
                    <div className="text-[11px] text-muted-foreground">
                      {currentImages.length} déjà en place — total après : {currentImages.length + files.length}
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-replace"
                  className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer ${mode === "replace" ? "border-destructive bg-destructive/5" : ""}`}
                >
                  <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold">Remplacer toutes</div>
                    <div className="text-[11px] text-muted-foreground">
                      Les {currentImages.length} photo(s) actuelle(s) seront détachées du produit.
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Progress */}
            {uploadMutation.isPending && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-[11px] text-muted-foreground text-right">
                  Téléversement… {progress}%
                </p>
              </div>
            )}

            {totalAfter > MAX_IMAGES_PER_PRODUCT && (
              <p className="text-xs text-destructive">
                Trop de photos — la limite est de {MAX_IMAGES_PER_PRODUCT}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={
                files.length === 0 ||
                uploadMutation.isPending ||
                totalAfter > MAX_IMAGES_PER_PRODUCT
              }
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Téléversement…
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-1.5" />
                  Téléverser {files.length > 0 ? `(${files.length})` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
