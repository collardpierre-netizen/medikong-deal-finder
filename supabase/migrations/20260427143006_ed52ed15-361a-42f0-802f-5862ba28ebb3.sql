-- Historique des actions massives sur les catégories (réactivation/désactivation)
-- pour audit + undo différé.

CREATE TABLE IF NOT EXISTS public.category_bulk_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('reactivate','deactivate')),
  scope TEXT NOT NULL CHECK (scope IN ('last_batch','all_inactive','manual_filter')),
  scope_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  product_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  category_count INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  cascade_products BOOLEAN NOT NULL DEFAULT false,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email TEXT,
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  undo_action_id UUID REFERENCES public.category_bulk_actions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cba_created_at ON public.category_bulk_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cba_action ON public.category_bulk_actions (action);
CREATE INDEX IF NOT EXISTS idx_cba_undone ON public.category_bulk_actions (undone_at) WHERE undone_at IS NULL;

ALTER TABLE public.category_bulk_actions ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire l'historique
CREATE POLICY "Admins can view bulk actions"
ON public.category_bulk_actions
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Seuls les admins peuvent en insérer (le code applicatif force performed_by = auth.uid())
CREATE POLICY "Admins can insert bulk actions"
ON public.category_bulk_actions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND performed_by = auth.uid());

-- Seuls les admins peuvent marquer une action comme annulée
CREATE POLICY "Admins can update bulk actions"
ON public.category_bulk_actions
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
