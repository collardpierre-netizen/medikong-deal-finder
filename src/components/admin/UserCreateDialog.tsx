import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Store, ShoppingBag, Shield } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const initialBuyer = {
  company_name: "",
  email: "",
  phone: "",
  vat_number: "",
  address_line1: "",
  city: "",
  postal_code: "",
  country_code: "BE",
  customer_type: "pharmacy" as string,
  price_level: "pharmacien",
};

const initialVendor = {
  company_name: "",
  email: "",
  phone: "",
  vat_number: "",
  address: "",
  commission_rate: "15",
  description: "",
};

const initialAdmin = {
  name: "",
  email: "",
  role: "support" as string,
};

export default function UserCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [tab, setTab] = useState("buyer");
  const [saving, setSaving] = useState(false);
  const [buyer, setBuyer] = useState(initialBuyer);
  const [vendor, setVendor] = useState(initialVendor);
  const [admin, setAdmin] = useState(initialAdmin);

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleCreateBuyer = async () => {
    if (!buyer.company_name || !buyer.email || !buyer.address_line1 || !buyer.city || !buyer.postal_code) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("customers").insert({
        company_name: buyer.company_name.trim(),
        email: buyer.email.trim(),
        phone: buyer.phone || null,
        vat_number: buyer.vat_number || null,
        address_line1: buyer.address_line1.trim(),
        city: buyer.city.trim(),
        postal_code: buyer.postal_code.trim(),
        country_code: buyer.country_code,
        customer_type: buyer.customer_type as any,
        is_professional: true,
        is_verified: true,
      });
      if (error) throw error;
      toast.success(`Client "${buyer.company_name}" créé`);
      setBuyer(initialBuyer);
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVendor = async () => {
    if (!vendor.company_name || !vendor.email) {
      toast.error("Nom et email requis");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vendors").insert({
        name: vendor.company_name.trim(),
        slug: slugify(vendor.company_name),
        company_name: vendor.company_name.trim(),
        email: vendor.email.trim(),
        phone: vendor.phone || null,
        vat_number: vendor.vat_number || null,
        address: vendor.address || null,
        type: "real",
        is_active: true,
        can_manage_offers: true,
        commission_rate: parseFloat(vendor.commission_rate) || 15,
        description: vendor.description || null,
      });
      if (error) throw error;
      toast.success(`Vendeur "${vendor.company_name}" créé`);
      setVendor(initialVendor);
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!admin.name || !admin.email) {
      toast.error("Nom et email requis");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_users").insert({
        name: admin.name.trim(),
        email: admin.email.trim(),
        role: admin.role as any,
        is_active: true,
      });
      if (error) throw error;
      toast.success(`Membre admin "${admin.name}" créé avec le rôle ${admin.role}`);
      setAdmin(initialAdmin);
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Créer un utilisateur</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="buyer" className="text-xs gap-1"><ShoppingBag size={14} /> Client</TabsTrigger>
            <TabsTrigger value="vendor" className="text-xs gap-1"><Store size={14} /> Vendeur</TabsTrigger>
            <TabsTrigger value="admin" className="text-xs gap-1"><Shield size={14} /> Admin</TabsTrigger>
          </TabsList>

          {/* --- BUYER --- */}
          <TabsContent value="buyer" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nom de l'entreprise *</Label>
                <Input value={buyer.company_name} onChange={e => setBuyer({ ...buyer, company_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={buyer.email} onChange={e => setBuyer({ ...buyer, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Téléphone</Label>
                <Input value={buyer.phone} onChange={e => setBuyer({ ...buyer, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Type de client</Label>
                <Select value={buyer.customer_type} onValueChange={v => setBuyer({ ...buyer, customer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pharmacy">Pharmacie</SelectItem>
                    <SelectItem value="hospital">Hôpital</SelectItem>
                    <SelectItem value="wholesaler">Grossiste</SelectItem>
                    <SelectItem value="clinic">Clinique</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Niveau de prix</Label>
                <Select value={buyer.price_level} onValueChange={v => setBuyer({ ...buyer, price_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (TVAC)</SelectItem>
                    <SelectItem value="pharmacien">Pharmacien (HTVA)</SelectItem>
                    <SelectItem value="grossiste">Grossiste (HTVA)</SelectItem>
                    <SelectItem value="hospitalier">Hospitalier (HTVA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">N° TVA</Label>
                <Input value={buyer.vat_number} onChange={e => setBuyer({ ...buyer, vat_number: e.target.value })} placeholder="BE0123456789" />
              </div>
              <div>
                <Label className="text-xs">Pays</Label>
                <Select value={buyer.country_code} onValueChange={v => setBuyer({ ...buyer, country_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BE">Belgique</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="NL">Pays-Bas</SelectItem>
                    <SelectItem value="DE">Allemagne</SelectItem>
                    <SelectItem value="LU">Luxembourg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Adresse *</Label>
                <Input value={buyer.address_line1} onChange={e => setBuyer({ ...buyer, address_line1: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Ville *</Label>
                <Input value={buyer.city} onChange={e => setBuyer({ ...buyer, city: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Code postal *</Label>
                <Input value={buyer.postal_code} onChange={e => setBuyer({ ...buyer, postal_code: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreateBuyer} disabled={saving} className="w-full mt-2">
              {saving ? "Création…" : "Créer le client"}
            </Button>
          </TabsContent>

          {/* --- VENDOR --- */}
          <TabsContent value="vendor" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nom de l'entreprise *</Label>
                <Input value={vendor.company_name} onChange={e => setVendor({ ...vendor, company_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={vendor.email} onChange={e => setVendor({ ...vendor, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Téléphone</Label>
                <Input value={vendor.phone} onChange={e => setVendor({ ...vendor, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">N° TVA</Label>
                <Input value={vendor.vat_number} onChange={e => setVendor({ ...vendor, vat_number: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Commission %</Label>
                <Input type="number" value={vendor.commission_rate} onChange={e => setVendor({ ...vendor, commission_rate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Adresse</Label>
                <Input value={vendor.address} onChange={e => setVendor({ ...vendor, address: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Input value={vendor.description} onChange={e => setVendor({ ...vendor, description: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreateVendor} disabled={saving} className="w-full mt-2">
              {saving ? "Création…" : "Créer le vendeur"}
            </Button>
          </TabsContent>

          {/* --- ADMIN --- */}
          <TabsContent value="admin" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nom complet *</Label>
                <Input value={admin.name} onChange={e => setAdmin({ ...admin, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Rôle</Label>
                <Select value={admin.role} onValueChange={v => setAdmin({ ...admin, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin — Accès total</SelectItem>
                    <SelectItem value="admin">Admin — Tous sauf RBAC</SelectItem>
                    <SelectItem value="moderateur">Modérateur — Produits, vendeurs, CMS</SelectItem>
                    <SelectItem value="support">Support — CRM, commandes, litiges</SelectItem>
                    <SelectItem value="comptable">Comptable — Finances, logs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Note :</strong> Le membre devra se connecter avec cet email via la page <code>/admin/login</code>. Assurez-vous qu'un compte auth existe pour cet email.
              </div>
            </div>
            <Button onClick={handleCreateAdmin} disabled={saving} className="w-full mt-2">
              {saving ? "Création…" : "Créer le membre admin"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
