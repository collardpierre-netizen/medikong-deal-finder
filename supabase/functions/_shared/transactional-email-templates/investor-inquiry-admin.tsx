import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { INVESTOR_NOTIFICATION_EMAIL } from '../investor-config.ts'

interface InvestorInquiryAdminProps {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  investorType?: string
  amountRange?: string
  message?: string
  submittedAt?: string
}

const InvestorInquiryAdminEmail = ({
  firstName = '',
  lastName = '',
  email = '',
  phone = '',
  company = '',
  investorType = '',
  amountRange = '',
  message = '',
  submittedAt = '',
}: InvestorInquiryAdminProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>[Invest] Nouvelle demande d'informations : {`${firstName} ${lastName}`.trim()}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouvelle demande investisseur</Heading>
        <Section style={box}>
          <Row><Column style={label}>Nom</Column><Column style={value}>{`${firstName} ${lastName}`.trim() || '—'}</Column></Row>
          <Row><Column style={label}>Email</Column><Column style={value}>{email || '—'}</Column></Row>
          <Row><Column style={label}>Téléphone</Column><Column style={value}>{phone || '—'}</Column></Row>
          <Row><Column style={label}>Société</Column><Column style={value}>{company || '—'}</Column></Row>
          <Row><Column style={label}>Profil</Column><Column style={value}>{investorType || '—'}</Column></Row>
          <Row><Column style={label}>Montant envisagé</Column><Column style={value}>{amountRange || '—'}</Column></Row>
          <Row><Column style={label}>Reçue le</Column><Column style={value}>{submittedAt || '—'}</Column></Row>
        </Section>
        {message && (
          <Section style={{ marginBottom: '20px' }}>
            <Text style={{ ...text, fontWeight: 600, marginBottom: '4px' }}>Message :</Text>
            <Text style={text}>{message}</Text>
          </Section>
        )}
        <Hr style={divider} />
        <Text style={footer}>Notification automatique — MediKong</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvestorInquiryAdminEmail,
  subject: (data: Record<string, any>) =>
    `[Invest] Demande d'informations : ${[data.firstName, data.lastName].filter(Boolean).join(' ') || 'investisseur'}`,
  to: INVESTOR_NOTIFICATION_EMAIL,
  displayName: 'Invest — nouvelle demande investisseur',
  previewData: {
    firstName: 'Jean',
    lastName: 'Martin',
    email: 'jean.martin@example.be',
    phone: '+32 470 00 00 00',
    company: 'Martin Invest SRL',
    investorType: 'Personne physique',
    amountRange: '5 000 € – 25 000 €',
    message: 'Intéressé par le Tax Shelter, merci de m\'envoyer le deck.',
    submittedAt: '22/09/2026 11:04',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '13px', color: '#55575d', lineHeight: '1.5', margin: '0 0 12px' }
const box = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', marginBottom: '20px', border: '1px solid #d1d5db' }
const label = { fontSize: '12px', color: '#6b7280', width: '40%' as const }
const value = { fontSize: '13px', color: '#1e252f', fontWeight: 600 as const }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af' }
