import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface OrderCancelledCustomerProps {
  orderNumber?: string
  customerName?: string
  total?: string
  cancelledAt?: string
  reason?: string
  wasPaid?: boolean
}

const OrderCancelledCustomerEmail = ({
  orderNumber = '—',
  customerName,
  total,
  cancelledAt,
  reason,
  wasPaid = false,
}: OrderCancelledCustomerProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre commande {orderNumber} a été annulée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>Votre commande a été annulée</Heading>

        <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>

        <Text style={text}>
          Votre commande <strong>{orderNumber}</strong> a été annulée{cancelledAt ? ` le ${cancelledAt}` : ''}.
          Elle ne sera pas préparée ni expédiée.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}><strong>Commande :</strong> {orderNumber}</Text>
          {total && <Text style={infoLine}><strong>Montant :</strong> {total}</Text>}
          {reason && <Text style={infoLine}><strong>Motif :</strong> {reason}</Text>}
          <Text style={infoLine}><strong>Statut :</strong> Annulée</Text>
        </Section>

        {wasPaid ? (
          <Text style={text}>
            Votre paiement vous sera remboursé. Le délai dépend de votre banque
            (généralement <strong>5 à 10 jours ouvrés</strong>).
          </Text>
        ) : (
          <Text style={text}>
            Aucun montant n'est dû pour cette commande. Si vous avez déjà effectué un virement,
            répondez à cet e-mail : nous procéderons au remboursement.
          </Text>
        )}

        <Text style={small}>
          Une question ? Répondez à cet e-mail ou écrivez à{' '}
          <a href="mailto:support@medikong.pro" style={link}>support@medikong.pro</a>.
        </Text>

        <Hr style={divider} />
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Meslin-l'Évêque, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderCancelledCustomerEmail,
  subject: ((data: Record<string, any>) => {
    const num = data.orderNumber || ''
    return `Annulation de votre commande MediKong${num ? ` ${num}` : ''}`
  }),
  displayName: 'Acheteur — Commande annulée',
  previewData: {
    orderNumber: 'MK-2026-000123',
    customerName: 'Pharmacie du Centre',
    total: '1 463,43 €',
    cancelledAt: '16/09/2026',
    reason: 'Annulation à votre demande',
    wasPaid: false,
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
  borderLeft: '3px solid #EF4343',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
