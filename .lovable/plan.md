# Scan : connexion par code et session longue

Ce qui existe déjà : l'écran Scan envoie déjà un code à 6 chiffres (avec « ou recevoir un lien » en option), accepte le collage automatique iOS et bloque la création de compte. Le manifeste « MediKong Scan » existe aussi.

## A. Changements d'écran (aperçu seulement, sans GO base)
1. **Écran de connexion** : suppression de l'option « lien », bouton « Recevoir mon code », compteur de 60 s avant renvoi, blocage après 5 codes faux (attente de 15 min, mémorisée sur l'appareil), message « MediKong Scan est en phase pilote, sur invitation. » avec un contact (adresse à confirmer).
2. **Session** : à l'ouverture et au retour au premier plan, vérification et rafraîchissement de la session avant toute lecture.
3. **Session expirée** : une garde commune à Verdict, Mes conditions, Panier, Moi et Derniers scans. Si une lecture est vide ou refusée, l'app tente un rafraîchissement ; en cas d'échec, elle affiche « Votre session a expiré » avec la saisie du code sur place. Les conditions, quantités et prix déclarés en cours sont gardés sur l'appareil, puis renvoyés automatiquement après la reconnexion.
4. **Écran d'accueil** : manifeste Scan (nom et icône), bandeau Safari « Partager → Sur l'écran d'accueil » affiché une seule fois et masqué dans l'app installée.
5. **Admin** : bouton « Renvoyer l'invitation » sur la fiche client (il fonctionne une fois le point B4 en place).

## B. Changements en ligne immédiatement, GO séparé pour chacun
1. **E-mail du code (fonction d'envoi des e-mails de connexion)** : cet e-mail est partagé avec medikong.pro. Je propose une version Scan réservée aux demandes venant de /scan : grand code, validité de 10 min, en français, sans lien. L'e-mail du site principal reste identique.
2. **Contrôle « accès Scan » avant l'envoi du code** : une petite fonction serveur qui répond seulement oui ou non, sans révéler si l'adresse existe.
3. **Réglages d'authentification** :
   - **Validité du code : 10 min.** Ce réglage est global : il s'appliquerait aussi aux codes et liens de medikong.pro. Alternative : garder le réglage actuel et refuser côté Scan tout code de plus de 10 min.
   - **Durée de session : 90 jours.** Sans limite de durée ni d'inactivité, la session se renouvelle déjà indéfiniment ; je vérifie seulement que ces deux limites sont désactivées, sans rien modifier.
   - **Limite de 5 essais** : elle est appliquée côté écran, en plus de la limite anti-abus déjà en place côté serveur.
4. **E-mail d'invitation automatique** à l'activation de « Accès Scan » : lien medikong.pro/scan, puis 3 étapes. Il faut un e-mail d'application et un déclenchement lors de l'activation.

## Points à trancher
- **Adresse de démarrage** : le manifeste pointe aujourd'hui sur « / », parce que Scan est aussi servi sur scan.medikong.pro. Faut-il passer à /scan, comme demandé, ou garder « / » sur le sous-domaine ?
- **Contact** du message « phase pilote » : quelle adresse e-mail ou quel téléphone afficher ?
- **Validité de 10 min** : réglage global, ou contrôle limité à Scan ?

## Tests prévus (aperçu, taille iPhone)
Connexion dans Safari puis en mode app, réouverture simulée après 2 h (session vieillie artificiellement), coupure réseau puis retour, session forcée expirée sur chacun des 5 écrans. Limite : pas de vrai iPhone ; les captures sont faites en simulation iPhone.

Aucune publication sans « GO PUBLICATION ».
