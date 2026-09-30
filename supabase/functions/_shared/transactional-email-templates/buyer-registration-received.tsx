import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props { companyName?: string }

const Email = ({ companyName }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre inscription sur {SITE_NAME} a bien été reçue</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Inscription bien reçue</Heading>
        <Text style={text}>Bonjour{companyName ? ` ${companyName}` : ''},</Text>
        <Text style={text}>
          Merci pour votre inscription sur {SITE_NAME}. Notre équipe vérifie actuellement vos informations professionnelles.
        </Text>
        <Text style={text}>
          Vous recevrez un email dès que votre compte sera validé : vous pourrez alors voir les prix et passer commande.
        </Text>
        <Hr style={divider} />
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Votre inscription MediKong a bien été reçue',
  displayName: 'Inscription reçue (acheteur)',
  previewData: { companyName: 'Pharmacie du Parc' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#1E252F', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1D2530', lineHeight: '1.6', margin: '0 0 12px' }
const divider = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#8B95A5' }
