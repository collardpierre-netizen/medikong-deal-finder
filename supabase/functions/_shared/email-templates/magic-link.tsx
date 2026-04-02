/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de connexion Medikong</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt="Medikong" width="180" style={logo} />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Votre code de connexion</Heading>
        <Text style={text}>
          Utilisez le code ci-dessous pour poursuivre votre connexion à {siteName}. Il expirera sous peu.
        </Text>
        {token ? <Text style={codeStyle}>{token}</Text> : null}
        <Text style={helperText}>
          Saisissez ce code dans l'écran de vérification affiché sur MediKong.
        </Text>
        <Section style={buttonSection}>
          <Button style={secondaryButton} href={confirmationUrl}>
            Ouvrir sur cet appareil
          </Button>
        </Section>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'avez pas demandé ce code, vous pouvez ignorer cet e-mail.
        </Text>
        <Text style={footerBrand}>© Medikong — Balooh SRL</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '520px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '16px' }
const logo = { margin: '0 auto', width: '180px', height: 'auto', maxWidth: '100%', display: 'block' as const }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1e3a5f',
  margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = {
  fontSize: '14px',
  color: '#3b4a5a',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#1e3a5f',
  textAlign: 'center' as const,
  margin: '0 0 12px',
  letterSpacing: '6px',
}
const helperText = {
  fontSize: '13px',
  color: '#3b4a5a',
  lineHeight: '1.6',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const secondaryButton = {
  backgroundColor: '#eff6ff',
  color: '#2563eb',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 28px',
  textDecoration: 'none',
  border: '1px solid #bfdbfe',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '20px 0 4px' }
const footerBrand = { fontSize: '11px', color: '#9ca3af', margin: '0' }
