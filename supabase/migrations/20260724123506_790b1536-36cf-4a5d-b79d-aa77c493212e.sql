
CREATE POLICY tracking_campaigns_owner_insert
ON public.tracking_campaigns
FOR INSERT
TO authenticated
WITH CHECK (public.user_owns_tracking_campaign(owner_type, owner_id));

CREATE POLICY tracking_campaigns_owner_delete
ON public.tracking_campaigns
FOR DELETE
TO authenticated
USING (public.user_owns_tracking_campaign(owner_type, owner_id));
