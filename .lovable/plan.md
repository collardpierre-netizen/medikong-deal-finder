# Vérification email avant activation accès portail (mode ATTACH)

## Objectif strict
Quand un admin rattache un email à un vendeur existant (ATTACH), **ne plus activer immédiatement** `vendor.auth_user_id`. À la place, envoyer un email de vérification avec un token unique. L'accès n'est activé qu'après que le destinataire clique le lien.

**Hors scope** (non modifié) :
- Mode CREATE de `create-vendor-account` (création complète d'un vendeur from scratch)
- `self-register-vendor`
- Vendors déjà rattachés (`auth_user_id` non null)

## Comportement actuel (à corriger)
Deux chemins ATTACH écrivent `auth_user_id` immédiatement :
- `create-vendor-account` (branche `if (vendor_id)`)
- `attach-user-to-vendor` (edge function dédiée)

Risque : un admin saisit un email erroné → le titulaire de cet email obtient l'accès au portail vendeur sans preuve qu'il représente bien le vendeur.

## Nouveau flux

```text
Admin → ATTACH
  ├─ Trouve/crée le user auth (email_confirm=true)
  ├─ ⛔ N'écrit PAS vendor.auth_user_id
  ├─ Génère token random 32 octets, stocke SHA-256 + expires_at (24h)
  ├─ Envoie email "vendor-attach-verification" au candidat
  └─ Réponse admin : "Email de vérification envoyé"

Destinataire → clique lien /vendor/verifier-acces?token=XYZ
  └─ Page appelle verify-vendor-attach (public)
       ├─ Hash token, lookup non consommé + non expiré
       ├─ Met à jour vendors.auth_user_id + vendors.email
       ├─ Marque consumed_at
       ├─ Génère magic-link recovery (set password) côté serveur
       └─ Renvoie {ok, recovery_url, vendor_id}
  └─ Page affiche succès + bouton "Définir mon mot de passe"
```

## Changements

### 1. Migration SQL — `vendor_attach_verifications`
```sql
create table public.vendor_attach_verifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null,            -- auth.users.id pré-créé/résolu
  email text not null,
  token_hash text not null unique,  -- sha-256 hex
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by_admin_id uuid,         -- caller admin
  created_at timestamptz not null default now()
);
create index on public.vendor_attach_verifications (vendor_id) where consumed_at is null;
-- RLS : admin lecture, pas d'accès anon/authenticated (la consommation passe par edge function service_role)
grant select on public.vendor_attach_verifications to service_role;
grant all on public.vendor_attach_verifications to service_role;
alter table public.vendor_attach_verifications enable row level security;
create policy "Admins read attach verifications" on public.vendor_attach_verifications
  for select to authenticated using (public.is_admin());
```

### 2. Nouvelle edge function `verify-vendor-attach` (verify_jwt = false)
- Body : `{ token: string }`
- Hash SHA-256, lookup `vendor_attach_verifications` where `consumed_at IS NULL AND expires_at > now()`
- Re-check : `vendors.auth_user_id IS NULL` (sinon `already_attached`)
- Re-check : email non utilisé par un autre vendor (sinon `email_conflict`)
- Update vendor (`auth_user_id`, `email`), marque consumed_at
- Génère `recovery` magic-link, renvoie `{ok, vendor_id, recovery_url, login_email}`
- Log dans `audit_logs` (event `vendor_attach_verified`)

### 3. Modifier `create-vendor-account` (branche ATTACH) et `attach-user-to-vendor`
Remplacer le bloc « update vendors.auth_user_id » par :
- Génération token + insert `vendor_attach_verifications`
- Envoi email `vendor-attach-verification` (locale résolue) avec URL `https://www.medikong.pro/vendor/verifier-acces?token=...`
- Log dans `vendor_onboarding_email_logs` (nouveau template_name `vendor-attach-verification`, status `enqueued`/`failed`)
- Réponse : `{ ok: true, vendor_id, verification_sent: true, expires_at, message: "Email de vérification envoyé au candidat (valide 24h)" }`
- ⚠️ Si un user auth a été créé pour cette opération mais que l'envoi d'email échoue → on garde le user (il peut être réutilisé), on retourne tout de même `verification_sent: false` + `error` pour que l'admin renvoie

### 4. Nouveau template email `vendor-attach-verification.tsx`
FR/NL/EN, structure miroir de `vendor-account-created.tsx` :
- Sujet : "Confirmez votre accès vendeur MediKong" / NL / EN
- Corps : "Un admin MediKong a configuré un accès portail vendeur pour cette adresse email. Confirmez que vous êtes bien le représentant de **{companyName}** pour activer l'accès."
- Bouton : "Confirmer mon accès" → URL token
- Note : "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message. Le lien expire dans 24h."
- Enregistrer dans `registry.ts`

### 5. Nouvelle page `/vendor/verifier-acces` (`VendorVerifyAttachPage.tsx`)
- Lit `?token=` dans l'URL
- Appelle `verify-vendor-attach` au mount (1× via ref guard)
- États : `verifying` / `success` / `expired` / `already_used` / `error`
- Succès : carte "Accès activé ✅", bouton primaire "Définir mon mot de passe" (lien recovery_url), bouton secondaire "Aller à la connexion"
- noindex (la page est privée)

### 6. Route dans `src/App.tsx`
Ajouter `<Route path="/vendor/verifier-acces" element={<VendorVerifyAttachPage />} />` (lazy import)

### 7. UI admin — messages
- `VendorFormDialog.tsx` et `AdminVendeurDetail.tsx` : adapter le toast de succès post-ATTACH pour dire « Email de vérification envoyé à `{email}` (valide 24h). L'accès portail s'activera après confirmation. »
- `vendor-account-errors.ts` : ajouter codes éventuels (`verification_send_failed`)

### 8. Page admin `/admin/vendor-onboarding-emails`
Aucun changement structurel : les nouveaux logs (template `vendor-attach-verification`, mode `attach`) apparaissent automatiquement.

## Vérifications avant de clore
- `bunx tsc --noEmit`
- Test manuel : ATTACH depuis `/admin/vendeurs` → vérifier qu'aucun `auth_user_id` n'est posé, que la ligne `vendor_attach_verifications` existe, que l'email est loggé, qu'un appel `verify-vendor-attach` consomme la ligne et active l'accès.
