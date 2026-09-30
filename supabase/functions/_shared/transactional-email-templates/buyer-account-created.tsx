import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'
const FORGOT_URL = 'https://medikong.pro/forgot-password'

interface Props {
  companyName?: string
  email?: string
  setPasswordUrl?: string
  verified?: boolean
}

const BuyerAccountCreatedEmail = ({ companyName, email, setPasswordUrl, verified }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre compte {SITE_NAME} a été créé — choisissez votre mot de passe</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Bienvenue{companyName ? `, ${companyName}` : ''} !</Heading>
        <Text style={text}>
          Un compte acheteur a été créé pour vous sur <strong>{SITE_NAME}</strong>
          {email ? <> avec l'adresse <strong>{email}</strong></> : null}.
        </Text>
        <Text style={text}>
          {verified
            ? 'Votre compte est déjà validé : dès votre mot de passe choisi, vous aurez accès aux prix professionnels HTVA et à la commande en ligne.'
            : 'Notre équipe va valider votre compte ; vous recevrez un email dès que les prix professionnels seront accessibles.'}
        </Text>
        <Text style={text}>Pour activer votre accès, choisissez votre mot de passe :</Text>
        {setPasswordUrl ? (
          <Button href={setPasswordUrl} style={button}>Choisir mon mot de passe</Button>
        ) : null}
        <Text style={small}>
          Ce lien est personnel et expire rapidement. S'il ne fonctionne plus, utilisez{' '}
          <Link href={FORGOT_URL} style={link}>« Mot de passe oublié »</Link> avec votre adresse email.
        </Text>
        <Hr style={divider} />
        <Text style={footerText}>Des questions ? Contactez notre équipe à support@medikong.pro</Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BuyerAccountCreatedEmail,
  subject: 'Votre compte MediKong a été créé',
  displayName: 'Compte acheteur créé par l\'admin',
  previewData: {
    companyName: 'Pharmacie du Centre',
    email: 'contact@pharmacie-centre.be',
    setPasswordUrl: 'https://medikong.pro/reset-password',
    verified: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1E252F', margin: '0 0 20px', fontFamily: "'Bricolage Grotesque', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px' }
const link = { color: '#1C58D9' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', margin: '4px 0 20px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
