import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Row, Column, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AuditNewLeadProps {
  auditId?: string
  pharmacyName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  city?: string
  country?: string
  filesCount?: number
  files?: { name: string; url: string }[]
  notes?: string
}

const AuditNewLeadEmail = ({
  auditId = '',
  pharmacyName = 'Pharmacie',
  contactName = '',
  contactEmail = '',
  contactPhone = '',
  city = '',
  country = '',
  filesCount = 0,
  files = [],
  notes = '',
}: AuditNewLeadProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>[Lead] Nouvelle demande d'audit : {pharmacyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouveau lead d'audit</Heading>
        <Section style={summaryBox}>
          <Row><Column style={label}>Pharmacie</Column><Column style={value}>{pharmacyName}</Column></Row>
          <Row><Column style={label}>Contact</Column><Column style={value}>{contactName}</Column></Row>
          <Row><Column style={label}>Email</Column><Column style={value}>{contactEmail}</Column></Row>
          <Row><Column style={label}>Téléphone</Column><Column style={value}>{contactPhone || '—'}</Column></Row>
          <Row><Column style={label}>Ville</Column><Column style={value}>{[city, country].filter(Boolean).join(', ') || '—'}</Column></Row>
          <Row><Column style={label}>Fichiers</Column><Column style={value}>{filesCount}</Column></Row>
        </Section>

        {files.length > 0 && (
          <Section style={{ marginBottom: '20px' }}>
            <Text style={{ ...text, fontWeight: 600, marginBottom: '8px' }}>
              Téléchargement (liens valides 24h) :
            </Text>
            {files.map((f, i) => (
              <Text key={i} style={{ ...text, margin: '4px 0' }}>
                <Link href={f.url} style={linkStyle}>{f.name}</Link>
              </Text>
            ))}
          </Section>
        )}

        {notes && (
          <Section style={{ marginBottom: '20px' }}>
            <Text style={{ ...text, fontWeight: 600, marginBottom: '4px' }}>Notes du pharmacien :</Text>
            <Text style={text}>{notes}</Text>
          </Section>
        )}

        <Button href={`https://medikong.pro/admin/audits?id=${auditId}`} style={button}>
          Voir dans admin
        </Button>
        <Hr style={divider} />
        <Text style={footer}>Notification automatique — MediKong</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AuditNewLeadEmail,
  subject: (data: Record<string, any>) =>
    `[Lead] Nouvelle demande d'audit : ${data.pharmacyName || 'Pharmacie'}`,
  to: 'pit@medikong.pro',
  displayName: 'Audit — notification nouveau lead',
  previewData: {
    auditId: 'demo-uuid',
    pharmacyName: 'Pharmacie Centrale',
    contactName: 'Marie Dupont',
    contactEmail: 'marie@pharmacie.be',
    contactPhone: '+32 470 00 00 00',
    city: 'Bruxelles',
    country: 'BE',
    filesCount: 2,
    files: [{ name: 'facture-jan.pdf', url: 'https://example.com/x' }],
    notes: 'Nous achetons surtout chez Febelco.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '13px', color: '#55575d', lineHeight: '1.5', margin: '0 0 12px' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', marginBottom: '20px', border: '1px solid #d1d5db' }
const label = { fontSize: '12px', color: '#6b7280', padding: '6px 0', verticalAlign: 'top' as const, width: '100px' }
const value = { fontSize: '13px', color: '#1e3a5f', padding: '6px 0', fontWeight: '600' as const, verticalAlign: 'top' as const }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const linkStyle = { color: '#1e3a5f', textDecoration: 'underline' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
