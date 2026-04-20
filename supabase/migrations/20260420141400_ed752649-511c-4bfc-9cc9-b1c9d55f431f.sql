UPDATE public.sync_logs 
SET status='running', 
    error_message=NULL, 
    completed_at=NULL,
    progress_current=0,
    progress_message='Reprise après tuning (chunk 3MB, batch 500)', 
    chunk_state = chunk_state || jsonb_build_object(
      'byte_offset', 0, 
      'line_residue', '', 
      'header_parsed', false, 
      'header_line', '', 
      'processed', 0, 
      'brands_seen', '[]'::jsonb, 
      'categories_seen', '[]'::jsonb
    ) 
WHERE id='5ad961f3-7e47-4b7d-9ce3-229dfc5e2838';