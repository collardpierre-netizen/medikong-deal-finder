## Diagnostic

- Le domaine email est bien vérifié : le problème ne vient pas du DNS ni de la capacité d’envoi.
- Il n’y a aucune ligne récente dans le journal d’emails pour `order-line-accepted`, `order-line-shipped` ou `order-line-delivered`.
- Il n’y a aucune requête récente vers la fonction d’envoi email lors du test sur `MK-2026-24395`.
- La commande existe bien, avec client, email client, vendeur Noralphar, statut `delivered`, numéro de suivi `3232323` et URL `http://www.dhl.com`.
- Cause probable confirmée par le code : la page vendeur tente de lire directement `customers.email` depuis le navigateur vendeur. Or les règles d’accès protègent les emails clients : un vendeur ne peut pas lire la fiche client. Résultat : `cust?.email` est vide, le code fait `return` silencieusement, et aucun email n’est même déclenché.

## Fix proposé

1. **Déplacer l’envoi des emails côté backend sécurisé**
   - Créer une fonction backend dédiée aux notifications de statut de ligne de commande.
   - Elle recevra uniquement l’ID de ligne, l’événement (`accepted`, `shipped`, `delivered`) et, pour l’expédition, les infos saisies par le vendeur : transporteur, numéro de suivi, URL de suivi.
   - Elle vérifiera que l’utilisateur connecté est bien le vendeur propriétaire ou membre du compte vendeur concerné.
   - Elle récupérera l’email client côté backend, sans jamais l’exposer au navigateur vendeur.

2. **Modifier la page vendeur**
   - Remplacer le helper actuel qui lit `customers.email` côté frontend.
   - Après chaque changement de statut réussi :
     - `Accepter` déclenche l’email “commande en préparation”.
     - `Confirmer l’expédition` déclenche l’email “commande expédiée”, avec transporteur, numéro de suivi et URL.
     - `Marquer livré` déclenche l’email “commande livrée”.
   - Si l’envoi échoue, afficher une erreur claire au vendeur au lieu de prétendre “acheteur notifié”.

3. **Fiabiliser l’idempotence sans bloquer les retests**
   - Utiliser une clé d’envoi liée à l’événement réel de statut, mais permettre un nouvel envoi après un retour arrière puis une nouvelle progression du statut.
   - Cela évite les doublons accidentels tout en permettant exactement le scénario de test que tu viens de faire.

4. **Vérifier la chaîne complète**
   - Tester un appel backend sur la commande `MK-2026-24395` ou une commande de test.
   - Vérifier que le journal d’emails reçoit bien une ligne `pending`, puis `sent`.
   - Ensuite refaire ensemble le test vendeur : retour en préparation → expédiée → livrée.

## Résultat attendu

Après ce fix, le vendeur pourra continuer à changer les statuts depuis `/vendor/orders`, mais l’email client sera envoyé par le backend sécurisé, avec les informations de livraison incluses dans le template d’expédition.