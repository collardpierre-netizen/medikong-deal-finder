/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'
const PORTAL_URL = 'https://www.medikong.pro/vendor/login'

type Locale = 'fr' | 'nl' | 'en'

interface VendorAccountCreatedProps {
  companyName?: string
  loginEmail: string
  recoveryUrl?: string | null
  tempPassword?: string | null
  locale?: Locale
}

const COPY: Record<Locale, {
  preview: string
  greeting: (n: string) => string
  intro: string
  loginLabel: string
  recoveryIntro: string
  recoveryButton: string
  tempPasswordIntro: string
  tempPasswordNote: string
  expiry: string
  support: string
  subject: string
  signature: string
}> = {
  fr: {
    preview: 'Votre accès vendeur MediKong est prêt',
    greeting: (n) => `Bienvenue${n ? `, ${n}` : ''} !`,
    intro: `Votre compte vendeur sur ${SITE_NAME} vient d'être créé par notre équipe. Vous pouvez dès maintenant accéder à votre portail pour configurer votre catalogue, vos prix et vos paramètres de livraison.`,
    loginLabel: 'Email de connexion :',
    recoveryIntro: 'Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre portail vendeur.',
    recoveryButton: 'Définir mon mot de passe',
    tempPasswordIntro: 'Voici votre mot de passe temporaire :',
    tempPasswordNote: 'Pour des raisons de sécurité, changez-le à votre première connexion depuis « Mon compte ».',
    expiry: 'Ce lien est valable 24 heures.',
    support: 'Une question ? Écrivez-nous à support@medikong.pro',
    subject: 'Votre accès vendeur MediKong',
    signature: 'L\'équipe MediKong',
  },
  nl: {
    preview: 'Uw MediKong-verkopersaccount is klaar',
    greeting: (n) => `Welkom${n ? `, ${n}` : ''}!`,
    intro: `Uw verkopersaccount op ${SITE_NAME} is zojuist door ons team aangemaakt. U kunt nu inloggen om uw catalogus, prijzen en verzendinstellingen te configureren.`,
    loginLabel: 'Login e-mail:',
    recoveryIntro: 'Klik op de knop hieronder om uw wachtwoord in te stellen en uw verkopersportaal te openen.',
    recoveryButton: 'Wachtwoord instellen',
    tempPasswordIntro: 'Hier is uw tijdelijk wachtwoord:',
    tempPasswordNote: 'Wijzig het bij uw eerste aanmelding via "Mijn account" voor de veiligheid.',
    expiry: 'Deze link is 24 uur geldig.',
    support: 'Vragen? Mail ons via support@medikong.pro',
    subject: 'Uw MediKong-verkopersaccount',
    signature: 'Het MediKong-team',
  },
  en: {
    preview: 'Your MediKong vendor account is ready',
    greeting: (n) => `Welcome${n ? `, ${n}` : ''}!`,
    intro: `Your vendor account on ${SITE_NAME} has just been created by our team. You can now access your portal to set up your catalog, prices and shipping settings.`,
    loginLabel: 'Login email:',
    recoveryIntro: 'Click the button below to set your password and access your vendor portal.',
    recoveryButton: 'Set my password',
    tempPasswordIntro: 'Here is your temporary password:',
    tempPasswordNote: 'For security reasons, please change it on first login from "My account".',
    expiry: 'This link is valid for 24 hours.',
    support: 'Any question? Email us at support@medikong.pro',
    subject: 'Your MediKong vendor account',
    signature: 'The MediKong team',
  },
}

const pickLocale = (l?: string): Locale => {
  const v = (l || '').toLowerCase()
  if (v === 'nl') return 'nl'
  if (v === 'en') return 'en'
  return 'fr'
}

const VendorAccountCreatedEmail = ({
  companyName,
  loginEmail,
  recoveryUrl,
  tempPassword,
  locale,
}: VendorAccountCreatedProps) => {
  const t = COPY[pickLocale(locale)]
  return (
    <Html lang={pickLocale(locale)} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>{t.greeting(companyName || '')}</Heading>
          <Text style={text}>{t.intro}</Text>

          <Section style={infoBox}>
            <Text style={infoLabel}>{t.loginLabel}</Text>
            <Text style={infoValue}>{loginEmail}</Text>
          </Section>

          {recoveryUrl ? (
            <>
              <Text style={text}>{t.recoveryIntro}</Text>
              <Button href={recoveryUrl} style={button}>{t.recoveryButton}</Button>
              <Text style={smallText}>{t.expiry}</Text>
            </>
          ) : tempPassword ? (
            <>
              <Text style={text}>{t.tempPasswordIntro}</Text>
              <Text style={codeBox}>{tempPassword}</Text>
              <Text style={smallText}>{t.tempPasswordNote}</Text>
              <Button href={PORTAL_URL} style={button}>{t.recoveryButton}</Button>
            </>
          ) : (
            <Button href={PORTAL_URL} style={button}>{t.recoveryButton}</Button>
          )}

          <Hr style={divider} />
          <Text style={footerText}>{t.support}</Text>
          <Text style={footer}>{t.signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: VendorAccountCreatedEmail,
  subject: (data: Record<string, any>) => COPY[pickLocale(data?.locale)].subject,
  displayName: 'Vendeur — création de compte',
  previewData: {
    companyName: 'PharmaCorp SPRL',
    loginEmail: 'vendor@example.com',
    recoveryUrl: 'https://www.medikong.pro/vendor/login',
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
const codeBox = { fontFamily: 'Courier, monospace', fontSize: '20px', fontWeight: 'bold' as const, color: '#1e3a5f', backgroundColor: '#f3f6fb', borderRadius: '8px', padding: '14px 18px', textAlign: 'center' as const, letterSpacing: '2px', margin: '0 0 12px' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
