import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'

interface OrderMessageAdminProps {
  orderNumber?: string
  customerName?: string
  customerEmail?: string
  message?: string
  ctaUrl?: string
}

const OrderMessageAdminEmail = ({
  orderNumber = 'MK-2026-00000',
  customerName = '—',
  customerEmail = '',
  message = '',
  ctaUrl = 'https://medikong.pro/admin/commandes',
}: OrderMessageAdminProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réponse client sur la commande {orderNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Réponse client sur une commande</Heading>

        <Text style={text}>
          <strong>{customerName}</strong>{customerEmail ? ` (${customerEmail})` : ''} a répondu sur la commande{' '}
          <strong>{orderNumber}</strong>.
        </Text>

        <Section style={box}>
          <Text style={quote}>{message}</Text>
        </Section>

        <Button style={button} href={ctaUrl}>
          Ouvrir la commande
        </Button>

        <Hr style={hr} />
        <Text style={footer}>{SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderMessageAdminEmail,
  subject: (data: Record<string, any>) =>
    `Réponse client — commande ${data?.orderNumber ?? ''}`.trim(),
  displayName: 'Réponse client — commande',
  previewData: {
    orderNumber: 'MK-2026-20064',
    customerName: 'Pharmacie Centrale',
    customerEmail: 'contact@pharma.be',
    message: 'Merci, une livraison groupée nous convient.',
    ctaUrl: 'https://medikong.pro/admin/commandes/123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const h1 = { fontSize: '20px', color: '#1E252F', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#1E252F', lineHeight: '22px' }
const box = {
  backgroundColor: '#F8FAFC',
  borderLeft: '3px solid #1C58D9',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '16px 0',
}
const quote = { fontSize: '14px', color: '#1E252F', lineHeight: '22px', whiteSpace: 'pre-line' as const, margin: 0 }
const button = {
  backgroundColor: '#1C58D9',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 20px',
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#E2E8F0', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#8B95A5' }
