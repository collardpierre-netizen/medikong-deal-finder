import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  invitationUrl?: string
  role?: string
  accountKind?: string
  locale?: string
}

type L = 'fr' | 'nl' | 'de' | 'en'
const pick = (l?: string): L => (l === 'nl' || l === 'de' || l === 'en' ? l : 'fr')

const COPY: Record<L, {
  kind: Record<string, string>; admin: string; member: string
  preview: (k: string) => string; title: string; intro: (k: string, r: string) => React.ReactNode
  how: string; cta: string; fallback: string; team: string; subject: string
}> = {
  fr: {
    kind: { vendor: 'vendeur', buyer: 'acheteur' }, admin: 'Administrateur', member: 'Membre',
    preview: (k) => `Vous êtes invité·e à rejoindre un compte ${k} sur ${SITE_NAME}`,
    title: `Vous êtes invité·e à rejoindre ${SITE_NAME}`,
    intro: (k, r) => <>Vous avez été invité·e à rejoindre un compte {k} sur <strong>{SITE_NAME}</strong> avec le rôle <strong>{r}</strong>.</>,
    how: "Cliquez sur le bouton ci-dessous pour accepter l'invitation. Connectez-vous (ou créez un compte) avec l'email exact qui a reçu ce message.",
    cta: "Accepter l'invitation",
    fallback: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    team: `L'équipe ${SITE_NAME}`,
    subject: `Invitation à rejoindre un compte sur ${SITE_NAME}`,
  },
  nl: {
    kind: { vendor: 'verkopers', buyer: 'kopers' }, admin: 'Beheerder', member: 'Lid',
    preview: (k) => `U bent uitgenodigd om lid te worden van een ${k}account op ${SITE_NAME}`,
    title: `U bent uitgenodigd voor ${SITE_NAME}`,
    intro: (k, r) => <>U bent uitgenodigd om lid te worden van een {k}account op <strong>{SITE_NAME}</strong> met de rol <strong>{r}</strong>.</>,
    how: 'Klik op de knop hieronder om de uitnodiging te aanvaarden. Meld u aan (of maak een account aan) met exact het e-mailadres dat dit bericht ontving.',
    cta: 'Uitnodiging aanvaarden',
    fallback: 'Werkt de knop niet? Kopieer deze link in uw browser:',
    team: `Het ${SITE_NAME}-team`,
    subject: `Uitnodiging om lid te worden van een account op ${SITE_NAME}`,
  },
  de: {
    kind: { vendor: 'Verkäufer', buyer: 'Käufer' }, admin: 'Administrator', member: 'Mitglied',
    preview: (k) => `Sie wurden eingeladen, einem ${k}konto auf ${SITE_NAME} beizutreten`,
    title: `Sie wurden zu ${SITE_NAME} eingeladen`,
    intro: (k, r) => <>Sie wurden eingeladen, einem {k}konto auf <strong>{SITE_NAME}</strong> mit der Rolle <strong>{r}</strong> beizutreten.</>,
    how: 'Klicken Sie auf die Schaltfläche unten, um die Einladung anzunehmen. Melden Sie sich mit genau der E-Mail-Adresse an (oder registrieren Sie sich), die diese Nachricht erhalten hat.',
    cta: 'Einladung annehmen',
    fallback: 'Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
    team: `Ihr ${SITE_NAME}-Team`,
    subject: `Einladung zu einem Konto auf ${SITE_NAME}`,
  },
  en: {
    kind: { vendor: 'seller', buyer: 'buyer' }, admin: 'Administrator', member: 'Member',
    preview: (k) => `You are invited to join a ${k} account on ${SITE_NAME}`,
    title: `You are invited to join ${SITE_NAME}`,
    intro: (k, r) => <>You have been invited to join a {k} account on <strong>{SITE_NAME}</strong> with the role <strong>{r}</strong>.</>,
    how: 'Click the button below to accept the invitation. Sign in (or create an account) with the exact email address that received this message.',
    cta: 'Accept invitation',
    fallback: "If the button doesn't work, copy this link into your browser:",
    team: `The ${SITE_NAME} team`,
    subject: `Invitation to join an account on ${SITE_NAME}`,
  },
}

const AccountInvitationEmail = ({ invitationUrl, role, accountKind, locale }: Props) => {
  const l = pick(locale)
  const c = COPY[l]
  const kindLabel = c.kind[accountKind ?? ''] ?? ''
  const roleLabel = role === 'admin' ? c.admin : c.member
  return (
    <Html lang={l} dir="ltr">
      <Head />
      <Preview>{c.preview(kindLabel)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>{c.title}</Heading>
          <Text style={text}>{c.intro(kindLabel, roleLabel)}</Text>
          <Text style={text}>{c.how}</Text>
          {invitationUrl && (
            <Button href={invitationUrl} style={button}>{c.cta}</Button>
          )}
          <Hr style={divider} />
          <Text style={footerText}>{c.fallback}</Text>
          <Text style={{ ...footerText, wordBreak: 'break-all' as const, color: '#1C58D9' }}>{invitationUrl}</Text>
          <Text style={footer}>{c.team}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccountInvitationEmail,
  subject: (data: Record<string, any>) => COPY[pick(data?.locale)].subject,
  displayName: 'Invitation compte',
  previewData: { invitationUrl: 'https://medikong.pro/account/invitation/abc123?lang=nl', role: 'member', accountKind: 'vendor', locale: 'nl' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '16px 0 0' }
