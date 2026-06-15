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

interface VendorSelfRegisteredProps {
  companyName?: string
  loginEmail: string
  locale?: Locale
}

const COPY: Record<Locale, {
  preview: string
  greeting: (n: string) => string
  intro: string
  loginLabel: string
  reviewIntro: string
  reviewNote: string
  nextStepsTitle: string
  nextSteps: string[]
  cta: string
  support: string
  subject: string
  signature: string
}> = {
  fr: {
    preview: 'Votre candidature vendeur MediKong est bien reçue',
    greeting: (n) => `Merci${n ? `, ${n}` : ''} !`,
    intro: `Nous avons bien reçu votre candidature pour rejoindre ${SITE_NAME} en tant que vendeur. Notre équipe va l'examiner sous peu.`,
    loginLabel: 'Email de connexion :',
    reviewIntro: 'Votre compte est en cours de validation manuelle par notre équipe (en général sous 1-2 jours ouvrés).',
    reviewNote: 'Vous recevrez un email dès que votre compte sera approuvé, avec les prochaines étapes pour activer votre catalogue et vos offres.',
    nextStepsTitle: 'En attendant, vous pouvez :',
    nextSteps: [
      'Préparer votre catalogue produits (Excel ou CSV)',
      'Rassembler vos documents KYC (statuts, RIB, pièce d\'identité du gérant)',
      'Définir votre politique de livraison et vos zones desservies',
    ],
    cta: 'Accéder au portail vendeur',
    support: 'Une question ? Écrivez-nous à support@medikong.pro',
    subject: 'Votre candidature vendeur MediKong est bien reçue',
    signature: 'L\'équipe MediKong',
  },
  nl: {
    preview: 'Uw MediKong-verkoperskandidatuur is goed ontvangen',
    greeting: (n) => `Bedankt${n ? `, ${n}` : ''}!`,
    intro: `We hebben uw aanvraag om verkoper te worden op ${SITE_NAME} goed ontvangen. Ons team zal deze binnenkort bekijken.`,
    loginLabel: 'Login e-mail:',
    reviewIntro: 'Uw account wordt momenteel handmatig gevalideerd door ons team (meestal binnen 1-2 werkdagen).',
    reviewNote: 'U ontvangt een e-mail zodra uw account is goedgekeurd, met de volgende stappen om uw catalogus en aanbiedingen te activeren.',
    nextStepsTitle: 'In de tussentijd kunt u:',
    nextSteps: [
      'Uw productcatalogus voorbereiden (Excel of CSV)',
      'Uw KYC-documenten verzamelen (statuten, bankgegevens, ID van de zaakvoerder)',
      'Uw leveringsbeleid en bedieningszones bepalen',
    ],
    cta: 'Naar het verkopersportaal',
    support: 'Vragen? Mail ons via support@medikong.pro',
    subject: 'Uw MediKong-verkoperskandidatuur is goed ontvangen',
    signature: 'Het MediKong-team',
  },
  en: {
    preview: 'Your MediKong vendor application has been received',
    greeting: (n) => `Thank you${n ? `, ${n}` : ''}!`,
    intro: `We have received your application to join ${SITE_NAME} as a vendor. Our team will review it shortly.`,
    loginLabel: 'Login email:',
    reviewIntro: 'Your account is currently under manual review by our team (typically within 1-2 business days).',
    reviewNote: 'You will receive an email as soon as your account is approved, with next steps to activate your catalog and offers.',
    nextStepsTitle: 'In the meantime, you can:',
    nextSteps: [
      'Prepare your product catalog (Excel or CSV)',
      'Gather your KYC documents (incorporation papers, bank details, ID of the manager)',
      'Define your shipping policy and serviced zones',
    ],
    cta: 'Go to vendor portal',
    support: 'Any question? Email us at support@medikong.pro',
    subject: 'Your MediKong vendor application has been received',
    signature: 'The MediKong team',
  },
}

const pickLocale = (l?: string): Locale => {
  const v = (l || '').toLowerCase()
  if (v === 'nl') return 'nl'
  if (v === 'en') return 'en'
  return 'fr'
}

const VendorSelfRegisteredEmail = ({
  companyName,
  loginEmail,
  locale,
}: VendorSelfRegisteredProps) => {
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

          <Text style={text}>{t.reviewIntro}</Text>
          <Text style={text}>{t.reviewNote}</Text>

          <Text style={{ ...text, fontWeight: 600, color: '#1e3a5f', marginTop: '20px' }}>{t.nextStepsTitle}</Text>
          {t.nextSteps.map((step, i) => (
            <Text key={i} style={{ ...text, margin: '4px 0 4px 12px' }}>• {step}</Text>
          ))}

          <Button href={PORTAL_URL} style={button}>{t.cta}</Button>

          <Hr style={divider} />
          <Text style={footerText}>{t.support}</Text>
          <Text style={footer}>{t.signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: VendorSelfRegisteredEmail,
  subject: (data: Record<string, any>) => COPY[pickLocale(data?.locale)].subject,
  displayName: 'Vendeur — candidature reçue (self-signup)',
  previewData: {
    companyName: 'PharmaCorp SPRL',
    loginEmail: 'vendor@example.com',
    locale: 'fr',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f3f6fb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const infoLabel = { fontSize: '12px', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const infoValue = { fontSize: '15px', color: '#1e3a5f', fontWeight: '600' as const, margin: '0' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginTop: '12px', marginBottom: '20px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
