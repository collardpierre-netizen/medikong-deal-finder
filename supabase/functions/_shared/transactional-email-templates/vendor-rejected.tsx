import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorRejectedProps {
  companyName?: string
  reason?: string
}

const VendorRejectedEmail = ({ companyName, reason }: VendorRejectedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Mise à jour de votre candidature {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>
          {companyName ? `${companyName}, m` : 'M'}ise à jour de votre candidature
        </Heading>
        <Text style={text}>
          Après examen de votre dossier, nous ne sommes malheureusement pas en mesure de valider votre inscription en tant que vendeur partenaire sur <strong>{SITE_NAME}</strong> pour le moment.
        </Text>
        {reason ? (
          <Text style={{ ...text, backgroundColor: '#FEF2F2', padding: '12px 16px', borderRadius: '8px', border: '1px solid #FECACA' }}>
            <strong>Motif :</strong> {reason}
          </Text>
        ) : null}
        <Text style={text}>
          Si vous pensez qu'il s'agit d'une erreur ou si votre situation a évolué, n'hésitez pas à nous contacter.
        </Text>
        <Button href="mailto:support@medikong.pro" style={button}>
          Contacter le support
        </Button>
        <Hr style={divider} />
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorRejectedEmail,
  subject: 'Mise à jour de votre candidature MediKong',
  displayName: 'Vendeur refusé',
  previewData: { companyName: 'PharmaCorp SPRL', reason: 'Documents manquants' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
