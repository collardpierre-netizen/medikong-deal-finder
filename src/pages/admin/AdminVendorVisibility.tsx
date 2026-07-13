import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Eye, EyeOff, Plus, ShoppingCart, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  resolveVendorLabel,
  type VendorVisibilityRule,
} from "@/lib/vendor-display";

const COUNTRIES: { code: string; label: string }[] = [
  { code: "BE", label: "Belgique" },
  { code: "FR", label: "France" },
  { code: "LU", label: "Luxembourg" },
  { code: "NL", label: "Pays-Bas" },
];

const ANY = "__any__";

type VendorRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  display_code: string | null;
  show_real_name: boolean | null;
};

type BuyerProfile = { id: string; label: string };

export default function AdminVendorVisibility() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    country_code: ANY,
    customer_type: ANY,
    show_real_name: true,
    priority: 10,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vv-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, display_code, show_real_name")
        .order("company_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as VendorRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-vv-buyer-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyer_profiles")
        .select("id, label")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as BuyerProfile[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["admin-vv-rules", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_visibility_rules" as any)
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data || []) as any[] as (VendorVisibilityRule & {
        id: string;
      })[];
    },
  });

  const vendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) || null,
    [vendors, vendorId]
  );

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-vv-rules", vendorId] });

  const addRule = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const payload = {
        vendor_id: vendorId,
        country_code: draft.country_code === ANY ? null : draft.country_code,
        customer_type:
          draft.customer_type === ANY ? null : draft.customer_type,
        show_real_name: draft.show_real_name,
        priority: draft.priority,
      };
      const { error } = await supabase
        .from("vendor_visibility_rules" as any)
        .insert(payload as any);
      if (error) throw error;
      toast.success("Règle ajoutée");
      setDraft({
        country_code: ANY,
        customer_type: ANY,
        show_real_name: true,
        priority: 10,
      });
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const updateRule = async (
    ruleId: string,
    patch: Partial<VendorVisibilityRule>
  ) => {
    const { error } = await supabase
      .from("vendor_visibility_rules" as any)
      .update(patch as any)
      .eq("id", ruleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  };

  const deleteRule = async (ruleId: string) => {
    const { error } = await supabase
      .from("vendor_visibility_rules" as any)
      .delete()
      .eq("id", ruleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Règle supprimée");
    invalidate();
  };

  const previewInput = vendor
    ? {
        id: vendor.id,
        name: vendor.name || "",
        company_name: vendor.company_name || "",
        display_code: vendor.display_code || "",
        show_real_name: !!vendor.show_real_name,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Anonymisation vendeurs</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les règles CMS <code>vendor_visibility_rules</code> qui décident
          si le vrai nom du vendeur est affiché ou remplacé par « Fournisseur
          &lt;code&gt; » sur les surfaces publiques.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendeur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label>Sélectionner un vendeur</Label>
              <Select
                value={vendorId ?? ""}
                onValueChange={(v) => setVendorId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un vendeur…" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.company_name || v.name} · {v.display_code || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vendor && (
              <div className="text-xs text-muted-foreground">
                Défaut vendeur:{" "}
                <Badge variant={vendor.show_real_name ? "default" : "secondary"}>
                  {vendor.show_real_name ? "Nom réel" : "Anonymisé"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {vendor && previewInput && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Règles existantes</CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune règle — le défaut vendeur s'applique partout.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pays</TableHead>
                      <TableHead>Profil acheteur</TableHead>
                      <TableHead>Visibilité</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.country_code || (
                            <span className="text-muted-foreground">Tous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.customer_type ? (
                            profiles.find((p) => p.id === r.customer_type)
                              ?.label || r.customer_type
                          ) : (
                            <span className="text-muted-foreground">Tous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={r.show_real_name}
                              onCheckedChange={(v) =>
                                updateRule(r.id, { show_real_name: v })
                              }
                            />
                            {r.show_real_name ? (
                              <span className="text-xs inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" /> Nom réel
                              </span>
                            ) : (
                              <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                                <EyeOff className="h-3 w-3" /> Anonymisé
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            value={r.priority}
                            onChange={(e) =>
                              updateRule(r.id, {
                                priority: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteRule(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ajouter une règle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <Label>Pays</Label>
                  <Select
                    value={draft.country_code}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, country_code: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Tous</SelectItem>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Profil acheteur</Label>
                  <Select
                    value={draft.customer_type}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, customer_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Tous</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priorité</Label>
                  <Input
                    type="number"
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        priority: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={draft.show_real_name}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({ ...d, show_real_name: v }))
                    }
                  />
                  <span className="text-sm">
                    {draft.show_real_name ? "Nom réel" : "Anonymisé"}
                  </span>
                </div>
                <Button onClick={addRule} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Aperçu temps réel — matrice (pays × profil)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pays / Profil</TableHead>
                      {profiles.map((p) => (
                        <TableHead key={p.id}>{p.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COUNTRIES.map((c) => (
                      <TableRow key={c.code}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        {profiles.map((p) => {
                          const label = resolveVendorLabel(
                            previewInput,
                            rules,
                            { country: c.code, customerType: p.id }
                          );
                          const anonymized = label.startsWith("Fournisseur ");
                          return (
                            <TableCell key={p.id}>
                              <Badge
                                variant={anonymized ? "secondary" : "default"}
                                className="font-normal"
                              >
                                {label}
                              </Badge>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <PreviewShopCard vendor={previewInput} rules={rules} />
                <PreviewCartRow vendor={previewInput} rules={rules} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PreviewShopCard({
  vendor,
  rules,
}: {
  vendor: any;
  rules: VendorVisibilityRule[];
}) {
  const [country, setCountry] = useState("BE");
  const [profile, setProfile] = useState<string>("pharmacie_independante");
  const label = resolveVendorLabel(vendor, rules, {
    country,
    customerType: profile,
  });
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Store className="h-4 w-4" />
        Aperçu carte offre (shop / fiche produit)
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="border rounded-md p-3 bg-background">
        <div className="text-xs text-muted-foreground">Vendu par</div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-2">12,45 € HTVA</div>
      </div>
    </div>
  );
}

function PreviewCartRow({
  vendor,
  rules,
}: {
  vendor: any;
  rules: VendorVisibilityRule[];
}) {
  const [country, setCountry] = useState("BE");
  const [profile, setProfile] = useState<string>("pharmacie_independante");
  const label = resolveVendorLabel(vendor, rules, {
    country,
    customerType: profile,
  });
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <ShoppingCart className="h-4 w-4" />
        Aperçu ligne panier
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="border rounded-md p-3 bg-background flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Produit exemple × 2</div>
          <div className="text-xs text-muted-foreground">Fournisseur : {label}</div>
        </div>
        <div className="text-sm font-medium">24,90 €</div>
      </div>
    </div>
  );
}
