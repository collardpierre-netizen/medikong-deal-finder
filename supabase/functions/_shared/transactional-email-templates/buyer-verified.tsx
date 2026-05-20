import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'
const BONNES_AFFAIRES_URL = 'https://www.medikong.pro/bonnes-affaires'

interface BuyerVerifiedProps {
  companyName?: string
}

const BuyerVerifiedEmail = ({ companyName }: BuyerVerifiedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>✅ Votre compte acheteur {SITE_NAME} est validé</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>
          Bienvenue{companyName ? `, ${companyName}` : ''} !
        </Heading>
        <Text style={text}>
          Votre compte acheteur sur <strong>{SITE_NAME}</strong> vient d'être{' '}
          <strong style={{ color: '#059669' }}>validé</strong> par notre équipe.
        </Text>
        <Text style={text}>
          Vous avez désormais accès aux prix professionnels HTVA, à la commande en ligne
          et aux <strong>Bonnes Affaires</strong> : promotions et déstockages négociés
          auprès de nos vendeurs partenaires.
        </Text>
        <Button href={BONNES_AFFAIRES_URL} style={button}>
          Voir les Bonnes Affaires
        </Button>
        <Hr style={divider} />
        <Text style={footerText}>
          Des questions ? Contactez notre équipe à support@medikong.pro
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BuyerVerifiedEmail,
  subject: '✅ Votre compte acheteur MediKong est validé',
  displayName: 'Acheteur validé',
  previewData: { companyName: 'Pharmacie du Centre' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
