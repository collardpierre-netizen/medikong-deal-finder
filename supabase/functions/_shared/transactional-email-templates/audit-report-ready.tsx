import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface AuditReportReadyProps {
  firstName?: string
  pharmacyName?: string
  reportUrl?: string
  economiesMin?: number
  economiesMax?: number
}

const fmtEur = (n?: number) =>
  typeof n === 'number' && isFinite(n)
    ? new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : null

const AuditReportReadyEmail = ({
  firstName = '',
  pharmacyName = 'votre pharmacie',
  reportUrl = '#',
  economiesMin,
  economiesMax,
}: AuditReportReadyProps) => {
  const min = fmtEur(economiesMin)
  const max = fmtEur(economiesMax)
  const range = min && max ? `${min} – ${max}` : min || max || null
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre rapport d'audit MediKong est prêt</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>
            {firstName ? `${firstName}, votre rapport est prêt` : 'Votre rapport est prêt'}
          </Heading>
          <Text style={text}>
            Nous avons terminé l'analyse de vos achats pour <strong>{pharmacyName}</strong>.
          </Text>
          {range && (
            <Text style={highlight}>
              Économies estimées : <strong>{range} / an</strong>
            </Text>
          )}
          <Button href={reportUrl} style={button}>
            Télécharger mon rapport
          </Button>
          <Text style={{ ...text, marginTop: '24px' }}>
            Le rapport contient le détail produit par produit, les sources alternatives
            identifiées et nos recommandations de sourcing personnalisées.
          </Text>
          <Hr style={divider} />
          <Text style={footer}>
            Une question ? Répondez à cet email ou écrivez-nous à pcoll@medikong.pro<br />
            {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AuditReportReadyEmail,
  subject: (data: Record<string, any>) =>
    `Votre rapport d'audit MediKong est prêt${data.pharmacyName ? ` — ${data.pharmacyName}` : ''}`,
  displayName: 'Audit — rapport prêt',
  previewData: {
    firstName: 'Marie',
    pharmacyName: 'Pharmacie Centrale',
    reportUrl: 'https://example.com/report.pdf',
    economiesMin: 8000,
    economiesMax: 14000,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const highlight = { fontSize: '16px', color: '#0F766E', backgroundColor: '#ECFDF5', padding: '12px 16px', borderRadius: '8px', margin: '0 0 20px', border: '1px solid #A7F3D0' }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
