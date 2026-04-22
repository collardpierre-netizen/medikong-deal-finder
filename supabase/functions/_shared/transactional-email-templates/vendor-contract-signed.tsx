import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorContractSignedProps {
  vendorCompanyName?: string
  signerName?: string
  signedAtFormatted?: string
  contractVersion?: string
  downloadUrl?: string | null
}

const VendorContractSignedEmail = ({
  vendorCompanyName,
  signerName,
  signedAtFormatted,
  contractVersion,
  downloadUrl,
}: VendorContractSignedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre convention de mandat de facturation a bien été signée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>Convention signée avec succès ✅</Heading>

        <Text style={text}>
          Bonjour{signerName ? ` ${signerName}` : ''},
        </Text>

        <Text style={text}>
          Nous confirmons la bonne signature de la <strong>Convention de mandat de
          facturation</strong> entre {vendorCompanyName ? <strong>{vendorCompanyName}</strong> : 'votre société'} et {SITE_NAME}.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}>
            <strong>Document :</strong> Convention de mandat de facturation
          </Text>
          {contractVersion ? (
            <Text style={infoLine}><strong>Version :</strong> {contractVersion}</Text>
          ) : null}
          {signedAtFormatted ? (
            <Text style={infoLine}><strong>Date & heure :</strong> {signedAtFormatted}</Text>
          ) : null}
          <Text style={infoLine}>
            <strong>Base légale :</strong> article 53 §2 du Code TVA belge
          </Text>
        </Section>

        <Text style={text}>
          À partir de cet instant, {SITE_NAME} est autorisé à émettre des factures
          en votre nom et pour votre compte pour toutes les ventes réalisées via
          la marketplace. Votre compte vendeur peut désormais publier des offres
          et recevoir des commandes.
        </Text>

        {downloadUrl ? (
          <>
            <Button href={downloadUrl} style={button}>
              Télécharger mon exemplaire PDF
            </Button>
            <Text style={small}>
              Le lien de téléchargement est valable 1 heure. Vous pouvez à tout
              moment retrouver votre convention depuis votre portail vendeur.
            </Text>
          </>
        ) : (
          <Text style={small}>
            Vous pouvez retrouver votre convention à tout moment depuis votre
            portail vendeur, rubrique « Convention de facturation ».
          </Text>
        )}

        <Hr style={divider} />

        <Text style={footerText}>
          Conservez précieusement ce document : il a valeur de preuve juridique
          (eIDAS n°910/2014). Pour toute question comptable ou TVA, contactez
          <span> </span>
          <a href="mailto:facturation@medikong.pro" style={link}>facturation@medikong.pro</a>.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorContractSignedEmail,
  subject: '✅ Convention de mandat de facturation signée',
  displayName: 'Vendeur — Convention signée',
  previewData: {
    vendorCompanyName: 'PharmaCorp SRL',
    signerName: 'Jean Dupont',
    signedAtFormatted: '22/04/2026 14:32',
    contractVersion: 'v1.0',
    downloadUrl: 'https://example.com/contract.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '12px 0 0' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const button = {
  backgroundColor: '#1B5BDA',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '14px 32px',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '8px',
  marginBottom: '8px',
}
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.5' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
