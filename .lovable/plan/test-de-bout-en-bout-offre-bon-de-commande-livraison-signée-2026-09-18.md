# Test de bout en bout : offre → bon de commande → livraison signée → paiement

Objectif : rejouer le parcours complet sur une commande de test, sans toucher aux commandes réelles.

## Étapes prévues

1. **Partir d'une offre existante** (Medista ou MediKong) avec une référence vendeur, créer un devis de test puis la commande de test associée.
2. **Imprimer le bon de commande fournisseur** en PDF et vérifier qu'il contient bien le produit, la référence vendeur, le nom MediKong et le numéro de commande.
3. **Créer le bon de livraison** avec checklist et générer le lien de confirmation en ligne à remettre au client.
4. **Envoyer le lien au client** (adresse de test uniquement, jamais un vrai client) et vérifier la réception.
5. **Signer la checklist** via la page publique de confirmation : remarques, signature, horodatage.
6. **Débloquer le paiement** du fournisseur (complet / partiel / nul) et vérifier la trace dans l'historique.
7. Vous remettre le PDF et un récapitulatif de chaque vérification.

## Écritures nécessaires (autorisation demandée)

Ce test crée des données : 1 devis de test, 1 commande de test, 1 bon de livraison, 1 confirmation signée, 1 déblocage de paiement, 1 envoi d'e-mail vers une adresse de test. **Aucune migration, aucun déploiement, aucune modification de commande existante.**

Précisez avant que je démarre :
- l'adresse e-mail de test à utiliser pour l'envoi du lien ;
- le montant à débloquer côté fournisseur (complet, partiel, ou nul).

## Points déjà signalés, non traités ici

- `convert_quote_to_order` écrit dans des colonnes inexistantes depuis juin 2026 : la conversion automatique échoue, je créerai donc la commande de test à la main comme la dernière fois.
- Deux alertes de sécurité restent ouvertes (prix d'achat/marge fournisseur visibles par l'acheteur sur ses lignes de commande ; marge d'expédition MediKong sur les envois ReStock). Correction = une migration, en attente de votre feu vert.
