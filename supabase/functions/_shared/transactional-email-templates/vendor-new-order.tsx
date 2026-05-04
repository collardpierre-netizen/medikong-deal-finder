import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface VendorNewOrderProps {
  vendorName?: string
  orderNumber?: string
  lineCount?: number
  vendorTotalIncVat?: string
  hoursToConfirm?: number
  hoursToShip?: number
  ctaUrl?: string
}

const VendorNewOrderEmail = ({
  vendorName,
  orderNumber = 'MK-2026-00000',
  lineCount = 0,
  vendorTotalIncVat = '0,00 EUR',
  hoursToConfirm = 12,
  hoursToShip = 24,
  ctaUrl = 'https://medikong.pro/vendor/commandes',
}: VendorNewOrderProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle commande {orderNumber} à traiter — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>📦 Nouvelle commande à traiter</Heading>

        <Text style={text}>
          Bonjour{vendorName ? ` ${vendorName}` : ''},
        </Text>

        <Text style={text}>
          Vous venez de recevoir une nouvelle commande payée sur {SITE_NAME}.
          Merci de la confirmer puis de l'expédier dans les délais ci-dessous.
        </Text>

        <Section style={summaryBox}>
          <Row>
            <Column style={summaryLabel}>N° de commande</Column>
            <Column style={summaryValue}><strong>{orderNumber}</strong></Column>
          </Row>
          <Row>
            <Column style={summaryLabel}>Lignes à préparer</Column>
            <Column style={summaryValue}>{lineCount} ligne{lineCount > 1 ? 's' : ''}</Column>
          </Row>
          <Hr style={divider} />
          <Row>
            <Column style={summaryLabel}><strong>Total TTC</strong></Column>
            <Column style={{ ...summaryValue, fontSize: '16px', fontWeight: 'bold' }}>{vendorTotalIncVat}</Column>
          </Row>
        </Section>

        <Section style={slaBox}>
          <Text style={slaTitle}>⏱ Délais à respecter</Text>
          <Text style={slaLine}>• Confirmation : sous <strong>{hoursToConfirm}h</strong></Text>
          <Text style={slaLine}>• Expédition : sous <strong>{hoursToShip}h</strong></Text>
          <Text style={slaFoot}>
            Au-delà, des relances automatiques seront déclenchées et la commande pourra être réattribuée.
          </Text>
        </Section>

        <Button href={ctaUrl} style={button}>
          Voir la commande dans mon portail
        </Button>

        <Text style={footerText}>
          Vous pouvez à tout moment suivre vos commandes depuis votre portail vendeur.
        </Text>

        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorNewOrderEmail,
  subject: (data: Record<string, any>) =>
    `Nouvelle commande ${data.orderNumber || ''} à traiter`.trim(),
  displayName: 'Vendeur — Nouvelle commande',
  previewData: {
    vendorName: 'Pharma Distrib',
    orderNumber: 'MK-2026-00042',
    lineCount: 3,
    vendorTotalIncVat: '1 245,00 EUR',
    hoursToConfirm: 12,
    hoursToShip: 24,
    ctaUrl: 'https://medikong.pro/vendor/commandes',
  },
} satisfies TemplateEntry

// Styles — MediKong branding (Primary Blue #1C58D9 / Navy #1E252F)
const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1E252F', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 18px' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #e5e7eb' }
const summaryLabel = { fontSize: '13px', color: '#6b7280', padding: '4px 0', verticalAlign: 'top' as const }
const summaryValue = { fontSize: '14px', color: '#1E252F', padding: '4px 0', textAlign: 'right' as const, verticalAlign: 'top' as const }
const divider = { borderColor: '#e5e7eb', margin: '12px 0' }
const slaBox = { backgroundColor: '#eff4ff', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', border: '1px solid #c7d8ff' }
const slaTitle = { fontSize: '14px', fontWeight: '600' as const, color: '#1C58D9', margin: '0 0 8px' }
const slaLine = { fontSize: '13px', color: '#1E252F', margin: '4px 0' }
const slaFoot = { fontSize: '12px', color: '#55575d', margin: '8px 0 0', fontStyle: 'italic' as const }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const footerText = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 20px' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
