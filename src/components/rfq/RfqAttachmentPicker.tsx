import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";

// Mirror du bucket storage `rfq-attachments`.
export const RFQ_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo / fichier
export const RFQ_MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 Mo total (UI guard)
export const RFQ_MAX_FILES = 8;

const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
]);

const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt";

const EXT_FALLBACK_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  txt: "text/plain",
};

function inferMime(f: File): string {
  if (f.type && ALLOWED_MIME.has(f.type)) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_FALLBACK_MIME[ext] ?? f.type ?? "application/octet-stream";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function FileTypeIcon({ mime, className = "h-4 w-4" }: { mime: string; className?: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime === "application/pdf") return <FileText className={className} />;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv")
    return <FileSpreadsheet className={className} />;
  if (mime.includes("word") || mime === "text/plain") return <FileText className={className} />;
  return <FileIcon className={className} />;
}

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  /** Surcharge max par fichier (octets). Défaut : 20 Mo (limite bucket). */
  maxFileSize?: number;
  /** Surcharge max total (octets). Défaut : 50 Mo. */
  maxTotalSize?: number;
  /** Nombre max de fichiers. Défaut : 8. */
  maxFiles?: number;
  /** Style compact (vendeur). */
  compact?: boolean;
}

/**
 * Picker partagé pour les pièces jointes RFQ.
 * - Valide MIME + taille + total
 * - Affiche prévisualisation image + bouton aperçu (image/PDF)
 * - Empêche les doublons (nom + taille)
 */
export default function RfqAttachmentPicker({
  files, onChange,
  maxFileSize = RFQ_MAX_FILE_SIZE,
  maxTotalSize = RFQ_MAX_TOTAL_SIZE,
  maxFiles = RFQ_MAX_FILES,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewKind, setPreviewKind] = useState<"image" | "pdf" | "other">("other");

  // Génère/révoque les blob URLs pour les images
  useEffect(() => {
    const next: Record<string, string> = {};
    files.forEach((f) => {
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (f.type.startsWith("image/")) {
        next[key] = previews[key] ?? URL.createObjectURL(f);
      }
    });
    // Révoque celles qui ne sont plus là
    Object.entries(previews).forEach(([k, url]) => {
      if (!next[k]) URL.revokeObjectURL(url);
    });
    setPreviews(next);
    return () => {
      Object.values(next).forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => `${f.name}-${f.size}-${f.lastModified}`).join("|")]);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const handleAdd = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    const dupKey = (f: File) => `${f.name}|${f.size}`;
    const existingKeys = new Set(files.map(dupKey));

    let runningTotal = totalSize;

    for (const f of arr) {
      if (files.length + accepted.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} fichiers autorisés.`);
        break;
      }
      if (existingKeys.has(dupKey(f))) {
        toast.warning(`Ignoré : « ${f.name} » est déjà ajouté.`);
        continue;
      }
      const mime = inferMime(f);
      if (!ALLOWED_MIME.has(mime)) {
        toast.error(`Type non autorisé : ${f.name}. Formats acceptés : PDF, images, Word, Excel, CSV, TXT.`);
        continue;
      }
      if (f.size === 0) {
        toast.error(`Fichier vide ignoré : ${f.name}.`);
        continue;
      }
      if (f.size > maxFileSize) {
        toast.error(`« ${f.name} » fait ${formatSize(f.size)} (max ${formatSize(maxFileSize)}).`);
        continue;
      }
      if (runningTotal + f.size > maxTotalSize) {
        toast.error(`Total dépassé : max ${formatSize(maxTotalSize)} cumulés.`);
        break;
      }
      runningTotal += f.size;
      existingKeys.add(dupKey(f));
      accepted.push(f);
    }

    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const openPreview = (f: File) => {
    const key = `${f.name}-${f.size}-${f.lastModified}`;
    const mime = inferMime(f);
    if (mime.startsWith("image/")) {
      setPreviewUrl(previews[key] ?? URL.createObjectURL(f));
      setPreviewKind("image");
    } else if (mime === "application/pdf") {
      setPreviewUrl(URL.createObjectURL(f));
      setPreviewKind("pdf");
    } else {
      toast.info("Aperçu indisponible pour ce type — téléchargez le fichier après envoi.");
      return;
    }
    setPreviewName(f.name);
  };

  const closePreview = () => {
    if (previewUrl && previewKind === "pdf") URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName("");
  };

  const remaining = maxFiles - files.length;
  const overTotal = totalSize > maxTotalSize;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleAdd(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer?.files?.length) handleAdd(e.dataTransfer.files);
        }}
        className={`flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] ${compact ? "px-3 py-2" : "px-3 py-3"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Upload className="h-4 w-4 text-[#1C58D9] shrink-0" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={remaining <= 0}
              className="text-[12px] font-medium text-[#1C58D9] hover:underline disabled:opacity-50"
            >
              Ajouter un fichier
            </button>
            <span className="text-[11px] text-[#8B95A5] ml-1">ou glissez-déposez</span>
            <p className="text-[10px] text-[#8B95A5] mt-0.5 truncate">
              PDF, images, Word, Excel, CSV — max {formatSize(maxFileSize)}/fichier · {maxFiles} max
            </p>
          </div>
        </div>
        <div className="text-[10px] text-[#8B95A5] text-right shrink-0">
          <div>{files.length}/{maxFiles}</div>
          <div className={overTotal ? "text-red-600 font-semibold" : ""}>
            {formatSize(totalSize)} / {formatSize(maxTotalSize)}
          </div>
        </div>
      </div>

      {overTotal && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="h-3 w-3" /> Taille totale dépassée — retirez un fichier avant d'envoyer.
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => {
            const key = `${f.name}-${f.size}-${f.lastModified}`;
            const mime = inferMime(f);
            const isImg = mime.startsWith("image/");
            const isPdf = mime === "application/pdf";
            return (
              <li key={i} className="flex items-center gap-2 bg-white border border-[#E2E8F0] px-2 py-1.5 rounded">
                {isImg && previews[key] ? (
                  <img src={previews[key]} alt={f.name} className="h-8 w-8 object-cover rounded shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded bg-[#F1F5F9] flex items-center justify-center shrink-0 text-[#475569]">
                    <FileTypeIcon mime={mime} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#1D2530] truncate">{f.name}</p>
                  <p className="text-[10px] text-[#8B95A5]">{formatSize(f.size)} · {mime.split("/")[1] ?? mime}</p>
                </div>
                {(isImg || isPdf) && (
                  <button
                    type="button"
                    onClick={() => openPreview(f)}
                    className="p-1 rounded hover:bg-[#F1F5F9] text-[#1C58D9]"
                    title="Aperçu"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-1 rounded hover:bg-red-50 text-[#8B95A5] hover:text-red-600"
                  title="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <p className="text-sm font-semibold truncate">{previewName}</p>
              <button onClick={closePreview} className="p-1 rounded hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {previewKind === "image" ? (
              <img src={previewUrl} alt={previewName} className="object-contain max-h-[80vh] mx-auto" />
            ) : (
              <iframe src={previewUrl} title={previewName} className="w-full h-[80vh]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
