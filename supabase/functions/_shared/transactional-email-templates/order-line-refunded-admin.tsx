import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'

interface OrderLineRefundedAdminProps {
  orderNumber?: string
  orderId?: string
  vendorName?: string
  vendorId?: string
  productName?: string
  lineId?: string
  action?: 'cancel' | 'partial'
  quantityRefunded?: number
  quantityOrdered?: number
  refundAmountEur?: number
  stripeRefundId?: string
  reason?: string
}

const fmtEur = (v?: number) =>
  typeof v === 'number' ? `${v.toFixed(2)} €` : '—'

const OrderLineRefundedAdminEmail = ({
  orderNumber = '—',
  orderId,
  vendorName,
  vendorId,
  productName = '—',
  lineId,
  action = 'cancel',
  quantityRefunded,
  quantityOrdered,
  refundAmountEur,
  stripeRefundId,
  reason,
}: OrderLineRefundedAdminProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      [Admin] Refund vendeur {vendorName || ''} sur {orderNumber} — {fmtEur(refundAmountEur)}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          [Admin] Vendor refund — {vendorName || '—'} sur {orderNumber}
        </Heading>

        <Text style={text}>
          Un vendeur vient d'effectuer un remboursement {action === 'partial' ? 'partiel' : 'total'}{' '}
          sur une ligne de commande. Détails ci-dessous pour le suivi comptable.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}><strong>Commande :</strong> {orderNumber} {orderId ? `(id: ${orderId})` : ''}</Text>
          <Text style={infoLine}><strong>Vendeur :</strong> {vendorName || '—'} {vendorId ? `(id: ${vendorId})` : ''}</Text>
          <Text style={infoLine}><strong>Produit :</strong> {productName}</Text>
          {lineId && <Text style={infoLine}><strong>Line ID :</strong> {lineId}</Text>}
          <Text style={infoLine}><strong>Action :</strong> {action}</Text>
          {typeof quantityOrdered === 'number' && (
            <Text style={infoLine}><strong>Qté commandée :</strong> {quantityOrdered}</Text>
          )}
          {typeof quantityRefunded === 'number' && (
            <Text style={infoLine}><strong>Qté remboursée :</strong> {quantityRefunded}</Text>
          )}
          <Text style={infoLineHighlight}>
            <strong>Montant remboursé :</strong> {fmtEur(refundAmountEur)}
          </Text>
          {stripeRefundId && (
            <Text style={infoLine}><strong>Stripe refund :</strong> {stripeRefundId}</Text>
          )}
          {reason && <Text style={infoLine}><strong>Motif :</strong> {reason}</Text>}
        </Section>

        <Hr style={divider} />
        <Text style={footer}>Notification automatique — {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderLineRefundedAdminEmail,
  subject: ((data: Record<string, any>) => {
    const v = data.vendorName || 'Vendeur'
    const n = data.orderNumber || '—'
    return `[Admin] Vendor refund — ${v} sur ${n}`
  }),
  to: 'pit@medikong.pro',
  displayName: 'Admin — Ligne remboursée par le vendeur',
  previewData: {
    orderNumber: 'MK-2026-000123',
    orderId: '11111111-1111-1111-1111-111111111111',
    vendorName: 'PharmaCorp',
    vendorId: '22222222-2222-2222-2222-222222222222',
    productName: 'Doliprane 1000 mg, boîte de 8',
    lineId: '33333333-3333-3333-3333-333333333333',
    action: 'partial',
    quantityRefunded: 42,
    quantityOrdered: 92,
    refundAmountEur: 168.42,
    stripeRefundId: 're_1ABCDEFGHIJKLMNOP',
    reason: 'Stock insuffisant',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { fontSize: '18px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 12px' }
const infoBox = {
  backgroundColor: '#f8fafc',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '12px 14px',
  margin: '12px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '3px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '14px', color: '#dc2626', margin: '6px 0 0', lineHeight: '1.5', fontWeight: '600' as const }
const divider = { borderColor: '#e5e7eb', margin: '16px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
