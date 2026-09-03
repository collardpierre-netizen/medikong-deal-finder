import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Column, Container, Head, Heading, Hr, Html, Preview, Row, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { AUDIT_NOTIFICATION_EMAIL } from '../audit-config.ts'

const SITE_NAME = 'MediKong'

interface AdminNewOrderProps {
  orderNumber?: string
  customerName?: string
  customerEmail?: string
  totalIncVat?: string
  totalExclVat?: string
  lineCount?: number
  vendorCount?: number
  paymentMethod?: string
  ctaUrl?: string
}

const AdminNewOrderEmail = ({
  orderNumber = 'MK-2026-00000',
  customerName = '—',
  customerEmail = '',
  totalIncVat = '0,00 EUR',
  totalExclVat = '0,00 EUR',
  lineCount = 0,
  vendorCount = 0,
  paymentMethod = '—',
  ctaUrl = 'https://medikong.pro/admin/commandes',
}: AdminNewOrderProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle commande {orderNumber} — {totalIncVat}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🛒 Nouvelle commande payée</Heading>

        <Text style={text}>
          Une nouvelle commande vient d'être encaissée sur {SITE_NAME}.
        </Text>

        <Section style={box}>
          <Row>
            <Column style={label}>N° de commande</Column>
            <Column style={value}><strong>{orderNumber}</strong></Column>
          </Row>
          <Row>
            <Column style={label}>Client</Column>
            <Column style={value}>{customerName}{customerEmail ? ` (${customerEmail})` : ''}</Column>
          </Row>
          <Row>
            <Column style={label}>Lignes</Column>
            <Column style={value}>{lineCount}</Column>
          </Row>
          <Row>
            <Column style={label}>Vendeurs concernés</Column>
            <Column style={value}>{vendorCount}</Column>
          </Row>
          <Row>
            <Column style={label}>Paiement</Column>
            <Column style={value}>{paymentMethod}</Column>
          </Row>
          <Hr style={divider} />
          <Row>
            <Column style={label}>Total HTVA</Column>
            <Column style={value}>{totalExclVat}</Column>
          </Row>
          <Row>
            <Column style={label}><strong>Total TTC</strong></Column>
            <Column style={{ ...value, fontSize: '16px', fontWeight: 'bold' }}>{totalIncVat}</Column>
          </Row>
        </Section>

        <Button href={ctaUrl} style={button}>Ouvrir la commande dans l'admin</Button>

        <Text style={footer}>Notification interne {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewOrderEmail,
  subject: (data: Record<string, any>) =>
    `Nouvelle commande ${data.orderNumber || ''} — ${data.totalIncVat || ''}`.trim(),
  displayName: 'Interne — Nouvelle commande',
  to: AUDIT_NOTIFICATION_EMAIL,
  previewData: {
    orderNumber: 'MK-2026-20064',
    customerName: 'Pharmacie Test',
    customerEmail: 'client@example.com',
    totalIncVat: '312,18 EUR',
    totalExclVat: '258,00 EUR',
    lineCount: 3,
    vendorCount: 2,
    paymentMethod: 'card',
    ctaUrl: 'https://medikong.pro/admin/commandes',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1E252F', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 18px' }
const box = { backgroundColor: '#f8f9fb', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid #e5e7eb' }
const label = { fontSize: '13px', color: '#6b7280', padding: '4px 0', verticalAlign: 'top' as const }
const value = { fontSize: '14px', color: '#1E252F', padding: '4px 0', textAlign: 'right' as const, verticalAlign: 'top' as const }
const divider = { borderColor: '#e5e7eb', margin: '12px 0' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
