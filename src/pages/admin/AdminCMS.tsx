import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Layout, Image, Layers, GripVertical, Eye, EyeOff, FileText, ToggleLeft,
} from "lucide-react";

const pages = [
  { name: "Homepage", slug: "/", status: "published", lastEdit: "27/03 14:00" },
  { name: "FAQ", slug: "/faq", status: "published", lastEdit: "22/03 09:30" },
  { name: "CGV", slug: "/cgv", status: "published", lastEdit: "15/03 11:00" },
  { name: "À propos", slug: "/a-propos", status: "draft", lastEdit: "20/03 16:45" },
  { name: "Politique de confidentialité", slug: "/confidentialite", status: "published", lastEdit: "10/03 10:00" },
];

const banners = [
  { name: "Promo printemps -20% EPI", position: "Homepage hero", active: true, start: "01/03", end: "31/03" },
  { name: "Livraison gratuite >200€", position: "Barre supérieure", active: true, start: "01/01", end: "31/12" },
  { name: "Nouveau : gamme Hartmann", position: "Homepage milieu", active: false, start: "15/03", end: "15/04" },
  { name: "Black Friday médical", position: "Homepage hero", active: false, start: "25/11", end: "02/12" },
];

const collections = [
  { name: "Meilleures ventes", type: "auto", products: 50, rule: "Top 50 ventes 30j" },
  { name: "Nouveautés mars", type: "auto", products: 34, rule: "Créés < 30j" },
  { name: "Essentiels pharmacie", type: "manual", products: 28, rule: "Sélection manuelle" },
  { name: "Kit premiers soins", type: "manual", products: 12, rule: "Sélection manuelle" },
  { name: "Promo printemps", type: "manual", products: 45, rule: "Sélection manuelle" },
];

const homepageSections = [
  { name: "Hero Banner", visible: true, order: 1 },
  { name: "Stats marketplace", visible: true, order: 2 },
  { name: "Catégories", visible: true, order: 3 },
  { name: "3 Piliers", visible: true, order: 4 },
  { name: "Produits populaires", visible: true, order: 5 },
  { name: "Marques partenaires", visible: true, order: 6 },
  { name: "Pourquoi MediKong", visible: true, order: 7 },
  { name: "CTA Vendeur", visible: true, order: 8 },
  { name: "FAQ", visible: true, order: 9 },
];

const AdminCMS = () => {
  const [tab, setTab] = useState("pages");
  const [sections, setSections] = useState(homepageSections);

  const toggleSection = (idx: number) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s));
  };

  return (
    <div>
      <AdminTopBar title="CMS & Merchandising" subtitle="Gestion du contenu et de la mise en avant" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="pages" className="text-[13px]">Pages</TabsTrigger>
          <TabsTrigger value="bannieres" className="text-[13px]">Bannières</TabsTrigger>
          <TabsTrigger value="collections" className="text-[13px]">Collections</TabsTrigger>
          <TabsTrigger value="homepage" className="text-[13px]">Sections Homepage</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Page", "Slug", "Statut", "Dernière édition"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                      <div className="flex items-center gap-2"><FileText size={14} style={{ color: "#1B5BDA" }} />{p.name}</div>
                    </TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{p.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: p.status === "published" ? "#059669" : "#F59E0B",
                        backgroundColor: p.status === "published" ? "#ECFDF5" : "#FFFBEB",
                        borderColor: "transparent",
                      }}>
                        {p.status === "published" ? "Publié" : "Brouillon"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{p.lastEdit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bannieres">
          <div className="space-y-3">
            {banners.map((b) => (
              <div key={b.name} className="bg-white rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: b.active ? "#ECFDF5" : "#F1F5F9" }}>
                  <Image size={16} style={{ color: b.active ? "#059669" : "#8B95A5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>{b.position} • {b.start} → {b.end}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleLeft size={20} style={{ color: b.active ? "#059669" : "#CBD5E1" }} />
                  <span className="text-[11px] font-medium" style={{ color: b.active ? "#059669" : "#8B95A5" }}>
                    {b.active ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <div className="grid grid-cols-3 gap-4">
            {collections.map((c) => (
              <div key={c.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} style={{ color: "#7C3AED" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.name}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: c.type === "auto" ? "#1B5BDA" : "#7C3AED",
                    backgroundColor: c.type === "auto" ? "#EFF6FF" : "#F3F0FF",
                    borderColor: "transparent",
                  }}>
                    {c.type === "auto" ? "Automatique" : "Manuelle"}
                  </Badge>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>{c.products} produits</span>
                </div>
                <p className="text-[11px]" style={{ color: "#616B7C" }}>{c.rule}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="homepage">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Sections Homepage (ordre d'affichage)</h3>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <GripVertical size={14} style={{ color: "#CBD5E1" }} className="cursor-grab" />
                  <span className="text-[11px] font-bold w-6" style={{ color: "#8B95A5" }}>{s.order}</span>
                  <span className="text-[13px] font-medium flex-1" style={{ color: "#1D2530" }}>{s.name}</span>
                  <button onClick={() => toggleSection(i)} className="flex items-center gap-1.5">
                    {s.visible ? <Eye size={14} style={{ color: "#059669" }} /> : <EyeOff size={14} style={{ color: "#8B95A5" }} />}
                    <span className="text-[11px]" style={{ color: s.visible ? "#059669" : "#8B95A5" }}>
                      {s.visible ? "Visible" : "Masqué"}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCMS;
