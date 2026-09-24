# LOT 1 (fin) + LOT 2 — MediKong Scan

Rien n'est codé ni déployé. Chaque étape attend votre GO ; le déploiement en prod attend un GO séparé.

## Étape 0 — Fin de /admin/scan/imports + fichier grossiste de test

Déjà en ligne : upload CSV/XLSX, grossiste + mois, correspondance des colonnes, aperçu, import (prix courant + historique), rapport (importés, non trouvés, écarts > 15 %).

À ajouter :
- Onglet « EAN à compléter » : produits sans EAN dont le CNK correspond à une ligne du fichier → liste de propositions (produit, CNK, EAN proposé, grossiste, mois). Rien n'est écrit avant validation admin (cocher / tout valider / rejeter). Refus si l'EAN proposé est déjà porté par un autre produit, ou s'il vaut 0000000000000.
- Fichier de test : un petit fichier « TEST Febelco » (≈ 15 produits du périmètre NAN / Nutricia / Fresubin) construit pour obtenir, avec les conditions de Pharmacie Test MediKong, au moins un verdict vert, un orange et un rouge. Importé sur une source marquée test, supprimable en un clic, jamais visible par un vrai pharmacien.

Question : ce fichier de test doit-il utiliser des prix inventés (source test isolée) ou un vrai extrait Febelco/CERP que vous m'envoyez ?

## Étape 1 — Coque scan.medikong.pro

- Surface `scan` + application Scan dédiée, sur le modèle de Care (session séparée par hôte).
- medikong.pro/scan → redirection vers scan.medikong.pro.
- Manifeste propre à l'hôte : scope /, standalone, portrait, icône MediKong. Aucun service worker (installable, pas hors-ligne). Invitation « Ajouter à l'écran d'accueil » après le 3e scan (une fois, refermable).
- Connexion par lien magique e-mail, session longue.
- Accès : les deux interrupteurs (site + officine) ; sinon écran « Accès sur invitation ». Un compte sans Scan ne voit aucun lien, menu ni donnée Scan.
- Charte : navy #1E293B, emerald #10B981 (texte sur clair #047857), fond #F6F8F7, Plus Jakarta Sans, zones tactiles ≥ 44 px. Charte limitée à scan.medikong.pro, medikong.pro inchangé.
- Barre basse : Scanner · Ruptures (bientôt) · Panier · Moi (bientôt).
- Montants HTVA via l'affichage de prix existant.

À prévoir : ajout du sous-domaine scan.medikong.pro dans les réglages de domaine (votre action, comme pour care).

## Étape 2 — Scanner

- Interface `BarcodeScanner` (start / stop / onDetect / setTorch), moteur zxing-wasm.
- EAN-13, DataMatrix GS1, Code 128 ; lecture continue, caméra arrière, lampe si dispo, anti-doublon 2 s, bip + vibration 40 ms.
- Lien « Code illisible ? Saisir le CNK ».
- Temps de décodage client envoyé à part (nouvelle colonne nullable `client_decode_ms` sur scan_events, migration additive séparée).

## Étape 3 — Onboarding « Vos conditions » (≤ 2 min, passable)

Écrans : 1) grossistes cochés + remise générale + dépôt (liste vide aujourd'hui → saisie libre) ; 2) exception par gamme (nutrition infantile en avant) ; 3) labos en direct ; 4) cases ristourne fin d'année / gratuités → mention « gain estimé ».
Stockage : pharmacist_wholesaler_settings (customer_id + override_rules_json v2). Aucune nouvelle table de remises.
Texte exact : « Jamais partagées avec un grossiste, un labo ou une autre pharmacie. »

## Étape 4 — Verdict

- Produit (photo, nom, conditionnement, CNK), bandeau vert / orange / rouge + gain par boîte.
- Comparaison par grossiste ; si l'affichage détaillé est interdit → seulement « Votre meilleur prix actuel : X € ». Aujourd'hui les 6 grossistes ont l'affichage interdit : le détail sera donc toujours masqué tant que vous ne l'autorisez pas.
- Ligne MediKong mise en avant (prix, franco, délai), nom vendeur fourni par le serveur.
- Lot / péremption seulement s'ils viennent d'un DataMatrix.
- Ajout au panier par le mécanisme existant, panier habituel inchangé ; trace dans scan_cart_attributions.
- Verdict « none » : prix MediKong + « Ajoutez vos conditions pour voir votre gain ».

## Étape 5 — Sans offre / inconnu

- « On le cherche pour vous » + « Vous êtes la Ne pharmacie à le chercher cette semaine » (compte hors comptes de test).
- Inconnu : photo (espace de stockage privé, accès limité à l'officine) + nom.
- Champs optionnels quantité/mois, prix actuel, fournisseur actuel → sourcing_requests (source = 'scan') liée à l'item existant.
- Badge « Hors périmètre du test » si hors périmètre ; demande enregistrée quand même.

## Tests d'acceptation

20 boîtes réelles iPhone Safari + Android d'entrée de gamme (≥ 90 % < 1,5 s) — à faire par vous en officine ; onboarding < 2 min ; verdict p75 < 1 s (mesuré via client_decode_ms + latency_ms) ; panier + attribution ; compte sans Scan ne voit rien. Tous les tests automatiques avec Pharmacie Test MediKong uniquement.

## Points signalés, non traités

- Nouvelle alerte : tout compte connecté peut lire tous les profils acheteurs (buyer_profiles). À traiter en migration séparée sur votre GO. Historique de prix et réglages P2P restent ouverts, comme décidé.
- 3 anciennes lignes de scan du compte test (7 au lieu de 4) : suppression en attente de votre GO.

## Détails techniques

- Nouvelles dépendances : zxing-wasm. Fichiers : src/ScanApp.tsx, src/config/surface.ts (ajout), src/pages/scan/*, src/lib/scanner/*, manifeste scan servi par hôte.
- Migrations séparées : client_decode_ms ; bucket `scan-photos` + policies officine ; RPC `scan_sourcing_week_rank` ; RPC `scan_save_conditions` ; propositions EAN (table de propositions + RPC admin de validation).
- scan-resolve : accepte `client_decode_ms` ; aucun changement de calcul.
