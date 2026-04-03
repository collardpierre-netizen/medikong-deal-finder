
## 7 Landing Pages Segment — Plan d'implémentation

Je vais créer 7 pages dédiées en m'inspirant fidèlement du contenu et de la structure du site de production (pharmacies, ehpad, grossistes) et en adaptant pour les 4 autres segments.

### Pages à créer :
1. **`/pharmacies`** — Hero avec économie 23%, comparateur prix, arguments (marge, simplicité, confiance), tableau comparatif vs grossistes/groupements, catégories, packs, calculateur, FAQ, formulaire
2. **`/ehpad`** — Hero "MediKong Care", stats, défis d'approvisionnement, 6 features (catalogue, prix, commande, multi-résidents, dashboard, conformité), process 3 étapes, showcase produit, catégories phares, FAQ, formulaire
3. **`/grossistes`** — Hero benchmark, problèmes (prix/temps/ruptures), process 3 étapes, catégories, 5 étapes zéro blabla, pilote 30j, FAQ, formulaire
4. **`/hopitaux`** — Adapté du modèle EHPAD : volumes hospitaliers, conformité CE, gestion multi-services
5. **`/cabinets-medicaux`** — Adapté du modèle pharmacie : MOQ bas, consommables, instruments
6. **`/dentistes`** — Matériel dentaire spécialisé, consommables, hygiène
7. **`/veterinaires`** — Fournitures vétérinaires, cliniques et cabinets

### Architecture technique :
- Un composant template `SegmentLandingPage.tsx` avec des sections modulaires (Hero, Stats, Features, Process, Categories, FAQ, ContactForm)
- Un fichier de données `segment-pages-data.ts` contenant le contenu unique par segment
- 7 pages légères qui utilisent le template avec leurs données
- Routes ajoutées dans `App.tsx`
- Images générées pour les héros de chaque segment
- Liens mis à jour dans `ProfessionnelsPage.tsx`

### Sections par page (template) :
1. **Hero** — Badge, titre avec mot clé coloré, sous-titre, 2 CTA, image
2. **Stats Row** — 4 KPIs animés
3. **Pain Points** — 3 problèmes identifiés
4. **Features Grid** — 4-6 features numérotées
5. **Process Steps** — 3-5 étapes
6. **Comparaison** (optionnel) — Tableau vs concurrents
7. **Catégories phares** — 4 catégories clés
8. **FAQ** — 4-6 questions/réponses
9. **CTA + Formulaire** — Formulaire de contact/inscription
