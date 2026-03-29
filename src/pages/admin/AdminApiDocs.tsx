import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Lock, Zap, Code, ArrowRight } from "lucide-react";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "iokwqxhhpblcbkrxgcje"}.supabase.co/functions/v1`;

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  permission: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  responseExample?: string;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/products",
    description: "Liste des produits avec pagination cursor",
    permission: "catalog:read",
    params: [
      { name: "limit", type: "integer", required: false, desc: "Nombre de résultats (max 100, défaut 20)" },
      { name: "cursor", type: "string", required: false, desc: "Cursor pour la page suivante" },
      { name: "category", type: "string", required: false, desc: "Filtrer par slug catégorie" },
      { name: "brand", type: "string", required: false, desc: "Filtrer par slug marque" },
      { name: "search", type: "string", required: false, desc: "Recherche textuelle" },
      { name: "in_stock", type: "boolean", required: false, desc: "Uniquement les produits en stock" },
    ],
    responseExample: `{
  "data": [
    {
      "id": "uuid",
      "name": "Gants nitrile M",
      "slug": "gants-nitrile-m",
      "gtin": "5412345678901",
      "best_price_excl_vat": 12.50,
      "best_price_incl_vat": 15.13,
      "offer_count": 3,
      "is_in_stock": true,
      "category": { "name": "Gants", "slug": "gants" },
      "brand": { "name": "Hartmann", "slug": "hartmann" }
    }
  ],
  "next_cursor": "eyJpZCI6Ii4uLiJ9",
  "has_more": true,
  "total_count": 1234
}`,
  },
  {
    method: "GET",
    path: "/api/v1/products/:id",
    description: "Détail d'un produit avec toutes ses offres",
    permission: "catalog:read",
    responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Gants nitrile M",
    "offers": [
      {
        "id": "uuid",
        "vendor_name": "MediKong Direct",
        "price_excl_vat": 12.50,
        "price_incl_vat": 15.13,
        "stock_quantity": 500,
        "delivery_days": 3,
        "moq": 1
      }
    ]
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/categories",
    description: "Arborescence des catégories",
    permission: "catalog:read",
  },
  {
    method: "GET",
    path: "/api/v1/brands",
    description: "Liste des marques actives",
    permission: "catalog:read",
  },
  {
    method: "GET",
    path: "/api/v1/offers",
    description: "Liste des offres avec filtres",
    permission: "prices:read",
    params: [
      { name: "product_id", type: "uuid", required: false, desc: "Filtrer par produit" },
      { name: "min_price", type: "number", required: false, desc: "Prix minimum HTVA" },
      { name: "max_price", type: "number", required: false, desc: "Prix maximum HTVA" },
      { name: "in_stock", type: "boolean", required: false, desc: "Uniquement en stock" },
    ],
  },
  {
    method: "POST",
    path: "/api/v1/orders",
    description: "Créer une commande via API",
    permission: "orders:write",
    params: [
      { name: "items", type: "array", required: true, desc: "Liste d'offres [{offer_id, quantity}]" },
      { name: "shipping_address", type: "object", required: true, desc: "Adresse de livraison" },
      { name: "billing_address", type: "object", required: false, desc: "Adresse de facturation (défaut = shipping)" },
      { name: "notes", type: "string", required: false, desc: "Notes de commande" },
    ],
    responseExample: `{
  "data": {
    "id": "uuid",
    "order_number": "MK-2026-00042",
    "status": "pending",
    "total_incl_vat": 453.75,
    "source": "api"
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/orders",
    description: "Liste des commandes du client API",
    permission: "orders:read",
  },
  {
    method: "GET",
    path: "/api/v1/orders/:id",
    description: "Détail d'une commande avec lignes et sous-commandes",
    permission: "orders:read",
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-800",
  POST: "bg-blue-100 text-blue-800",
  PUT: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

const AdminApiDocs = () => {
  return (
    <div className="space-y-6 p-6">
      <AdminTopBar title="Documentation API" subtitle="Référence technique de l'API publique MediKong v1" />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="auth">Authentification</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Erreurs</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Base URL</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">{BASE_URL}/api/v1</code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Auth</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Header <code className="text-xs">X-API-Key</code></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Code className="w-4 h-4" /> Format</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">JSON, pagination cursor, UTF-8</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">{`# Lister les produits
curl -H "X-API-Key: mk_live_xxxx..." \\
  "${BASE_URL}/api/v1/products?limit=10&in_stock=true"

# Créer une commande
curl -X POST \\
  -H "X-API-Key: mk_live_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"offer_id":"uuid","quantity":5}],"shipping_address":{"line1":"Rue Neuve 1","city":"Bruxelles","postal_code":"1000","country":"BE"}}' \\
  "${BASE_URL}/api/v1/orders"`}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth */}
        <TabsContent value="auth" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" /> Authentification par clé API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Chaque requête doit inclure votre clé API dans le header <code className="text-xs bg-muted px-1 rounded">X-API-Key</code>.
              </p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs">{`GET /api/v1/products
Host: ${BASE_URL}
X-API-Key: mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</pre>

              <h4 className="font-semibold text-sm mt-4">Permissions</h4>
              <div className="space-y-2">
                {[
                  { perm: "catalog:read", desc: "Accès en lecture au catalogue (produits, catégories, marques)" },
                  { perm: "catalog:write", desc: "Création et modification de produits/offres" },
                  { perm: "prices:read", desc: "Accès aux offres et prix détaillés" },
                  { perm: "orders:read", desc: "Lecture des commandes" },
                  { perm: "orders:write", desc: "Création de commandes via API" },
                  { perm: "customers:read", desc: "Lecture des données clients" },
                ].map(p => (
                  <div key={p.perm} className="flex items-start gap-3">
                    <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0">{p.perm}</Badge>
                    <span className="text-sm text-muted-foreground">{p.desc}</span>
                  </div>
                ))}
              </div>

              <h4 className="font-semibold text-sm mt-4">Rate Limiting</h4>
              <p className="text-sm text-muted-foreground">
                Par défaut : 60 requêtes/minute et 10 000 requêtes/jour. Configurable par clé.
                Les headers <code className="text-xs bg-muted px-1 rounded">X-RateLimit-Remaining</code> et <code className="text-xs bg-muted px-1 rounded">X-RateLimit-Reset</code> sont inclus dans chaque réponse.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endpoints */}
        <TabsContent value="endpoints" className="space-y-4 mt-4">
          {endpoints.map((ep, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-3">
                  <Badge className={`${methodColors[ep.method]} text-[10px] font-mono`}>{ep.method}</Badge>
                  <code className="text-xs">{ep.path}</code>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground font-normal">{ep.description}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{ep.permission}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ep.params && (
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold mb-2">Paramètres</h5>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 pr-4">Nom</th>
                          <th className="text-left py-1 pr-4">Type</th>
                          <th className="text-left py-1 pr-4">Requis</th>
                          <th className="text-left py-1">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map(p => (
                          <tr key={p.name} className="border-b border-dashed">
                            <td className="py-1 pr-4 font-mono">{p.name}</td>
                            <td className="py-1 pr-4 text-muted-foreground">{p.type}</td>
                            <td className="py-1 pr-4">{p.required ? <Badge variant="destructive" className="text-[9px]">Oui</Badge> : "Non"}</td>
                            <td className="py-1 text-muted-foreground">{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {ep.responseExample && (
                  <div>
                    <h5 className="text-xs font-semibold mb-2">Exemple de réponse</h5>
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] overflow-x-auto">{ep.responseExample}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Errors */}
        <TabsContent value="errors" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Codes d'erreur</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Code</th>
                    <th className="text-left py-2 pr-4">Signification</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    { code: 400, meaning: "Bad Request", action: "Vérifier les paramètres de la requête" },
                    { code: 401, meaning: "Unauthorized", action: "Clé API manquante ou invalide" },
                    { code: 403, meaning: "Forbidden", action: "Permission insuffisante pour cette action" },
                    { code: 404, meaning: "Not Found", action: "Ressource inexistante" },
                    { code: 429, meaning: "Too Many Requests", action: "Rate limit atteint — attendre le reset" },
                    { code: 500, meaning: "Internal Server Error", action: "Erreur serveur — réessayer ou contacter le support" },
                  ].map(e => (
                    <tr key={e.code} className="border-b">
                      <td className="py-2 pr-4 font-mono font-bold">{e.code}</td>
                      <td className="py-2 pr-4">{e.meaning}</td>
                      <td className="py-2">{e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 className="font-semibold text-sm mt-6 mb-2">Format d'erreur</h4>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs">{`{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "details": {
      "limit": 60,
      "remaining": 0,
      "reset_at": "2026-03-29T10:15:00Z"
    }
  }
}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminApiDocs;
