DELETE FROM public.admin_notifications
WHERE type = 'security'
  AND (title ILIKE 'Audit critique : admin_user.%' OR title ILIKE '%admin_user.created%' OR title ILIKE '%admin_user.deleted%');