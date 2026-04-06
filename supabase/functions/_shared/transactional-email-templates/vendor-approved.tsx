import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorApprovedProps {
  companyName?: string
}

const VendorApprovedEmail = ({ companyName }: VendorApprovedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>✅ Votre candidature {SITE_NAME} est approuvée !</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Félicitations{companyName ? `, ${companyName}` : ''} !</Heading>
        <Text style={text}>
          Votre candidature en tant que vendeur partenaire sur <strong>{SITE_NAME}</strong> a été <strong style={{ color: '#059669' }}>approuvée</strong>.
        </Text>
        <Text style={text}>
          Vous pouvez maintenant accéder à votre portail vendeur pour configurer votre catalogue, vos prix et vos paramètres de livraison.
        </Text>
        <Button href="https://www.medikong.pro/vendor/login" style={button}>
          Accéder à mon portail vendeur
        </Button>
        <Hr style={divider} />
        <Text style={footerText}>
          Des questions ? Contactez notre équipe à support@medikong.pro
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorApprovedEmail,
  subject: '✅ Votre candidature MediKong est approuvée !',
  displayName: 'Vendeur approuvé',
  previewData: { companyName: 'PharmaCorp SPRL' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#059669', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
