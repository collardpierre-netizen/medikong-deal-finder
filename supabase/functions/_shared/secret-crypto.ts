// AES-GCM encryption helper for storing third-party API credentials at rest.
// Key is provided via env (SENDCLOUD_ENC_KEY): 64 hex chars (256 bits) or any
// string ≥ 32 chars (we derive 32 bytes via SHA-256 of UTF-8).
// Ciphertext format (base64-url-safe): version("v1") + "." + iv(12B) + cipher

async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(rawKey);
  // If looks like 64 hex chars, decode as raw bytes; else SHA-256 derive.
  let bytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(rawKey.slice(i * 2, i * 2 + 2), 16);
  } else {
    const digest = await crypto.subtle.digest("SHA-256", enc);
    bytes = new Uint8Array(digest);
  }
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plaintext: string, rawKey: string): Promise<string> {
  if (!rawKey) throw new Error("encryption key not configured");
  const key = await deriveKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphered = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  return `v1.${b64encode(iv)}.${b64encode(ciphered)}`;
}

export async function decryptSecret(payload: string, rawKey: string): Promise<string> {
  if (!rawKey) throw new Error("encryption key not configured");
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("invalid ciphertext format");
  const iv = b64decode(parts[1]);
  const data = b64decode(parts[2]);
  const key = await deriveKey(rawKey);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data),
  );
  return new TextDecoder().decode(plain);
}
