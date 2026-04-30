import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Zap } from "lucide-react";

export interface ChallengeContext {
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  offerId: string | null;
  mkPriceHt: number;
  refPriceHt: number;
  refLabel: string; // ex: "Medi-Market" ou "vendeur concurrent" ou "prix pharmacien"
  reason: "vs_external" | "vs_internal" | "vs_pvp" | "negative_margin" | "no_offer";
  deltaPct: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: ChallengeContext | null;
  /** Si true → envoie direct le template figé sans afficher l'éditeur */
  quickSend?: boolean;
  onSent?: () => void;
}

function buildMessage(ctx: ChallengeContext): { title: string; body: string; suggestedPriceHt: number } {
  const suggestedPriceHt = Math.max(0.01, +(ctx.refPriceHt * 0.99).toFixed(2));
  const title = `Votre prix est ${ctx.deltaPct.toFixed(1)}% au-dessus du marché sur ${ctx.productName}`;
  const body =
    `Bonjour,\n\n` +
    `Sur le produit « ${ctx.productName} », votre prix HTVA actuel est de ${ctx.mkPriceHt.toFixed(2)} €.\n` +
    `Le meilleur prix relevé (${ctx.refLabel}) est de ${ctx.refPriceHt.toFixed(2)} € HTVA, soit un écart de ${ctx.deltaPct.toFixed(1)}%.\n\n` +
    `Pour reprendre la première position et maximiser votre visibilité auprès des acheteurs MediKong, ` +
    `nous vous suggérons d'ajuster votre prix HTVA à environ ${suggestedPriceHt.toFixed(2)} €.\n\n` +
    `Vous pouvez modifier votre offre directement depuis votre espace vendeur.\n\n` +
    `Merci,\nL'équipe MediKong`;
  return { title, body, suggestedPriceHt };
}

export default function PriceChallengeModal({ open, onOpenChange, ctx, quickSend, onSent }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!ctx) return null;

  const { title, body } = buildMessage(ctx);
  const finalMessage = (quickSend ? body : message || body).trim();

  async function send() {
    if (!ctx) return;
    setSending(true);
    try {
      const { suggestedPriceHt } = buildMessage(ctx);
      const ctaUrl = `${window.location.origin}/vendor/offers?product=${ctx.productId}`;

      // 1. Créer la notification vendeur
      const { data: notif, error: nerr } = await supabase
        .from("vendor_notifications")
        .insert({
          vendor_id: ctx.vendorId,
          type: "price_challenge",
          title,
          body: finalMessage,
          cta_url: `/vendor/offers?product=${ctx.productId}`,
          payload: {
            product_id: ctx.productId,
            offer_id: ctx.offerId,
            reason: ctx.reason,
            ref_price_ht: ctx.refPriceHt,
            mk_price_ht: ctx.mkPriceHt,
            delta_pct: ctx.deltaPct,
            ref_label: ctx.refLabel,
            suggested_price_ht: suggestedPriceHt,
          },
        })
        .select("id")
        .single();
      if (nerr) throw nerr;

      // 2. Logger le challenge
      const { error: lerr } = await supabase.rpc("admin_log_price_challenge", {
        _vendor_id: ctx.vendorId,
        _product_id: ctx.productId,
        _offer_id: ctx.offerId,
        _reason: ctx.reason,
        _ref_price_ht: ctx.refPriceHt,
        _mk_price_ht: ctx.mkPriceHt,
        _delta_pct: ctx.deltaPct,
        _message: finalMessage,
        _notification_id: notif?.id ?? null,
      });
      if (lerr) throw lerr;

      // 3. Envoyer l'email transactionnel au vendeur (best-effort)
      let emailStatus: "sent" | "skipped" | "failed" = "skipped";
      try {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("email, name, company_name")
          .eq("id", ctx.vendorId)
          .maybeSingle();
        const recipientEmail = vendor?.email ?? null;
        if (recipientEmail) {
          // CNK best-effort
          const { data: prod } = await supabase
            .from("products")
            .select("cnk_code")
            .eq("id", ctx.productId)
            .maybeSingle();

          const { error: eerr } = await supabase.functions.invoke(
            "send-transactional-email",
            {
              body: {
                templateName: "vendor-price-challenge",
                recipientEmail,
                idempotencyKey: `price-challenge-${notif?.id ?? `${ctx.vendorId}-${ctx.productId}-${Date.now()}`}`,
                templateData: {
                  vendorName: vendor?.company_name || vendor?.name || ctx.vendorName,
                  productName: ctx.productName,
                  cnk: (prod as any)?.cnk_code ?? null,
                  mkPriceHt: ctx.mkPriceHt,
                  refPriceHt: ctx.refPriceHt,
                  refLabel: ctx.refLabel,
                  deltaPct: ctx.deltaPct,
                  suggestedPriceHt,
                  reason: ctx.reason,
                  message: finalMessage,
                  ctaUrl,
                },
              },
            },
          );
          emailStatus = eerr ? "failed" : "sent";
        }
      } catch {
        emailStatus = "failed";
      }

      if (emailStatus === "sent") {
        toast.success(`Challenge envoyé à ${ctx.vendorName} (notification + email)`);
      } else if (emailStatus === "failed") {
        toast.warning(`Notification créée pour ${ctx.vendorName}, mais l'email n'a pas pu être envoyé.`);
      } else {
        toast.success(`Challenge envoyé à ${ctx.vendorName} (notification — email vendeur non renseigné)`);
      }
      onOpenChange(false);
      setMessage("");
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  if (quickSend) {
    // Auto-send via effect-style on first render? Non — on ouvre juste avec un seul bouton de confirmation rapide
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-mk-blue" /> Envoi rapide à {ctx.vendorName}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md max-h-64 overflow-auto">
            {body}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Annuler
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Challenger {ctx.vendorName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted p-3 rounded-md">
            <div><strong>Produit :</strong> {ctx.productName}</div>
            <div><strong>Prix MK :</strong> {ctx.mkPriceHt.toFixed(2)} € HT</div>
            <div><strong>Référence ({ctx.refLabel}) :</strong> {ctx.refPriceHt.toFixed(2)} € HT</div>
            <div><strong>Écart :</strong> +{ctx.deltaPct.toFixed(1)}%</div>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              rows={10}
              value={message || body}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Envoyer le challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
