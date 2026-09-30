# Création de comptes acheteurs en masse

## Ce que vous pourrez faire
Page **Utilisateurs**, nouveau bouton **« Créer des comptes en masse »** :

1. **Fournir la liste** : envoyer un fichier Excel/CSV ou coller des lignes, au choix.
   Colonnes : **Nom, APB, Type, Email, Tél**. Un modèle Excel est téléchargeable.
2. **Relire l'aperçu, ligne par ligne**, avant toute création :
   - ✓ prête à créer
   - ⚠ ignorée si l'email est déjà dans la liste ou déjà client ; une ligne ignorée n'est ni écrasée ni recréée
   - ✗ erreur si l'email est invalide, le type inconnu ou le nom manquant
3. **Choisir la validation** avec une case, décochée par défaut :
   - cochée : les comptes sont validés d'office et ont accès aux prix dès que le mot de passe est choisi ;
   - décochée : ils attendent votre validation habituelle.
4. **Cliquer « Créer X comptes »**. Un récapitulatif s'affiche ensuite : créés, ignorés, erreurs, emails envoyés. Il est téléchargeable en Excel.

## Ce que reçoit chaque officine
Un email en français, un seul par compte, du type « Votre compte MediKong a été créé ». Il contient un bouton **« Choisir mon mot de passe »**, qui mène à la page où l'officine définit son mot de passe, puis la connecte.

- Le lien expire après quelques jours.
- Un bouton **« Renvoyer l'invitation »** sur la fiche du compte en envoie un nouveau.
- L'email ne donne jamais de mot de passe provisoire.

Un aperçu de l'email vous sera montré avant l'application.

## Limites
- Au maximum 200 comptes par import.
- Seul un admin peut lancer un import. La vérification se fait côté serveur, pas seulement à l'écran.
- La colonne « Type » accepte : pharmacien, professionnel de santé, maison de repos, groupement, revendeur. Tout autre mot met la ligne en erreur.
- Une ligne sans APB est acceptée seulement pour les types qui ne l'exigent pas.

## Hors périmètre (non touché)
- L'inscription publique et les points 1 à 3 signalés plus tôt (champ APB sans titre, emails d'inscription, tri des comptes en attente). Ils attendent toujours votre GO séparé.
- L'alerte de sécurité sur les profils acheteurs reste ouverte, comme vous l'avez décidé.

## Mise en ligne
- Tout est préparé en aperçu d'abord.
- La création des comptes et l'envoi des emails ne fonctionneront qu'après votre **GO PUBLICATION**.
- Aucun compte réel ne sera créé pendant mes tests : je testerai uniquement sur une adresse de test, que vous me donnerez.

## Détails techniques
- Nouvelle fonction serveur, réservée aux admins (`bulk-create-buyers`). Pour chaque ligne :
  - création du compte de connexion sans mot de passe et de la fiche client (`customers`), avec `is_verified` selon la case ;
  - génération d'un lien de choix de mot de passe (recovery) vers la page existante `/reset-password` ;
  - envoi du modèle `buyer-account-created`, avec une clé anti-doublon par compte.
- Les lignes sont traitées une à une. Une ligne en échec n'annule pas les autres, et son erreur est remontée.
- Nouveau modèle d'email aux couleurs MediKong, ajouté au registre.
- Écran : dialogue d'import sur la page Utilisateurs, avec lecture Excel/CSV côté navigateur uniquement pour l'aperçu. La validation définitive se fait côté serveur.
- Aucun changement de structure en base n'est prévu : on utilise les colonnes client existantes (nom, APB/identifiant pro, type, téléphone).
