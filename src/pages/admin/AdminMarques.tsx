import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBrands, useManufacturers } from "@/hooks/useAdminData";
import { BrandFormDialog } from "@/components/admin/BrandFormDialog";
import { ManufacturerFormDialog } from "@/components/admin/ManufacturerFormDialog";
import { exportBrands, importBrands } from "@/lib/xlsx-utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, Factory, Package, DollarSign, Shield, Plus, Download, Upload } from "lucide-react";

const tierColors: Record<string, { bg: string; text: string }> = {
  Strategic: { bg: "#FCE7F3", text: "#BE185D" },
  Platinum: { bg: "#EDE9FE", text: "#7C3AED" },
  Gold: { bg: "#FEF9C3", text: "#A16207" },
  Silver: { bg: "#F1F5F9", text: "#475569" },
  Bronze: { bg: "#FEF3C7", text: "#92400E" },
};

const fmt = (n: number) => n.toLocaleString("fr-BE");

const AdminMarques = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("marques");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const { data: brandsData = [], isLoading: loadingBrands } = useBrands();
  const { data: manufacturersData = [], isLoading: loadingMfrs } = useManufacturers();

  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<any>(null);
  const [mfrDialogOpen, setMfrDialogOpen] = useState(false);
  const [editMfr, setEditMfr] = useState<any>(null);

  const brandFileRef = useRef<HTMLInputElement>(null);
  const mfrFileRef = useRef<HTMLInputElement>(null);

  const selected = brandsData.find(b => b.name === selectedBrand);

  const handleImport = async (file: File, type: "brands" | "manufacturers") => {
    toast.info("Import en cours...");
    try {
      const result = type === "brands" ? await importBrands(file) : await importManufacturers(file);
      toast.success(`${result.created} ${type === "brands" ? "marques" : "fabricants"} importé(e)s`);
      if (result.errors.length > 0) toast.warning(`${result.errors.length} erreur(s): ${result.errors[0]}`);
      qc.invalidateQueries({ queryKey: [type === "brands" ? "admin-brands" : "admin-manufacturers"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import");
    }
  };

  return (
    <div>
      <AdminTopBar title="Marques & Fabricants" subtitle="Gestion du portefeuille marques"
        actions={
          <div className="flex gap-2">
            {tab === "marques" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => exportBrands()}><Download size={14} className="mr-1" />Export XLSX</Button>
                <Button variant="outline" size="sm" onClick={() => brandFileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
                <input ref={brandFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0], "brands"); e.target.value = ""; }} />
                <Button size="sm" onClick={() => { setEditBrand(null); setBrandDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Marque</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => exportManufacturers()}><Download size={14} className="mr-1" />Export XLSX</Button>
                <Button variant="outline" size="sm" onClick={() => mfrFileRef.current?.click()}><Upload size={14} className="mr-1" />Import XLSX</Button>
                <input ref={mfrFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0], "manufacturers"); e.target.value = ""; }} />
                <Button size="sm" onClick={() => { setEditMfr(null); setMfrDialogOpen(true); }} className="bg-[#1E293B] hover:bg-[#1E293B]/90"><Plus size={14} className="mr-1" />Fabricant</Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Tag} label="Marques actives" value={String(brandsData.length)} evolution={{ value: 2, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Factory} label="Fabricants" value={String(manufacturersData.length)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Produits total" value={fmt(brandsData.reduce((a, b) => a + (b.product_count || 0), 0))} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="marques" className="text-[13px]">Marques</TabsTrigger>
          <TabsTrigger value="fabricants" className="text-[13px]">Fabricants</TabsTrigger>
        </TabsList>

        <TabsContent value="marques">
          <div className="flex gap-4">
            <div className={`bg-white rounded-lg border overflow-hidden ${selectedBrand ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
              {loadingBrands ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                      {["Marque", "Fabricant", "Pays", "Produits", "GMV mois", "Tier", "CE", ""].map(h => (
                        <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandsData.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer hover:bg-blue-50/50"
                        onClick={() => setSelectedBrand(selectedBrand === b.name ? null : b.name)}
                        style={selectedBrand === b.name ? { backgroundColor: "#EFF6FF" } : {}}>
                        <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>—</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>—</TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{b.product_count || 0}</TableCell>
                        <TableCell className="text-[11px] text-right font-semibold" style={{ color: "#059669" }}>—</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {b.is_featured ? "Featured" : "Standard"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px]" style={{ color: "#8B95A5" }}>—</span>
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
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Fabricant</span><span className="font-medium" style={{ color: "#1D2530" }}>{(selected.manufacturers as any)?.name || "—"}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Pays</span><span style={{ color: "#1D2530" }}>{selected.country || "—"}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Produits</span><span style={{ color: "#1D2530" }}>{selected.products_count || 0}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>GMV mois</span><span className="font-semibold" style={{ color: "#059669" }}>€{fmt(Number(selected.gmv_month) || 0)}</span></div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Certifications</span>
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {(selected.certifications || []).map((c: string) => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>{c}</span>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4 text-[12px]" onClick={() => { setEditBrand(selected); setBrandDialogOpen(true); }}>Modifier</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="fabricants">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            {loadingMfrs ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                    {["Fabricant", "Pays", "Marques", "Produits sur MK", "Statut", ""].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manufacturersData.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                        <div className="flex items-center gap-2"><Factory size={14} style={{ color: "#7C3AED" }} />{m.name}</div>
                      </TableCell>
                      <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>{m.country || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(m.brands || []).map((b: string) => (
                            <span key={b} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>{b}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{m.products_on_mk || 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold" style={{
                          backgroundColor: m.status === "active" ? "#ECFDF5" : "#FFFBEB",
                          color: m.status === "active" ? "#059669" : "#D97706",
                          borderColor: "transparent",
                        }}>
                          {m.status === "active" ? "Actif" : m.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={() => { setEditMfr(m); setMfrDialogOpen(true); }}>Éditer</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <BrandFormDialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen} brand={editBrand} manufacturers={manufacturersData} />
      <ManufacturerFormDialog open={mfrDialogOpen} onOpenChange={setMfrDialogOpen} manufacturer={editMfr} />
    </div>
  );
};

export default AdminMarques;
