-- Tighten buyers self-insert: force is_active=false so accounts require admin activation
DROP POLICY IF EXISTS buyers_insert_own ON public.buyers;

CREATE POLICY buyers_insert_own ON public.buyers
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_active = false
);

-- Prevent self-activation via UPDATE: users can update their own row but cannot set is_active=true
DROP POLICY IF EXISTS buyers_update_own ON public.buyers;

CREATE POLICY buyers_update_own ON public.buyers
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND is_active = false
);

-- Change default so any accidental insert without explicit value stays inactive
ALTER TABLE public.buyers ALTER COLUMN is_active SET DEFAULT false;