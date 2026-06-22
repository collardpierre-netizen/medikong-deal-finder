## Diagnostic confirmé

- Le domaine d’envoi configuré pour le projet est `notify.medikong.pro` et il est vérifié.
- Les emails qui fonctionnent déjà (création/validation de compte, récupération, inscriptions acheteur/vendeur) passent par la même infrastructure d’emails de l’application et arrivent bien jusqu’à la file d’envoi puis au statut `sent`.
- Je n’ai trouvé aucune trace d’envoi pour les templates de statut commande : `order-line-accepted`, `order-line-shipped`, `order-line-delivered`.
- La commande `MK-2026-24395` existe, l’email client existe, l’adresse n’est pas en suppression, et les infos de suivi sont bien présentes. Donc ce n’est pas un problème d’adresse client ni de délivrabilité.
- Les files d’emails ne sont pas bloquées et il n’y a pas de message en échec/DLQ pour cette commande.
- Cause la plus probable : le changement de statut vendeur ne déclenche pas réellement l’envoi sur le site publié `medikong.pro`. Le code actuellement publié ne contient pas l’appel au nouveau déclencheur email, alors que le code source de preview le contient. Autrement dit : les emails d’auth fonctionnent, mais les emails de statut commande ne sont jamais envoyés à la plateforme d’email.
- Problème secondaire : l’interface vendeur peut afficher “acheteur notifié” même si l’appel email échoue, car l’erreur est absorbée côté écran vendeur.
- Point de clarification : je n’ai pas trouvé d’intégration Resend directe utilisée par ces envois. Le libellé admin “Resend (API)” semble obsolète/misleading. Le système réel utilisé par les emails qui fonctionnent est l’infrastructure email Lovable configurée sur `notify.medikong.pro`. Le correctif doit donc utiliser cette même chaîne, pas ajouter une seconde plateforme.

## Plan de correction

1. **Sécuriser le déclencheur email des statuts commande**
   - Garder l’envoi sur la même infrastructure que les emails de compte déjà fonctionnels.
   - Confirmer que les événements vendeur `acceptée`, `expédiée`, `livrée` appellent tous le backend d’envoi.
   - Inclure les données d’expédition dans l’email “expédiée” : transporteur, numéro de suivi, URL de suivi.

2. **Corriger les faux positifs côté vendeur**
   - Faire remonter les erreurs d’envoi au lieu de les masquer.
   - Remplacer les messages “acheteur notifié” par un succès uniquement si l’email a vraiment été mis en file.
   - Si le statut est bien changé mais l’email échoue, afficher clairement : “statut mis à jour, email non envoyé”.

3. **Rendre les retests après retour en arrière fiables**
   - Ajuster la clé d’idempotence : un aller-retour “livrée → préparation → expédiée/livrée” doit pouvoir renvoyer un nouvel email.
   - Éviter en même temps les doublons accidentels lors d’un double-clic ou retry réseau.

4. **Réconcilier l’infrastructure email si nécessaire**
   - Restaurer la ligne de configuration manquante de la file email via le mécanisme officiel d’infrastructure email, sans recréer manuellement les tables.
   - Garder la file et le cron existants, qui sont déjà en place.

5. **Déployer les fonctions backend concernées**
   - Déployer le déclencheur de notification de statut commande.
   - Déployer l’envoi email si le template ou la logique d’envoi change.

6. **Vérifier sans supposer**
   - Après correction, refaire un test contrôlé sur `MK-2026-24395` ou une commande de test.
   - Vérifier que les lignes `order-line-shipped` et `order-line-delivered` apparaissent en `pending`, puis `sent`.
   - Vérifier que le client reçoit bien l’email.

7. **Publication**
   - Comme ton test se fait sur `medikong.pro`, il faudra publier la version corrigée pour que le site live utilise le nouveau déclencheur. Sans publication, le preview peut être corrigé mais le live continuera à ne rien déclencher.