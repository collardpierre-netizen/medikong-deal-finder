import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  recipientPharmacy?: string
  sellerPharmacy?: string
  productName?: string
  brandName?: string | null
  gtin?: string | null
  cnk?: string | null
  quantity?: number
  unitPriceHt?: number
  totalHt?: number
  vatRate?: number
  validUntil?: string
  batchNumber?: string | null
  expiryDate?: string | null
  notes?: string | null
  ctaUrl?: string
}

const fmtEur = (v?: number) => (typeof v === 'number' ? `${v.toFixed(2)} €` : '—')

const Email = ({
  recipientPharmacy, sellerPharmacy, productName = 'un produit',
  brandName, gtin, cnk, quantity, unitPriceHt, totalHt, vatRate,
  validUntil, batchNumber, expiryDate, notes, ctaUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{sellerPharmacy ?? 'Un autre acheteur'} vous propose {productName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>📦 Nouvelle offre privée reçue</Heading>
        <Text style={text}>Bonjour{recipientPharmacy ? ` ${recipientPharmacy}` : ''},</Text>
        <Text style={text}>
          <strong>{sellerPharmacy ?? 'Un autre acheteur MediKong'}</strong> vous propose une vente privée
          directement via la plateforme MediKong.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}><strong>Produit :</strong> {productName}</Text>
          {brandName ? <Text style={infoLine}><strong>Marque :</strong> {brandName}</Text> : null}
          {gtin ? <Text style={infoLine}><strong>EAN :</strong> {gtin}</Text> : null}
          {cnk ? <Text style={infoLine}><strong>CNK :</strong> {cnk}</Text> : null}
          {batchNumber ? <Text style={infoLine}><strong>N° lot :</strong> {batchNumber}</Text> : null}
          {expiryDate ? <Text style={infoLine}><strong>Péremption :</strong> {expiryDate}</Text> : null}
          <Text style={infoLine}><strong>Quantité :</strong> {quantity}</Text>
          <Text style={infoLine}><strong>Prix unitaire HTVA :</strong> {fmtEur(unitPriceHt)}</Text>
          <Text style={infoLineHighlight}>
            <strong>Total :</strong> {fmtEur(totalHt)} HTVA {typeof vatRate === 'number' ? `(TVA ${vatRate}%)` : ''}
          </Text>
          {validUntil ? <Text style={infoLine}><strong>Validité :</strong> jusqu'au {validUntil}</Text> : null}
        </Section>

        {notes ? (
          <Section style={messageBox}>
            <Text style={messageText}>{notes}</Text>
          </Section>
        ) : null}

        {ctaUrl ? <Button href={ctaUrl} style={button}>Voir et répondre</Button> : null}

        <Text style={small}>
          Cette offre est <strong>nominative</strong> : seul votre compte peut l'accepter, la refuser ou négocier.
          La facturation reste prise en charge par MediKong.
        </Text>

        <Hr style={divider} />
        <Text style={footerText}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Ath, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: ((d: Record<string, any>) =>
    `📦 Offre privée reçue${d.sellerPharmacy ? ` de ${d.sellerPharmacy}` : ''} — ${d.productName ?? 'MediKong'}`),
  displayName: 'P2P — Offre reçue (vendeur → destinataire)',
  previewData: {
    recipientPharmacy: 'Pharmacie Lambert',
    sellerPharmacy: 'Pharmacie Dupont',
    productName: 'Doliprane 1000 mg, boîte de 8',
    brandName: 'Sanofi', gtin: '3400933123456', cnk: '0123456',
    quantity: 50, unitPriceHt: 1.85, totalHt: 92.5, vatRate: 6,
    validUntil: '24 juin 2026', notes: 'Lot proche péremption, prix attractif.',
    ctaUrl: 'https://medikong.pro/compte/offres-recues',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = { backgroundColor: '#f1f5f9', borderLeft: '3px solid #1B5BDA', borderRadius: '6px', padding: '14px 16px', margin: '18px 0' }
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '14px', color: '#1B5BDA', margin: '8px 0 0', lineHeight: '1.5', fontWeight: '600' as const }
const messageBox = { backgroundColor: '#fffbeb', borderLeft: '3px solid #f59e0b', borderRadius: '6px', padding: '12px 14px', margin: '14px 0' }
const messageText = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
