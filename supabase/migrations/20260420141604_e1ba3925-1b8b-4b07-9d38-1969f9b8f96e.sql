UPDATE public.sync_logs 
SET status='running', error_message=NULL, completed_at=NULL,
    progress_message='Reprise après erreur réseau transitoire'
WHERE id='5ad961f3-7e47-4b7d-9ce3-229dfc5e2838';