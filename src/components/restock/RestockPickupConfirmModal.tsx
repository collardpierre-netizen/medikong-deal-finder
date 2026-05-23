import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, KeyRound, QrCode, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  transactionId: string | null;
  sellerCode?: string | null;
  sellerQrToken?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirmed?: () => void;
}

export function RestockPickupConfirmModal({
  transactionId,
  sellerCode,
  sellerQrToken,
  open,
  onOpenChange,
  onConfirmed,
}: Props) {
  const [code, setCode] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCode("");
    setQrToken("");
    setLoading(false);
  };

  const submit = async (kind: "code" | "qr") => {
    if (!transactionId) return;
    if (kind === "code" && code.replace(/\s/g, "").length !== 6) {
      toast.error("Le code doit contenir 6 chiffres");
      return;
    }
    if (kind === "qr" && !qrToken) {
      toast.error("Token QR manquant");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("confirm_pickup", {
        _transaction_id: transactionId,
        _code: kind === "code" ? code.replace(/\s/g, "") : null,
        _qr_token: kind === "qr" ? qrToken : null,
      });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success("Retrait confirmé. Escrow en libération.");
        reset();
        onOpenChange(false);
        onConfirmed?.();
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("invalid_credentials")) toast.error("Code / QR invalide");
      else if (msg.includes("rate_limited")) toast.error("Trop de tentatives. Réessayez dans 10 minutes.");
      else if (msg.includes("already_confirmed")) toast.error("Retrait déjà confirmé");
      else if (msg.includes("payment_required")) toast.error("Paiement non finalisé");
      else if (msg.includes("forbidden")) toast.error("Action non autorisée");
      else toast.error(msg || "Erreur lors de la confirmation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-[#1C58D9]" size={20} />
            Valider le retrait
          </DialogTitle>
          <DialogDescription>
            Confirmez le retrait en saisissant le code 6 chiffres de l'acheteur, ou en scannant son QR. Vous pouvez aussi
            lui demander de saisir <strong>votre</strong> code ci-dessous sur son téléphone.
          </DialogDescription>
        </DialogHeader>

        {(sellerCode || sellerQrToken) && (
          <div className="bg-[#EBF0FB]/60 border border-[#1C58D9]/20 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-[#1E252F]">Vos identifiants pour cette commande</p>
            {sellerCode && (
              <p className="text-[#5C6470]">
                Code : <span className="font-mono font-bold text-[#1C58D9] text-base tracking-widest">{sellerCode}</span>
              </p>
            )}
            {sellerQrToken && (
              <p className="text-[#5C6470] break-all">
                Token QR : <span className="font-mono text-[10px]">{sellerQrToken}</span>
              </p>
            )}
          </div>
        )}

        <Tabs defaultValue="code" className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="code" className="gap-1.5">
              <KeyRound size={14} /> Code
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-1.5">
              <QrCode size={14} /> QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-[#5C6470]">Code 6 chiffres de l'acheteur</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123 456"
                inputMode="numeric"
                maxLength={6}
                className="border-[#D0D5DC] rounded-lg text-center text-2xl font-mono tracking-[0.4em] py-3"
              />
            </div>
            <Button
              onClick={() => submit("code")}
              disabled={loading || code.length !== 6}
              className="w-full bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Valider le retrait
            </Button>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-[#5C6470]">Token scanné depuis le QR de l'acheteur</Label>
              <Input
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value.trim())}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="border-[#D0D5DC] rounded-lg font-mono text-xs"
              />
              <p className="text-[10px] text-[#8B929C] mt-1">
                Collez ici le token contenu dans le QR de l'acheteur (un scanner caméra sera ajouté plus tard).
              </p>
            </div>
            <Button
              onClick={() => submit("qr")}
              disabled={loading || !qrToken}
              className="w-full bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Valider le retrait
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
