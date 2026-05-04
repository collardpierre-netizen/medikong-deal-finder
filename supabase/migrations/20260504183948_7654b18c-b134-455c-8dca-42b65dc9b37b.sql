-- Suppression des 6 commandes test pending visibles dans le dashboard admin
DELETE FROM order_lines WHERE order_id IN (
  'b913eb9e-326e-429a-887f-73e246e2033b',
  'e4489056-01d3-4a92-a5d7-45d513e70b14',
  '30084dad-74b0-4d8e-bffa-7b6ebf6988b8',
  'a995975b-e0a2-43c2-8482-c61cd610a0cb',
  '14d2ad37-e9a4-495c-8d22-9ddeca226e9a',
  '79981da7-a2f0-4126-8b3c-e4447ab7781f'
);

DELETE FROM orders WHERE id IN (
  'b913eb9e-326e-429a-887f-73e246e2033b',
  'e4489056-01d3-4a92-a5d7-45d513e70b14',
  '30084dad-74b0-4d8e-bffa-7b6ebf6988b8',
  'a995975b-e0a2-43c2-8482-c61cd610a0cb',
  '14d2ad37-e9a4-495c-8d22-9ddeca226e9a',
  '79981da7-a2f0-4126-8b3c-e4447ab7781f'
);