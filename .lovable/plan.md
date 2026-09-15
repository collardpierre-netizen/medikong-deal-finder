# LOT 0 — Sous-domaine care.medikong.pro et routage deux-hôtes

Objectif : faire naître Care sur sa propre origine avant tout travail PWA. Aucun écran métier dans cette étape — uniquement l'ossature d'hôte, les routes, les redirections et la configuration d'authentification.

## 1. Détection d'hôte

Extension de `src/config/env.ts` (déjà en place pour prod/staging) avec une notion de **surface** :

- `care` : `care.medikong.pro`, `care.dev.medikong.pro`, et en local/preview via `?surface=care` mémorisé + variable `VITE_SURFACE=care`.
- `market` : tout le reste (`medikong.pro`, `www`, `dev.medikong.pro`, previews).

La surface est calculée une seule fois au chargement et exposée en constante (`APP_SURFACE`, `IS_CARE`, `IS_MARKET`). Aucun composant ne relit `window.location.hostname`.

## 2. Routage deux-hôtes

`App.tsx` choisit l'arbre de routes selon la surface :

- Surface `market` : arbre actuel inchangé (catalogue, compte, `/admin/*` superadmin).
- Surface `care` : arbre Care isolé, avec ses propres providers.

Routes Care posées dès maintenant (écrans réels livrés à l'étape suivante, ici des coquilles vides ou placeholders) :

```text
/                       → portail Care (remplace l'ancien portail)
/groups/:slug           → tableau de bord multi-groupes
/groups/:id             → back-office Groupe
/residences/:id         → back-office Résidence
/auth                   → connexion Care
/*                      → 404 Care
```

Les routes Care ne sont pas montées sur `medikong.pro`, et les routes marketplace ne sont pas montées sur Care : une URL croisée tombe sur le 404 de sa surface.

## 3. Redirections 301

Les anciennes URLs `/care/*` de `medikong.pro` doivent partir en 301 vers `care.medikong.pro/*` (chemin conservé, query conservée). L'hébergement Lovable ne lit pas de fichier de redirections : la seule voie disponible côté application est une redirection au chargement (`window.location.replace`) sur un composant monté sur `/care/*` de la surface market.

Conséquence à valider : ce sera une redirection navigateur, pas un vrai 301 HTTP. Pour le SEO c'est sans effet ici puisque Care est en `noindex` global, mais il faut le savoir. Si un vrai 301 est exigé, il faut un proxy en amont — hors périmètre Lovable.

## 4. Noindex global Care

Sur la surface Care : `<meta name="robots" content="noindex, nofollow">` monté inconditionnellement, aucune entrée dans le sitemap, aucun hreflang. Le composant existant de non-indexation pré-prod est réutilisé.

## 5. Configuration authentification

- Sessions distinctes : le stockage navigateur étant scopé à l'origine, `care.medikong.pro` a naturellement sa propre session. Aucun cookie sur `.medikong.pro`, on garde les réglages de stockage par défaut.
- Ajout de `https://care.medikong.pro/**` (et `https://care.medikong.pro`) dans les URLs de redirection autorisées de l'authentification, en gardant celles de `medikong.pro`.
- Les redirections d'authentification Care utilisent `window.location.origin`, jamais une URL codée en dur.
- Aucune modification des méthodes de connexion existantes dans cette étape.

## 6. Ce que je ne fais pas dans cette étape

Aucune migration base de données, aucun écran métier, aucun service worker ni manifeste PWA, aucun PIN, aucune souscription push. La PWA vient après, sur la bonne origine.

## Action manuelle de votre côté

Le sous-domaine `care.medikong.pro` doit être connecté au projet dans les réglages de domaines (TLS wildcard ou entrée dédiée). Je ne peux pas créer l'entrée DNS chez votre registrar. Dites-moi quand il répond, je vérifie.

## Critère de sortie

`care.medikong.pro/` sert le portail Care, `medikong.pro/care/...` redirige vers Care, une route Care sur `medikong.pro` renvoie 404, la connexion sur Care revient bien sur Care, et les deux surfaces ont des sessions indépendantes.
