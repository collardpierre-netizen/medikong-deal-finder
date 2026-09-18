import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/vendor/contract/SignatureCanvas";
import { CHECKLIST_ITEMS } from "@/lib/delivery-checklist";
import medikongLogo from "@/assets/medikong-logo-cropped.png";

type PublicLine = {
  delivery_note_line_id: string;
  product_name: string;
  cnk_code: string | null;
  gtin: string | null;
  delivered_quantity: number;
  accepted_quantity: number | null;
};

type PublicNote = {
  delivery_note_id: string;
  document_number: string | null;
  issued_at: string;
  carrier: string | null;
  tracking_number: string | null;
  note: string | null;
  order_number: string | null;
  shipping_address: Record<string, any> | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  client_remarks: string | null;
  lines: PublicLine[];
};

const ERRORS: Record<string, string> = {
  not_found: "Ce lien de signature est invalide ou a expiré.",
  cancelled: "Ce bon de livraison a été annulé.",
  already_confirmed: "Ce bon de livraison a déjà été signé.",
  name_required: "Indiquez le nom de la personne qui réceptionne.",
  signature_too_large: "La signature est trop volumineuse, recommencez.",
};

export default function DeliveryNoteSignaturePage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Record<string, number>>({});
  const [refusalReason, setRefusalReason] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);

  const load = async () => {
    if (!token) {
      setError(ERRORS.not_found);
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcErr } = await supabase.rpc("delivery_note_public_get" as any, { _token: token });
      if (rpcErr) throw rpcErr;
      const d = data as any;
      if (d?.error) {
        setError(ERRORS[d.error] ?? ERRORS.not_found);
      } else {
        const n = d as PublicNote;
        setNote(n);
        setAccepted(
          Object.fromEntries(
            n.lines.map((l) => [l.delivery_note_line_id, l.accepted_quantity ?? l.delivered_quantity]),
          ),
        );
        if (n.confirmed_at) setDone(true);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const allChecked = useMemo(() => CHECKLIST_ITEMS.every((i) => checks[i.key]), [checks]);
  const hasRefusal = useMemo(
    () => (note?.lines ?? []).some((l) => (accepted[l.delivery_note_line_id] ?? l.delivered_quantity) < l.delivered_quantity),
    [note, accepted],
  );
  const canSubmit = name.trim().length >= 2 && !!signature && allChecked && !submitting;

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("confirm-delivery-note", {
        body: {
          token,
          confirmedByName: name.trim(),
          remarks: remarks.trim() || null,
          signatureDataUrl: signature,
          checklist: {
            items: CHECKLIST_ITEMS.map((i) => ({ key: i.key, label: i.label, checked: !!checks[i.key] })),
          },
          lines: (note?.lines ?? []).map((l) => ({
            delivery_note_line_id: l.delivery_note_line_id,
            accepted_quantity: accepted[l.delivery_note_line_id] ?? l.delivered_quantity,
            refusal_reason: refusalReason[l.delivery_note_line_id] || null,
          })),
        },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error(ERRORS[(data as any).error] ?? (data as any).error);
      setDone(true);
      toast.success("Réception signée, merci !");
    } catch (e: any) {
      toast.error(e?.message || "Signature impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Helmet>
        <title>Signature de réception — MediKong</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-4">
        <img src={medikongLogo} alt="MediKong" className="h-8" />

        {loading && (
          <div className="bg-white rounded-lg border p-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement du bon de livraison…
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && note && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-primary" />
                <h1 className="font-semibold text-slate-900">
                  Bon de livraison {note.document_number || ""}
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Commande {note.order_number || "—"} · émis le{" "}
                {new Date(note.issued_at).toLocaleDateString("fr-BE")}
                {note.carrier ? ` · ${note.carrier}` : ""}
                {note.tracking_number ? ` · suivi ${note.tracking_number}` : ""}
              </p>
            </div>

            {done ? (
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-5 h-5" /> Réception signée
                </div>
                <p className="text-sm text-slate-600">
                  Merci. Votre signature a été enregistrée et horodatée
                  {note.confirmed_by_name ? ` au nom de ${note.confirmed_by_name}` : ""}. Notre
                  équipe traite le dossier et débloque le paiement du fournisseur.
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* Quantités reçues */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 mb-2">Quantités reçues</h2>
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Article</th>
                          <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Livré</th>
                          <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Reçu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {note.lines.map((l) => {
                          const acc = accepted[l.delivery_note_line_id] ?? l.delivered_quantity;
                          return (
                            <tr key={l.delivery_note_line_id} className="border-t align-top">
                              <td className="px-3 py-2">
                                <div className="text-slate-800">{l.product_name}</div>
                                {l.cnk_code && (
                                  <div className="text-[11px] text-slate-400 font-mono">CNK {l.cnk_code}</div>
                                )}
                                {acc < l.delivered_quantity && (
                                  <Input
                                    className="mt-2 h-8 text-xs"
                                    placeholder="Motif (manquant, casse…)"
                                    value={refusalReason[l.delivery_note_line_id] ?? ""}
                                    onChange={(e) =>
                                      setRefusalReason((r) => ({ ...r, [l.delivery_note_line_id]: e.target.value }))
                                    }
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{l.delivered_quantity}</td>
                              <td className="px-3 py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  max={l.delivered_quantity}
                                  value={acc}
                                  onChange={(e) => {
                                    const v = Math.max(0, Math.min(Number(e.target.value || 0), l.delivered_quantity));
                                    setAccepted((a) => ({ ...a, [l.delivery_note_line_id]: v }));
                                  }}
                                  className="w-20 h-8 ml-auto text-right"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasRefusal && (
                    <p className="text-xs text-amber-700 mt-2">
                      Un écart est constaté : précisez le motif pour chaque ligne concernée.
                    </p>
                  )}
                </div>

                {/* Checklist */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 mb-2">Checklist de réception</h2>
                  <div className="space-y-2">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label key={item.key} className="flex items-start gap-2 text-sm text-slate-700">
                        <Checkbox
                          checked={!!checks[item.key]}
                          onCheckedChange={(v) => setChecks((c) => ({ ...c, [item.key]: v === true }))}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  {!allChecked && (
                    <p className="text-xs text-slate-500 mt-2">
                      Cochez tous les points de contrôle pour pouvoir signer.
                    </p>
                  )}
                </div>

                {/* Remarques */}
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarques (optionnel)</Label>
                  <Textarea
                    id="remarks"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Colis abîmé, températures, retard…"
                  />
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <Label htmlFor="signer">Nom et fonction du réceptionnaire</Label>
                  <Input
                    id="signer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Marie Dupont, pharmacienne"
                  />
                  <SignatureCanvas onChange={setSignature} />
                </div>

                <Button className="w-full" onClick={submit} disabled={!canSubmit}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Valider et signer la réception
                </Button>
                <p className="text-[11px] text-slate-400 text-center">
                  Votre signature est horodatée par nos serveurs et jointe au bon de livraison.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
