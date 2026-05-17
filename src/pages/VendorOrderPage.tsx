import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import logoHorizontal from "@/assets/logo-medikong.png";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type VendorLineStatus = "pending" | "processing" | "forwarded" | "shipped" | "delivered" | "cancelled" | string;
type VendorLineAction = "confirm" | "ship" | "deliver";

interface VendorOrderLine {
  id: string;
  product_name: string;
  gtin?: string | null;
  sku?: string | null;
  image_url?: string | null;
  quantity: number;
  unit_price_excl_vat: number;
  unit_price_incl_vat?: number;
  line_total_excl_vat: number;
  line_total_incl_vat?: number;
  fulfillment_status: VendorLineStatus;
  tracking_number?: string | null;
  tracking_url?: string | null;
}

interface VendorOrderData {
  order_number: string;
  order_date?: string | null;
  payment_status?: string | null;
  status?: string | null;
  vendor_id?: string;
  vendor_name: string;
  shipping_address?: unknown;
  totals?: {
    subtotal_excl_vat?: number | null;
    subtotal_incl_vat?: number | null;
    commission_rate?: number | null;
    commission_amount?: number | null;
    vendor_net_excl_vat?: number | null;
  };
  lines: VendorOrderLine[];
}

class VendorOrderPageError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const errorMessages: Record<number, string> = {
  404: "Lien invalide. Contactez support@medikong.pro",
  410: "Lien expiré. Demandez un nouveau lien à support@medikong.pro",
  409: "Commande non finalisée",
};

// Mapping par code d'erreur applicatif renvoyé dans le JSON body { error: "..." }
const errorCodeMessages: Record<string, string> = {
  not_found: "Lien invalide. Cette commande n'existe pas ou n'est plus accessible.",
  invalid_token: "Lien invalide. Contactez support@medikong.pro",
  token_expired: "Lien expiré. Demandez un nouveau lien à support@medikong.pro",
  order_not_paid: "Commande non finalisée — le paiement n'a pas encore été confirmé.",
  forbidden: "Action non autorisée pour cette commande.",
  missing_params: "Paramètres manquants dans la requête.",
  invalid_action: "Action inconnue.",
  tracking_number_required: "Numéro de suivi requis pour marquer comme expédié.",
  invalid_transition: "Transition de statut invalide : cette action n'est pas possible depuis le statut actuel.",
};

function resolveErrorMessage(err: VendorOrderPageError): string {
  if (err.code && errorCodeMessages[err.code]) return errorCodeMessages[err.code];
  if (errorMessages[err.status]) return errorMessages[err.status];
  return err.message || "Une erreur est survenue.";
}

async function parseFunctionError(error: unknown): Promise<VendorOrderPageError> {
  const fallback = error instanceof Error ? error.message : "Erreur inconnue";
  const response = (error as { context?: { response?: Response } })?.context?.response;

  if (!response) return new VendorOrderPageError(500, fallback);

  try {
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    const code = typeof payload?.error === "string" ? payload.error : null;
    return new VendorOrderPageError(response.status, code || payload?.message || fallback, code);
  } catch {
    return new VendorOrderPageError(response.status, fallback);
  }
}

