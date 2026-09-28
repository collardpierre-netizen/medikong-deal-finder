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

import { OTP_LENGTH } from '../otp.ts'

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
    <Preview>{token ? `Votre code de connexion MediKong : ${token}` : 'Votre connexion MediKong'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt="MediKong" width="180" style={logo} />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Votre code de connexion</Heading>
        {token ? (
          <Section style={codeSection}>
            <Text style={codeValue}>{token}</Text>
            <Text style={codeLabel}>Saisissez ce code à {OTP_LENGTH} chiffres dans MediKong Scan ou sur medikong.pro.</Text>
          </Section>
        ) : null}
        <Text style={text}>ou cliquez ici depuis votre ordinateur :</Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Se connecter à MediKong
          </Button>
        </Section>
        <Hr style={divider} />
        <Text style={footer}>
          Ce code et ce lien expirent rapidement. Si vous n'avez rien demandé, ignorez cet e-mail.
        </Text>
        <Text style={footerBrand}>© MediKong SRL</Text>
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
  color: '#1E252F',
  margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = {
  textAlign: 'center' as const,
  fontSize: '14px',
  color: '#3b4a5a',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#1C58D9',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '20px 0 4px' }
const footerBrand = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const codeSection = { textAlign: 'center' as const, margin: '8px 0 24px', backgroundColor: '#EEF3FD', borderRadius: '12px', padding: '20px 12px' }
const codeLabel = { fontSize: '13px', color: '#3b4a5a', margin: '10px 0 0' }
const codeValue = {
  fontSize: '40px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#1E252F',
  margin: '0',
  fontFamily: "'DM Sans', Arial, sans-serif",
}
