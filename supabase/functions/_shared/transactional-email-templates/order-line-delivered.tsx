import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  orderNumber?: string
  vendorLabel?: string
  productName?: string
  quantity?: number
  orderUrl?: string
}

const OrderLineDeliveredEmail = ({
  orderNumber = '—',
  vendorLabel = 'Le fournisseur',
  productName = 'un produit',
  quantity,
  orderUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Livraison confirmée — Commande {orderNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Livraison confirmée</Heading>
        <Text style={text}>Bonjour,</Text>
        <Text style={text}>
          <strong>{vendorLabel}</strong> a marqué la ligne <strong>« {productName} »</strong>
          {typeof quantity === 'number' ? <> (qté {quantity})</> : null} de votre commande <strong>{orderNumber}</strong> comme <strong>livrée</strong>.
        </Text>
        <Section style={infoBox}>
          <Text style={infoLine}><strong>Commande :</strong> {orderNumber}</Text>
          <Text style={infoLine}><strong>Article :</strong> {productName}</Text>
          {typeof quantity === 'number' && (
            <Text style={infoLine}><strong>Quantité :</strong> {quantity}</Text>
          )}
          <Text style={infoLineHighlight}><strong>Statut :</strong> Livrée ✓</Text>
        </Section>
        <Text style={text}>
          Un problème avec votre livraison ? Répondez à cet email ou contactez{' '}
          <a href="mailto:support@medikong.pro" style={link}>support@medikong.pro</a>.
        </Text>
        {orderUrl && (
          <Text style={small}><a href={orderUrl} style={link}>Voir ma commande →</a></Text>
        )}
        <Hr style={divider} />
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong by Balooh SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Ath, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderLineDeliveredEmail,
  subject: ((data: Record<string, any>) =>
    `Livraison confirmée — Commande MediKong${data.orderNumber ? ` ${data.orderNumber}` : ''}`),
  displayName: 'Acheteur — Ligne livrée',
  previewData: {
    orderNumber: 'MK-2026-000123',
    vendorLabel: 'Fournisseur ABC123',
    productName: 'Doliprane 1000 mg, boîte de 8',
    quantity: 12,
    orderUrl: 'https://medikong.pro/commande/xxx',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = { backgroundColor: '#f1f5f9', borderLeft: '3px solid #059669', borderRadius: '6px', padding: '14px 16px', margin: '18px 0' }
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '14px', color: '#059669', margin: '8px 0 0', lineHeight: '1.5', fontWeight: '600' as const }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none', fontWeight: 600 as const }
