-- Purge all data tables (respecting FK order)
TRUNCATE TABLE
  order_line_sub_orders,
  order_lines,
  sub_orders,
  orders,
  cart_items,
  favorite_list_items,
  favorite_lists,
  favorites,
  recent_activity,
  user_price_watches,
  api_request_logs,
  api_keys,
  audit_logs,
  sync_logs,
  sourcing_requests,
  offers,
  products,
  margin_rules,
  brands,
  categories,
  customers,
  vendors,
  profiles,
  admin_users
CASCADE;

-- Reset site_config to clean defaults
TRUNCATE TABLE site_config CASCADE;
INSERT INTO site_config (id, site_name, tagline, country, currency, default_vat_rate, reduced_vat_rate, display_prices_incl_vat, investment_banner_enabled)
VALUES (1, 'MediKong', 'Fournitures médicales B2B au meilleur prix', 'BE', 'EUR', 21.0, 6.0, false, false);

-- Reset qogita_config
TRUNCATE TABLE qogita_config CASCADE;
INSERT INTO qogita_config (id, base_url, default_country, sync_enabled, sync_status, warehouse_country_code, shipping_mode)
VALUES (1, 'https://api.qogita.com', 'BE', false, 'idle', 'BE', 'direct_to_customer');