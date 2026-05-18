import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface AuditConfirmationProps {
  firstName?: string
  lastName?: string
  pharmacyName?: string
  filesCount?: number
}

const AuditConfirmationEmail = ({
  firstName = '',
  pharmacyName = 'votre pharmacie',
  filesCount = 1,
}: AuditConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre demande d'audit est bien reçue — rapport sous 48h</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>
          {firstName ? `Merci ${firstName} !` : 'Merci !'}
        </Heading>
        <Text style={text}>
          Nous avons bien reçu votre demande d'audit pour <strong>{pharmacyName}</strong>{' '}
          ({filesCount} fichier{filesCount > 1 ? 's' : ''} transmis).
        </Text>
        <Text style={text}>
          Notre équipe analyse vos achats et benchmark vos produits face à notre catalogue
          de plus de 450 000 offres. Vous recevrez votre <strong>rapport personnalisé sous
          48h ouvrées</strong> à cette adresse email.
        </Text>
        <Text style={text}>
          En attendant, vous pouvez explorer notre catalogue ou suivre MediKong pour les
          insights du marché pharma.
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          Pour toute question : pcoll@medikong.pro<br />
          {SITE_NAME} — Audit gratuit, sans engagement
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AuditConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Votre audit MediKong arrive sous 48h${data.pharmacyName ? ` — ${data.pharmacyName}` : ''}`,
  displayName: 'Audit — confirmation pharmacien',
  previewData: { firstName: 'Marie', lastName: 'Dupont', pharmacyName: 'Pharmacie Centrale', filesCount: 2 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