const statusLabels: Record<string, string> = {
  pending: "À préparer",
  processing: "En préparation",
  forwarded: "Transféré",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

function formatMoney(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatAddress(address: unknown): string[] {
  if (!address) return ["—"];
  if (typeof address === "string") return [address];
  if (typeof address !== "object") return ["—"];

  const addr = address as Record<string, unknown>;
  const cityLine = [addr.postal_code, addr.zip, addr.city].filter(Boolean).join(" ");
  return [
    addr.full_name || addr.name,
    addr.company || addr.company_name,
    addr.line1 || addr.street || addr.address_line1,
    addr.line2 || addr.address_line2,
    cityLine,
    addr.country,
  ]
    .filter(Boolean)
    .map(String);
}

function normalizeOrderPayload(data: unknown): VendorOrderData {
  const payload = ((data as { order?: unknown })?.order ?? data) as VendorOrderData;
  return { ...payload, lines: payload.lines ?? [] };
}

export default function VendorOrderPage() {
  const { order_number } = useParams<{ order_number: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [order, setOrder] = useState<VendorOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<{ status: number; code: string | null; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [cancelTarget, setCancelTarget] = useState<VendorOrderLine | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [partialTarget, setPartialTarget] = useState<VendorOrderLine | null>(null);
  const [partialQuantity, setPartialQuantity] = useState<string>("");
  const [partialReason, setPartialReason] = useState("");
  const [partialLoading, setPartialLoading] = useState(false);

  const loadOrder = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setLoadError(null);
      setActionError(null);
    }

    if (!order_number || !token) {
      setLoadError({ status: 404, code: "not_found", message: "missing_params" });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("get-vendor-order", {
      body: { order_number, token },
    });

    if (error) {
      const parsedError = await parseFunctionError(error);
      if (silent) {
        toast.error("Impossible d'actualiser la commande", { description: resolveErrorMessage(parsedError) });
      } else {
        setLoadError({ status: parsedError.status, code: parsedError.code, message: parsedError.message });
        setOrder(null);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nextOrder = normalizeOrderPayload(data);
    setOrder(nextOrder);
    setTrackingNumbers(
      Object.fromEntries(nextOrder.lines.map((line) => [line.id, line.tracking_number || ""])),
    );
    setLoading(false);
    setRefreshing(false);
  }, [order_number, token]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const addressLines = useMemo(() => formatAddress(order?.shipping_address), [order?.shipping_address]);

  const handleLineAction = async (lineId: string, action: VendorLineAction, trackingNumber?: string) => {
    setActionError(null);
    setActionLoading(`${lineId}:${action}`);

    const actionLabels: Record<VendorLineAction, { pending: string; success: string; error: string }> = {
      confirm: { pending: "Confirmation en cours…", success: "Ligne confirmée", error: "Échec de la confirmation" },
      ship: { pending: "Expédition en cours…", success: "Ligne marquée expédiée", error: "Échec de l'expédition" },
      deliver: { pending: "Mise à jour en cours…", success: "Ligne marquée livrée", error: "Échec de la mise à jour" },
      
    };
    const labels = actionLabels[action];
    const productName = order?.lines.find((l) => l.id === lineId)?.product_name;
    const toastId = toast.loading(labels.pending, { description: productName });

    const body: { token: string; line_id: string; action: VendorLineAction; tracking_number?: string } = {
      token,
      line_id: lineId,
      action,
    };
    if (trackingNumber) body.tracking_number = trackingNumber;

    const { error } = await supabase.functions.invoke("update-vendor-order-line", { body });

    if (error) {
      const parsedError = await parseFunctionError(error);
      const message = resolveErrorMessage(parsedError);
      setActionError(message);
      toast.error(labels.error, { id: toastId, description: message });
      setActionLoading(null);
      return;
    }

    toast.success(labels.success, { id: toastId, description: productName });
    await loadOrder({ silent: true });
    setActionLoading(null);
  };

  const handleCancelLine = async () => {
    if (!cancelTarget) return;
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      toast.error("Motif requis", { description: "Merci d'expliquer la raison de l'annulation." });
      return;
    }
    setCancelLoading(true);
    const productName = cancelTarget.product_name;
    const toastId = toast.loading("Annulation en cours…", { description: productName });

    const { error } = await supabase.functions.invoke("refund-order-line", {
      body: { token, line_id: cancelTarget.id, action: "cancel", reason: trimmedReason },
    });

    if (error) {
      const parsedError = await parseFunctionError(error);
      const message = resolveErrorMessage(parsedError);
      toast.error("Échec de l'annulation", { id: toastId, description: message });
      setCancelLoading(false);
      return;
    }

    toast.success("Ligne annulée et remboursée", { id: toastId, description: productName });
    setCancelTarget(null);
    setCancelReason("");
    setCancelLoading(false);
    await loadOrder({ silent: true });
  };

  const handlePartialRefund = async () => {
    if (!partialTarget) return;
    const trimmedReason = partialReason.trim();
    const qty = Number.parseInt(partialQuantity, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty >= partialTarget.quantity) {
      toast.error("Quantité invalide", {
        description: `Indiquez une quantité entière entre 1 et ${partialTarget.quantity - 1}.`,
      });
      return;
    }
    if (!trimmedReason) {
      toast.error("Motif requis", { description: "Merci d'expliquer la raison du remboursement partiel." });
      return;
    }
    setPartialLoading(true);
    const productName = partialTarget.product_name;
    const toastId = toast.loading("Remboursement partiel en cours…", { description: productName });

    const { error } = await supabase.functions.invoke("refund-order-line", {
      body: {
        token,
        line_id: partialTarget.id,
        action: "partial",
        quantity_to_refund: qty,
        reason: trimmedReason,
      },
    });

    if (error) {
      const parsedError = await parseFunctionError(error);
      const message = resolveErrorMessage(parsedError);
      toast.error("Échec du remboursement partiel", { id: toastId, description: message });
      setPartialLoading(false);
      return;
    }

    toast.success("Remboursement partiel effectué", { id: toastId, description: productName });
    setPartialTarget(null);
    setPartialQuantity("");
    setPartialReason("");
    setPartialLoading(false);
    await loadOrder({ silent: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
          <img src={logoHorizontal} alt="MediKong" className="h-14 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && loadError && (
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle>Commande indisponible</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{resolveErrorMessage(new VendorOrderPageError(loadError.status, loadError.message, loadError.code)) || "Impossible de charger cette commande. Contactez support@medikong.pro"}</p>
              {loadError.code && <p className="text-xs text-muted-foreground/70">Code : <code className="font-mono">{loadError.code}</code></p>}
              <Button asChild>
                <a href="mailto:support@medikong.pro">Contacter le support</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && order && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Espace fournisseur — {order.vendor_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Commande {order.order_number}</p>
              </div>
              {refreshing && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Mise à jour…</span>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Commande</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">N° commande</span>
                    <span className="font-semibold">{order.order_number}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-semibold">{formatDate(order.order_date)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Paiement</span>
                    <Badge variant="outline">{order.payment_status || "paid"}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Adresse livraison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {addressLines.map((line, index) => (
                    <div key={`${line}-${index}`}>{line}</div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Totaux vendor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Brut HT</span>
                    <span className="font-semibold">{formatMoney(order.totals?.subtotal_excl_vat)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Commission</span>
                    <span className="font-semibold">{formatMoney(order.totals?.commission_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-3">
                    <span className="text-muted-foreground">Net HT</span>
                    <span className="font-bold">{formatMoney(order.totals?.vendor_net_excl_vat)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Articles</CardTitle>
              </CardHeader>
              <CardContent>
                {actionError && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</div>}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Prix unit. HT</TableHead>
                      <TableHead>Total HT</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lines.map((line) => {
                      const status = line.fulfillment_status;
                      const trackingValue = trackingNumbers[line.id] || "";

                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {line.image_url && <img src={line.image_url} alt={line.product_name} className="h-12 w-12 rounded-md border border-border object-contain" />}
                              <div>
                                <div className="font-semibold">{line.product_name}</div>
                                <div className="text-xs text-muted-foreground">{line.gtin || line.sku || "—"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{line.quantity}</TableCell>
                          <TableCell>{formatMoney(line.unit_price_excl_vat)}</TableCell>
                          <TableCell>{formatMoney(line.line_total_excl_vat)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{statusLabels[status] || status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-2">
                              {status === "pending" && (
                                <Button size="sm" onClick={() => handleLineAction(line.id, "confirm")} disabled={actionLoading === `${line.id}:confirm`}>
                                  {actionLoading === `${line.id}:confirm` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Confirmer prise en charge
                                </Button>
                              )}
                              {status === "processing" && (
                                <div className="flex min-w-64 items-center gap-2">
                                  <Input
                                    value={trackingValue}
                                    onChange={(event) => setTrackingNumbers((prev) => ({ ...prev, [line.id]: event.target.value }))}
                                    placeholder="Tracking number"
                                    className="h-9"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleLineAction(line.id, "ship", trackingValue)}
                                    disabled={!trackingValue.trim() || actionLoading === `${line.id}:ship`}
                                  >
                                    {actionLoading === `${line.id}:ship` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Marquer expédié
                                  </Button>
                                </div>
                              )}
                              {status === "shipped" && (
                                <Button size="sm" onClick={() => handleLineAction(line.id, "deliver")} disabled={actionLoading === `${line.id}:deliver`}>
                                  {actionLoading === `${line.id}:deliver` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Marquer livré
                                </Button>
                              )}
                              {(status === "pending" || status === "processing" || status === "shipped") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setCancelTarget(line);
                                    setCancelReason("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              )}
                              {!["pending", "processing", "shipped"].includes(status) && <span className="text-sm text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog
          open={cancelTarget !== null}
          onOpenChange={(open) => {
            if (!open && !cancelLoading) {
              setCancelTarget(null);
              setCancelReason("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annuler cette ligne ?</DialogTitle>
              <DialogDescription>
                {cancelTarget
                  ? `Vous êtes sur le point d'annuler « ${cancelTarget.product_name} » (qté ${cancelTarget.quantity}). Un remboursement Stripe sera émis et l'acheteur sera notifié.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motif de l'annulation</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex. rupture de stock, produit endommagé…"
                rows={4}
                disabled={cancelLoading}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                disabled={cancelLoading}
              >
                Revenir
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleCancelLine}
                disabled={cancelLoading || !cancelReason.trim()}
              >
                {cancelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer l'annulation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}