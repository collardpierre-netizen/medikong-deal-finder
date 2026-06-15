/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

type Locale = 'fr' | 'nl' | 'en'

interface VendorAttachVerificationProps {
  companyName?: string
  loginEmail: string
  verifyUrl: string
  locale?: Locale
}

const COPY: Record<Locale, {
  preview: string
  greeting: string
  intro: (company: string) => string
  loginLabel: string
  cta: string
  expiry: string
  ignore: string
  support: string
  subject: string
  signature: string
}> = {
  fr: {
    preview: 'Confirmez votre accès vendeur MediKong',
    greeting: 'Bonjour,',
    intro: (c) => `Un administrateur ${SITE_NAME} a configuré un accès au portail vendeur pour cette adresse email, rattaché à l'entreprise « ${c} ». Pour activer cet accès, confirmez que vous êtes bien autorisé à représenter ce vendeur en cliquant sur le bouton ci-dessous.`,
    loginLabel: 'Email concerné :',
    cta: 'Confirmer mon accès',
    expiry: 'Ce lien est valable 24 heures. Tant qu\'il n\'est pas cliqué, aucun accès n\'est activé.',
    ignore: 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement ce message — aucun accès ne sera créé.',
    support: 'Une question ? Écrivez-nous à support@medikong.pro',
    subject: 'Confirmez votre accès vendeur MediKong',
    signature: 'L\'équipe MediKong',
  },
  nl: {
    preview: 'Bevestig uw MediKong-verkopersaccount',
    greeting: 'Hallo,',
    intro: (c) => `Een ${SITE_NAME}-beheerder heeft een verkopersportaal-toegang geconfigureerd voor dit e-mailadres, gekoppeld aan het bedrijf "${c}". Om deze toegang te activeren, bevestig dat u gemachtigd bent om deze verkoper te vertegenwoordigen door op de knop hieronder te klikken.`,
    loginLabel: 'Betreffend e-mailadres:',
    cta: 'Mijn toegang bevestigen',
    expiry: 'Deze link is 24 uur geldig. Zolang er niet op wordt geklikt, wordt geen toegang geactiveerd.',
    ignore: 'Heeft u deze aanvraag niet gedaan? Negeer dit bericht — er wordt geen toegang aangemaakt.',
    support: 'Vragen? Mail ons via support@medikong.pro',
    subject: 'Bevestig uw MediKong-verkopersaccount',
    signature: 'Het MediKong-team',
  },
  en: {
    preview: 'Confirm your MediKong vendor access',
    greeting: 'Hello,',
    intro: (c) => `A ${SITE_NAME} administrator has configured vendor portal access for this email address, linked to the company "${c}". To activate this access, please confirm that you are authorised to represent this vendor by clicking the button below.`,
    loginLabel: 'Email concerned:',
    cta: 'Confirm my access',
    expiry: 'This link is valid for 24 hours. Until it is clicked, no access is activated.',
    ignore: 'If you did not request this, simply ignore this message — no access will be created.',
    support: 'Any question? Email us at support@medikong.pro',
    subject: 'Confirm your MediKong vendor access',
    signature: 'The MediKong team',
  },
}

const pickLocale = (l?: string): Locale => {
  const v = (l || '').toLowerCase()
  if (v === 'nl') return 'nl'
  if (v === 'en') return 'en'
  return 'fr'
}

const VendorAttachVerificationEmail = ({
  companyName,
  loginEmail,
  verifyUrl,
  locale,
}: VendorAttachVerificationProps) => {
  const t = COPY[pickLocale(locale)]
  return (
    <Html lang={pickLocale(locale)} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>{t.greeting}</Heading>
          <Text style={text}>{t.intro(companyName || '—')}</Text>

          <Section style={infoBox}>
            <Text style={infoLabel}>{t.loginLabel}</Text>
            <Text style={infoValue}>{loginEmail}</Text>
          </Section>

          <Button href={verifyUrl} style={button}>{t.cta}</Button>
          <Text style={smallText}>{t.expiry}</Text>

          <Hr style={divider} />
          <Text style={footerText}>{t.ignore}</Text>
          <Text style={footerText}>{t.support}</Text>
          <Text style={footer}>{t.signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: VendorAttachVerificationEmail,
  subject: (data: Record<string, any>) => COPY[pickLocale(data?.locale)].subject,
  displayName: 'Vendeur — vérification email (ATTACH)',
  previewData: {
    companyName: 'PharmaCorp SPRL',
    loginEmail: 'vendor@example.com',
    verifyUrl: 'https://www.medikong.pro/vendor/verifier-acces?token=preview',
    locale: 'fr',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '8px 0 20px' }
const infoBox = { backgroundColor: '#f3f6fb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const infoLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const infoValue = { fontSize: '15px', color: '#1e3a5f', fontWeight: '600' as const, margin: '0' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '8px 0 0' }
