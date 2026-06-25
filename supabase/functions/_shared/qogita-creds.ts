// Helpers to read/write Qogita credentials with at-rest AES-GCM encryption.
// Backward compatible: reads plaintext values if no "v1." prefix is found.
import { encryptSecret, decryptSecret } from "./secret-crypto.ts";

const QOGITA_KEY = () => Deno.env.get("QOGITA_ENC_KEY") ?? "";

export async function maybeDecrypt(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("v1.")) {
    const key = QOGITA_KEY();
    if (!key) throw new Error("QOGITA_ENC_KEY not configured");
    return await decryptSecret(value, key);
  }
  return value;
}

export async function encryptPassword(plain: string): Promise<string> {
  const key = QOGITA_KEY();
  if (!key) throw new Error("QOGITA_ENC_KEY not configured");
  return await encryptSecret(plain, key);
}
