import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, Loader2 } from "lucide-react";

interface Props {
  orderId: string;
}

/**
 * Génère un lien de paiement Stripe (Payment Link) pour une commande manuelle
 * confirmée et non payée, à partager au client (email, WhatsApp, etc.).
 * Réservé aux admins — l'edge function `stripe-checkout` (action
 * `admin-create-payment-link`) vérifie le rôle côté serveur.
 */
export default function GeneratePaymentLinkButton({ orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "admin-create-payment-link", order_id: orderId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Lien manquant dans la réponse");
      setUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
        toast.success("Lien de paiement généré et copié dans le presse-papiers");
      } catch {
        toast.success("Lien de paiement généré");
      }
    } catch (err: any) {
      console.error("[GeneratePaymentLinkButton] error", err);
      toast.error(err?.message || "Impossible de générer le lien");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={generate}
        disabled={loading}
        className="h-8 gap-1.5 text-xs"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
        {url ? "Régénérer le lien" : "Générer lien de paiement"}
      </Button>
      {url && (
        <div className="flex items-center gap-1.5 text-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[240px]"
            title={url}
          >
            <ExternalLink size={11} /> {url}
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
            title="Copier"
          >
            <Copy size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
