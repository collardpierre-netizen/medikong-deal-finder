import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  sellerPharmacy?: string
  buyerPharmacy?: string
  productName?: string
  ctaUrl?: string
}

const Email = ({ sellerPharmacy, buyerPharmacy, productName = 'votre offre', ctaUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{buyerPharmacy ?? 'Le destinataire'} a refusé votre offre privée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Offre privée refusée</Heading>
        <Text style={text}>Bonjour{sellerPharmacy ? ` ${sellerPharmacy}` : ''},</Text>
        <Text style={text}>
          <strong>{buyerPharmacy ?? 'Le destinataire'}</strong> a refusé votre offre privée sur{' '}
          <strong>{productName}</strong>.
        </Text>
        <Text style={text}>
          Vous pouvez en proposer une nouvelle, à un autre acheteur ou avec des conditions ajustées,
          depuis votre espace MediKong.
        </Text>
        {ctaUrl ? <Button href={ctaUrl} style={button}>Mes ventes privées</Button> : null}
        <Hr style={divider} />
        <Text style={footerText}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>MediKong SRL · TVA : BE 1005.771.323</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: ((d: Record<string, any>) => `Offre privée refusée — ${d.productName ?? 'MediKong'}`),
  displayName: 'P2P — Offre refusée (destinataire → vendeur)',
  previewData: {
    sellerPharmacy: 'Pharmacie Dupont', buyerPharmacy: 'Pharmacie Lambert',
    productName: 'Doliprane 1000 mg',
    ctaUrl: 'https://medikong.pro/compte/ventes-privees',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
