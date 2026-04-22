---
name: Convention Vendeur Email Automation
description: Système d'emails automatiques autour de la signature de la convention de mandat de facturation vendeur (soumission, confirmation, relances graduées J+3 / J+7 / J+14)
type: feature
---

# Convention Vendeur — Emails Automatiques

## Templates transactionnels (registry.ts)

| Template | Destinataire | Déclencheur |
|----------|--------------|-------------|
| `vendor-contract-submitted` | Vendeur | Au montage de `MandatFacturationFlow` (1×/vendeur/version) |
| `vendor-contract-signed` | Vendeur | Après insertion réussie en `seller_contracts` |
| `admin-contract-notification` | `admin@medikong.pro` | Après insertion réussie en `seller_contracts` |
| `vendor-contract-reminder` | Vendeur | Cron quotidien `send-contract-reminders-daily` (09h UTC) |

## Variables dynamiques B2B (templateData)

- **vendorCompanyName** — raison sociale (ex: "PharmaCorp SRL")
- **signerName / contact_name** — nom du signataire ou contact
- **contractVersion** — version de la convention (`v1.0`)
- **signedAtFormatted** — date+heure FR-BE
- **downloadUrl** — URL signée 1h vers le PDF stocké dans `seller-contracts`
- **contractUrl** — `${origin}/vendor/contract`
- **missingFields** — colonnes profil incomplètes (alerte dans submitted)
- **daysSinceInvitation** — jours écoulés depuis `validated_at` (ou `created_at`)
- **reminderLevel** — 1 (J+3), 2 (J+7), 3 (J+14) — change le ton et l'objet

## Idempotence

- Soumission : `contract-submitted-{vendorId}-{version}`
- Signature vendeur : `contract-signed-{contractId}`
- Notification admin : `admin-contract-{contractId}`
- Relance : `contract-reminder-{vendorId}-L{level}-{YYYY-MM-DD}` (max 1×/jour/niveau)

## Edge function de relances

`send-contract-reminders` (cron `0 9 * * *`) :
1. Liste vendeurs `is_active = true`
2. Exclut ceux ayant un `seller_contracts` de type `mandat_facturation`
3. Calcule `daysSince = today - (validated_at || created_at)`
4. Sélectionne le niveau le plus élevé atteint (3 > 2 > 1)
5. Invoke `send-transactional-email` avec idempotencyKey daté

## Ton B2B des relances

- **L1 (J+3)** : 👋 amical, "petit rappel"
- **L2 (J+7)** : ⏰ insistant, rappelle l'obligation légale (art. 53 §2 CTVA)
- **L3 (J+14+)** : 🚨 dernier rappel, mentionne suspension du compte
