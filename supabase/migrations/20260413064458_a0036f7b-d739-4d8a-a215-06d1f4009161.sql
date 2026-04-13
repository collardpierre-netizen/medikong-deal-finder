
UPDATE brands
SET logo_url = 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' || website_url || '&size=128'
WHERE logo_url LIKE '%logo.dev%'
  AND website_url IS NOT NULL;
