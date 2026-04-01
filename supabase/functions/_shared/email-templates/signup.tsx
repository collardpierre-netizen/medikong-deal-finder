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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse e-mail pour Medikong</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt="Medikong" width="180" style={logo} />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Confirmez votre adresse e-mail</Heading>
        <Text style={text}>
          Merci de vous être inscrit sur{' '}
          <Link href={siteUrl} style={link}>
            <strong>Medikong</strong>
          </Link>
          , votre marketplace B2B pharmaceutique.
        </Text>
        <Text style={text}>
          Veuillez confirmer votre adresse e-mail (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) en cliquant sur le bouton ci-dessous :
        </Text>
        {token ? (
          <>
            <Text style={text}>Votre code de vérification à 6 chiffres :</Text>
            <Text style={otpCode}>{token}</Text>
            <Text style={textSmall}>
              Saisissez ce code dans l'application pour continuer votre inscription.
            </Text>
          </>
        ) : null}
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Vérifier mon e-mail
          </Button>
        </Section>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.
        </Text>
        <Text style={footerBrand}>© Medikong — Balooh SRL</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#2563eb', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 28px',
  textDecoration: 'none',
}
const otpCode = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#1e3a5f',
  textAlign: 'center' as const,
  margin: '0 0 12px',
}
const textSmall = {
  fontSize: '12px',
  color: '#6b7280',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '20px 0 4px' }
const footerBrand = { fontSize: '11px', color: '#9ca3af', margin: '0' }
