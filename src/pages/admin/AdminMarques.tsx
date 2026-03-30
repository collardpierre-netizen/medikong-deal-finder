import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrands, useManufacturers, useBrandCount } from "@/hooks/useAdminData";
import { BrandFormDialog } from "@/components/admin/BrandFormDialog";
import { exportBrands, importBrands } from "@/lib/xlsx-utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, Package, Plus, Download, Upload, Search } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("fr-BE");

const AdminMarques = () => {
  const qc = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const { data: brandsData = [], isLoading: loadingBrands } = useBrands();
  const { data: manufacturersData = [] } = useManufacturers();

  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<any>(null);
  const [search, setSearch] = useState("");

  const brandFileRef = useRef<HTMLInputElement>(null);

  const selected = brandsData.find(b => b.name === selectedBrand);

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
        <KpiCard icon={Tag} label="Marques actives" value={String(brandsData.length)} evolution={{ value: 2, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Package} label="Produits total" value={fmt(brandsData.reduce((a, b) => a + (b.product_count || 0), 0))} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une marque..." className="pl-9 h-9 text-[12px]" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className={`bg-white rounded-lg border overflow-hidden ${selectedBrand ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
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
                    onClick={() => setSelectedBrand(selectedBrand === b.name ? null : b.name)}
                    style={selectedBrand === b.name ? { backgroundColor: "#EFF6FF" } : {}}>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</TableCell>
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
                      <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={(e) => { e.stopPropagation(); setEditBrand(b); setBrandDialogOpen(true); }}>Éditer</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {selected && (
          <div className="w-[300px] bg-white rounded-lg border p-5 shrink-0" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{selected.name}</h3>
              <Badge variant="outline" className="text-[10px] font-bold">
                {selected.is_featured ? "Featured" : "Standard"}
              </Badge>
            </div>
            <div className="space-y-3 text-[12px] mb-4">
              <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Slug</span><span style={{ color: "#1D2530" }}>{selected.slug}</span></div>
              <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Produits</span><span style={{ color: "#1D2530" }}>{selected.product_count || 0}</span></div>
              <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Statut</span><span style={{ color: selected.is_active ? "#059669" : "#EF4444" }}>{selected.is_active ? "Actif" : "Inactif"}</span></div>
            </div>
            {selected.description && <p className="text-[11px] mb-3" style={{ color: "#616B7C" }}>{selected.description}</p>}
            <Button variant="outline" size="sm" className="w-full mt-4 text-[12px]" onClick={() => { setEditBrand(selected); setBrandDialogOpen(true); }}>Modifier</Button>
          </div>
        )}
      </div>

      <BrandFormDialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen} brand={editBrand} manufacturers={manufacturersData} />
    </div>
  );
};

export default AdminMarques;