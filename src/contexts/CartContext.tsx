import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  offer_id: string;
  product_id: string;
  vendor_id?: string;
  price_excl_vat?: number;
  price_incl_vat?: number;
  quantity: number;
  max_quantity?: number;
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
    mutate: (args: { offerId: string; productId: string; quantity?: number; maxQuantity?: number; productData?: CartItem["product"]; vendorId?: string; priceExclVat?: number; priceInclVat?: number }) => void;
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
    setItems(loadCart());
    setIsLoading(false);
  }, []);

  const addToCart = useMemo(() => ({
    mutate: ({ offerId, productId, quantity = 1, productData, vendorId, priceExclVat, priceInclVat }: {
      offerId: string; productId: string; quantity?: number; productData?: CartItem["product"]; vendorId?: string; priceExclVat?: number; priceInclVat?: number;
    }) => {
      setItems(prev => {
        const existing = prev.find(i => i.offer_id === offerId);
        let next: CartItem[];
        if (existing) {
          next = prev.map(i => i.offer_id === offerId ? { ...i, quantity: i.quantity + quantity } : i);
        } else {
          next = [...prev, { id: crypto.randomUUID(), offer_id: offerId, product_id: productId, vendor_id: vendorId, price_excl_vat: priceExclVat, price_incl_vat: priceInclVat, quantity, product: productData }];
        }
        saveCart(next);
        return next;
      });
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
