import { supabase } from "@/integrations/supabase/client";
import { contractLogger } from "@/lib/contract/contract-logger";

/**
 * Bucket privé des conventions vendeur. RLS :
 *  - Vendeur : lit/écrit uniquement son dossier `{vendor_id}/...`
 *  - Admin   : lit tout, peut supprimer
 *  - Personne ne peut UPDATE (immuabilité légale)
 *
 * Le nom du bucket et la TTL des liens signés sont VERROUILLÉS ici et
 * dans `supabase/functions/_shared/contract-env.ts`. Toute modification doit
 * être faite simultanément aux deux endroits (et accompagnée d'une migration
 * si on renomme le bucket).
 */
export const SELLER_CONTRACTS_BUCKET = "seller-contracts";

/**
 * Durée de vie courte des liens signés (rotation forcée).
 * Doit rester alignée avec `SIGNED_URL_TTL_SECONDS` côté edge function pour
 * que l'expérience utilisateur soit cohérente entre l'aperçu post-signature
 * et les téléchargements ultérieurs.
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
  const start = performance.now();
  const { data, error } = await supabase.storage
    .from(SELLER_CONTRACTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds, { download: true });
  if (error) {
    contractLogger.error({
      stage: "sign_url",
      message: "createSignedUrl failed",
      durationMs: Math.round(performance.now() - start),
      context: { storagePath, ttlSeconds },
      error,
    });
    return null;
  }
  contractLogger.debug({
    stage: "sign_url",
    message: "createSignedUrl ok",
    durationMs: Math.round(performance.now() - start),
    context: { storagePath, ttlSeconds },
  });
  return data?.signedUrl ?? null;
}

/**
 * Récupère puis ouvre le PDF dans un nouvel onglet avec un lien fraichement signé.
 * À utiliser depuis n'importe quel CTA "Télécharger / Consulter" pour garantir
 * que les anciens liens ne fuitent pas.
 */
export async function openContractPdf(storagePath: string | null | undefined): Promise<boolean> {
  if (!storagePath) {
    contractLogger.warn({
      stage: "download_signed_pdf",
      message: "openContractPdf called without storagePath",
    });
    return false;
  }
  const url = await getContractSignedUrl(storagePath);
  if (!url) {
    contractLogger.error({
      stage: "download_signed_pdf",
      message: "openContractPdf: no URL returned",
      context: { storagePath },
    });
    return false;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  contractLogger.info({
    stage: "download_signed_pdf",
    message: "openContractPdf opened new tab",
    context: { storagePath },
  });
  return true;
}

