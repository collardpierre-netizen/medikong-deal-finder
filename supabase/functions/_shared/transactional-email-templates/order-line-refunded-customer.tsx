import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface OrderLineRefundedCustomerProps {
  orderNumber?: string
  vendorName?: string
  productName?: string
  action?: 'cancel' | 'partial'
  quantityRefunded?: number
  quantityOrdered?: number
  refundAmountEur?: number
  reason?: string
}

const fmtEur = (v?: number) =>
  typeof v === 'number' ? `${v.toFixed(2)} €` : '—'

const OrderLineRefundedCustomerEmail = ({
  orderNumber = '—',
  vendorName,
  productName = 'un produit',
  action = 'cancel',
  quantityRefunded,
  quantityOrdered,
  refundAmountEur,
  reason,
}: OrderLineRefundedCustomerProps) => {
  const isPartial = action === 'partial'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>
        Mise à jour de votre commande {orderNumber} — remboursement de {fmtEur(refundAmountEur)}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

          <Heading style={h1}>Mise à jour de votre commande</Heading>

          <Text style={text}>Bonjour,</Text>

          <Text style={text}>
            {isPartial
              ? <>Le fournisseur {vendorName ? <strong>{vendorName}</strong> : 'concerné'} n'a pas pu vous livrer la totalité de l'article <strong>« {productName} »</strong> de votre commande <strong>{orderNumber}</strong>.</>
              : <>Le fournisseur {vendorName ? <strong>{vendorName}</strong> : 'concerné'} a annulé l'article <strong>« {productName} »</strong> de votre commande <strong>{orderNumber}</strong>.</>}
          </Text>

          <Section style={infoBox}>
            <Text style={infoLine}><strong>Commande :</strong> {orderNumber}</Text>
            <Text style={infoLine}><strong>Article :</strong> {productName}</Text>
            {typeof quantityOrdered === 'number' && (
              <Text style={infoLine}><strong>Quantité commandée :</strong> {quantityOrdered}</Text>
            )}
            {typeof quantityRefunded === 'number' && (
              <Text style={infoLine}>
                <strong>Quantité {isPartial ? 'non livrée' : 'annulée'} :</strong> {quantityRefunded}
              </Text>
            )}
            <Text style={infoLineHighlight}>
              <strong>Montant remboursé :</strong> {fmtEur(refundAmountEur)}
            </Text>
            {reason && (
              <Text style={infoLine}><strong>Motif fournisseur :</strong> {reason}</Text>
            )}
          </Section>

          <Text style={text}>
            Le remboursement a été initié sur le moyen de paiement utilisé lors de la commande.
            Il apparaîtra sur votre relevé sous <strong>5 à 10 jours ouvrés</strong> selon votre banque.
          </Text>

          <Text style={small}>
            Une question sur cette mise à jour ? Répondez à cet email ou contactez{' '}
            <a href="mailto:support@medikong.pro" style={link}>support@medikong.pro</a>.
          </Text>

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
}

export const template = {
  component: OrderLineRefundedCustomerEmail,
  subject: ((data: Record<string, any>) => {
    const num = data.orderNumber || ''
    return `Mise à jour de votre commande MediKong${num ? ` ${num}` : ''}`
  }),
  displayName: 'Acheteur — Ligne remboursée par le vendeur',
  previewData: {
    orderNumber: 'MK-2026-000123',
    vendorName: 'PharmaCorp',
    productName: 'Doliprane 1000 mg, boîte de 8',
    action: 'partial',
    quantityRefunded: 42,
    quantityOrdered: 92,
    refundAmountEur: 168.42,
    reason: 'Stock insuffisant',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '14px', color: '#059669', margin: '8px 0 0', lineHeight: '1.5', fontWeight: '600' as const }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
