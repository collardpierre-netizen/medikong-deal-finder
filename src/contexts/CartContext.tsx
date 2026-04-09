import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  offer_id: string;
  product_id: string;
  vendor_id?: string;
  price_excl_vat?: number;
  price_incl_vat?: number;
  quantity: number;
  max_quantity?: number;
  delivery_days?: number | null;
  product?: {
    id: string;
    name: string;
    brand: string;
    slug: string;
    price: number;
    imageUrl?: string;
  };
}

const CART_KEY = "medikong_cart";

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch { return []; }
}

function saveCartLocal(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  cartCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addToCart: {
    mutate: (args: { offerId: string; productId: string; quantity?: number; maxQuantity?: number; productData?: CartItem["product"]; vendorId?: string; priceExclVat?: number; priceInclVat?: number; deliveryDays?: number | null }) => void;
    isPending: boolean;
  };
  updateQuantity: {
    mutate: (args: { itemId: string; quantity: number }) => void;
    isPending: boolean;
  };
  removeFromCart: {
    mutate: (itemId: string) => void;
    isPending: boolean;
  };
  clearCart: {
    mutate: () => void;
    isPending: boolean;
  };
}

const CartContext = createContext<CartContextType | null>(null);

// --- DB sync helpers ---
async function getCustomerId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("customers").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function syncCartToDB(items: CartItem[], customerId: string) {
  // Delete existing cart items
  await supabase.from("cart_items").delete().eq("customer_id", customerId);
  if (items.length === 0) return;
  // Insert current items
  const rows = items.map(i => ({
    customer_id: customerId,
    offer_id: i.offer_id,
    quantity: i.quantity,
  }));
  await supabase.from("cart_items").insert(rows);
}

async function loadCartFromDB(customerId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from("cart_items")
    .select("id, offer_id, quantity, offers:offer_id(id, product_id, vendor_id, price_excl_vat, price_incl_vat, delivery_days, stock_quantity, products:product_id(id, name, brand_name, slug, image_url, image_urls))")
    .eq("customer_id", customerId);
  if (!data) return [];
  return data.map((row: any) => {
    const offer = row.offers;
    const product = offer?.products;
    return {
      id: row.id,
      offer_id: row.offer_id,
      product_id: offer?.product_id || "",
      vendor_id: offer?.vendor_id,
      price_excl_vat: offer?.price_excl_vat,
      price_incl_vat: offer?.price_incl_vat,
      quantity: row.quantity,
      max_quantity: offer?.stock_quantity || undefined,
      delivery_days: offer?.delivery_days,
      product: product ? {
        id: product.id,
        name: product.name,
        brand: product.brand_name || "",
        slug: product.slug,
        price: offer?.price_excl_vat || 0,
        imageUrl: (Array.isArray(product.image_urls) && product.image_urls.length > 0 ? product.image_urls[0] : product.image_url) || undefined,
      } : undefined,
    };
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const customerIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Debounced sync to DB
  const debouncedSync = useCallback((nextItems: CartItem[]) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      if (customerIdRef.current) {
        syncCartToDB(nextItems, customerIdRef.current).catch(console.error);
      }
    }, 500);
  }, []);

  // Load cart — from DB if logged in, else localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const cid = await getCustomerId(session.user.id);
        if (cid && !cancelled) {
          customerIdRef.current = cid;
          const dbItems = await loadCartFromDB(cid);
          const localItems = loadCart();
          // Merge: if local has items not in DB, add them
          if (localItems.length > 0 && dbItems.length === 0) {
            setItems(localItems);
            syncCartToDB(localItems, cid).catch(console.error);
          } else if (dbItems.length > 0) {
            setItems(dbItems);
            saveCartLocal(dbItems);
          } else {
            setItems([]);
          }
        } else {
          setItems(loadCart());
        }
      } else {
        setItems(loadCart());
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Listen for auth changes to sync
  useEffect(() => {
    let cancelled = false;

    const handleSignedIn = (userId: string) => {
      window.setTimeout(() => {
        if (cancelled) return;

        void (async () => {
          const cid = await getCustomerId(userId);
          if (!cid || cancelled) return;

          customerIdRef.current = cid;
          const localItems = loadCart();
          if (localItems.length > 0) {
            await syncCartToDB(localItems, cid);
          }
        })().catch(console.error);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        handleSignedIn(session.user.id);
      } else if (event === "SIGNED_OUT") {
        customerIdRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const persistItems = useCallback((next: CartItem[]) => {
    saveCartLocal(next);
    debouncedSync(next);
  }, [debouncedSync]);

  const addToCart = useMemo(() => ({
    mutate: ({ offerId, productId, quantity = 1, maxQuantity, productData, vendorId, priceExclVat, priceInclVat, deliveryDays }: {
      offerId: string; productId: string; quantity?: number; maxQuantity?: number; productData?: CartItem["product"]; vendorId?: string; priceExclVat?: number; priceInclVat?: number; deliveryDays?: number | null;
    }) => {
      setItems(prev => {
        const existing = prev.find(i => i.offer_id === offerId);
        const safeMax = typeof maxQuantity === "number" && maxQuantity > 0 ? maxQuantity : undefined;
        let next: CartItem[];

        if (existing) {
          next = prev.map(i => {
            if (i.offer_id !== offerId) return i;
            const resolvedMax = safeMax ?? i.max_quantity;
            const nextQuantity = resolvedMax ? Math.min(i.quantity + quantity, resolvedMax) : i.quantity + quantity;
            if (resolvedMax && i.quantity + quantity > resolvedMax) {
              toast.warning(`Stock limité à ${resolvedMax} unités pour ce produit`);
            }
            return { ...i, quantity: nextQuantity, max_quantity: resolvedMax };
          });
        } else {
          const initialQuantity = safeMax ? Math.min(quantity, safeMax) : quantity;
          next = [...prev, { id: crypto.randomUUID(), offer_id: offerId, product_id: productId, vendor_id: vendorId, price_excl_vat: priceExclVat, price_incl_vat: priceInclVat, quantity: initialQuantity, max_quantity: safeMax, delivery_days: deliveryDays, product: productData }];
        }

        persistItems(next);
        return next;
      });
      setIsDrawerOpen(true);
    },
    isPending: false,
  }), [persistItems]);

  const updateQuantity = useMemo(() => ({
    mutate: ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      setItems(prev => {
        const next = quantity <= 0
          ? prev.filter(i => i.id !== itemId)
          : prev.map(i => {
              if (i.id !== itemId) return i;
              const nextQuantity = i.max_quantity ? Math.min(quantity, i.max_quantity) : quantity;
              return { ...i, quantity: nextQuantity };
            });
        persistItems(next);
        return next;
      });
    },
    isPending: false,
  }), [persistItems]);

  const removeFromCart = useMemo(() => ({
    mutate: (itemId: string) => {
      setItems(prev => {
        const next = prev.filter(i => i.id !== itemId);
        persistItems(next);
        return next;
      });
      toast.success("Produit retiré du panier");
    },
    isPending: false,
  }), [persistItems]);

  const clearCart = useMemo(() => ({
    mutate: () => {
      setItems([]);
      persistItems([]);
      toast.success("Panier vidé");
    },
    isPending: false,
  }), [persistItems]);

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  const value = useMemo(() => ({
    items, isLoading, cartCount, isDrawerOpen, openDrawer, closeDrawer,
    addToCart, updateQuantity, removeFromCart, clearCart,
  }), [items, isLoading, cartCount, isDrawerOpen, openDrawer, closeDrawer, addToCart, updateQuantity, removeFromCart, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
