UPDATE public.products p
SET image_url = v.url,
    image_urls = ARRAY[v.url]::text[],
    updated_at = now()
FROM (VALUES
  ('5410151319671', 'https://media.s-bol.com/38nMAN1WvY6Q/8qxRMwL/550x658.jpg'),
  ('5410441002955', 'https://static.delhaize.be/medias/sys_master/products/hf2/h4d/12866319384606.jpg?imwidth=1200'),
  ('5410441002986', 'https://res.cloudinary.com/dheyfwgs6/image/upload/v1761203182/Bambix/website/product/Bambix_Groeimelk_2Belgisch_N_pgqjir.png'),
  ('5410441003013', 'https://res.cloudinary.com/dheyfwgs6/image/upload/v1761203175/Bambix/website/product/Bambix_Groeimelk_3Belgisch_N-e1681219494563_qaepjq.png'),
  ('5410441003037', 'https://res.cloudinary.com/dheyfwgs6/image/upload/v1761203174/Bambix/website/product/Bambix_Groeidrink_Soja_1-3_N_Transparant-e1681216633321_vug8jr.png'),
  ('5410441004089', 'https://static.delhaize.be/medias/sys_master/products/h57/hd4/13782630465566.jpg?imwidth=1200'),
  ('5410441004294', 'https://static.delhaize.be/medias/sys_master/products/h95/h22/13736000127006.jpg'),
  ('5410441004348', 'https://optiphar.com/media/fb/ea/fe/1744711014/Bambix%20Groeimelk%20Natuur%201-3%20Jaar%20%28%20Inhoud%203%20x%20250%20ml%20%29.png?ts=1744711022'),
  ('7613033384882', 'https://www.nestlebaby.be/sites/default/files/content_image/ne2835_brandbank_gum_1l_koekjes.png'),
  ('7613034044198', 'https://www.nestlebaby.be/sites/default/files/content_image/ne2835_brandbank_gum_1l_1an.png'),
  ('7613034044235', 'https://www.nestlebaby.be/sites/default/files/content_image/ne2835_brandbank_gum_1l_3ans.png'),
  ('7613034044273', 'https://www.nestlebaby.be/sites/default/files/content_image/1l_2ans.jpg'),
  ('7613034557322', 'https://www.nestlebaby.be/sites/default/files/content_image/NE2020_NAN_OPTIPRO_1_1L.jpg'),
  ('7613034905284', 'https://cgn-mig.farmaline.be/images/BE0/319/836/3/BE03198363-p1.jpg'),
  ('7613035267688', 'https://www.nestlebaby.be/sites/default/files/content_image/NE2020_NAN_OPTIPRO_2_1L.jpg'),
  ('7613037864304', 'https://media.s-bol.com/mjnJv8DJ4j8n/pYZJZmQ/550x775.jpg'),
  ('7613037898200', 'https://media.s-bol.com/J2ZQQKVGEwlo/OA5NxN/550x774.jpg'),
  ('7613037898378', 'https://cgn-mig.farmaline.be/images/BE0/396/308/9/BE03963089-p1-nl.jpg'),
  ('7613037898590', 'https://cgn-mig.farmaline.be/images/BE0/396/307/1/BE03963071-p1-nl.jpg'),
  ('8410100012643', 'https://www.nestlebaby.be/sites/default/files/content_image/ne2835_brandbank_gum_1l_cereals.png'),
  ('8445290170491', 'https://media.s-bol.com/B9M96wLpAPG2/x683v1P/550x708.jpg')
) AS v(gtin, url)
WHERE p.gtin = v.gtin;