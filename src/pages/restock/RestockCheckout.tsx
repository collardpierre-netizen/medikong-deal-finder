import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Package, Truck, Shield, Lock, Check, ArrowLeft, CreditCard, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import logoHorizontal from "@/assets/logo-medikong.png";

export default function RestockCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const transactionId = params.get("tx");

  // Fetch the pending transaction
  const { data: tx, isLoading } = useQuery({
    queryKey: ["restock-checkout", transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_transactions")
        .select("*, restock_offers(designation, ean, cnk, grade, delivery_condition, product_image_url, seller_city)")
        .eq("id", transactionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch buyer profile if exists
  const { data: buyer } = useQuery({
    queryKey: ["restock-buyer-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_buyers")
        .select("*")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("BE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Prefill from buyer profile
  useEffect(() => {
    if (buyer) {
      setCompany(buyer.pharmacy_name || "");
      setCity(buyer.city || "");
      setPhone(buyer.phone || "");
      setEmail(buyer.email || "");
    }
    if (user?.email) setEmail(user.email);
  }, [buyer, user]);

  const isPickup = tx?.delivery_mode === "pickup";
  const offer = tx?.restock_offers;
  const total = ((tx?.final_price || 0) * (tx?.quantity || 0));
  const shipping = isPickup ? 0 : (tx?.shipping_cost || 0);
  const commission = tx?.commission_amount || 0;
  const grandTotal = total + shipping;

  const isValid = name.trim() && street.trim() && city.trim() && postal.trim() && phone.trim();

  const payMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("restock_transactions")
        .update({
          buyer_name: name,
          buyer_company: company,
          buyer_street: street,
          buyer_city: city,
          buyer_postal_code: postal,
          buyer_country: country,
          buyer_phone: phone,
          buyer_email: email,
          buyer_vat_number: vatNumber || null,
          delivery_notes: notes || null,
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", transactionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-checkout"] });
      setConfirmed(true);
    },
    onError: () => toast.error("Erreur lors du paiement"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={40} />
          <h1 className="text-xl font-bold mb-2">Transaction introuvable</h1>
          <p className="text-sm text-muted-foreground mb-4">Cette transaction n'existe pas ou a déjà été traitée.</p>
          <Link to="/restock/opportunities">
            <Button>Retour aux opportunités</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (confirmed || tx.status === "paid") {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Paiement confirmé !</h1>
          <p className="text-sm text-muted-foreground mb-2">
            {offer?.designation} — {tx.quantity} unités
          </p>
          <p className="text-lg font-bold text-emerald-600 mb-4">{grandTotal.toFixed(2)} € TTC</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-left">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                Vos fonds sont en escrow sécurisé. Le vendeur recevra votre adresse pour préparer l'envoi. 
                Vous disposez de 48h après livraison pour signaler un problème.
              </p>
            </div>
          </div>

          {isPickup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">Adresse d'enlèvement</p>
                  <p className="text-xs text-amber-700">
                    {offer?.seller_city || "Adresse communiquée par le vendeur sous 24h"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full mb-3" onClick={() => navigate("/restock/buyer/dashboard")}>
            Voir mes achats
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/restock/opportunities")}>
            Continuer mes achats
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/restock/opportunities" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <img src={logoHorizontal} alt="MediKong" className="h-7" />
          <span className="text-emerald-600 font-bold text-sm">ReStock — Checkout</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
        {/* Left: Form */}
        <div className="space-y-5">
          {/* Delivery mode info */}
          {isPickup ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Mode : Enlèvement sur place</span>
              </div>
              <p className="text-xs text-amber-700">
                L'adresse exacte du vendeur vous sera communiquée après paiement. 
                Ville : <strong>{offer?.seller_city || "—"}</strong>
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Mode : Livraison</span>
              </div>
              <p className="text-xs text-blue-700">
                Le vendeur préparera votre colis. Frais de port : {shipping.toFixed(2)} €
              </p>
            </div>
          )}

          {/* Shipping address */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-foreground" />
              <span className="text-sm font-semibold">{isPickup ? "Vos coordonnées" : "Adresse de livraison"}</span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom complet *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Sophie Claessens" />
                </div>
                <div>
                  <Label className="text-xs">Pharmacie / Entreprise</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Pharmacie du Centre" />
                </div>
              </div>
              {!isPickup && (
                <>
                  <div>
                    <Label className="text-xs">Rue + numéro *</Label>
                    <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rue de la Loi 42" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Code postal *</Label>
                      <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="1000" />
                    </div>
                    <div>
                      <Label className="text-xs">Ville *</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bruxelles" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Pays</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BE">Belgique</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="NL">Pays-Bas</SelectItem>
                        <SelectItem value="LU">Luxembourg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Téléphone *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 123 456" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sophie@pharmacie.be" />
                </div>
              </div>
              <div>
                <Label className="text-xs">N° TVA (optionnel)</Label>
                <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="BE0123456789" />
              </div>
              <div>
                <Label className="text-xs">Notes de livraison (optionnel)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Horaires de réception, instructions spéciales..." rows={2} />
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <Shield size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-800 mb-1">Paiement sécurisé — Escrow MediKong</p>
              <p className="text-xs text-emerald-700">
                Vos fonds sont bloqués en escrow et ne sont libérés au vendeur qu'après livraison confirmée + 48h sans litige. 
                MediKong ne stocke jamais vos données bancaires.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="bg-white border border-border rounded-xl p-5 sticky top-4">
            <h3 className="text-sm font-semibold mb-4">Résumé de la commande</h3>
            
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                <Package size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{offer?.designation || "Produit"}</p>
                {offer?.ean && <p className="text-[10px] text-muted-foreground">EAN {offer.ean}</p>}
                {offer?.grade && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Grade {offer.grade}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{tx.quantity} × {(tx.final_price || 0).toFixed(2)} €</span>
                <span>{total.toFixed(2)} €</span>
              </div>
              {!isPickup && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Livraison</span>
                  <span>{shipping.toFixed(2)} €</span>
                </div>
              )}
              {isPickup && (
                <div className="flex justify-between text-emerald-600">
                  <span>Enlèvement</span>
                  <span className="font-medium">Gratuit</span>
                </div>
              )}
            </div>

            <div className="border-t mt-3 pt-3 flex justify-between text-base font-bold">
              <span>Total HT</span>
              <span>{grandTotal.toFixed(2)} €</span>
            </div>

            <Button
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={!isValid || payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              <Lock size={14} />
              {payMutation.isPending ? "Traitement…" : `Payer ${grandTotal.toFixed(2)} €`}
            </Button>

            <p className="text-[10px] text-muted-foreground text-center mt-3">
              En confirmant, vous acceptez les CGV ReStock et la politique de retour (48h après livraison).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
