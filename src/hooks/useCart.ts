import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
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

export function useCart() {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  useEffect(() => {
    setItems(loadCart());
    setIsLoading(false);
  }, []);

  const addToCart = {
    mutate: useCallback(({ productId, quantity = 1, productData }: { productId: string; quantity?: number; productData?: CartItem["product"] }) => {
      setItems(prev => {
        const existing = prev.find(i => i.product_id === productId);
        let next: CartItem[];
        if (existing) {
          next = prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + quantity } : i);
        } else {
          next = [...prev, { id: crypto.randomUUID(), product_id: productId, quantity, product: productData }];
        }
        saveCart(next);
        return next;
      });
      toast.success("Produit ajouté au panier");
      setIsDrawerOpen(true);
    }, []),
    isPending: false,
  };

  const updateQuantity = {
    mutate: useCallback(({ itemId, quantity }: { itemId: string; quantity: number }) => {
      setItems(prev => {
        const next = quantity <= 0 ? prev.filter(i => i.id !== itemId) : prev.map(i => i.id === itemId ? { ...i, quantity } : i);
        saveCart(next);
        return next;
      });
    }, []),
    isPending: false,
  };

  const removeFromCart = {
    mutate: useCallback((itemId: string) => {
      setItems(prev => {
        const next = prev.filter(i => i.id !== itemId);
        saveCart(next);
        return next;
      });
      toast.success("Produit retiré du panier");
    }, []),
    isPending: false,
  };

  const clearCart = {
    mutate: useCallback(() => {
      setItems([]);
      saveCart([]);
      toast.success("Panier vidé");
    }, []),
    isPending: false,
  };

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  return { items, isLoading, cartCount, addToCart, updateQuantity, removeFromCart, clearCart, isDrawerOpen, openDrawer, closeDrawer };
}
