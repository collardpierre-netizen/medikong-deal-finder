// @ts-nocheck — Deno runtime
// Verrous d'idempotence courts, partagés par les fonctions d'émission /
// d'envoi de factures. Empêchent qu'une même facture soit réémise ou
// renvoyée deux fois quand un retry, un webhook ou un marquage « payée »
// se répète (ou se déclenche en parallèle).

export const IDEMPOTENCY_TTL = {
  invoicePeppol: 600, // 10 min : un envoi Falco ne dure jamais aussi longtemps
  orderInvoices: 900, // 15 min : émission complète d'une commande
} as const;

export const peppolInvoiceLockKey = (invoiceId: string) => `peppol:invoice:${invoiceId}`;
export const orderInvoicesLockKey = (orderId: string) => `order-invoices:${orderId}`;

/** true = verrou obtenu (on peut agir). false = un autre traitement est déjà en cours. */
export async function acquireLock(
  supabase: any,
  key: string,
  ttlSeconds: number,
  holder: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("try_acquire_idempotency_lock", {
      _key: key,
      _ttl_seconds: ttlSeconds,
      _holder: holder,
    });
    if (error) {
      console.error("[idempotency] acquire failed", key, error.message);
      // En cas d'indisponibilité du verrou, on ne bloque pas le métier.
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[idempotency] acquire exception", key, e);
    return true;
  }
}

export async function releaseLock(supabase: any, key: string): Promise<void> {
  try {
    await supabase.rpc("release_idempotency_lock", { _key: key });
  } catch (e) {
    console.error("[idempotency] release exception", key, e);
  }
}
