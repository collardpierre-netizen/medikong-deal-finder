import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { ExternalLink, Package, Truck, Tag, Building2 } from "lucide-react";
import VendorDelegateCompact from "@/components/vendor/VendorDelegateCompact";
import { MEDIKONG_PLACEHOLDER, isValidProductImage } from "@/lib/image-utils";

interface QuickViewProduct {
  id: string;
  name: string;
  slug?: string;
  brand?: string | null;
  imageUrl?: string | null;
  price: number;
  priceInclVat?: number | null;
  stock?: boolean;
  stockQty?: number | null;
  deliveryDays?: number | null;
  description?: string | null;
  gtin?: string | null;
  vendorId: string;
  vendorName?: string | null;
  vendorSlug?: string | null;
}

interface Props {
  product: QuickViewProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * QuickView produit affiché en popup depuis le shop d'un vendeur.
 * Contient : visuel + infos clés du produit, lien vers la fiche complète,
 * et le composant VendorDelegateCompact pour exposer le contact dédié
 * (filtré par profil + pays de l'acheteur, visible uniquement si vérifié).
 */
export default function VendorProductQuickView({ product, open, onOpenChange }: Props) {
  if (!product) return null;
  const img = isValidProductImage(product.imageUrl) ? product.imageUrl! : MEDIKONG_PLACEHOLDER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Aperçu produit</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
          <div className="aspect-square rounded-lg bg-muted overflow-hidden flex items-center justify-center">
            <img
              src={img}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-2"
              onError={(e) => { e.currentTarget.src = MEDIKONG_PLACEHOLDER; }}
            />
          </div>

          <div className="min-w-0">
            {product.brand && (
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{product.brand}</p>
            )}
            <h2 className="text-base font-bold text-foreground leading-snug">{product.name}</h2>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary">{product.price.toFixed(2)} €</span>
              <span className="text-[11px] text-muted-foreground">HTVA</span>
              {product.priceInclVat != null && (
                <span className="text-[11px] text-muted-foreground">
                  · {product.priceInclVat.toFixed(2)} € TVAC
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Package size={12} />
                {product.stock ? (
                  <span className="text-emerald-600 font-medium">
                    En stock{product.stockQty ? ` (${product.stockQty})` : ""}
                  </span>
                ) : (
                  <span className="text-destructive">Rupture</span>
                )}
              </span>
              {product.deliveryDays != null && (
                <span className="inline-flex items-center gap-1">
                  <Truck size={12} /> {product.deliveryDays}j
                </span>
              )}
              {product.gtin && (
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} /> {product.gtin}
                </span>
              )}
            </div>

            {product.vendorName && (
              <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Building2 size={12} /> Vendu par
                {product.vendorSlug ? (
                  <Link
                    to={`/vendeur/${product.vendorSlug}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {product.vendorName}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{product.vendorName}</span>
                )}
              </div>
            )}

            {product.description && (
              <p className="mt-3 text-[12px] text-muted-foreground line-clamp-4">
                {product.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {product.slug && (
                <Link
                  to={`/produit/${product.slug}`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Voir la fiche complète <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Délégué dédié — filtré par profil acheteur, masqué si non vérifié */}
        <div className="mt-4 pt-4 border-t border-border">
          <VendorDelegateCompact vendorId={product.vendorId} variant="card" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
