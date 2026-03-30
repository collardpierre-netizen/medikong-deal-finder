import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface OrderConfirmationProps {
  orderNumber?: string
  customerName?: string
  total?: string
  itemCount?: number
  shippingAddress?: string
  paymentMethod?: string
}

const OrderConfirmationEmail = ({
  orderNumber = 'MK-2026-00001',
  customerName,
  total = '0,00 EUR',
  itemCount = 0,
  shippingAddress,
  paymentMethod,
}: OrderConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmation de votre commande {orderNumber} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {customerName ? `Merci, ${customerName} !` : 'Merci pour votre commande !'}
        </Heading>

        <Text style={text}>
          Votre commande <strong style={{ color: '#1e3a5f' }}>{orderNumber}</strong> a bien été enregistrée.
          Nous la traitons dès maintenant.
        </Text>

        <Section style={summaryBox}>
          <Row>
            <Column style={summaryLabel}>N° de commande</Column>
            <Column style={summaryValue}>{orderNumber}</Column>
          </Row>
          {itemCount > 0 && (
            <Row>
              <Column style={summaryLabel}>Articles</Column>
              <Column style={summaryValue}>{itemCount} article{itemCount > 1 ? 's' : ''}</Column>
            </Row>
          )}
          {paymentMethod && (
            <Row>
              <Column style={summaryLabel}>Paiement</Column>
              <Column style={summaryValue}>{paymentMethod}</Column>
            </Row>
          )}
          {shippingAddress && (
            <Row>
              <Column style={summaryLabel}>Livraison</Column>
              <Column style={summaryValue}>{shippingAddress}</Column>
            </Row>
          )}
          <Hr style={divider} />
          <Row>
            <Column style={summaryLabel}><strong>Total TTC</strong></Column>
            <Column style={{ ...summaryValue, fontWeight: 'bold', fontSize: '16px' }}>{total}</Column>
          </Row>
        </Section>

        <Button href="https://medikong.pro/compte" style={button}>
          Suivre ma commande
        </Button>

        <Text style={footerText}>
          Si vous avez des questions, n'hésitez pas à nous contacter via notre centre d'aide.
        </Text>

        <Text style={footer}>
          L'équipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Confirmation de commande ${data.orderNumber || ''}`.trim(),
  displayName: 'Confirmation de commande',
  previewData: {
    orderNumber: 'MK-2026-00042',
    customerName: 'Dr. Martin',
    total: '1 245,00 EUR',
    itemCount: 3,
    shippingAddress: '23 rue de la Procession, B-7822 Ath',
    paymentMethod: 'Virement SEPA',
  },
} satisfies TemplateEntry

// Styles — MediKong branding
const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 24px' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '20px', marginBottom: '28px', border: '1px solid #d1d5db' }
const summaryLabel = { fontSize: '13px', color: '#6b7280', padding: '4px 0', verticalAlign: 'top' as const }
const summaryValue = { fontSize: '14px', color: '#1e3a5f', padding: '4px 0', textAlign: 'right' as const, verticalAlign: 'top' as const }
const divider = { borderColor: '#d1d5db', margin: '12px 0' }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const footerText = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 20px' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
