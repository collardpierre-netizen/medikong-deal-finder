import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

let stripePromise: Promise<Stripe | null> | null = null;
let lastError: string | null = null;

export function getStripeLoadError(): string | null {
  return lastError;
}

export function resetStripe(): void {
  stripePromise = null;
  lastError = null;
}

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-stripe-config");
        if (error || !data?.publishableKey) {
          lastError = error?.message || "Clé Stripe indisponible (get-stripe-config)";
          console.error("Failed to load Stripe publishable key", error);
          return null;
        }
        const stripe = await loadStripe(data.publishableKey);
        if (!stripe) {
          lastError = "Stripe.js n'a pas pu se charger (script bloqué par le navigateur ou une extension ?)";
        }
        return stripe;
      } catch (error: any) {
        lastError = error?.message || "Erreur inconnue lors du chargement de Stripe.js";
        console.error("Failed to load Stripe.js", error);
        return null;
      }
    })();
  }
  return stripePromise;
}
