import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorApplicationProps {
  companyName?: string
  email?: string
  phone?: string
  businessType?: string
  country?: string
}

const VendorApplicationEmail = ({
  companyName = 'Société Test',
  email = 'test@example.com',
  phone = '+32 470 000 000',
  businessType = 'distributor',
  country = 'Belgique',
}: VendorApplicationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>🆕 Nouvelle candidature vendeur : {companyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Nouvelle candidature vendeur</Heading>
        <Text style={text}>
          Un nouveau vendeur vient de s'inscrire sur {SITE_NAME} et attend votre validation.
        </Text>
        <Section style={summaryBox}>
          <Row><Column style={label}>Société</Column><Column style={value}>{companyName}</Column></Row>
          <Row><Column style={label}>Email</Column><Column style={value}>{email}</Column></Row>
          <Row><Column style={label}>Téléphone</Column><Column style={value}>{phone || '—'}</Column></Row>
          <Row><Column style={label}>Type</Column><Column style={value}>{businessType}</Column></Row>
          <Row><Column style={label}>Pays</Column><Column style={value}>{country}</Column></Row>
        </Section>
        <Button href="https://medikong.pro/admin/vendeurs" style={button}>
          Voir dans l'admin
        </Button>
        <Hr style={divider} />
        <Text style={footer}>Notification automatique — {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorApplicationEmail,
  subject: (data: Record<string, any>) => `🆕 Candidature vendeur : ${data.companyName || 'Nouveau vendeur'}`,
  displayName: 'Candidature vendeur (admin)',
  previewData: { companyName: 'PharmaCorp SPRL', email: 'info@pharmacorp.be', phone: '+32 2 123 45 67', businessType: 'distributor', country: 'Belgique' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #d1d5db' }
const label = { fontSize: '12px', color: '#6b7280', padding: '6px 0', verticalAlign: 'top' as const, width: '100px' }
const value = { fontSize: '13px', color: '#1e3a5f', padding: '6px 0', fontWeight: '600' as const, textAlign: 'right' as const, verticalAlign: 'top' as const }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
