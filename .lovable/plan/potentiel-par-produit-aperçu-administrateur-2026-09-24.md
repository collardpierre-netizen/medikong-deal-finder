# Potentiel par produit — aperçu administrateur

## Objectif
Créer `/admin/scan/potentiel` en preview uniquement, avec des données de démonstration clairement identifiées. Aucun stockage, calcul serveur, migration ou publication.

## Écran
- En-tête « Potentiel par produit » et mention « Données de démonstration ».
- Réglage local du seuil de bascule, initialisé à 6 %, pour recalculer immédiatement les valeurs affichées.
- Filtres marque et laboratoire, appliqués aux deux vues.
- Deux vues : « Par produit » et « Par officine ».
- Vue produit : officines, dont sans volume, volume exact, volume estimé, total, prix payé moyen pondéré, prix cible, prix MediKong, écart, potentiel au prix cible, potentiel au prix MediKong et écart entre potentiels.
- Vue officine : synthèse du potentiel total par client, avec la même séparation des volumes et les mêmes filtres.
- Export CSV des données de démonstration visibles, avec volumes exact et estimé séparés.
- Tri par potentiel décroissant.

## Intégration
- Ajouter la route administrateur `/admin/scan/potentiel`.
- Ajouter l’entrée « Potentiel Scan » dans la navigation administrateur.
- Utiliser les composants et styles déjà présents dans l’administration.

## Vérification
- Ouvrir la page en preview avec un compte administrateur.
- Vérifier filtres, vues, seuil et calculs visibles.
- Produire une capture d’écran de la vue produit.
