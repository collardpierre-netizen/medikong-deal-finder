import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  recipientPharmacy?: string
  authorPharmacy?: string
  productName?: string
  body?: string
  counterQuantity?: number | null
  counterUnitPriceHt?: number | null
  ctaUrl?: string
}

const fmtEur = (v?: number | null) => (typeof v === 'number' ? `${v.toFixed(2)} €` : null)

const Email = ({ recipientPharmacy, authorPharmacy, productName = 'votre offre', body, counterQuantity, counterUnitPriceHt, ctaUrl }: Props) => {
  const priceTxt = fmtEur(counterUnitPriceHt)
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{authorPharmacy ?? 'Une contrepartie'} vous a répondu sur {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
          <Heading style={h1}>💬 Nouveau message sur votre vente privée</Heading>
          <Text style={text}>Bonjour{recipientPharmacy ? ` ${recipientPharmacy}` : ''},</Text>
          <Text style={text}>
            <strong>{authorPharmacy ?? 'La contrepartie'}</strong> vous a envoyé un message concernant{' '}
            <strong>{productName}</strong>.
          </Text>

          {body ? (
            <Section style={messageBox}>
              <Text style={messageText}>{body}</Text>
            </Section>
          ) : null}

          {(counterQuantity != null || priceTxt) && (
            <Section style={infoBox}>
              <Text style={infoLineHighlight}>Contre-offre :</Text>
              {counterQuantity != null ? <Text style={infoLine}><strong>Quantité :</strong> {counterQuantity}</Text> : null}
              {priceTxt ? <Text style={infoLine}><strong>PU HTVA :</strong> {priceTxt}</Text> : null}
            </Section>
          )}

          {ctaUrl ? <Button href={ctaUrl} style={button}>Répondre</Button> : null}

          <Hr style={divider} />
          <Text style={footerText}>L'équipe {SITE_NAME}</Text>
          <Text style={legalFooter}>MediKong SRL · TVA : BE 1005.771.323</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: ((d: Record<string, any>) => `💬 Réponse${d.authorPharmacy ? ` de ${d.authorPharmacy}` : ''} — ${d.productName ?? 'vente privée'}`),
  displayName: 'P2P — Message / contre-offre',
  previewData: {
    recipientPharmacy: 'Pharmacie Dupont',
    authorPharmacy: 'Pharmacie Lambert',
    productName: 'Doliprane 1000 mg',
    body: 'Bonjour, êtes-vous ok à 1,70 € HTVA si je prends les 50 unités ?',
    counterQuantity: 50, counterUnitPriceHt: 1.70,
    ctaUrl: 'https://medikong.pro/compte/ventes-privees',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const messageBox = { backgroundColor: '#f1f5f9', borderLeft: '3px solid #1B5BDA', borderRadius: '6px', padding: '12px 14px', margin: '14px 0' }
const messageText = { fontSize: '14px', color: '#1D2530', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
const infoBox = { backgroundColor: '#fffbeb', borderLeft: '3px solid #f59e0b', borderRadius: '6px', padding: '12px 14px', margin: '14px 0' }
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '13px', color: '#92400e', margin: '0 0 6px', fontWeight: '600' as const }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
