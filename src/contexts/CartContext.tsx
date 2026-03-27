import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  product_id: string;
  vendor_id?: string;
  price_ht?: number;
  quantity: number;
  product?: {
    id: string;
    name: string;
    brand: string;
    slug: string;
    price: number;
    gtin: string;
    unit: string;
    stock: boolean;
    imageUrl?: string;
  };
}

const CART_KEY = "medikong_cart";

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
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
    mutate: (args: { productId: string; quantity?: number; productData?: CartItem["product"]; vendorId?: string; priceHt?: number }) => void;
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  useEffect(() => {
    const loaded = loadCart();
    setItems(loaded);
    setIsLoading(false);

    // Enrich items missing prices with real offer data
    const itemsMissingPrice = loaded.filter(i => !i.price_ht && (!i.product?.price || i.product.price === 0));
    if (itemsMissingPrice.length > 0) {
      const productIds = [...new Set(itemsMissingPrice.map(i => i.product_id))];
      supabase
        .from("offers_direct")
        .select("product_id, vendor_id, price_ht")
        .in("product_id", productIds)
        .eq("status", "active")
        .then(({ data: offers }) => {
          if (!offers || offers.length === 0) return;
          setItems(prev => {
            const next = prev.map(item => {
              if (item.price_ht && item.price_ht > 0) return item;
              // Find matching offer by product_id + vendor_id, or best price for product
              const match = offers.find(o => o.product_id === item.product_id && o.vendor_id === item.vendor_id)
                || offers.find(o => o.product_id === item.product_id);
              if (!match) return item;
              const price = Number(match.price_ht);
              return {
                ...item,
                price_ht: price,
                vendor_id: item.vendor_id || match.vendor_id,
                product: item.product ? { ...item.product, price: price } : item.product,
              };
            });
            saveCart(next);
            return next;
          });
        });
    }
  }, []);

  const addToCart = useMemo(() => ({
    mutate: ({ productId, quantity = 1, productData, vendorId, priceHt }: { productId: string; quantity?: number; productData?: CartItem["product"]; vendorId?: string; priceHt?: number }) => {
      setItems(prev => {
        const existing = prev.find(i => i.product_id === productId && i.vendor_id === vendorId);
        let next: CartItem[];
        if (existing) {
          next = prev.map(i => (i.product_id === productId && i.vendor_id === vendorId) ? { ...i, quantity: i.quantity + quantity } : i);
        } else {
          next = [...prev, { id: crypto.randomUUID(), product_id: productId, vendor_id: vendorId, price_ht: priceHt, quantity, product: productData }];
        }
        saveCart(next);
        return next;
      });
      toast.success("Produit ajouté au panier");
      setIsDrawerOpen(true);
    },
    isPending: false,
  }), []);

  const updateQuantity = useMemo(() => ({
    mutate: ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      setItems(prev => {
        const next = quantity <= 0 ? prev.filter(i => i.id !== itemId) : prev.map(i => i.id === itemId ? { ...i, quantity } : i);
        saveCart(next);
        return next;
      });
    },
    isPending: false,
  }), []);

  const removeFromCart = useMemo(() => ({
    mutate: (itemId: string) => {
      setItems(prev => {
        const next = prev.filter(i => i.id !== itemId);
        saveCart(next);
        return next;
      });
      toast.success("Produit retiré du panier");
    },
    isPending: false,
  }), []);

  const clearCart = useMemo(() => ({
    mutate: () => {
      setItems([]);
      saveCart([]);
      toast.success("Panier vidé");
    },
    isPending: false,
  }), []);

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
