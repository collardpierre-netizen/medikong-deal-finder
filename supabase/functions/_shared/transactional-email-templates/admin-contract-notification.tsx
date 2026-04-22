import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface AdminContractNotificationProps {
  vendorCompanyName?: string
  vendorEmail?: string
  signerName?: string
  signedAtFormatted?: string
  contractVersion?: string
}

const AdminContractNotificationEmail = ({
  vendorCompanyName,
  vendorEmail,
  signerName,
  signedAtFormatted,
  contractVersion,
}: AdminContractNotificationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau mandat de facturation signé par un vendeur</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="160" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>📄 Nouveau mandat signé</Heading>

        <Text style={text}>
          Un vendeur vient de signer la convention de mandat de facturation.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}>
            <strong>Société :</strong> {vendorCompanyName || '—'}
          </Text>
          <Text style={infoLine}>
            <strong>Signataire :</strong> {signerName || '—'}
          </Text>
          {vendorEmail ? (
            <Text style={infoLine}><strong>Email :</strong> {vendorEmail}</Text>
          ) : null}
          {signedAtFormatted ? (
            <Text style={infoLine}><strong>Signé le :</strong> {signedAtFormatted}</Text>
          ) : null}
          {contractVersion ? (
            <Text style={infoLine}><strong>Version :</strong> {contractVersion}</Text>
          ) : null}
        </Section>

        <Text style={text}>
          Le PDF signé, le hash SHA-256 du document, le user-agent et l'horodatage
          ont été enregistrés dans <code style={code}>seller_contracts</code>. Le
          vendeur peut désormais publier ses offres et recevoir des commandes.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          Notification automatique — {SITE_NAME} Admin
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminContractNotificationEmail,
  subject: ((data: Record<string, any>) =>
    `📄 Nouveau mandat signé — ${data.vendorCompanyName || 'Vendeur'}`),
  displayName: 'Admin — Mandat signé',
  to: 'admin@medikong.pro',
  previewData: {
    vendorCompanyName: 'PharmaCorp SRL',
    vendorEmail: 'jean@pharmacorp.be',
    signerName: 'Jean Dupont',
    signedAtFormatted: '22/04/2026 14:32',
    contractVersion: 'v1.0',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '20px' }
const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  margin: '0 0 16px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 14px' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '16px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const code = {
  fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
  fontSize: '12px',
  backgroundColor: '#eef2f7',
  padding: '1px 5px',
  borderRadius: '3px',
}
const divider = { borderColor: '#d1d5db', margin: '20px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
