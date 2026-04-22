import { supabase } from "@/integrations/supabase/client";

/**
 * Bucket privé des conventions vendeur. RLS :
 *  - Vendeur : lit/écrit uniquement son dossier `{vendor_id}/...`
 *  - Admin   : lit tout, peut supprimer
 *  - Personne ne peut UPDATE (immuabilité légale)
 */
export const SELLER_CONTRACTS_BUCKET = "seller-contracts";

/**
 * Durée de vie courte des liens signés (rotation forcée).
 * Le lien doit être régénéré à chaque consultation pour limiter
 * la fenêtre d'exposition en cas de fuite (logs, historique navigateur, email).
 */
export const CONTRACT_SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * Génère une URL signée à courte durée pour télécharger le PDF d'une convention.
 * Renvoie null si le chemin n'est pas accessible (RLS).
 */
export async function getContractSignedUrl(
  storagePath: string,
  ttlSeconds: number = CONTRACT_SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(SELLER_CONTRACTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds, { download: true });
  if (error) {
    console.warn("contract signed url error:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Récupère puis ouvre le PDF dans un nouvel onglet avec un lien fraichement signé.
 * À utiliser depuis n'importe quel CTA "Télécharger / Consulter" pour garantir
 * que les anciens liens ne fuitent pas.
 */
export async function openContractPdf(storagePath: string | null | undefined): Promise<boolean> {
  if (!storagePath) return false;
  const url = await getContractSignedUrl(storagePath);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
