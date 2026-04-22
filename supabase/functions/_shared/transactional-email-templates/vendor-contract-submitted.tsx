import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorContractSubmittedProps {
  vendorCompanyName?: string
  signerName?: string
  contractVersion?: string
  contractUrl?: string
  missingFields?: string[]
}

const VendorContractSubmittedEmail = ({
  vendorCompanyName,
  signerName,
  contractVersion,
  contractUrl,
  missingFields = [],
}: VendorContractSubmittedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Action requise — Signez votre convention de mandat de facturation</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>📝 Convention prête à signer</Heading>

        <Text style={text}>
          Bonjour{signerName ? ` ${signerName}` : ''},
        </Text>

        <Text style={text}>
          Bienvenue sur {SITE_NAME} ! Votre profil vendeur{vendorCompanyName ? <> pour <strong>{vendorCompanyName}</strong></> : ''} est désormais
          actif. Avant votre première vente, vous devez signer la <strong>Convention
          de mandat de facturation</strong>.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}>
            <strong>Document :</strong> Convention de mandat de facturation
          </Text>
          {contractVersion ? (
            <Text style={infoLine}><strong>Version :</strong> {contractVersion}</Text>
          ) : null}
          <Text style={infoLine}>
            <strong>Base légale :</strong> article 53 §2 du Code TVA belge
          </Text>
          <Text style={infoLine}>
            <strong>Durée :</strong> indéterminée — résiliable à tout moment (préavis 30 jours)
          </Text>
          <Text style={infoLine}>
            <strong>Coût :</strong> gratuit (aucun frais de signature)
          </Text>
        </Section>

        <Text style={text}>
          Cette convention autorise {SITE_NAME} à émettre des factures de vente
          en votre nom et pour votre compte (self-billing). C'est une étape
          <strong> obligatoire </strong> pour activer vos offres.
        </Text>

        {missingFields && missingFields.length > 0 ? (
          <Section style={warnBox}>
            <Text style={warnTitle}>⚠️ Profil entreprise incomplet</Text>
            <Text style={warnText}>
              Avant de pouvoir signer, complétez les informations suivantes
              dans votre portail vendeur :
            </Text>
            <ul style={warnList}>
              {missingFields.map((f, i) => (
                <li key={i} style={warnItem}>{f}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {contractUrl ? (
          <Button href={contractUrl} style={button}>
            Accéder au document et signer
          </Button>
        ) : null}

        <Text style={small}>
          La signature électronique prend moins de 2 minutes. Vous recevrez une
          copie PDF par email immédiatement après.
        </Text>

        <Hr style={divider} />

        <Text style={footerText}>
          Une question ? Contactez{' '}
          <a href="mailto:vendeurs@medikong.pro" style={link}>vendeurs@medikong.pro</a>
          {' '}ou consultez notre centre d'aide vendeurs.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong by Balooh SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Ath, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorContractSubmittedEmail,
  subject: '📝 Action requise — Signez votre convention de facturation MediKong',
  displayName: 'Vendeur — Convention à signer (soumission)',
  previewData: {
    vendorCompanyName: 'PharmaCorp SRL',
    signerName: 'Jean Dupont',
    contractVersion: 'v1.0',
    contractUrl: 'https://medikong.pro/vendor/contract',
    missingFields: [],
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
const warnBox = {
  backgroundColor: '#fffbeb',
  borderLeft: '3px solid #f59e0b',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const warnTitle = {
  fontSize: '14px',
  fontWeight: '700' as const,
  color: '#92400e',
  margin: '0 0 6px',
}
const warnText = { fontSize: '13px', color: '#78350f', margin: '0 0 8px', lineHeight: '1.5' }
const warnList = { margin: '0', paddingLeft: '20px' }
const warnItem = { fontSize: '13px', color: '#78350f', lineHeight: '1.6' }
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
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
