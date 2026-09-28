import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'
const SCAN_URL = 'https://medikong.pro/scan'

interface Props { pharmacyName?: string }

const ScanInvitationEmail = ({ pharmacyName }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre accès MediKong Scan est ouvert</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Bienvenue dans MediKong Scan</Heading>
        <Text style={text}>{pharmacyName ? <>L'officine <strong>{pharmacyName}</strong> fait partie du pilote MediKong Scan.</> : <>Votre officine fait partie du pilote MediKong Scan.</>} Scannez un produit, voyez en 2 secondes si MediKong fait mieux que vos grossistes.</Text>
        <Text style={step}><strong>1.</strong> Ouvrez ce lien sur votre iPhone : <a href={SCAN_URL} style={link}>medikong.pro/scan</a></Text>
        <Text style={step}><strong>2.</strong> Dans Safari, touchez <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong>.</Text>
        <Text style={step}><strong>3.</strong> Ouvrez MediKong Scan, saisissez votre e-mail et connectez-vous avec le code reçu.</Text>
        <Button href={SCAN_URL} style={button}>Ouvrir MediKong Scan</Button>
        <Hr style={divider} />
        <Text style={footer}>Une question ? Écrivez-nous à pcoll@medikong.pro.</Text>
        <Text style={footer}>© MediKong SRL</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ScanInvitationEmail,
  subject: 'Votre accès MediKong Scan est ouvert',
  displayName: 'Invitation MediKong Scan',
  previewData: { pharmacyName: 'Pharmacie Test' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1E252F', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3b4a5a', lineHeight: '1.6', margin: '0 0 20px' }
const step = { fontSize: '15px', color: '#1E252F', lineHeight: '1.6', margin: '0 0 12px' }
const link = { color: '#1C58D9' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', margin: '12px 0 24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0 0 6px' }
