-- Réglage par vente : forcer ou exclure la facturation au nom et pour le compte du fournisseur.
-- NULL = suivre le réglage du fournisseur (vendors.self_billing_enabled).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS self_billing_override boolean;

COMMENT ON COLUMN public.orders.self_billing_override IS
  'NULL = suit vendors.self_billing_enabled ; true = force la facturation au nom et pour le compte ; false = exclut cette commande.';