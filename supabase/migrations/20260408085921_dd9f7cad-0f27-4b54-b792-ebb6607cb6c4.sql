ALTER TABLE restock_offers
  ADD COLUMN allow_partial boolean NOT NULL DEFAULT false,
  ADD COLUMN moq integer NOT NULL DEFAULT 1,
  ADD COLUMN lot_size integer NOT NULL DEFAULT 1;

ALTER TABLE restock_offers ADD CONSTRAINT restock_offers_moq_positive CHECK (moq >= 1);
ALTER TABLE restock_offers ADD CONSTRAINT restock_offers_lot_positive CHECK (lot_size >= 1);

UPDATE restock_offers SET allow_partial = true, moq = 10, lot_size = 10 WHERE designation LIKE '%Dafalgan%';
UPDATE restock_offers SET allow_partial = true, moq = 20, lot_size = 20 WHERE designation LIKE '%Perdolan%';
UPDATE restock_offers SET allow_partial = true, moq = 5, lot_size = 5 WHERE designation LIKE '%Doliprane%';
UPDATE restock_offers SET allow_partial = true, moq = 1, lot_size = 1 WHERE designation LIKE '%Strepsils%';
UPDATE restock_offers SET allow_partial = true, moq = 10, lot_size = 10 WHERE designation LIKE '%Paracetamol%';
UPDATE restock_offers SET allow_partial = true, moq = 10, lot_size = 10 WHERE designation LIKE '%Rhinospray%';
UPDATE restock_offers SET allow_partial = true, moq = 5, lot_size = 5 WHERE designation LIKE '%Mucosolvan%';
UPDATE restock_offers SET allow_partial = true, moq = 50, lot_size = 50 WHERE designation LIKE '%Loperamide%';