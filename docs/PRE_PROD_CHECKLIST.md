# Checklist de migration MediKong vers production

À exécuter dans cet ordre, sans exception, **avec un backup DB et un snapshot du code** en début de procédure.

---

## 1. Code & environnement

- [ ] `bun run scripts/pre-prod-check.ts` retourne 0 erreur (cf. `scripts/pre-prod-check.ts`)
- [ ] Aucune occurrence de `console.log`, `debugger`, `lorem ipsum` dans `src/`
- [ ] Le bandeau `<EnvBanner />` ne s'affiche pas sur `medikong.pro` (test visuel)
- [ ] `<head>` ne contient PAS `<meta name="robots" content="noindex">` en prod
- [ ] `public/robots.txt` autorise le crawl en prod (cf. section dédiée plus bas)
- [ ] Tous les liens internes pointent vers `medikong.pro` (pas `dev.medikong.pro`, pas `*.lovable.app`)
- [ ] Stripe en clés `sk_live_...` / `pk_live_...` côté secrets edge functions et Cloud
- [ ] Domaines email expéditeurs vérifiés (Resend) sur `medikong.pro`

## 2. Données (Lovable Cloud / Supabase)

- [ ] Backup complet de la base avant toute purge (bouton `/admin/db-backups`)
- [ ] Migration `supabase/migrations/_pending/pre_prod_purge.sql` revue ligne à ligne, puis exécutée manuellement
- [ ] Aucun compte avec email `@test.`, `@example.com`, `+test@`
- [ ] Aucun panier > 30 jours en statut `active`
- [ ] Aucun témoignage placeholder (`lorem`, `placeholder`, `à compléter`)
- [ ] La vue `public_marketplace_metrics` retourne des chiffres cohérents
- [ ] Vue `admin_search_zero_results_with_suggestions` revue : top trous catalogue triés
- [ ] RLS audit : `audit_backup_tables_rls()` retourne 0 alerte

## 3. SEO

- [ ] Edge function `sitemap.xml` génère bien la version prod (`SITE_URL=https://medikong.pro`)
- [ ] OG image / Twitter Card vérifiées sur Home, Catalogue, Fiche produit, Fiche marque
- [ ] Schema.org (`Organization`, `WebSite`, `Product`) présent sur les routes ciblées
- [ ] Hreflang FR/NL/DE/EN cohérents (`HreflangTags`)
- [ ] Search Console : nouvelle propriété `medikong.pro` ajoutée et sitemap soumis

## 4. Légal / conformité

- [ ] Mentions légales à jour : Balooh SRL, BCE 1005.771.323, 23 rue de la Procession 7822 Ath
- [ ] CGV publiées et acceptées par tous les fournisseurs actifs (table `vendor_contracts`)
- [ ] Politique de confidentialité conforme RGPD (export + suppression compte testés)
- [ ] Cookie banner fonctionnel + GTM consent mode opérationnel
- [ ] Conformité FAGG/AFMPS visible sur les pages concernées

## 5. Monitoring & Observabilité

- [ ] Alertes mail admin en place (notifications critiques RFQ, paiements, KYC)
- [ ] Logs Lovable Cloud consultables et purge planifiée OK
- [ ] Dashboard `/admin/marketplace-metrics` consulté → cohérence finale

## 6. Bascule

- [ ] DNS `medikong.pro` pointe sur le hosting Lovable
- [ ] Custom domain configuré dans Lovable (Project Settings → Domains)
- [ ] Test E2E : signup → vérification → ajout panier → checkout (sandbox Stripe live OK)
- [ ] Surveillance active 24h post-bascule (taux d'erreur, latence checkout, premiers users)

## En cas de pépin

- Rollback DNS sous 5 min vers `dev.medikong.pro`
- `restore_brands_from_backup()` si données marques corrompues
- `db-backups` → restore SQL d'urgence sur tables critiques
