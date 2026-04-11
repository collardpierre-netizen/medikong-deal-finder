import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBrands, useManufacturers, useBrandCount } from "@/hooks/useAdminData";
import { BrandFormDialog } from "@/components/admin/BrandFormDialog";
import { exportBrands, importBrands } from "@/lib/xlsx-utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, Package, Plus, Download, Upload, Search, ExternalLink, Globe } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("fr-BE");

const AdminMarques = () => {
  const qc = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const { data: brandsData = [], isLoading: loadingBrands } = useBrands();
  const { data: manufacturersData = [] } = useManufacturers();
  const { data: totalBrandCount = 0 } = useBrandCount();

  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<any>(null);
  const [search, setSearch] = useState("");

  const brandFileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    toast.info("Import en cours...");
    try {
      const result = await importBrands(file);
      toast.success(`${result.created} marques importée(s)`);
      if (result.errors.length > 0) toast.warning(`${result.errors.length} erreur(s): ${result.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import");
    }
  };

  return (
    <div>
      <AdminTopBar title="Marques" subtitle="Gestion du portefeuille marques"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportBrands()}><Download size={14} className="mr-1" />Export XLSX</Button>
            <Button variant="outline" size="sm" onClick={() => brandFileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
            <input ref={brandFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
            <Button size="sm" onClick={() => { setEditBrand(null); setBrandDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Marque</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <KpiCard icon={Tag} label="Marques actives" value={totalBrandCount.toLocaleString("fr-BE")} evolution={{ value: 2, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Package} label="Produits total" value={fmt(brandsData.reduce((a, b) => a + (b.product_count || 0), 0))} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une marque..." className="pl-9 h-9 text-[12px]" />
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {loadingBrands ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                {["Marque", "Produits", "Featured", "Statut", ""].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {brandsData.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase())).map((b) => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-blue-50/50"
                  onClick={() => setSelectedBrand(b)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {b.logo_url ? <img src={b.logo_url} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded border object-contain bg-white p-0.5" style={{ borderColor: "#E2E8F0" }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Tag size={14} className="text-muted-foreground" />}
                      <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{b.product_count || 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {b.is_featured ? "Featured" : "Standard"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold" style={{
                      backgroundColor: b.is_active ? "#ECFDF5" : "#FEF2F2",
                      color: b.is_active ? "#059669" : "#EF4444",
                      borderColor: "transparent",
                    }}>
                      {b.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={(e) => { e.stopPropagation(); setEditBrand(b); setBrandDialogOpen(true); }}>Éditer</Button>
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 px-1.5" onClick={(e) => { e.stopPropagation(); window.open(`/marque/${b.slug}`, '_blank'); }} title="Page publique">
                        <ExternalLink size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Brand detail popup */}
      <Dialog open={!!selectedBrand} onOpenChange={(open) => { if (!open) setSelectedBrand(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedBrand?.logo_url ? (
                <img src={selectedBrand.logo_url} alt={selectedBrand.name} referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg border object-contain p-1 bg-white" style={{ borderColor: "#E2E8F0" }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-12 h-12 rounded-lg border flex items-center justify-center bg-muted/30" style={{ borderColor: "#E2E8F0" }}>
                  <Tag size={20} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <span className="text-base">{selectedBrand?.name}</span>
                <Badge variant="outline" className="ml-2 text-[10px] font-bold">
                  {selectedBrand?.is_featured ? "Featured" : "Standard"}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedBrand && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Slug</span><span className="font-medium">{selectedBrand.slug}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Produits</span><span className="font-medium">{selectedBrand.product_count || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><span className="font-medium" style={{ color: selectedBrand.is_active ? "#059669" : "#EF4444" }}>{selectedBrand.is_active ? "Actif" : "Inactif"}</span></div>
                {selectedBrand.country_of_origin && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Pays d'origine</span><span className="font-medium">{selectedBrand.country_of_origin}</span></div>
                )}
                {selectedBrand.website_url && (
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Site web</span><a href={selectedBrand.website_url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline flex items-center gap-1 text-[12px]"><Globe size={12} />{selectedBrand.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>
                )}
              </div>

              {selectedBrand.description && (
                <p className="text-[12px] text-muted-foreground bg-muted/30 rounded-lg p-3">{selectedBrand.description}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 text-[12px]" onClick={() => { setEditBrand(selectedBrand); setBrandDialogOpen(true); setSelectedBrand(null); }}>Modifier</Button>
                <Button variant="outline" size="sm" className="text-[12px]" onClick={() => window.open(`/marque/${selectedBrand.slug}`, '_blank')}>
                  <ExternalLink size={13} className="mr-1" />Page publique
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BrandFormDialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen} brand={editBrand} manufacturers={manufacturersData} />
    </div>
  );
};

export default AdminMarques;