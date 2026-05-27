// Shared helpers to harden edge-function file uploads:
// - In-memory IP rate limiting (best-effort, per instance)
// - File size / MIME validation
// - Magic-byte sniffing for common image / PDF types
// - Safe storage path segments (no traversal, no leading slashes)
//
// NOTE: backend rate limiting is intentionally ad-hoc. The platform does not
// expose proper rate-limiting primitives; this is a best-effort in-process
// throttle per edge instance and per IP, so it can be bypassed by a
// distributed attacker. Use as a first line of defence only.

export type UploadKind = "image" | "pdf" | "image-or-pdf" | "image-pdf-csv";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const PDF_MIME = "application/pdf";
const CSV_MIMES = new Set(["text/csv", "application/vnd.ms-excel"]);

export function allowedMimesFor(kind: UploadKind): Set<string> {
  switch (kind) {
    case "image":
      return new Set(IMAGE_MIMES);
    case "pdf":
      return new Set([PDF_MIME]);
    case "image-or-pdf":
      return new Set([...IMAGE_MIMES, PDF_MIME]);
    case "image-pdf-csv":
      return new Set([...IMAGE_MIMES, PDF_MIME, ...CSV_MIMES]);
  }
}

// Magic-byte sniff. Returns the detected MIME, or null if unknown.
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  // PDF: "%PDF-"
  if (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) return "application/pdf";
  return null;
}

export interface ValidateBytesOptions {
  maxBytes: number;
  kind: UploadKind;
  declaredMime?: string | null;
  /** When true, declared MIME must match the sniffed MIME (default true). */
  enforceSniff?: boolean;
}

export interface ValidateBytesError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface ValidateBytesOk {
  ok: true;
  mime: string;
}

export function validateUploadBytes(
  bytes: Uint8Array,
  opts: ValidateBytesOptions,
): ValidateBytesOk | ValidateBytesError {
  if (bytes.length === 0) {
    return { ok: false, status: 400, code: "empty_file", message: "Fichier vide." };
  }
  if (bytes.length > opts.maxBytes) {
    return {
      ok: false,
      status: 413,
      code: "file_too_large",
      message: `Fichier trop volumineux (max ${Math.round(opts.maxBytes / 1024 / 1024)} Mo).`,
    };
  }
  const allowed = allowedMimesFor(opts.kind);
  const sniffed = sniffMime(bytes);
  const declared = (opts.declaredMime || "").toLowerCase();

  // For CSV we cannot sniff reliably; allow when declared MIME is in the allow-list
  // and the kind permits csv.
  if (opts.kind === "image-pdf-csv" && CSV_MIMES.has(declared)) {
    return { ok: true, mime: declared };
  }

  if (!sniffed) {
    return {
      ok: false,
      status: 400,
      code: "unrecognized_format",
      message: "Format de fichier non reconnu.",
    };
  }
  if (!allowed.has(sniffed)) {
    return {
      ok: false,
      status: 400,
      code: "mime_not_allowed",
      message: `Type ${sniffed} non autorisé.`,
    };
  }
  if (
    opts.enforceSniff !== false &&
    declared &&
    declared !== sniffed &&
    // Accept the common alias image/jpg vs image/jpeg
    !(declared === "image/jpg" && sniffed === "image/jpeg")
  ) {
    return {
      ok: false,
      status: 400,
      code: "mime_mismatch",
      message: `MIME déclaré (${declared}) ne correspond pas au contenu (${sniffed}).`,
    };
  }
  return { ok: true, mime: sniffed };
}

// ===== In-memory rate limit =====

const hitsByKey = new Map<string, number[]>();

export interface RateLimitOptions {
  /** Bucket name to scope counters (e.g. "upload-product-image"). */
  bucket: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max events allowed in the window. */
  max: number;
}

export function rateLimitCheck(
  identity: string,
  opts: RateLimitOptions,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = `${opts.bucket}:${identity}`;
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const previous = hitsByKey.get(key) ?? [];
  const fresh = previous.filter((t) => t > windowStart);
  if (fresh.length >= opts.max) {
    hitsByKey.set(key, fresh);
    const oldest = fresh[0];
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000)) };
  }
  fresh.push(now);
  hitsByKey.set(key, fresh);
  return { ok: true };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// ===== Safe storage paths =====

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Sanitize a single path segment: strip slashes, traversal, control chars. */
export function safeSegment(input: string, maxLen = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\\/]+/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, maxLen) || "file";
}

/** Allowed image / doc extensions; everything else collapsed to a safe default. */
export function safeExtension(ext: string | null | undefined, fallback = "bin"): string {
  if (!ext) return fallback;
  const clean = ext.toLowerCase().replace(/^\./, "").replace(/[^a-z0-9]/g, "");
  const allow = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf", "csv"]);
  return allow.has(clean) ? clean : fallback;
}
