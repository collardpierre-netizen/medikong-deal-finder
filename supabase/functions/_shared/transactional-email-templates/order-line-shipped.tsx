import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface OrderLine {
  name: string
  quantity: number
  unitPriceTtc?: number | null
  lineTotalTtc?: number | null
}

interface Props {
  orderNumber?: string
  vendorLabel?: string
  productName?: string
  quantityShipped?: number
  quantityOrdered?: number
  trackingNumber?: string
  trackingUrl?: string
  carrierName?: string
  isPartial?: boolean
  orderUrl?: string
  lines?: OrderLine[]
  totalIncl?: number | null
  currency?: string
}

const fmt = (n: number | null | undefined, currency = 'EUR') =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-BE', { style: 'currency', currency }).format(n)
    : '—'

const OrderLineShippedEmail = ({
  orderNumber = '—',
  vendorLabel = 'Le fournisseur',
  productName = 'un produit',
  quantityShipped,
  quantityOrdered,
  trackingNumber,
  trackingUrl,
  carrierName,
  isPartial = false,
  orderUrl,
  lines,
  totalIncl,
  currency = 'EUR',
}: Props) => {
  const items: OrderLine[] =
    lines && lines.length > 0
      ? lines
      : [{ name: productName, quantity: quantityOrdered ?? quantityShipped ?? 1 }]

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre commande {orderNumber} a été expédiée</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
          <Heading style={h1}>Votre commande a été expédiée</Heading>
          <Text style={text}>Bonjour,</Text>
          <Text style={text}>
            <strong>{vendorLabel}</strong> vient d'expédier votre commande{' '}
            <strong>{orderNumber}</strong>. Elle est désormais en cours de livraison
            {isPartial ? ' (expédition partielle, un reliquat suivra)' : ''}.
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>Détail de votre commande</Text>
            {items.map((it, i) => (
              <Text key={i} style={infoLine}>
                • {it.quantity}× {it.name}
                {typeof it.lineTotalTtc === 'number'
                  ? ` — ${fmt(it.lineTotalTtc, currency)}`
                  : typeof it.unitPriceTtc === 'number'
                    ? ` — ${fmt(it.unitPriceTtc * it.quantity, currency)}`
                    : ''}
              </Text>
            ))}
            {typeof totalIncl === 'number' && (
              <Text style={totalLine}>
                <strong>Total TTC : {fmt(totalIncl, currency)}</strong>
              </Text>
            )}
          </Section>

          {(carrierName || trackingNumber || trackingUrl) && (
            <Section style={trackingBox}>
              <Text style={infoTitle}>Informations de livraison</Text>
              {carrierName && (
                <Text style={infoLine}><strong>Transporteur :</strong> {carrierName}</Text>
              )}
              {trackingNumber && (
                <Text style={infoLine}><strong>N° de suivi :</strong> {trackingNumber}</Text>
              )}
              {trackingUrl && (
                <Text style={infoLine}>
                  <strong>Lien de suivi :</strong>{' '}
                  <a href={trackingUrl} style={link}>Suivre le colis →</a>
                </Text>
              )}
              {!trackingUrl && trackingNumber && (
                <Text style={small}>
                  Conservez ce numéro pour suivre votre colis auprès du transporteur.
                </Text>
              )}
            </Section>
          )}

          {orderUrl && (
            <Text style={small}><a href={orderUrl} style={link}>Voir ma commande →</a></Text>
          )}
          <Hr style={divider} />
          <Text style={footer}>L'équipe {SITE_NAME}</Text>
          <Text style={legalFooter}>
            MediKong SRL · TVA : BE 1005.771.323<br />
            23 rue de la Procession, B-7822 Ath, Belgique
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderLineShippedEmail,
  subject: ((data: Record<string, any>) =>
    `Votre commande MediKong${data.orderNumber ? ` ${data.orderNumber}` : ''} a été expédiée`),
  displayName: 'Acheteur — Commande expédiée',
  previewData: {
    orderNumber: 'MK-2026-000123',
    vendorLabel: 'Fournisseur ABC123',
    productName: 'Doliprane 1000 mg, boîte de 8',
    quantityShipped: 8,
    quantityOrdered: 12,
    trackingNumber: '3SBPM1234567890',
    trackingUrl: 'https://tracking.bpost.be/btr/web/#/search?itemCode=3SBPM1234567890',
    carrierName: 'bpost',
    isPartial: false,
    orderUrl: 'https://medikong.pro/commande/xxx',
    lines: [
      { name: 'Doliprane 1000 mg, boîte de 8', quantity: 12, unitPriceTtc: 2.5, lineTotalTtc: 30 },
    ],
    totalIncl: 30,
    currency: 'EUR',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = { backgroundColor: '#f1f5f9', borderLeft: '3px solid #1B5BDA', borderRadius: '6px', padding: '14px 16px', margin: '18px 0' }
const trackingBox = { backgroundColor: '#f8fafc', borderLeft: '3px solid #1B5BDA', borderRadius: '6px', padding: '14px 16px', margin: '12px 0' }
const infoTitle = { fontSize: '13px', color: '#1D2530', margin: '0 0 8px', fontWeight: '700' as const }
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const totalLine = { fontSize: '14px', color: '#1B5BDA', margin: '12px 0 0', lineHeight: '1.5' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none', fontWeight: 600 as const }
