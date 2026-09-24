# Corriger « Mes conditions »

## Objectif
Faire apparaître systématiquement les conditions déjà enregistrées et empêcher qu’un champ vide efface une valeur existante.

## Mise en œuvre
- Attendre la fin réelle du chargement avant d’initialiser l’écran, et signaler un chargement impossible plutôt que présenter un formulaire vide.
- Préremplir grossistes cochés, remise générale, exceptions et dépôt depuis les données enregistrées.
- Lors de l’enregistrement, conserver toute valeur existante lorsque le champ correspondant est vide ; ne modifier que les valeurs effectivement renseignées ou les grossistes explicitement décochés.
- Tester avec Pharmacie Test MediKong : Febelco 15 %, exceptions nutrition 8 %, CERP 10 % ; passer CERP à 11 %, enregistrer et rouvrir.
- Produire une capture avant et une capture après, puis remettre CERP à 10 % afin de ne pas laisser une donnée de test modifiée.

## Limites
- Preview uniquement, aucune publication.
- Aucun changement de structure des données.
- Aucun travail sur les sujets C ou sur les alertes déjà exclues.
