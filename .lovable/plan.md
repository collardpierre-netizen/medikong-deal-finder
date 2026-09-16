# Régénérer et envoyer un lien Stripe vendeur

## Résultat attendu
Depuis la liste « Vendors — Stripe Connect », l’administrateur pourra régénérer un lien d’inscription Stripe pour un vendeur non finalisé, puis le copier ou préparer immédiatement un e-mail destiné au vendeur.

## Modifications
- Conserver l’action « Régénérer lien » pour les comptes Stripe en cours d’inscription.
- Après génération, afficher une fenêtre persistante avec le nom du vendeur et le lien complet.
- Ajouter deux actions explicites : « Copier le lien » et « Préparer l’e-mail ».
- Préremplir l’adresse du vendeur, l’objet et un court message MediKong dans le logiciel de messagerie.
- Afficher une erreur claire si le vendeur n’a pas d’adresse e-mail, tout en laissant la copie du lien disponible.

## Limites
- Aucun changement en base de données.
- Aucun changement du compte Stripe ni de son statut.
- Aucun e-mail envoyé automatiquement : l’administrateur garde la validation finale dans son logiciel de messagerie.

## Vérification
- Tester la régénération sur un compte Stripe incomplet.
- Vérifier la copie du lien et le contenu de l’e-mail préparé.
- Vérifier qu’une erreur Stripe ou une session expirée ne laisse pas l’écran bloqué.
